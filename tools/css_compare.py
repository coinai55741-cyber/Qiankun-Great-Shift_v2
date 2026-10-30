"""Pixel-diff two css_snapshot output folders:  python tools/css_compare.py <before> <after> [tolerance=8]"""
import sys, os, glob
from PIL import Image, ImageChops
import numpy as np
a, b = sys.argv[1:3]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 8
diffdir = f"diff_{os.path.basename(a)}_vs_{os.path.basename(b)}"
os.makedirs(diffdir, exist_ok=True)
names = sorted(os.path.basename(f) for f in glob.glob(f"{a}/*.png"))
bad = 0
for n in names:
    fb = f"{b}/{n}"
    if not os.path.exists(fb):
        print("MISSING in", b, n); bad += 1; continue
    ia = Image.open(f"{a}/{n}").convert('RGB'); ib = Image.open(fb).convert('RGB')
    if ia.size != ib.size:
        print(f"SIZE  {n}: {ia.size} vs {ib.size}"); bad += 1; continue
    d = np.asarray(ImageChops.difference(ia, ib)).max(axis=2)
    m = d > tol
    cnt = int(m.sum())
    if cnt:
        ys, xs = np.where(m)
        print(f"DIFF  {n}: {cnt} px  bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}")
        out = ib.copy(); arr = np.asarray(out).copy(); arr[m] = (255, 0, 255); Image.fromarray(arr).save(f"{diffdir}/{n}")
        bad += 1
print(f"{len(names)} images compared, {bad} differ (tol {tol})")
