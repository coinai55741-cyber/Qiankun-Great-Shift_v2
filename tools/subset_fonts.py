#!/usr/bin/env python3
"""把 GenSekiGothic2TW 原始字型（約 15～16 MB 的 .otf）縮成只含用得到字的 woff2，放進 data/fonts/。

    python tools/subset_fonts.py        （需要 fonttools 與 brotli：pip install fonttools brotli）

保留的字：
  1. 專案裡實際出現的字：題庫（data/quiz、questions_data.js）、網頁文字與程式碼（含客語罕用字，例如「𠊎」）
  2. 大五碼常用字（A440–C67E，共 5401 字）與標點符號區（A140–A3BF），之後新增文案或題目用到常用字時不必重做
  3. ASCII
之後題庫換新或新增罕用字（畫面上看到該字變成別的字型），重新執行本程式即可。
原始 .otf 放在 tools/font-source/，不會被網頁載入。
"""
import glob
import os
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "font-source"
OUT = ROOT / "data" / "fonts"
TEXT_FILES = (
    glob.glob(str(ROOT / "data" / "quiz" / "*.json"))
    + [str(ROOT / n) for n in ("questions_data.js", "index.html", "app.js", "style.css", "README.md")]
    + [str(ROOT / "brush-prototype" / n) for n in ("index.html", "app.js", "style.css")]
)


def big5_chars():
    out = set()
    for hi in list(range(0xA1, 0xA4)) + list(range(0xA4, 0xC7)):   # 符號區 A1–A3、常用字 A4–C6
        for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            try:
                out.add(bytes([hi, lo]).decode("big5"))
            except UnicodeDecodeError:
                pass
    return out


def main():
    used = set()
    for f in TEXT_FILES:
        if os.path.exists(f):
            used |= {c for c in open(f, encoding="utf-8", errors="ignore").read() if ord(c) > 0x7F}
    wanted = used | big5_chars()
    for weight in ("R", "B"):
        font = TTFont(SRC / f"GenSekiGothic2TW-{weight}.otf")
        cmap = font.getBestCmap()
        unicodes = sorted({ord(c) for c in wanted if ord(c) in cmap} | set(range(0x20, 0x7F)))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.notdef_outline = True
        s = subset.Subsetter(opts)
        s.populate(unicodes=unicodes)
        s.subset(font)
        out = OUT / f"GenSekiGothic2TW-{weight}.woff2"
        font.flavor = "woff2"
        font.save(out)
        print(f"{out.name}: {len(unicodes)} 字, {out.stat().st_size / 1048576:.2f} MB")


if __name__ == "__main__":
    main()
