#!/usr/bin/env python3
"""把題庫裡「副檔名是 .wav、實際是 WebM/MP4」的題目音檔轉成 mp3，放進 data/audio/，並改寫題庫網址。

為什麼要轉：題庫的 .wav 網址實際內容是 WebM（Opus），iOS 17.4 以前的 iPhone Safari（含 LINE 內建瀏覽器）
的 <audio> 播不出來，只剩背景音樂。轉成 mp3 後所有瀏覽器都能播。

    python tools/convert_quiz_audio.py          （需要 ffmpeg）

會做的事：
  1. 掃描 data/quiz/*.json、data/quiz/questions_offline.js 與備用題庫 questions_data.js，找出 https://dn9mvjhbyvvpc.cloudfront.net/files/*.wav（與 .webm）
  2. 下載 -> 轉成 mp3（單聲道 24kHz 32kbps，語音夠用）-> data/audio/<原檔名>.mp3；已存在的就跳過
  3. 把上面那些檔案裡成功轉好的網址改成 data/audio/<原檔名>.mp3（相對於網站根目錄）
重新用 data/quiz/download_quiz.py 抓題庫後，再執行一次本程式即可把新的 .wav 轉掉。
"""
import re
import subprocess
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUIZ_DIR = ROOT / "data" / "quiz"
OUT_DIR = ROOT / "data" / "audio"
URL_RE = re.compile(r'https://dn9mvjhbyvvpc\.cloudfront\.net/files/([^"\\\s]+?)\.(?:wav|webm)')


URLS = {}   # 檔名 -> 原始網址


def targets():
    return sorted(list(QUIZ_DIR.glob("*.json")) + [QUIZ_DIR / "questions_offline.js", ROOT / "questions_data.js"])


def convert(name):
    out = OUT_DIR / f"{name}.mp3"
    if out.exists() and out.stat().st_size > 1000:
        return name, True, "exists"
    url = URLS[name]
    last = ""
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
            with tempfile.TemporaryDirectory() as td:
                src = Path(td) / "src.bin"
                src.write_bytes(data)
                tmp = Path(td) / "out.mp3"
                r = subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "24000",
                     "-codec:a", "libmp3lame", "-b:a", "32k", str(tmp)],
                    capture_output=True, text=True)
                if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 1000:
                    last = (r.stderr or "ffmpeg failed").strip()[:200]
                    continue
                out.write_bytes(tmp.read_bytes())
            return name, True, "ok"
        except Exception as e:   # 網路錯誤就重試
            last = str(e)
    return name, False, last


def main():
    files = targets()
    for f in files:
        if f.exists():
            for m in URL_RE.finditer(f.read_bytes().decode("utf-8")):
                URLS[m.group(1)] = m.group(0)
    names = sorted(URLS)
    print(f"{len(names)} 個 .wav 網址待處理")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok, failed = set(), []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for i, (name, good, info) in enumerate(ex.map(convert, names), 1):
            if good:
                ok.add(name)
            else:
                failed.append((name, info))
            if i % 200 == 0 or i == len(names):
                print(f"  {i}/{len(names)}  成功 {len(ok)}  失敗 {len(failed)}", flush=True)
    changed = 0
    for f in files:
        if not f.exists():
            continue
        text = f.read_bytes().decode("utf-8")
        new = URL_RE.sub(lambda m: f"data/audio/{m.group(1)}.mp3" if m.group(1) in ok else m.group(0), text)
        if new != text:
            f.write_bytes(new.encode("utf-8"))
            changed += 1
    total = sum(p.stat().st_size for p in OUT_DIR.glob("*.mp3"))
    print(f"完成：改寫 {changed} 個檔案，data/audio 共 {len(list(OUT_DIR.glob('*.mp3')))} 個 mp3、{total / 1024 / 1024:.1f} MB")
    if failed:
        print("失敗（網址保持原樣）：")
        for name, info in failed[:20]:
            print("  ", name, info)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        sys.exit("找不到 ffmpeg，請先安裝並加入 PATH。")
