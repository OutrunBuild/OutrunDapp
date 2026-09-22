# OUTRUN Logo Package

商用级标志资产包。`01–03` 由 `g10-final-black.png` 经标准矢量化管线（vtracer + potrace + svgo + resvg）转换；`04–06` 为 OR monogram（源稿 `docs/design/logo-variants/or-monogram/concepts/symbol_logo.png`，管线 `script/logo-vectorize/or_monogram_v3.py` → `export_or.mjs`）。

- 验收页：[preview.html](preview.html)
- 使用规范 / 色彩 / 最小尺寸 / 管线说明：[logo-spec.md](logo-spec.md)

```
01-primary/   双色字标 svg（transparent / onblack / currentColor）+ png 256–2048 + jpg
02-reverse/   反白 mono-white svg + png
03-mono/      单色 black / yellow / magenta / currentColor svg + png
04-symbol/    OR monogram（color / currentColor / themed / mono-white / mono-black / mono-yellow / mono-magenta + png 128–512）
05-favicon/   favicon.svg · favicon.ico（16/32 mono + 48 dual）· apple-touch-icon
06-app-icon/  PWA maskable 192 / 512 / 1024（黑底 + 光学居中）
```
