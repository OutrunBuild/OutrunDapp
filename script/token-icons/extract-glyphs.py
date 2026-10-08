# UETH/UBNB 字形轮廓提取（可复现）——从本仓在用的官方链图提取字形容迹
# 用法：python3 script/token-icons/extract-glyphs.py （打印 path 数据与 bbox）
# 管线：2048 LANCZOS 放大 → 掩膜 → morph close → findContours → approxDP eps1.4 → 512 坐标
# （logo-vectorize 同族方法论：测量重印，非路径复制；输出进 build.mjs 的 GLYPHS）
from PIL import Image
import numpy as np, cv2

def trace(path_png, glyph_test, eps=1.4, scale_in=2048, scale_out=512):
    im = Image.open(path_png).convert('RGBA').resize((scale_in, scale_in), Image.LANCZOS)
    a = np.array(im)
    r, g, b, al = a[...,0].astype(int), a[...,1].astype(int), a[...,2].astype(int), a[...,3]
    mask = (glyph_test(r, g, b, al)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    k = scale_out / scale_in
    subs = []
    for c in sorted(cnts, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(c) < scale_in*scale_in*0.0015: continue
        ap = cv2.approxPolyDP(c, eps, True)
        pts = [(p[0][0]*k, p[0][1]*k) for p in ap]
        start = min(range(len(pts)), key=lambda i: (round(pts[i][1],1), round(pts[i][0],1)))
        pts = pts[start:] + pts[:start]
        subs.append('M' + ' '.join('%.1f %.1f' % p for p in pts) + 'Z')
    ys, xs = np.where(mask > 0)
    return ' '.join(subs), (float(xs.min()*k), float(ys.min()*k), float(xs.max()*k), float(ys.max()*k))

if __name__ == '__main__':
    for name, p, test in [
        ('UETH', 'public/chains/ethereum.png', lambda r,g,b,al: al > 200),
        ('UBNB', 'public/chains/bnb.png', lambda r,g,b,al: (r>190)&(g>190)&(b>170)&(al>200)),
    ]:
        d, bb = trace(p, test)
        print(f'== {name} bbox x{bb[0]:.1f}..{bb[2]:.1f} y{bb[1]:.1f}..{bb[3]:.1f}')
        print(d)
