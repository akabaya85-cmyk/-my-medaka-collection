#!/usr/bin/env python3
"""Privately recover photos for article pages whose 'overview' has no photo."""
import base64,concurrent.futures,io,json,os,struct,zipfile,time,re
from urllib.parse import urljoin,urlparse,unquote
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import export_authorized_medaka_photos as base
MISSING=["0034","0035","0058","0059","0061","0062","0066","0158","0255","0599","0641","0642","0654","0655","0656","0657","0658","0659","0660","0661","0664","0666","0667","0668","0669","0674","0675","0676","0681","0682","0684","0685","0686","0687","0691","0692","0698","0699","0700","0701","0705","0709","0714","0715","0722","0723","0724","0736","0821"];
def choose_photo(soup,url,number):
    article=soup.find('article') or soup.find('main') or soup
    for h in article.find_all(['h2','h3']):
        if h.get_text(' ',strip=True) not in ('ギャラリー','写真'):continue
        cur=h
        for i in range(60):
            cur=cur.find_next(['img','h2','h3'])
            if cur is None or (cur.name in ('h2','h3') and cur is not h):break
            if cur.name!='img':continue
            candidate=urljoin(url,cur.get('data-src') or cur.get('src') or '')
            p=urlparse(candidate)
            if p.hostname!='medakazukan.net' or '/wp-content/uploads/' not in p.path:continue
            file=unquote(p.path).split('/')[-1]
            if any(x in file for x in ('アイキャッチ','形質アイコン','ロゴ','見分け方解説')):continue
            if number in file or re.match(r'\d{4}[_-]',file):return candidate,'gallery'
    # Fall back to the title card, which is itself identified with this cultivar's number.
    for img in article.select('img'):
        candidate=urljoin(url,img.get('data-src') or img.get('src') or '')
        p=urlparse(candidate)
        file=unquote(p.path).split('/')[-1]
        if p.hostname=='medakazukan.net' and 'アイキャッチ_品種' in file and number in file and '-150x150' not in file and '-300x200' not in file:
            return candidate,'featured'
    return None,None
def take(x):
    url=x['url'];number=str(x['webNo']).zfill(4);name=x['name']
    try:
        html=base.fetch_limited(url,2500000)
        soup=BeautifulSoup(html,'html.parser')
        image_url,quality=choose_photo(soup,url,number)
        if not image_url:raise ValueError('no matching article photo / featured image')
        body=base.fetch_limited(image_url,14000000)
        with Image.open(io.BytesIO(body)) as source:
            image=ImageOps.exif_transpose(source).convert('RGB')
            if image.width<90 or image.height<90:raise ValueError('image too small')
            image.thumbnail((900,900),Image.Resampling.LANCZOS)
            buf=io.BytesIO();image.save(buf,'JPEG',quality=77,optimize=True,progressive=True)
        jpeg=buf.getvalue()
        return dict(webNo=number,name=name,sourceUrl=url,sourceImage=image_url,
           dataUrl='data:image/jpeg;base64,'+base64.b64encode(jpeg).decode(),
           bytes=len(jpeg),source='改良メダカWEB図鑑',quality=quality,permission='personal use only')
    except Exception as e:return dict(webNo=number,name=name,error=str(e)[:200])
def main():
    items=json.loads(Path('catalog.json').read_text(encoding='utf-8'))
    selected=[x for x in items if x.get('webNo') in MISSING]
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(take,selected):
            results.append(result)
            print('PHOTO',result['webNo'],result['name'],result.get('quality'),result.get('bytes'),result.get('error'),flush=True)
            time.sleep(.3)
    good=[x for x in results if x.get('dataUrl')]
    errors=[x for x in results if x.get('error')]
    bundle=io.BytesIO()
    with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        z.writestr('medaka_photo_pack_13.json',json.dumps(dict(format='my-medaka-authorized-photo-pack-v1',source='改良メダカWEB図鑑',photos=good,photoCount=len(good),privacy='personal only'),ensure_ascii=False,separators=(',',':')))
        z.writestr('remaining_report.json',json.dumps(dict(success=len(good),failed=errors),ensure_ascii=False,indent=2))
    key=os.urandom(32);nonce=os.urandom(12)
    public=serialization.load_pem_public_key(base.PUBLIC_KEY.encode())
    wrapped=public.encrypt(key,padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
    ciphertext=AESGCM(key).encrypt(nonce,bundle.getvalue(),b'MEDAKA-PERSONAL-V1')
    Path('private_exports').mkdir(exist_ok=True)
    Path('private_exports/medaka_missing.encrypted').write_bytes(b'MEDAKA1'+struct.pack('>H',len(wrapped))+wrapped+nonce+ciphertext)
    print('SUMMARY',len(selected),len(good),'success',len(errors),'failed',flush=True)
if __name__=='__main__':main()
