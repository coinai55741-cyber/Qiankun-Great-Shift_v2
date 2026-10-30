#!/usr/bin/env python3
"""阿黑的客字繪卷 背景音樂產生器（宣傳影片同款曲風）

沿用宣傳影片（promo/src/audio.py）的樂器與旋律：G 大調、116 BPM，
撥弦分解和弦 + 木魚 + 鼓 + 沙鈴 + 低音，後半段旋律加高八度、鈴聲點綴。
輸出 16 小節（約 33 秒）可無縫循環的 data/music/S2_m3_bgmloop.mp3。

    python tools/generate_bgm.py        （需要 numpy 與 ffmpeg）

想調整風格：改下面「作曲設定」的速度、和弦、旋律，或最下方的 TARGET_LUFS。
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "data" / "music" / "S2_m3_bgmloop.mp3"
TARGET_LUFS = -23.7   # 整體響度；遊戲內再用 audio.volume 控制大小

# ---------------------------------------------------------------- 作曲設定
BPM = 116
BEAT = 60 / BPM
BAR = BEAT * 4
N_BARS = 16
LOOP_LEN = int(round(N_BARS * BAR * SR))
TAIL = int(3.0 * SR)   # 尾音折回開頭，讓循環接縫聽不出來

CHORDS = {
    "G":  dict(root="G2", tones=["G3", "B3", "D4"],  arp=["G4", "B4", "D5", "B4"]),
    "Em": dict(root="E2", tones=["E3", "G3", "B3"],  arp=["E4", "G4", "B4", "G4"]),
    "C":  dict(root="C3", tones=["C3", "G3", "E4"],  arp=["E4", "G4", "C5", "G4"]),
    "D":  dict(root="D3", tones=["D3", "A3", "F#3"], arp=["F#4", "A4", "D5", "A4"]),
}
PROG = ["G", "Em", "C", "D"] * 4

# 每小節 8 個八分音符，None 為休止
MEL_A = [
    ["B4", None, "D5", None, "E5", "D5", "B4", None],
    ["E5", None, "D5", "B4", None, "A4", "B4", None],
    ["D5", None, "B4", "G4", None, "A4", "B4", "D5"],
    ["A4", None, "B4", "D5", None, "E5", "D5", None],
]
MEL_B = [
    ["D5", "E5", "G5", None, "E5", "D5", "B4", "D5"],
    ["E5", None, "G5", "E5", "D5", "B4", None, "A4"],
    ["G5", None, "E5", "D5", "E5", None, "D5", "B4"],
    ["A4", "B4", "D5", "E5", "D5", None, "G5", None],
]


# ---------------------------------------------------------------- 樂器
def note(name):
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[name[0]]
    rest = name[1:]
    if rest.startswith("#"):
        n += 1
        rest = rest[1:]
    return 440.0 * 2 ** ((n + 12 * (int(rest) - 4) - 9) / 12)


def env_t(dur):
    return np.arange(int(dur * SR)) / SR


def pluck(freq, dur=1.2, bright=1.0):
    t = env_t(dur)
    sig = np.zeros_like(t)
    for n in range(1, 10):
        if freq * n > 9000:
            break
        sig += (1 / n ** 1.25) * np.sin(2 * np.pi * freq * n * t + 0.3 * n) * np.exp(-t * (2.2 + 2.2 * n * bright))
    sig *= (1 - np.exp(-t * 900))
    sig *= np.minimum(1, (dur - t) / 0.05)
    return sig / 1.6


def bell(freq, dur=1.6):
    t = env_t(dur)
    sig = (np.sin(2 * np.pi * freq * t) * np.exp(-t * 3.0)
           + 0.45 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 5.5)
           + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 9))
    sig *= (1 - np.exp(-t * 1500))
    return sig * 0.7


def pad(freqs, dur):
    t = env_t(dur)
    sig = np.zeros_like(t)
    for f in freqs:
        sig += np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t + 1) + 0.12 * np.sin(2 * np.pi * f * 3.003 * t)
    a = np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 0.7)
    return sig * a / (len(freqs) * 1.5)


def bass(freq, dur=0.55):
    t = env_t(dur)
    sig = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return sig * np.exp(-t * 4.5) * (1 - np.exp(-t * 300)) * np.minimum(1, (dur - t) / 0.04)


def kick(dur=0.28):
    t = env_t(dur)
    f = 50 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


def woodblock(dur=0.12, f=1250):
    t = env_t(dur)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 55) * 0.6


rng = np.random.default_rng(3)


def shaker(dur=0.07):
    t = env_t(dur)
    n = np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))   # 簡單高通
    return n * np.exp(-t * 60) * np.minimum(1, t / 0.004) * 0.35


# ---------------------------------------------------------------- 混音
class Mix:
    def __init__(self):
        self.buf = np.zeros((LOOP_LEN + TAIL, 2))

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * 1.4142
        e = min(len(sig), len(self.buf) - i)
        if e > 0:
            self.buf[i:i + e] += sig[:e] * gain

    def folded(self):
        """尾音折回開頭 -> 長度剛好 LOOP_LEN、頭尾相連。"""
        out = self.buf[:LOOP_LEN].copy()
        tail = self.buf[LOOP_LEN:LOOP_LEN + TAIL]
        out[:len(tail)] += tail
        return out


def render():
    mx = Mix()
    for b in range(N_BARS):
        t0 = b * BAR
        ch = CHORDS[PROG[b]]
        second_half = b >= N_BARS // 2

        mx.add(pad([note(n) for n in ch["tones"]], BAR + 0.4), t0, gain=0.10)

        # 撥弦分解和弦
        for k in range(8):
            mx.add(pluck(note(ch["arp"][k % 4]), 0.9, 0.8), t0 + k * BEAT / 2, gain=0.20, pan=-0.35)

        # 低音與鼓組
        mx.add(bass(note(ch["root"])), t0, gain=0.55)
        mx.add(bass(note(ch["root"]) * 1.5), t0 + BEAT * 2.5, gain=0.35)
        mx.add(bass(note(ch["root"])), t0 + BEAT * 2, gain=0.40)
        mx.add(kick(), t0, gain=0.55)
        mx.add(kick(), t0 + BEAT * 2, gain=0.50)
        mx.add(woodblock(), t0 + BEAT, gain=0.34, pan=0.2)
        mx.add(woodblock(f=1500), t0 + BEAT * 3, gain=0.30, pan=0.2)
        for k in range(8):
            mx.add(shaker(), t0 + k * BEAT / 2, gain=0.55 if k % 2 else 0.30, pan=0.35)

        # 旋律：前 8 小節 A、後 8 小節 B（加低八度疊音）
        slots = (MEL_B if second_half else MEL_A)[b % 4]
        for k, nn in enumerate(slots):
            if not nn:
                continue
            f = note(nn)
            mx.add(pluck(f, 0.7, 1.0), t0 + k * BEAT / 2, gain=0.42, pan=0.25)
            if second_half and k % 2 == 0:
                mx.add(pluck(f / 2, 0.7, 0.8), t0 + k * BEAT / 2, gain=0.12, pan=0.25)

        # 後半段每 4 小節的開頭加一記鈴聲
        if second_half and b % 4 == 0:
            mx.add(bell(note("G5")), t0 + 0.02, gain=0.16, pan=0.4)
    return mx.folded()


def lufs(wav_path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav_path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    line = [l for l in r.stderr.splitlines() if l.strip().startswith("I:")][-1]
    return float(line.split()[1])


def write_wav(path, audio):
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    audio = render()
    audio -= audio.mean(axis=0, keepdims=True)
    audio *= 0.5 / np.max(np.abs(audio))          # 先正規化再量響度、校正到目標 LUFS

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wav_path = OUT.with_suffix(".wav")
    write_wav(wav_path, audio)
    gain = 10 ** ((TARGET_LUFS - lufs(wav_path)) / 20)
    audio *= gain
    peak = np.max(np.abs(audio))
    if peak > 0.95:                                # 保險：避免爆音
        audio *= 0.95 / peak
    write_wav(wav_path, audio)

    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
                    "-codec:a", "libmp3lame", "-b:a", "128k", str(OUT)], check=True)
    wav_path.unlink()
    print(f"OK -> {OUT}  ({LOOP_LEN / SR:.1f} 秒, {OUT.stat().st_size // 1024} KB, 峰值 {20 * np.log10(np.max(np.abs(audio))):.1f} dBFS)")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        sys.exit("找不到 ffmpeg，請先安裝並加入 PATH。")
