#!/usr/bin/env python3
"""Index the public article titles/URLs of the 改良メダカWEB図鑑 archive, not images or descriptions."""
import json,re,time,requests
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin,urlparse
from urllib.robotparser import RobotFileParser
ROOT='https://medakazukan.net'
BASE=ROOT+'/category/variety/'
PATH=Path('catalog.json')
AGENT='MyMedakaCollectionIndex/1.0 (personal catalog of public article titles)'
NUMBER=re.compile(r'改良メダカ\s*WEB\s*図鑑\s*No[.．：:\s]*(\d{1,4})',re.I)
PREFIX=('メダカの品種 ','白朱赤 ','ブラック ','朱赤 ','黄金 ','青 ','白 ','オレンジ ','ピンク ','黄 ','琥珀 ','茶 ','斑 ','幹之 ','体外光 ','ヒカリ ','赤 ')
TOKENS=('リアルロングフィン','ロングフィン','半透明鱗','透明鱗','ブラックリム','ワイドフィン','体外光','体内光','ラメ','ヒレ長','スワロー','ダルマ','ヒカリ','三色','紅白','オーロラ','アルビノ','サファイア','黒','青','白','朱赤','ピンク','黄金','琥珀','オレンジ','黄','出目','パンダ')
def extract(html):
    out={}
    for a in BeautifulSoup(html,'html.parser').select('a[href]'):
        url=urljoin(ROOT,a['href'].split('#')[0])
        parsed=urlparse(url)
        if parsed.hostname!='medakazukan.net' or not re.match(r'^/\d{4}_[^/]+/?$',parsed.path):continue
        title=a.get_text(' ',strip=True)
        match=NUMBER.search(title)
        if not match or 'とは' not in title[:match.start()]:continue
        title=title[:match.start()].split('とは')[0].strip()
        for p in PREFIX:
            if title.startswith(p):
                title=title[len(p):].strip()
                break
        original=title
        title=re.sub(r'（[^）]+）$','',title).strip()
        number=match.group(1).zfill(4)
        if not 1<=len(title)<=75 or number!=parsed.path[1:5]:continue
        out[number]=dict(name=title,aliases=original[len(title)+1:-1] if original!=title else '',
            traits='、'.join(t for t in TOKENS if t in title),
            kind='WEB図鑑掲載名（区分は要確認）',description='詳しい系統や特徴は出典記事をご確認ください。',
            url=url,webNo=number)
    return out
def main():
    robot=RobotFileParser(ROOT+'/robots.txt')
    robot.read()
    if not robot.can_fetch(AGENT,BASE):raise RuntimeError('robots.txt does not permit this archive')
    session=requests.Session()
    session.headers.update({'User-Agent':AGENT,'Accept-Language':'ja,en;q=0.8'})
    found={}
    for page in range(1,54):
        url=BASE if page==1 else f'{BASE}page/{page}/'
        if not robot.can_fetch(AGENT,url):raise RuntimeError('robots.txt denies '+url)
        resp=session.get(url,timeout=25)
        if resp.status_code==404:break
        resp.raise_for_status()
        batch=extract(resp.text)
        if not batch:break
        found.update(batch)
        print(f'Page {page}: {len(batch)} / {len(found)}',flush=True)
        time.sleep(1.2)
    if len(found)<500:raise RuntimeError(f'Only {len(found)} items found; preserving original catalog')
    existing=json.loads(PATH.read_text(encoding='utf-8'))
    byname={}
    for x in found.values():byname.setdefault(x['name'].casefold(),x)
    used=set()
    for old in existing:
        new=byname.get(str(old.get('name','')).casefold())
        if new:
            if str(old.get('url',old.get('source',''))).rstrip('/') in ('','https://medakazukan.net/varietyofmedaka'):
                old['url']=new['url']
            old['webNo']=new['webNo']
            if not old.get('aliases'):old['aliases']=new['aliases']
            used.add(new['webNo'])
    names={str(x.get('name','')).casefold() for x in existing}
    for num,entry in sorted(found.items(),key=lambda e:int(e[0])):
        if num in used:continue
        if entry['name'].casefold() in names:
            entry=dict(entry)
            entry['name']+=f'（図鑑No.{num}）'
        existing.append(entry)
        names.add(entry['name'].casefold())
    PATH.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Indexed {len(found)} source articles; total catalog {len(existing)}')
if __name__=='__main__':main()
