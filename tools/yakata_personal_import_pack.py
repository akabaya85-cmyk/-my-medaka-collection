import base64,io,json,re,time,zipfile
from pathlib import Path
from urllib.parse import urljoin,urlparse,parse_qs
import requests
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
BASE='https://www.medakanoyakata.jp/'
HEAD={'User-Agent':'MyMedakaCollection/1.0 (authorized personal photo archive)'}
catalog=json.loads(Path('catalog.json').read_text())
targets={x['name']:x for x in catalog if x.get('source')=='めだかの館'}
s=requests.Session();s.headers.update(HEAD)
def get(url):
 r=s.get(url,timeout=25);r.raise_for_status();return r.content
soup=BeautifulSoup(get(BASE+'?cbid=2838660&csid=0&mode=cate'),'html.parser')
links={}
for a in soup.find_all('a',href=True):
 name=a.get_text(' ',strip=True)
 url=urljoin(BASE,a['href'])
 if not parse_qs(urlparse(url).query).get('pid'):continue
 for target in targets:
  if name.startswith(target+' ') or name==target:
   links.setdefault(target,url)
for target,x in targets.items():
 if x.get('yakataProductUrl'):links[target]=x['yakataProductUrl']
photos=[];failed=[]
for name,url in links.items():
 try:
  page=BeautifulSoup(get(url),'html.parser')
  og=page.find('meta',attrs={'property':'og:image'})
  if not og:raise ValueError('no product image')
  imgurl=urljoin(url,og.get('content',''))
  raw=get(imgurl)
  with Image.open(io.BytesIO(raw)) as original:
   im=ImageOps.exif_transpose(original).convert('RGB')
   if min(im.size)<180:raise ValueError('image too small')
   im.thumbnail((900,900),Image.Resampling.LANCZOS)
   b=io.BytesIO();im.save(b,'JPEG',quality=80,optimize=True)
  photos.append(dict(name=name,source='めだかの館',sourceUrl=url,sourceImage=imgurl,
   dataUrl='data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode(),
   sourceType='retailer sample photo',permission='authorized personal use only'))
  print('PHOTO',name,len(b.getvalue()),flush=True)
 except Exception as e:
  failed.append(dict(name=name,error=str(e)))
  print('ERROR',name,str(e),flush=True)
 time.sleep(.3)
Path('private_exports').mkdir(exist_ok=True)
pack=dict(format='my-medaka-yakata-name-pack-v1',photos=photos,source='めだかの館',privacy='personal use only')
Path('private_exports/My_Medaka_めだかの館_実物写真.json').write_text(json.dumps(pack,ensure_ascii=False),encoding='utf-8')
print('SUMMARY',len(photos),'photos',len(failed),'errors',flush=True)
