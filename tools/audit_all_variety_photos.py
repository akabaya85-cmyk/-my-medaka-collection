#!/usr/bin/env python3
"""Audit Creative Commons photo availability for every personal medaka-catalog entry.

Only photo metadata is recorded here; this script does NOT copy images or attach
unverified photographs to individual cultivars. A result for 'red medaka' does not
prove that it is, for example, '楊貴妃リアルロングフィン'.
"""
import concurrent.futures, json, re, time, threading
from collections import Counter
from pathlib import Path
import requests

CATALOG=Path('catalog.json')
OUTPUT=Path('photo_search_audit.json')
ENDPOINT='https://api.openverse.org/v1/images/'
LICENSES='by,by-sa,cc0,pdm'
MAX_REQUESTS=899
WORKERS=2
stop=threading.Event()
metrics=Counter()
metric_lock=threading.Lock()

def simplify(x):
    return ''.join(re.findall(r'[\w一-龥ぁ-んァ-ヶ]+',str(x).casefold()))
def tags_text(img):
    tags=img.get('tags',[]) or []
    return ' '.join(str(z.get('name','')) if isinstance(z,dict) else str(z) for z in tags)
def scan(item):
    if stop.is_set():return {'name':item['name'],'skipped':'rate_limited'}
    name=str(item['name'])
    # Require the medaka context, rather than matching unrelated creatures
    query=name+' メダカ'
    try:
        r=requests.get(ENDPOINT,params={'q':query,'page_size':10,'license':LICENSES,'mature':'false'},headers={'User-Agent':'MyMedakaCollection/1.0 (noncommercial image license research)'},timeout=30)
        if r.status_code in (403,429):
            stop.set()
            return {'name':name,'error':'HTTP '+str(r.status_code)+'; stopped to respect API rate limit'}
        r.raise_for_status()
        j=r.json()
        candidates=[]
        key=simplify(name)
        for img in j.get('results',[]):
            title=str(img.get('title') or '')
            allwords=title+' '+tags_text(img)
            context=re.search(r'メダカ|medaka|ricefish|oryzias|killifish',allwords,re.I)
            # Do not conclude that a picture depicts this cultivar just because
            # a search engine returned it for an ambiguous breed name.
            exact=bool(len(key)>=3 and key in simplify(allwords) and context)
            lic=str(img.get('license',''))
            if lic not in {'by','by-sa','cc0','pdm'}:continue
            url=str(img.get('url') or '')
            page=str(img.get('foreign_landing_url') or '')
            if not url.startswith('https://') or not page.startswith('https://'):continue
            if len(candidates)<5:
                candidates.append({'title':title[:140], 'creator':str(img.get('creator') or '')[:120], 'license':lic,
                    'licenseVersion':img.get('license_version'),'licenseUrl':img.get('license_url'),
                    'imageUrl':url,'pageUrl':page,'source':img.get('source'),
                    'tags':tags_text(img)[:220],'nameExplicitlyPresent':exact})
        return {'name':name,'matchesReturned':len(j.get('results',[])),'candidates':candidates,
            'explicitMatches':sum(x['nameExplicitlyPresent'] for x in candidates)}
    except Exception as e:
        return {'name':name,'error':type(e).__name__+': '+str(e)[:130]}
def main():
    catalog=json.loads(CATALOG.read_text(encoding='utf-8'))
    current=sum(bool(x.get('licensedPhoto') or x.get('licensedPhotos')) for x in catalog)
    names=[]
    seen=set()
    for x in catalog:
        n=x.get('name','').strip()
        if not n or n in seen:continue
        seen.add(n);names.append({'name':n,'webNo':x.get('webNo','')})
    selected=names[:MAX_REQUESTS]
    results=[]
    print('Auditing',len(selected),'of',len(names),'medaka catalog entries; currently',current,'with reused photos',flush=True)
    # Parallelism of 2, with a small delay per completed request and early
    # cancellation if the server refuses more searches.
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures=iter(pool.map(scan,selected))
        for i in range(len(selected)):
            obj=next(futures)
            obj['webNo']=selected[i]['webNo']
            results.append(obj)
            if (i+1)%25==0:
                print('Progress',i+1,'/',len(selected),'results',
                    sum(bool(z.get('candidates')) for z in results),'explicit',
                    sum(bool(z.get('explicitMatches')) for z in results),'stopped',stop.is_set(),flush=True)
            if stop.is_set():
                print('Rate limit encountered; preserving partial audit',flush=True)
                break
            time.sleep(0.36)
    withCandidates=[x for x in results if x.get('candidates')]
    exact=[x for x in results if x.get('explicitMatches')]
    errors=[x for x in results if x.get('error')]
    summary={'catalogEntries':len(catalog),'queriesAttempted':len(results),
        'queriesWithCandidates':len(withCandidates),
        'varietiesWithExplicitNamedImageLeads':len(exact),
        'alreadyLicensedVarieties':current,'errors':len(errors),
        'scannedAt':'2026-10-25','method':'Openverse Creative Commons license index; conservative exact-name match',
        'warning':'Results are only candidates. Do not automatically attach them before checking actual species, variety, original hosting rights, creator and license.'}
    OUTPUT.write_text(json.dumps({'summary':summary,'explicitLeads':exact,
                'otherLeads':withCandidates[:160],'errors':errors[:25]},
                ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('SUMMARY',json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
