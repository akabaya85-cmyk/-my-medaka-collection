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
