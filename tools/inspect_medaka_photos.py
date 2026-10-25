import json,re,requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin,urlparse
names=['0001_yokihi/','0100_miyukihikari/','0652_orichi/','0914_kotohimereallongfin/','1064_aquamarine/']
for name in names:
 url='https://medakazukan.net/'+name
 try:
  r=requests.get(url,timeout=25,headers={'User-Agent':'MyMedakaCollection-Personal/1.0','Accept-Language':'ja'})
  print('PAGE',url,r.status_code,len(r.content),flush=True)
  r.raise_for_status()
  bs=BeautifulSoup(r.content,'html.parser')
  for heading in bs.find_all(['h2','h3']):
   if '概要' in heading.get_text(' ',strip=True):
    print('OVERVIEW-H',heading.name,heading.get_text(' ',strip=True),flush=True)
    n=heading
    for j in range(8):
     n=n.find_next(['img','a','h2','h3'])
     if n is None:break
     if n.name in ('h2','h3'):break
     if n.name=='img':
      print('OVERVIEW-IMG',json.dumps(dict(src=n.get('src'),data_src=n.get('data-src'),srcset=n.get('srcset','')[:150],alt=n.get('alt'),className=n.get('class'),parentHref=n.parent.get('href','')),ensure_ascii=False),flush=True)
      break
  article=bs.find('article') or bs.find('main') or bs
  photos=[]
  for img in article.select('img'):
   d={'src':img.get('src'),'data-src':img.get('data-src'),'alt':img.get('alt'),'class':img.get('class'),'parenthref':img.parent.get('href','')}
   if 'medakazukan.net' in urljoin(url,(d['src'] or '')) and re.search(r'uploads|/media/',urljoin(url,d['src'] or '')):
    photos.append(d)
  for i,x in enumerate(photos[:7]):print('PIC',i,json.dumps(x,ensure_ascii=False)[:700],flush=True)
 except Exception as e: print('ERROR',name,str(e)[:350],flush=True)
