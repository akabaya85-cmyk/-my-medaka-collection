import requests,json,re
from bs4 import BeautifulSoup
from urllib.parse import urljoin
urls=[
'https://medakazukan.net/0034_pinkhikaridharma/',
'https://medakazukan.net/0035_tya/',
'https://medakazukan.net/0599_sirotoumeirinalbinomemae/',
'https://medakazukan.net/0654_kinrinsmalleyehikari/',
'https://medakazukan.net/0700_ougonnisikimerha/',
'https://medakazukan.net/0821_kinsyuumemae/'
]
for url in urls:
 try:
  r=requests.get(url,timeout=30,headers={'User-Agent':'MyMedakaCollection/1.0 (authorized personal gallery)'})
  r.raise_for_status()
  bs=BeautifulSoup(r.content,'html.parser')
  print('\nPAGE',url,r.status_code,flush=True)
  for h in bs.find_all(['h2','h3']):
   t=h.get_text(' ',strip=True)
   if t in ('概要','写真','ギャラリー','品種名・通称'):
    n=h.find_next('img')
    print('HEADING',t,'NEXT_IMAGE',json.dumps({'src':n.get('src') if n else None,'data-src':n.get('data-src') if n else None},ensure_ascii=False)[:360],flush=True)
  article=bs.find('article') or bs.find('main') or bs
  for i,img in enumerate(article.select('img')):
   if i>32:break
   src=img.get('data-src') or img.get('src') or ''
   if 'uploads' not in src:continue
   print('PIC',i,src[:200],'ALT',img.get('alt','')[:60],flush=True)
 except Exception as e:print('ERROR',str(e)[:250],flush=True)
