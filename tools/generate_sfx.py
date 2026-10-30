#!/usr/bin/env python3
"""阿黑的客字繪卷 遊戲音效產生器（宣傳影片同款鈴聲）

產生遊戲音效到 data/music/：
  S2_m3_pass.mp3    通過：阿黑平安過橋、該題過關
  S2_m3_help.mp3    伯公協助：金色仙橋出現時的閃光
  S2_m3_finish.mp3  全部通關：進入結果頁的收尾和弦
  S2_m3_ink.mp3     毛筆沾墨：墨滴入硯台的水聲
  S2_m3_write.mp3   毛筆寫字：筆尖擦過宣紙的沙沙聲（無縫循環，遊戲內依書寫速度調音量）
  S2_m3_stamp.mp3   毛筆蓋章：印章落在紙上的悶響

    python tools/generate_sfx.py        （需要 numpy 與 ffmpeg）
樂器沿用 generate_bgm.py（鈴聲、撥弦、墊音），想改音高或長度就改下面 SOUNDS。
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_bgm import SR, bell, note, pad, pluck  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "music"


def mixdown(length, events):
    """events: (時間, 訊號, 增益, 左右位置)"""
    buf = np.zeros((int(length * SR), 2))
    for t, sig, gain, pan in events:
        i = int(t * SR)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        stereo = np.stack([sig * l, sig * r], axis=1) * 1.4142
        e = min(len(stereo), len(buf) - i)
        if e > 0:
            buf[i:i + e] += stereo[:e] * gain
    return buf


rng = np.random.default_rng(11)


def _spectral(noise, shape):
    """在頻域上塑形（圓形卷積），因此頭尾相接、可無縫循環。"""
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(len(noise), 1 / SR)
    return np.fft.irfft(spec * shape(f), len(noise))


def _smooth_band(f, lo, hi, lo_w=200.0, hi_w=800.0):
    return 1 / (1 + np.exp(-(f - lo) / lo_w * 4)) * 1 / (1 + np.exp((f - hi) / hi_w * 4))


def brush_write_loop(dur=1.2):
    """毛筆擦過宣紙：帶通雜訊 + 整數週期的不規則起伏（讓循環接縫一致）。"""
    n = int(dur * SR)
    body = _spectral(rng.standard_normal(n), lambda f: _smooth_band(f, 700, 4200) * (1 + 1.6 * np.exp(-((f - 2200) / 900) ** 2)))
    t = np.arange(n) / SR
    mod = np.zeros(n)
    for cycles, amp in [(3, 1.0), (5, .7), (8, .5), (13, .35), (21, .25)]:
        mod += amp * np.sin(2 * np.pi * cycles * t / dur + rng.uniform(0, 2 * np.pi))
    mod = 0.68 + 0.32 * mod / np.max(np.abs(mod))
    return body / np.max(np.abs(body)) * mod


def ink_dip():
    """墨滴入硯台：兩顆水滴 + 一陣柔和的浸潤聲。"""
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for t0, f0, f1, amp in [(0.0, 950, 320, 1.0), (0.13, 760, 270, 0.6), (0.27, 600, 240, 0.35)]:
        m = t >= t0
        tt = t[m] - t0
        freq = f1 + (f0 - f1) * np.exp(-tt * 30)
        sig[m] += amp * np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt * 26) * np.minimum(1, tt / 0.004)
    swish = _spectral(rng.standard_normal(n), lambda f: _smooth_band(f, 150, 1400, 100, 300))
    swish /= np.max(np.abs(swish))
    sig += 0.45 * swish * np.sin(np.pi * np.clip((t - 0.04) / 0.5, 0, 1)) ** 2
    return sig


def stamp_thud():
    """印章落紙：低頻悶響 + 一點紙張被壓的聲音 + 極短的木頭敲擊。"""
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    freq = 46 + 70 * np.exp(-t * 32)
    thud = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 12) * np.minimum(1, t / 0.002)
    press = _spectral(rng.standard_normal(n), lambda f: _smooth_band(f, 120, 1500, 80, 400))
    press = press / np.max(np.abs(press)) * np.exp(-t * 22) * 0.55
    tick = np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 140) * 0.22
    return thud + press + tick


def bells(names, start, step, dur, gain, spread=0.0):
    n = len(names)
    return [(start + k * step, bell(note(nm), dur), gain, -spread + 2 * spread * k / max(1, n - 1)) for k, nm in enumerate(names)]


SOUNDS = {
    "S2_m3_ink": dict(length=0.7, lufs=-23.0, fade=0.15, events=[(0.0, ink_dip(), 1.0, 0.0)]),
    "S2_m3_stamp": dict(length=0.8, lufs=-18.0, fade=0.25, events=[(0.0, stamp_thud(), 1.0, 0.0)]),
    # 寫字是循環音：不淡出，頭尾直接相接
    "S2_m3_write": dict(length=1.2, lufs=-26.0, fade=0, events=[(0.0, brush_write_loop(), 1.0, 0.0)]),
    # 通過：三顆鈴聲往上走（G-B-D）再補一個高八度的亮點，輕快俐落
    "S2_m3_pass": dict(length=1.6, lufs=-21.0, events=(
        bells(["G5", "B5", "D6"], 0.0, 0.09, 1.3, 0.34, 0.15)
        + [(0.30, bell(note("G6"), 1.1), 0.18, 0.2)]
        + [(0.0, pluck(note("G4"), 0.6, 0.8), 0.22, -0.2)]
    )),
    # 伯公協助：五顆鈴聲快速掃上，像金橋灑下的光點
    "S2_m3_help": dict(length=1.9, lufs=-22.0, events=(
        bells(["D5", "G5", "B5", "D6", "G6"], 0.0, 0.08, 1.4, 0.30, 0.45)
        + [(0.0, pad([note("G3"), note("B3"), note("D4")], 1.6), 0.12, 0.0)]
    )),
    # 全部通關：G 大和弦的「噹啷」，尾音拉長
    "S2_m3_finish": dict(length=3.0, lufs=-21.0, events=(
        bells(["G5", "B5", "D6", "G6"], 0.0, 0.10, 2.2, 0.32, 0.3)
        + [(0.0, pad([note("G3"), note("B3"), note("D4"), note("G4")], 2.8), 0.20, 0.0)]
        + [(0.0, pluck(note("G3"), 1.0, 0.7), 0.24, 0.0)]
    )),
}


def lufs_of(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    return float([l for l in r.stderr.splitlines() if l.strip().startswith("I:")][-1].split()[1])


def write_wav(path, audio):
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    for name, cfg in SOUNDS.items():
        audio = mixdown(cfg["length"], cfg["events"])
        n = int(cfg.get("fade", 0.25) * SR)                  # 結尾淡出，避免被截斷的喀聲（循環音不淡出）
        if n:
            audio[-n:] *= np.linspace(1, 0, n)[:, None]
        audio *= 0.5 / np.max(np.abs(audio))
        wav = OUT_DIR / f"{name}.wav"
        write_wav(wav, audio)
        audio *= 10 ** ((cfg["lufs"] - lufs_of(wav)) / 20)
        peak = np.max(np.abs(audio))
        if peak > 0.9:
            audio *= 0.9 / peak
        write_wav(wav, audio)
        mp3 = OUT_DIR / f"{name}.mp3"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)], check=True)
        wav.unlink()
        print(f"OK {mp3.name}  {cfg['length']}s  {mp3.stat().st_size // 1024}KB  peak {20 * np.log10(np.max(np.abs(audio))):.1f} dBFS")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        sys.exit("找不到 ffmpeg，請先安裝並加入 PATH。")
