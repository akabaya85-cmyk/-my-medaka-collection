#!/usr/bin/env python3
"""Refresh public medaka metadata only. Never fetch or commit images or user records.

Source: https://medakazukan.net/category/variety/
Only names, article numbers, source links and independently composed trait notes.
A failed/incomplete archive scan never overwrites the existing catalog.
"""
import datetime as dt
import json
import pathlib
import re
import time
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

BASE = "https://medakazukan.net"
ARCHIVE = BASE + "/category/variety/"
CATALOG = pathlib.Path(__file__).resolve().parent.parent / "catalog.json"
TODAY = dt.date.today().isoformat()
MAX_DETAIL_CHECKS = 65
HEADERS = {"User-Agent": "MyMedakaPersonalCatalog/1.0 (public metadata only; no image fetching)"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
FEATURES = (
    "リアルロングフィン", "ヒカリダルマ", "全身体内光", "ブラックリム",
    "ハーフムーン", "半透明鱗", "ワイドフィン", "ロングフィン", "ナローフィン",
    "スモールアイ", "ルビーアイ", "ブルーアイ", "ヒレライン", "体外光",
    "体内光", "腹膜光", "腹膜青", "フサヒレ", "モルフォ", "サムライ", "スワロー",
    "アルビノ", "ヒレ長", "メラー", "マルコ", "斑", "ラメ", "透明鱗",
    "パンダ", "出目", "目前", "ビッグアイ", "水泡眼", "菱尾", "ダルマ",
    "ヒカリ", "朱赤", "琥珀", "黄金", "オレンジ", "ピンク", "ブラック",
    "茶", "黄", "白", "青"
)
GENERIC = {
    "", "詳しい系統や特徴は出典記事をご確認ください。",
    "特徴・作出系統の詳細は出典を確認して追記してください。"
}
NO_RE = re.compile(r"(?:改良メダカWEB図鑑\s*No[.．]?|WEB図鑑No[.．]?)\s*(\d{3,4})")
PAGE_RE = re.compile(r"/category/variety/page/(\d+)/")

def get(url):
    if urlparse(url).netloc != "medakazukan.net":
        raise ValueError("off-site URL blocked")
    response = SESSION.get(url, timeout=25)
    response.raise_for_status()
    time.sleep(0.8)
    return BeautifulSoup(response.text, "html.parser")

def parse_archive(soup):
    """Article title links can occur either on cards or in article headings."""
    output = {}
    for a in soup.find_all("a", href=True):
        label = " ".join(a.stripped_strings)
        no = NO_RE.search(label)
        if not no:
            continue
        # A category archive may also contain recent-post links in the sidebar.
        name_match = re.search(r"(.+?)とは[\s　]*改良メダカWEB図鑑\s*No[.．]?", label)
        if not name_match:
            continue
        name = re.sub(r"^(?:メダカの品種|白朱赤|ブラック|オレンジ|白|青|黄|黄金)\s+", "", name_match.group(1)).strip()
        url = a["href"].split("#", 1)[0]
        if url.startswith("/"):
            url = BASE + url
        if urlparse(url).netloc != "medakazukan.net" or len(name) < 2 or len(name) > 85:
            continue
        number = no.group(1).zfill(4)
        if number not in output:
            output[number] = {"name": name, "webNo": number, "url": url}
    return output

def overview(soup):
    for heading in soup.find_all(["h2", "h3", "h4"]):
        if heading.get_text(" ", strip=True) != "概要":
            continue
        node = heading.find_next("p")
        if node:
            txt = node.get_text(" ", strip=True)
            if 12 <= len(txt) <= 300 and not any(bad in txt for bad in ("本記事では", "こちらの記事", "下記の記事")):
                return txt
    return ""

def trait_list(summary):
    found = []
    for trait in FEATURES:
        if trait not in summary:
            continue
        if trait == "透明鱗" and "半透明鱗" in summary and "透明鱗" not in summary.replace("半透明鱗", ""):
            continue
        if trait == "ヒカリ" and "ヒカリダルマ" in summary and "ヒカリ" not in summary.replace("ヒカリダルマ", ""):
            continue
        if trait == "ダルマ" and "ヒカリダルマ" in summary and "ダルマ" not in summary.replace("ヒカリダルマ", ""):
            continue
        if trait == "ロングフィン" and "リアルロングフィン" in summary and "ロングフィン" not in summary.replace("リアルロングフィン", ""):
            continue
        found.append(trait)
    # A derived enumeration, not the site's prose.
    return found[:12]

def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if not isinstance(catalog, list) or len(catalog) < 800:
        raise RuntimeError("Unexpected existing catalog format; preserving it")
    all_articles = {}
    first = get(ARCHIVE)
    all_articles.update(parse_archive(first))
    pages = [int(m.group(1)) for a in first.find_all("a", href=True)
             if (m := PAGE_RE.search(a["href"]))]
    last = max(pages, default=46)
    if not (35 <= last <= 100):
        raise RuntimeError("Unexpected archive pagination; preserving existing catalog")
    for page in range(2, last + 1):
        all_articles.update(parse_archive(get(ARCHIVE + f"page/{page}/")))
    if len(all_articles) < 750:
        raise RuntimeError(f"Only {len(all_articles)} article numbers detected; NOT writing")

    by_no = {str(x["webNo"]).zfill(4): x for x in catalog if x.get("webNo")}
    added = 0
    for no, article in all_articles.items():
        if no in by_no:
            entry = by_no[no]
            if not entry.get("url") or entry["url"] == BASE + "/varietyofmedaka/":
                entry["url"] = article["url"]
        else:
            entry = dict(article)
            entry.update({
                "aliases": "", "traits": "",
                "kind": "WEB図鑑掲載名（区分は要確認）",
                "description": "詳しい系統や特徴は出典記事をご確認ください。",
                "profileBasis": "WEB図鑑の記事番号・名称を確認。詳細な形質は未照合。"
            })
            catalog.append(entry)
            by_no[no] = entry
            added += 1

    # Spread deeper checks over subsequent runs; never replace curated descriptions.
    candidates = [
        x for x in catalog
        if x.get("webNo") in all_articles and not x.get("sourceCheckedAt") and not x.get("sourceAttemptedAt")
    ]
    checked = 0
    for entry in candidates[:MAX_DETAIL_CHECKS]:
        try:
            soup = get(all_articles[entry["webNo"]]["url"])
            summary = overview(soup)
            traits = trait_list(summary)
            if not traits:
                entry["sourceAttemptedAt"] = TODAY
                continue
            if not entry.get("traits"):
                entry["traits"] = "・".join(traits)
            if not entry.get("profile"):
                entry["profile"] = "掲載記事で確認できる外見の要素：" + "、".join(traits) + "。"
            if entry.get("description", "") in GENERIC:
                entry["description"] = "見分けるときは、" + "・".join(traits) + "の組み合わせに注目します。"
            if "ニックネーム" in summary and entry.get("kind") in (
                "WEB図鑑掲載名（区分は要確認）", "品種・流通名（要照合）"
            ):
                entry["kind"] = "流通名"
            entry["profileBasis"] = "改良メダカWEB図鑑の記事概要から形質キーワードを整理（" + TODAY + "確認）"
            entry["sourceCheckedAt"] = TODAY
            checked += 1
        except (requests.RequestException, ValueError) as exc:
            print("Skipped article", entry.get("webNo"), str(exc)[:100])
            continue
    new_body = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    previous = CATALOG.read_text(encoding="utf-8")
    if previous != new_body:
        CATALOG.write_text(new_body, encoding="utf-8")
    print(f"Archived={len(all_articles)} added={added} verified={checked} catalog={len(catalog)}")
    print("Personal photos and notes were not accessed; only catalog.json can change.")

if __name__ == "__main__":
    main()
