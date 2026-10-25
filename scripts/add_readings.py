#!/usr/bin/env python3
"""Add search-only Japanese kana readings to a local medaka catalog.

No external user photos/notes are involved. Existing hand-verified readings win.
Pykakasi handles compound names, with verified cultivar-name exceptions.
The readings are search helpers, NOT proof of official pronunciation.
"""
import json
import pathlib
import re
import unicodedata
from pykakasi import kakasi

CATALOG = pathlib.Path(__file__).resolve().parent.parent / "catalog.json"
k = kakasi()
# Verified from the named sources and/or the article's own parenthetical reading.
OVERRIDES = {
    "幹之": "みゆき",
    "楊貴妃": "ようきひ",
    "初恋": "はつこい",
    "鱗光": "りんこう",
    "王華": "おうか",
    "夜桜": "よざくら",
    "深海": "しんかい",
    "青蝶": "あおちょう",
    "紅薊": "べにあざみ",
    "琴姫": "ことひめ",
    "黒百式": "くろひゃくしき",
    "月華": "げっか",
    "月下美人": "げっかびじん",
    "月神": "げっしん",
    "月弓": "つくゆみ",
    "雲州三色": "うんしゅうさんしょく",
    "東天光": "とうてんこう",
    "花魁": "おいらん",
    "紗々": "さしゃ",
    "緋牡丹": "ひぼたん",
    "錦秋": "きんしゅう",
    "虹": "にじ",
    "透明鱗": "とうめいりん",
    "半透明鱗": "はんとうめいりん",
    "体外光": "たいがいこう",
    "体内光": "たいないこう",
    "腹膜": "ふくまく",
    "白": "しろ",
    "青": "あお",
    "黒": "くろ",
    "朱赤": "しゅあか",
    "三色": "さんしょく",
    "紅白": "こうはく",
    "黄金": "おうごん",
    "出目": "でめ",
    "目前": "めまえ",
    "ヒレ長": "ひれなが",
    "流星": "りゅうせい",
    "錦": "にしき",
    "雪": "ゆき",
    "桜": "さくら",
    "鳳凰": "ほうおう",
    "緋": "ひ",
    "白斑": "しろぶち",
    "鯖の極み": "さばのきわみ",
    "墨武": "ぼぶ",
    "魔王": "まおう",
    "卑弥呼": "ひみこ",
    "紅ほっぺ": "べにほっぺ",
    "黒龍": "こくりゅう",
    "鈴蘭": "すずらん",
    "スズラン": "すずらん",
    "福星": "ふくせい",
    "五式": "ごしき",
    "竜章鳳姿": "りゅうしょうほうし",
    "龍の瞳": "りゅうのひとみ",
    "アグリアス": "あぐりあす",
    "エンゼル": "えんぜる"
}
SUBSTITUTIONS = sorted(OVERRIDES.items(), key=lambda p: len(p[0]), reverse=True)
# Kanji + parenthetical phonetics: 王華（おうか） -> おうか
RUBY = re.compile(r"([\u3400-\u9fff々〆ヶ]+)[（(]([ぁ-ゖァ-ヶー・]+)[）)]")

def to_hira(text):
    result = []
    for seg in k.convert(unicodedata.normalize("NFKC", text)):
        result.append(seg.get("hira", seg.get("orig", "")))
    return "".join(result).replace("ゔ", "ぶ").replace(" ", "").replace("　", "")

def reading_for(name):
    # Explicit ruby in WEB図鑑 names has higher priority than dictionary guessing.
    work = RUBY.sub(lambda m: to_hira(m.group(2)), name)
    work = re.sub(r"[（(](?:図鑑No\.?\s*\d+|品種No\.?\s*\d+)[）)]", "", work, flags=re.I)
    for target, reading in SUBSTITUTIONS:
        if target in work:
            work = work.replace(target, reading)
    work = to_hira(work)
    return re.sub(r"[^\u3040-\u309fー0-9a-z]", "", work.lower())

def run():
    records = json.loads(CATALOG.read_text(encoding="utf-8"))
    changed = 0
    for entry in records:
        if not entry.get("name"):
            continue
        computed = reading_for(entry["name"])
        if not computed:
            continue
        old = entry.get("reading", "")
        if not old:
            entry["reading"] = computed
            entry["readingBasis"] = "よみがな検索用（自動推定・要確認）"
            changed += 1
        # A manually checked pronunciation is authoritative for searching.
        # Do not introduce speculative machine readings as alternate names.
        # Users can change pronunciations inside the app if sources disagree.
    if changed:
        CATALOG.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Reading index changed entries: {changed}; total: {len(records)}")

if __name__ == "__main__":
    run()
