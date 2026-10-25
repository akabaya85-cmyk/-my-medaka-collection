#!/usr/bin/env python3
"""Audit illustration availability in Japan Medaka Association 2025 PDF.

PDF is downloaded temporarily in the CI runner only, never committed.
Its own notice permits private, noncommercial use but not public hosting.
"""
import io,re,requests,fitz,json
from pathlib import Path
URL="https://jma-medaka.com/wp-content/uploads/2022/08/250901_%E3%80%90%E5%85%AC%E5%BC%8F%E3%80%91%E5%93%81%E7%A8%AE%E5%88%86%E9%A1%9E%E3%83%9E%E3%83%8B%E3%83%A5%E3%82%A2%E3%83%AB_%E7%AC%AC%EF%BC%95%E7%89%88.pdf"
r=requests.get(URL,headers={'User-Agent':'Mozilla/5.0 (MyMedakaCollection private noncommercial audit)'},timeout=40)
print('FETCH',r.status_code,len(r.content),r.headers.get('content-type'),flush=True)
r.raise_for_status()
if not r.content.startswith(b'%PDF'):raise RuntimeError('Not a PDF')
doc=fitz.open(stream=r.content,filetype='pdf')
pages=[]
for p in doc:
    infos=p.get_images(full=True)
    imgs=[]
    for i in infos:
        xref=i[0]
        blocks=p.get_image_rects(xref)
        for b in blocks:
            if b.width<70 or b.height<45:continue
            imgs.append({'xref':xref,'w':round(b.width),'h':round(b.height)})
    if imgs:
        text=p.get_text('text')
        lines=[x.strip() for x in text.splitlines() if x.strip()]
        pages.append({'page':p.number+1,'photos':len(imgs),'uniquePhotos':len({x['xref'] for x in imgs}),
                      'sampleText':lines[:10]})
print('PDF_PAGES',len(doc),'IMAGE_PAGES',len(pages),
      'IMAGE_OCCURRENCES',sum(z['photos'] for z in pages),flush=True)
print('SAMPLE_PAGES',json.dumps(pages[:25],ensure_ascii=False),flush=True)
Path('jma_manual_image_audit.json').write_text(json.dumps(
 {'source':URL,'pdfPages':len(doc),'imagePages':len(pages),
 'imageOccurrences':sum(z['photos'] for z in pages),'pages':pages,
 'notice':'Photos not copied. Source permits private noncommercial use only; get permission before online redistribution.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
