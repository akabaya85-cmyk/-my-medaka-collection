import base64,io,json,os,re,struct,zipfile,time
from urllib.parse import urljoin,urlparse,parse_qs
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
import requests
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
PUB="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmo2U/AdLrrh20gdLh0ZK\nVShn5BbKegcOp1cweD5NdP57HkLjHRVnFEjkCfCfigoeN9g+refGPt42cTRUi5BT\n2ZPybqxPgQ2MSAexZZyvLhLrhhgswBk643H43+Ea8dwGYZxcjTBjLkhDQksmUGL8\nFHi1ycXKR9yf1M5J8ItYbueAmVsrZjnKcTionyJXZ80kBmxunJr165bzOqT9i9ry\nHCDelQUdNZ8R7XDbGtlUimVBQqus4QuWZ4P1IDKJ6VbriQf8Ga3sct50RRAb5DyE\n+C+QqYZDqYDmQSdAydmBesHkxFawvZRkJ2Gejt1BIE/FJI3wP7oF3oaw5fRWNM8k\nSwIDAQAB\n-----END PUBLIC KEY-----"
BASE='https://www.medakanoyakata.jp/'
HEAD={'User-Agent':'MyMedakaCollection/1.0 (authorized private collection)'}
def get(url,limit=12000000):
 r=requests.get(url,headers=HEAD,timeout=30)
 r.raise_for_status()
 if len(r.content)>limit:raise ValueError('oversize')
 return r.content
def normalize(s):
 return re.sub(r'[\s　・･‐－―—-]+','',s or '').lower()
def main():
 catalog=json.loads(open('catalog.json',encoding='utf-8').read())
 listing=BeautifulSoup(get(BASE+'?cbid=2838660&csid=0&mode=cate'),'html.parser')
 links={}
 for a in listing.find_all('a',href=True):
  href=urljoin(BASE,a['href'])
  if urlparse(href).hostname not in ('www.medakanoyakata.jp','medakanoyakata.jp'):continue
  pid=parse_qs(urlparse(href).query).get('pid')
  if not pid:continue
  label=a.get_text(' ',strip=True)
  for x in catalog:
   if x.get('source')!='めだかの館':continue
   name=x['name']
   if normalize(label).startswith(normalize(name)) and (len(label)==len(name) or label[len(name):].startswith((' ','　','オス','（','('))):
    links.setdefault(name,href)
 for x in catalog:
  if x.get('yakataProductUrl'):links[x['name']]=x['yakataProductUrl']
 print('MATCHED PRODUCT LINKS',len(links),list(links),flush=True)
 result=[];fail=[]
 for name,url in links.items():
  try:
   html=BeautifulSoup(get(url),'html.parser')
   images=[]
   for meta in html.find_all('meta'):
    if meta.get('property') in ('og:image','twitter:image') or meta.get('name')=='twitter:image':
     v=meta.get('content')
     if v:images.append(('meta',urljoin(url,v)))
   for img in html.find_all('img'):
    v=img.get('data-src') or img.get('src')
    if not v:continue
    image_url=urljoin(url,v)
    if urlparse(image_url).hostname not in ('img.shop-pro.jp','img14.shop-pro.jp','www.medakanoyakata.jp'):continue
    if 'thumb' in str(img.get('class','')).lower() or 'product' in str(img.get('class','')).lower():
     images.append(('product',image_url))
   images=list(dict.fromkeys(images))
   chosen=None
   for kind,src in images[:8]:
    try:
     raw=get(src,6000000)
     with Image.open(io.BytesIO(raw)) as im:
      w,h=im.size
      if w<350 or h<180:continue
      image=ImageOps.exif_transpose(im).convert('RGB')
      image.thumbnail((1000,1000),Image.Resampling.LANCZOS)
      b=io.BytesIO();image.save(b,'JPEG',quality=79,optimize=True)
      chosen=(kind,src,b.getvalue(),w,h)
      break
    except Exception as e:continue
   if chosen is None:raise ValueError('no usable product image')
   kind,src,data,w,h=chosen
   result.append(dict(name=name,source='めだかの館',sourceUrl=url,sourceImage=src,webNo=None,
       dataUrl='data:image/jpeg;base64,'+base64.b64encode(data).decode(),
       bytes=len(data),width=w,height=h,sourceType='retailer sample photo',matchStatus='candidate_needs_visual_review'))
   print('CANDIDATE',name,kind,src[:140],w,h,len(data),flush=True)
  except Exception as e:
   fail.append(dict(name=name,url=url,error=str(e)[:150]))
   print('ERROR',name,str(e)[:150],flush=True)
  time.sleep(.3)
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('yakata_photo_candidates.json',json.dumps(dict(format='my-medaka-yakata-candidates-v1',photos=result,failed=fail),ensure_ascii=False))
  z.writestr('review_report.json',json.dumps(dict(success=len(result),failed=fail,links=links),ensure_ascii=False,indent=2))
 key=os.urandom(32);nonce=os.urandom(12)
 pub=serialization.load_pem_public_key(PUB.encode())
 wrapped=pub.encrypt(key,padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
 blob=AESGCM(key).encrypt(nonce,out.getvalue(),b'MEDAKA-YAKATA-V1')
 os.makedirs('private_exports',exist_ok=True)
 open('private_exports/yakata_candidates.encrypted','wb').write(b'YAKATA1'+struct.pack('>H',len(wrapped))+wrapped+nonce+blob)
 print('SUMMARY',len(result),'candidates',len(fail),'failed',flush=True)
if __name__=='__main__':main()
