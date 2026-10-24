#!/usr/bin/env python3
"""Extract factual appearance attributes from public variety archive excerpts.

No pictures, original article text, or remotely hosted image URLs are copied.
Generated profiles use structured facts only and link to the original source.
"""
import json,re,time,requests
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin,urlparse
from urllib.robotparser import RobotFileParser

ROOT='https://medakazukan.net'
BASE=ROOT+'/category/variety/'
AGENT='MyMedakaCollectionIndex/1.0 (personal catalog of factual metadata)'
DATA=Path('catalog.json')
NUMBER=re.compile(r'改良メダカ\s*WEB\s*図鑑\s*No[.．：:\s]*(\d{1,4})',re.I)
FEATURES=(
    'リアルロングフィン','半透明鱗','透明鱗','ブラックリム','ロングフィン',
    'ヒレライン','フサヒレ','体外光','体内光','腹膜青','ルビーアイ',
    'シースルー','モルフォ','ラメ','斑','ヒレ長','ヒカリ体型','ヒカリ',
    'アルビノ','オーロラ','ダルマ','スワロー','サムライ','スモールアイ',
    '出目','パンダ','背地反応なし','体内黒','マリアージュ'
)
COLORS=(
    ('白と朱赤','白・朱赤'),('白と赤','白・赤'),('黄色と黒','黄・黒'),
    ('黄と黒','黄・黒'),('黄と青','黄・青'),('黒と朱赤','黒・朱赤'),
    ('黒と白','黒・白'),('琥珀体色','琥珀'),('ブラック体色','黒'),
    ('黒体色','黒'),('黒色','黒'),('朱赤体色','朱赤'),('朱赤色','朱赤'),
    ('オレンジ体色','オレンジ'),('黄金体色','黄金'),('白体色','白'),
    ('青体色','青'),('黄色','黄'),('黄体色','黄'),('ピンク体色','ピンク'),
    ('茶体色','茶'),('白と黒','白・黒')
)
def factual_profile(text):
    if '概要' not in text:return None
    part=text.split('概要',1)[1].strip()
    part=part.split('品種名・通称',1)[0]
    part=part.split('形質補足',1)[0]
    part=part[:240]
    # Only the overview's first sentence, to avoid accidentally including sidebar/related articles.
    first=re.split(r'[。！？]|\.\.\.|…',part,1)[0].strip()
    if not 7<=len(first)<=180:return None
    color_sentence=first.replace('黒色素胞','').replace('黒色素が少ない','')
    color=next((out for needle,out in COLORS if needle in color_sentence),'')
    if not color and ('青メダカ' in first or '青系' in first):color='青'
    features=[]
    for tok in FEATURES:
        if tok in first:
            if tok=='透明鱗' and '半透明鱗' in first:continue
            if tok=='ロングフィン' and 'リアルロングフィン' in first:continue
            if tok=='ヒカリ' and ('ヒカリ体型' in first or 'ヒカリ' not in first):continue
            features.append(tok)
    if not color and not features:
        return None
    desc=[]
    if color:desc.append('体色の特徴は'+color+'系')
    if features:desc.append('注目したい形質は'+ '・'.join(features[:8]))
    desc='。'.join(desc)+'。'
    return {'profile':desc,'profileBasis':'WEB図鑑の記事概要から抽出した外見上の特徴'}
def archive_page(html):
    soup=BeautifulSoup(html,'html.parser')
    found={}
    for a in soup.select('a[href]'):
        url=urljoin(ROOT,a.get('href','').split('#')[0])
        parsed=urlparse(url)
        if parsed.hostname!='medakazukan.net' or not re.match(r'^/\d{4}_[^/]+/?$',parsed.path):continue
        title=a.get_text(' ',strip=True)
        no=NUMBER.search(title)
        if not no or 'とは' not in title[:no.start()]:continue
        num=no.group(1).zfill(4)
        if num!=parsed.path[1:5]:continue
        node=a.find_parent('article')
        if not node:continue
        summary=node.select_one('.entry-summary, .post-excerpt, .post-description, .entry-content, .post-content, .entry_body, .entry-body')
        text=(summary or node).get_text(' ',strip=True)
        obj=factual_profile(text)
        if obj:found[num]=obj
    return found
def main():
    rp=RobotFileParser(ROOT+'/robots.txt')
    rp.read()
    if not rp.can_fetch(AGENT,BASE):raise RuntimeError('robots.txt prevents archive indexing')
    session=requests.Session()
    session.headers.update({'User-Agent':AGENT,'Accept-Language':'ja,en;q=0.8'})
    all_profiles={}
    for page in range(1,54):
        url=BASE if page==1 else f'{BASE}page/{page}/'
        if not rp.can_fetch(AGENT,url):raise RuntimeError('robots.txt forbids '+url)
        response=session.get(url,timeout=25)
        if response.status_code==404:break
        response.raise_for_status()
        batch=archive_page(response.text)
        if page==1:print('first-page examples:',list(batch.items())[:3],flush=True)
        if not batch:print('No further profiles at',page);break
        all_profiles.update(batch)
        print('archive page',page,':',len(batch),'total',len(all_profiles),flush=True)
        time.sleep(1.2)
    if len(all_profiles)<300:
        raise RuntimeError('Only '+str(len(all_profiles))+' summaries found; refusing to overwrite catalog')
    data=json.loads(DATA.read_text(encoding='utf-8'))
    enriched=0
    for x in data:
        obj=all_profiles.get(str(x.get('webNo','')).zfill(4))
        if obj:
            x.update(obj)
            enriched+=1
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Enriched',enriched,'of',len(data),'catalog entries')
if __name__=='__main__':main()
