#!/usr/bin/env python3
"""把遊戲用的大張 PNG 轉成 WebP（品質 90、保留透明），原始 PNG 收在 tools/image-source/ 供日後重轉。

    python tools/convert_images.py          （需要 Pillow）

只處理 data/image 下超過 40KB 的 PNG（小圖示轉了省不了多少）。轉完後程式碼裡的 .png 路徑要改成 .webp。
"""
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "image-source"
MIN_BYTES = 40 * 1024


def main():
    total_in = total_out = 0
    for png in sorted((ROOT / "data" / "image").rglob("*.png")):
        size = png.stat().st_size
        if size < MIN_BYTES:
            continue
        rel = png.relative_to(ROOT / "data" / "image")
        keep = SRC / rel
        keep.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(png), str(keep))
        with Image.open(keep) as im:
            im.load()
            out = png.with_suffix(".webp")
            im.save(out, "WEBP", quality=90, alpha_quality=100, method=6)
        total_in += size
        total_out += out.stat().st_size
        print(f"{rel}: {size / 1024:.0f}K -> {out.stat().st_size / 1024:.0f}K")
    print(f"合計 {total_in / 1048576:.1f}MB -> {total_out / 1048576:.1f}MB")


if __name__ == "__main__":
    main()
