#!/usr/bin/env python3
"""Nonpublishing audit of retailer's own illustrated variety guide.
Logs only text/image-URL layout so exact cultivar matches can be checked.
"""
import requests
from bs4 import BeautifulSoup
url='https://www.medakanoyakata.jp/?mode=f127'
r=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=40)
r.raise_for_status()
r.encoding=r.apparent_encoding
s=BeautifulSoup(r.text,'html.parser')
print('HTTP',r.status_code,'encoding',r.encoding,'bytes',len(r.content),'images',len(s.find_all('img')),flush=True)
for tag in s.find_all(['tr','li','article','section']):
 imgs=tag.find_all('img')
 text=tag.get_text(' ',strip=True)
 if imgs and len(text)>6 and any(key in text for key in ['幹之','夜桜','楊貴妃','琥珀','オロチ','ピンクサファイア','五式']):
  print('MATCH',tag.name,repr(text[:170]),'IMAGES',[(i.get('alt','')[:35],i.get('src','')[:170]) for i in imgs[:3]],flush=True)
print('GUIDE_IMAGE_SAMPLE',[(i.get('alt','')[:55],i.get('src','')[:170]) for i in s.find_all('img')[:35]],flush=True)

for url in [
 'https://medakazukan.net/wp-content/uploads/2021/06/1-1%E6%A5%8A%E8%B2%B4%E5%A6%83-scaled.jpg',
 'https://img14.shop-pro.jp/PA01303/264/product/180176797.jpg?cmsp_timestamp=20240326170212'
]:
 for referer in ['', 'https://akabaya85-cmyk.github.io/']:
  try:
   h={'User-Agent':'Mozilla/5.0'}
   if referer:h['Referer']=referer
   rr=requests.get(url,headers=h,timeout=15)
   print('IMAGE_PROBE',rr.status_code,rr.headers.get('Content-Type',''),len(rr.content),url.split('/')[2],referer or 'no-referer',flush=True)
  except Exception as e:print('IMAGE_PROBE_ERROR',str(e)[:130],flush=True)
