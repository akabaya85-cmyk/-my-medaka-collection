#!/usr/bin/env python3
"""Supplement missing cultivar *trait keywords* from individually linked trusted pages.

This script visits only vetted referenceLinks stored in catalog.json. It never
copies pictures, paragraphs, HTML, pricing, reviews or private notes. It never
changes a custom or already substantive description. It treats website prose as
a lead for morphological labels, not a claim of certification.
"""
import json
import pathlib
import re
import time
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

CAT = pathlib.Path(__file__).resolve().parent.parent / "catalog.json"
TRUSTED = {"www.medakalog.shop", "jasma.sc", "hinsyu-zukan.satumano-medakayasan.com"}
GENERIC = {
    "", "詳しい系統や特徴は出典記事をご確認ください。",
    "特徴・作出系統の詳細は出典を確認して追記してください。"
}
FEATURES = (
    "リアルロングフィン", "ブラックリム", "半透明鱗", "透明鱗",
    "体外光", "体内光", "全身体内光", "腹膜青", "腹膜黒",
    "ロングフィン", "ワイドフィン", "ヒレ光", "ヒレライン",
    "モルフォ", "サムライ", "スワロー", "ヒレ長",
    "アルビノ", "出目", "目前", "パンダ", "ルビーアイ", "ラメ",
    "背地反応なし", "斑", "ダルマ", "ヒカリ体型", "朱赤",
    "オレンジ", "黄金", "琥珀", "ピンク", "ブルー", "白", "青", "黒"
)

def normalize_features(txt):
    hits = []
    for feature in FEATURES:
        if feature not in txt:
            continue
        if feature == "透明鱗" and "半透明鱗" in txt and "透明鱗" not in txt.replace("半透明鱗", ""):
            continue
        if feature == "ロングフィン" and "リアルロングフィン" in txt and "ロングフィン" not in txt.replace("リアルロングフィン", ""):
            continue
        if feature == "体内光" and "全身体内光" in txt and "体内光" not in txt.replace("全身体内光", ""):
            continue
        if feature == "青" and "青ラメ" in txt and "青" not in txt.replace("青ラメ", ""):
            continue
        hits.append(feature)
    return hits[:7]

def feature_section(soup):
    article = soup.find("article") or soup.find("main") or soup
    for heading in article.find_all(["h2", "h3"]):
        heading_txt = heading.get_text(" ", strip=True)
        if not ("特徴" in heading_txt or "品種の概要" in heading_txt):
            continue
        chunks = []
        node = heading.next_sibling
        while node and len(" ".join(chunks)) < 600:
            if getattr(node, "name", None) in ("h2", "h3"):
                break
            if getattr(node, "name", None) in ("p", "ul"):
                chunks.append(node.get_text(" ", strip=True))
            node = node.next_sibling
        txt = " ".join(chunks)[:600]
        if txt:
            return txt
    return ""

def main():
    records = json.loads(CAT.read_text(encoding="utf-8"))
    changed = 0
    checked = 0
    for entry in records:
        if entry.get("description", "") not in GENERIC:
            continue
        links = entry.get("referenceLinks") or []
        if not isinstance(links, list):
            continue
        for source in links:
            url = str(source.get("url", ""))
            parts = urlparse(url)
            if parts.scheme != "https" or parts.netloc not in TRUSTED:
                continue
            try:
                res = requests.get(url, timeout=18, headers={"User-Agent": "MyMedakaCatalog/1.1 (no photos; source citations only)"})
                res.raise_for_status()
                checked += 1
                soup = BeautifulSoup(res.text, "html.parser")
                features = normalize_features(feature_section(soup))
                if len(features) < 2:
                    break
                entry["description"] = "専門図鑑の記事では、外見の観察ポイントとして" + "・".join(features) + "が紹介されています。"
                entry["profileBasis"] = "専門図鑑の個別記事から形質キーワードを要約。出典リンクで確認できます。"
                if not entry.get("traits"):
                    entry["traits"] = "・".join(features)
                changed += 1
            except (requests.RequestException, ValueError) as e:
                print("Skipped", entry.get("name"), str(e)[:95])
            finally:
                time.sleep(0.7)
            break
    if changed:
        CAT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"External source pages checked: {checked}; newly summarized: {changed}")

if __name__ == "__main__":
    main()
