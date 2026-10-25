#!/usr/bin/env python3
"""Build a PRIVATE medaka photo pack, based on owner's permission for personal use.
Neither the source photographs nor an unencrypted pack may be committed to a public repository.
"""
import base64, concurrent.futures, io, json, os, re, struct, time, threading, zipfile
from pathlib import Path
from urllib.parse import urljoin,urlparse
from bs4 import BeautifulSoup
from PIL import Image, ImageOps
import requests
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAtL3+xkry0nAYHef/yai3\nl0ndylHQ45EjspNNitzr4s8OzviPc3fHG+5BwCXIda50ZMnTcJQb6m5AKlzJjoVF\nG39zwVuL+Iq9FAfRqGgJvoKLaG7Een+BAv1SFYlpvVNo+0XIwvtDNqD8bLnelpr4\nvvlBmdftQXWDFG0UCjpMq1ezO6j+7DIKvW/k6OX7CfLcVDvdSdRKGhHjrxIIFS1r\nCZ4i0AcxgvVeByXUh6YlN11OV4eM80wfffoaaoGxlhWhsPCVCPs8fGDEslQPRpuP\njWKS5RpHycfbxM5q5IbLq+Mvjbhxh0xAwt2ABxK6KlBQ1V+HO2KkJCzBtf+J1uLI\nhkm/CSrZHG5No9zS0UHUyK/Am1/xZjmV2Mo3uKb8eXWfPJfwucj8eUMlmy7DXctt\nD04+GFRPlJmkkTzixu/NOmd/jESCTzi0iHophzHD+1wPE2iC+aTWcNqvkC6ZPXp1\nVDB28i0nf2tpNdleFpuQVazExb6s/XMAdLSpRqATe9VdAgMBAAE=\n-----END PUBLIC KEY-----"
ROOT='https://medakazukan.net'
AGENT='MyMedakaCollection/1.0 (authorized personal photo catalog)'
LIMIT=int(os.getenv('PHOTO_LIMIT','30'))
WORKERS=int(os.getenv('PHOTO_WORKERS','2'))
STOP=threading.Event()
SESSIONS=threading.local()
def session():
    if not hasattr(SESSIONS,'session'):
        s=requests.Session();s.headers.update({'User-Agent':AGENT,'Accept-Language':'ja,en;q=0.8'})
        SESSIONS.session=s
    return SESSIONS.session
def fetch_limited(url,max_bytes):
    r=session().get(url,timeout=(15,45),stream=True)
    if r.status_code in (429,403):
        STOP.set()
        raise RuntimeError('source HTTP '+str(r.status_code)+'; stopped to respect restrictions')
    r.raise_for_status()
    t=io.BytesIO()
    for chunk in r.iter_content(chunk_size=65536):
        if chunk:
            t.write(chunk)
            if t.tell()>max_bytes:raise RuntimeError('over download limit ('+str(max_bytes)+')')
    return t.getvalue()
def get_photo(x):
    no=str(x['webNo']).zfill(4)
    name=str(x['name'])
    url=str(x['url'])
    if STOP.is_set():return {'webNo':no,'name':name,'error':'stopped after server refusal'}
    p=urlparse(url)
    if p.hostname!='medakazukan.net' or not re.match(r'^/\d{4}_[^/]+/?$',p.path):
        return {'webNo':no,'name':name,'error':'invalid article URL'}
    try:
        raw=fetch_limited(url,2500000)
        soup=BeautifulSoup(raw,'html.parser')
        head=next((h for h in soup.find_all(['h2','h3']) if h.get_text(' ',strip=True)=='概要'),None)
        if head is None:raise ValueError('overview heading absent')
        img=head.find_next('img')
        if img is None:raise ValueError('overview photo absent')
        candidate=img.get('src') or img.get('data-src')
        photo_url=urljoin(url,candidate or '')
        ip=urlparse(photo_url)
        if ip.hostname!='medakazukan.net' or '/wp-content/uploads/' not in ip.path:
            raise ValueError('unexpected image source')
        body=fetch_limited(photo_url,14000000)
        with Image.open(io.BytesIO(body)) as original:
            im=ImageOps.exif_transpose(original)
            if im.width<90 or im.height<90:raise ValueError('small image / likely icon')
            im=im.convert('RGB')
            im.thumbnail((900,900),Image.Resampling.LANCZOS)
            out=io.BytesIO();im.save(out,'JPEG',quality=77,optimize=True,progressive=True)
            jpg=out.getvalue()
        if len(jpg)>400000:raise ValueError('image too large after resize')
        return dict(webNo=no,name=name,sourceUrl=url,sourceImage=photo_url,
            dataUrl='data:image/jpeg;base64,'+base64.b64encode(jpg).decode(),
            width=im.width,height=im.height,bytes=len(jpg),source='改良メダカWEB図鑑',
            permission='personal use only')
    except Exception as e:return dict(webNo=no,name=name,error=str(e)[:220])
