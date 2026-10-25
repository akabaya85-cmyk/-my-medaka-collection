#!/usr/bin/env python3
"""Find potentially reusable medaka photo leads using Openverse.

Candidates must NOT be displayed as confirmed variety photographs without
separate human verification of identity, license, original photographer,
source-page license and attribution.
"""
import json,time,requests
from pathlib import Path
from urllib.parse import urlparse
QUERIES=[
('楊貴妃','楊貴妃 メダカ'),
('オロチ','オロチ メダカ'),
('夜桜','夜桜 メダカ'),
('深海','深海 メダカ'),
('サファイア','サファイア メダカ'),
('三色ラメ','三色ラメ メダカ'),
('紅白','紅白 メダカ'),
('初恋','初恋 メダカ'),
('幹之','幹之 メダカ'),
('ヒメダカ','ヒメダカ'),
('楊貴妃','yokihi medaka'),
('幹之','miyuki medaka'),
('オロチ','orochi medaka'),
('サファイア','sapphire medaka')
]
SAFE_LICENSES={'cc0','pdm','by','by-sa'}
def main():
    session=requests.Session()
    session.headers.update({'User-Agent':'MyMedakaCollectionPhotoFinder/1.0 (non-commercial personal photo leads)','Accept':'application/json'})
    results={}
    errors=[]
    for name,q in QUERIES:
        try:
            resp=session.get('https://api.openverse.org/v1/images/',params={'q':q,'page_size':12,'license':','.join(sorted(SAFE_LICENSES)),'mature':'false'},timeout=30)
            if resp.status_code in (403,429):
                errors.append(f'{q}: HTTP {resp.status_code}, stop to respect service limits')
                break
            resp.raise_for_status()
            obj=resp.json()
            items=[]
            for item in obj.get('results',[]):
                license=item.get('license') or ''
                landing=item.get('foreign_landing_url') or ''
                if license not in SAFE_LICENSES or not landing.startswith('https://'):continue
                items.append(dict(title=item.get('title',''),pageUrl=landing,creator=item.get('creator',''),license=license,licenseVersion=item.get('license_version',''),licenseUrl=item.get('license_url',''),thumbnail=item.get('thumbnail',''),imageUrl=item.get('url',''),provider=item.get('provider',''),source=item.get('source','')))
            results.setdefault(name,[]).extend(items)
            print(q,len(items),flush=True)
            time.sleep(2)
        except Exception as e:
            errors.append(f'{q}: {type(e).__name__}: {str(e)[:120]}')
    if results:
        Path('photo_candidates.json').write_text(json.dumps(dict(note='Not verified; DO NOT automatically assign to a breed. Verify the source page, license and exact cultivar first.',results=results,errors=errors),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Total candidates',sum(len(x) for x in results.values()),'Errors',errors,flush=True)
if __name__=='__main__':main()