def main():
    items=json.loads(Path('catalog.json').read_text(encoding='utf-8'))
    chosen=[x for x in items if x.get('webNo') and x.get('url') and re.match(r'https://medakazukan\.net/\d{4}_',x['url'])]
    # SITE PERMISSION SUPPLIED BY USER, use only for their device; do not republish.
    if LIMIT>0:chosen=chosen[:LIMIT]
    print('START',len(chosen),'of',len(items),'catalog records; worker count',WORKERS,flush=True)
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        future_iter=iter(pool.map(get_photo,chosen))
        for i in range(len(chosen)):
            v=next(future_iter)
            results.append(v)
            if (i+1)<=5 or (i+1)%20==0 or v.get('error'):
                print('ITEM',i+1,'/',len(chosen),v['webNo'],v['name'],'JPEG',v.get('bytes'), 'ERROR',v.get('error'),flush=True)
            if STOP.is_set():
                print('STOPPING after HTTP restriction',flush=True)
                break
            time.sleep(0.22)
    okay=[x for x in results if x.get('dataUrl')]
    errors=[{k:v for k,v in x.items() if k!='dataUrl'} for x in results if x.get('error')]
    Path('private_exports').mkdir(exist_ok=True)
    z=io.BytesIO()
    with zipfile.ZipFile(z,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        for i in range(0,len(okay),75):
            photos=okay[i:i+75]
            pack=dict(format='my-medaka-authorized-photo-pack-v1',source='改良メダカWEB図鑑',
                privacy='personal local iPhone use only; do not repost publicly',
                photoCount=len(photos),photos=photos)
            archive.writestr('medaka_photo_pack_%02d.json'%(1+i//75),
                 json.dumps(pack,ensure_ascii=False,separators=(',',':')))
        summary=dict(attempted=len(results),succeeded=len(okay),failed=len(errors),
            photosFrom='medakazukan.net',permission='user-confirmed personal-use authorization',
            totalJpegBytes=sum(x['bytes'] for x in okay),partCount=(len(okay)+74)//75)
        archive.writestr('photo_collection_report.json',json.dumps({'summary':summary,'errors':errors},ensure_ascii=False,indent=2))
        archive.writestr('README.txt','My Medaka Collection personal photo pack. Unzip on iPhone Files app. Import all medaka_photo_pack_*.json in the app. Do not upload any images into the public GitHub repository.')
    blob=z.getvalue()
    pubkey=serialization.load_pem_public_key(PUBLIC_KEY.encode())
    key=os.urandom(32);nonce=os.urandom(12)
    wrapped=pubkey.encrypt(key,padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
    encrypted=AESGCM(key).encrypt(nonce,blob,b'MEDAKA-PERSONAL-V1')
    path=Path('private_exports/medaka_photo_pack.encrypted')
    path.write_bytes(b'MEDAKA1'+struct.pack('>H',len(wrapped))+wrapped+nonce+encrypted)
    print('SUMMARY',json.dumps(summary,ensure_ascii=False),flush=True)
    print('ENCRYPTED_PACK_BYTES',path.stat().st_size,'NO PHOTOS COMMITTED',flush=True)
if __name__=='__main__':main()
