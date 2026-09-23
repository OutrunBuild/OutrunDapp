import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: 'Card Surface Review',
  robots: { index: false, follow: false },
};

/**
 * 内部审阅工具（非产品界面）：大卡表面处理四方案 A/B/C/D 产品级完整对比。
 * 每张卡用同一套真实内容结构（错位 Symbol / 分层价格 / KPI 芯片 / 真蜡烛 SVG / live 点 / CTA）
 * 与系统原子（.ax-glitch-text / .ax-signal-dot / 切角），仅表面处理不同，保证公平对比。
 * 2026-09-23 雨夜质感调研（Linear 顶光发丝边 / feTurbulence 噪点 / CP2077·Hyperliquid 素面板）。
 * 样式全部内联本页，不进 globals.css / 不影响产品。
 */

/** 确定性伪随机蜡烛（模块级一次生成，RSC 安全） */
const CANDLES = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: Array<{ o: number; c: number; h: number; l: number }> = [];
  let px = 0.0149;
  for (let i = 0; i < 26; i++) {
    const o = px;
    const c = o * (1 + (rnd() - 0.48) * 0.012);
    out.push({
      o,
      c,
      h: Math.max(o, c) * (1 + rnd() * 0.004),
      l: Math.min(o, c) * (1 - rnd() * 0.004),
    });
    px = c;
  }
  return out;
})();

function MiniCandles() {
  const W = 520;
  const H = 150;
  const PAD = 6;
  const hi = Math.max(...CANDLES.map((k) => k.h));
  const lo = Math.min(...CANDLES.map((k) => k.l));
  const span = hi - lo || 1;
  const step = (W - PAD * 2 - 48) / CANDLES.length;
  const bodyW = Math.max(2, step / 2.6);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  return (
    <svg
      className="cs-candles"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="candles"
    >
      {CANDLES.map((k, i) => {
        const x = PAD + step * (i + 0.5);
        const up = k.c >= k.o;
        return (
          <g key={i} className={up ? 'cs-candle--up' : 'cs-candle--down'}>
            <line x1={x} x2={x} y1={y(k.h)} y2={y(k.l)} strokeWidth="1" />
            <rect
              x={x - bodyW / 2}
              y={y(Math.max(k.o, k.c))}
              width={bodyW}
              height={Math.max(1, y(Math.min(k.o, k.c)) - y(Math.max(k.o, k.c)))}
            />
          </g>
        );
      })}
      {[hi, (hi + lo) / 2, lo].map((v, i) => (
        <text key={i} className="cs-candles__axis" x={W - 46} y={PAD + 6 + ((H - PAD * 2) / 2) * i}>
          {v.toFixed(6)}
        </text>
      ))}
    </svg>
  );
}

export default async function CardSurfaceReviewPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const card = (variant: string, name: string, note: string) => (
    <figure className="cs-review__item">
      <div className={`cs-card cs-card--${variant}`}>
        <div className="cs-card__inner">
          {variant !== 'a' ? <span className="cs-card__inner-bg" aria-hidden="true" /> : null}
          {variant === 'b' ? <span className="cs-card__grain" aria-hidden="true" /> : null}
          <header className="cs-card__row">
            <strong className="cs-card__symbol ax-glitch-text">PEPE2</strong>
            <dl className="cs-card__chips" data-numeric>
              <div>
                <dt>MC:</dt>
                <dd>$15.0M</dd>
              </div>
              <div>
                <dt>LIQ:</dt>
                <dd>$2.4M</dd>
              </div>
              <div>
                <dt>VOL:</dt>
                <dd>$860K</dd>
              </div>
            </dl>
          </header>
          <div className="cs-card__row cs-card__row--main" data-numeric>
            <span className="cs-card__price">
              <span className="cs-card__price-sign">$</span>0.015
              <span className="cs-card__price-tail">000</span>
            </span>
            <span className="cs-card__trend cs-card__trend--up">+1.0%</span>
            <span className="cs-card__ca">0x1a2b…ef12</span>
          </div>
          <div className="cs-card__chart">
            <MiniCandles />
          </div>
          <footer className="cs-card__foot">
            <span className="cs-card__live">
              <span className="ax-signal-dot" />
              LIVE
            </span>
            <span className="cs-card__cta">SWAP</span>
          </footer>
        </div>
      </div>
      <figcaption className="cs-review__caption">
        <b>{`方案 ${variant.toUpperCase()} · ${name}`}</b>
        <span>{note}</span>
      </figcaption>
    </figure>
  );

  return (
    <main className="ax-hud ax-hud-inner cs-review">
      <style>{css}</style>
      <h1 className="cs-review__title">Card Surface · 四方案产品级对比</h1>
      <p className="cs-review__note">
        同一内容结构（错位 Symbol / 分层价格 / KPI 芯片 / 真蜡烛 / live
        点），仅表面处理不同——鼠标悬停可看各方案反馈态。 A=现状（雨线+均匀顶光+底缘品红+角标） ·
        B=雨夜材质【推荐：湿边缘方向描边+噪点镀膜+图表区单点洇光+品红角洗+悬浮投影】 · C=洇光极简（B
        去噪点去品红） · D=线框高反差（纯 Linear：白方向发丝光+深投影，无色洗）。
      </p>
      <div className="cs-review__grid">
        {card('a', '现状基线', '雨线 SVG + 均匀青顶光 + 底缘品红线 + HUD 角标')}
        {card(
          'b',
          '雨夜材质',
          '方向性湿边缘描边（上亮下暗）+ feTurbulence 噪点 + 图表区洇光 + 悬浮投影',
        )}
        {card('c', '洇光极简', 'B 减噪点减品红：只留洇光与渐变描边，最轻的雨夜')}
        {card('d', '线框高反差', '白色方向性发丝边 + 深投影，无任何彩色，纯 Linear 学派')}
      </div>
    </main>
  );
}

const css = `
.cs-review { min-block-size: 100vh; padding: 48px 32px 80px; display: grid; gap: 28px; align-content: start; }
.cs-review__title { margin: 0; font-family: var(--font-display); font-size: 28px; letter-spacing: 0.02em; }
.cs-review__note { margin: 0; max-inline-size: 980px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.7; }
.cs-review__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 36px; }
.cs-review__item { margin: 0; display: grid; gap: 12px; }
.cs-review__caption { display: grid; gap: 2px; }
.cs-review__caption b { font-size: 13px; letter-spacing: 0.04em; }
.cs-review__caption span { color: var(--color-text-secondary); font-size: 12px; }

/* ============ 共用内容结构（四卡同构，保证公平对比） ============ */
.cs-card { position: relative; }
.cs-card__inner { position: relative; display: grid; gap: 16px; padding: 22px 24px; min-block-size: 400px; align-content: start; }
.cs-card__row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.cs-card__row--main { justify-content: flex-start; }
.cs-card__symbol { font-size: 18px; }
.cs-card__chips { display: flex; gap: 8px; margin: 0; }
.cs-card__chips > div { display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 8px; border: 1px solid var(--color-border-signal); background: var(--color-surface-inset); box-shadow: inset 0 1px 0 rgba(0,240,255,0.14); clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); }
.cs-card__chips dt { color: var(--color-text-secondary); font-size: 10px; }
.cs-card__chips dd { margin: 0; font-family: var(--font-data); font-size: 12px; }
.cs-card__price { display: inline-flex; align-items: baseline; font-family: var(--font-data); font-size: 26px; font-weight: 600; }
.cs-card__price-sign, .cs-card__price-tail { font-size: 15px; font-weight: 400; color: var(--color-text-secondary); }
.cs-card__price-sign { margin-inline-end: 1px; }
.cs-card__trend { font-family: var(--font-data); font-size: 13px; }
.cs-card__trend--up { color: var(--color-success); }
.cs-card__ca { margin-inline-start: auto; padding: 2px 8px; border: 1px solid var(--color-border); color: var(--or-cyan); background: var(--color-surface-inset); font-family: var(--font-data); font-size: 11px; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%); white-space: nowrap; }
.cs-card__chart { display: grid; }
.cs-candles { inline-size: 100%; block-size: 150px; }
.cs-candles .cs-candle--up line, .cs-candles .cs-candle--up rect { stroke: var(--color-success); fill: var(--color-success); }
.cs-candles .cs-candle--down line, .cs-candles .cs-candle--down rect { stroke: var(--color-danger); fill: var(--color-danger); }
.cs-candles__axis { fill: var(--color-text-secondary); font-family: var(--font-data); font-size: 10px; }
.cs-card__foot { display: flex; align-items: center; justify-content: space-between; margin-block-start: auto; }
.cs-card__live { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-data); font-size: 11px; letter-spacing: 0.1em; color: var(--color-text-secondary); }
.cs-card__cta { padding: 6px 22px; border: 1px solid var(--color-border-strong); font-size: 12px; letter-spacing: 0.1em; color: var(--color-text-secondary); }

/* 渐变描边通用内衬层（B/C/D）：::before=边色渐变（z-2），.cs-card__inner-bg=卡底+氛围层（z-1），露出 1px 边 */
.cs-card__inner-bg { position: absolute; inset: 1px; z-index: -1; clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%); }

/* ============ A 现状基线（当前产品值原样照搬） ============ */
.cs-card--a .cs-card__inner {
  border: 1px solid var(--color-border-signal);
  background-color: var(--color-surface);
  box-shadow: inset 0 1px 0 rgba(0,240,255,0.32), inset 0 -1px 0 rgba(255,6,181,0.28);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--a .cs-card__inner::after {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background-image:
    linear-gradient(135deg, rgba(255,6,181,0.14), transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'%3E%3Cg stroke='%2300f0ff' stroke-width='1'%3E%3Cline x1='30' y1='20' x2='72' y2='220' opacity='.14'/%3E%3Cline x1='95' y1='300' x2='121' y2='450' opacity='.09'/%3E%3Cline x1='160' y1='120' x2='220' y2='360' opacity='.16'/%3E%3Cline x1='230' y1='520' x2='249' y2='640' opacity='.08'/%3E%3Cline x1='300' y1='60' x2='342' y2='240' opacity='.12'/%3E%3Cline x1='370' y1='380' x2='440' y2='640' opacity='.1'/%3E%3Cline x1='445' y1='180' x2='472' y2='320' opacity='.18'/%3E%3Cline x1='520' y1='620' x2='535' y2='730' opacity='.08'/%3E%3Cline x1='590' y1='40' x2='637' y2='260' opacity='.13'/%3E%3Cline x1='660' y1='330' x2='700' y2='490' opacity='.1'/%3E%3Cline x1='730' y1='130' x2='788' y2='380' opacity='.15'/%3E%3Cline x1='800' y1='540' x2='823' y2='670' opacity='.09'/%3E%3Cline x1='870' y1='240' x2='921' y2='430' opacity='.12'/%3E%3Cline x1='940' y1='60' x2='972' y2='210' opacity='.17'/%3E%3Cline x1='1000' y1='420' x2='1036' y2='650' opacity='.1'/%3E%3Cline x1='1070' y1='150' x2='1112' y2='320' opacity='.13'/%3E%3Cline x1='1130' y1='500' x2='1157' y2='640' opacity='.08'/%3E%3Cline x1='1180' y1='30' x2='1226' y2='230' opacity='.12'/%3E%3Cline x1='55' y1='600' x2='83' y2='730' opacity='.09'/%3E%3Cline x1='275' y1='700' x2='294' y2='810' opacity='.07'/%3E%3Cline x1='640' y1='700' x2='680' y2='850' opacity='.08'/%3E%3Cline x1='960' y1='700' x2='983' y2='820' opacity='.09'/%3E%3Cline x1='420' y1='20' x2='438' y2='150' opacity='.11'/%3E%3Cline x1='760' y1='20' x2='786' y2='140' opacity='.14'/%3E%3Cline x1='1150' y1='250' x2='1190' y2='410' opacity='.1'/%3E%3Cline x1='140' y1='750' x2='156' y2='850' opacity='.07'/%3E%3Cline x1='890' y1='800' x2='918' y2='920' opacity='.08'/%3E%3Cline x1='500' y1='460' x2='518' y2='560' opacity='.12'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 100% 100%, 100% 100%; background-repeat: no-repeat;
}
.cs-card--a .cs-card__inner::before {
  content: ''; position: absolute; inset-block-start: 8px; inset-inline-start: 8px; inline-size: 12px; block-size: 12px; pointer-events: none;
  border-block-start: 2px solid var(--or-cyan); border-inline-start: 2px solid var(--or-cyan);
}

/* ============ B 雨夜材质 ============ */
.cs-card--b .cs-card__inner {
  box-shadow: 0 24px 48px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--b .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(0,240,255,0.5), rgba(0,240,255,0.12) 36%, rgba(255,255,255,0.06) 70%, transparent);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  transition: background var(--motion-fast) var(--ease-out);
}
.cs-card--b .cs-card__inner-bg {
  background-color: var(--color-surface);
  background-image:
    radial-gradient(560px 240px at 34% 58%, rgba(0,240,255,0.08), transparent 62%),
    linear-gradient(135deg, rgba(255,6,181,0.1), transparent 34%);
}
.cs-card--b .cs-card__grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
}
.cs-card--b:hover .cs-card__inner::before {
  background: linear-gradient(165deg, rgba(0,240,255,0.8), rgba(0,240,255,0.2) 36%, rgba(255,255,255,0.08) 70%, transparent);
}
.cs-card--b:hover .cs-card__inner-bg {
  background-image:
    radial-gradient(560px 240px at 34% 58%, rgba(0,240,255,0.13), transparent 62%),
    linear-gradient(135deg, rgba(255,6,181,0.13), transparent 34%);
}

/* ============ C 洇光极简 ============ */
.cs-card--c .cs-card__inner {
  box-shadow: 0 24px 48px rgba(0,0,0,0.45);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--c .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(0,240,255,0.42), rgba(0,240,255,0.1) 38%, transparent 74%);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  transition: background var(--motion-fast) var(--ease-out);
}
.cs-card--c .cs-card__inner-bg {
  background-color: var(--color-surface);
  background-image: radial-gradient(560px 240px at 34% 58%, rgba(0,240,255,0.07), transparent 62%);
}
.cs-card--c:hover .cs-card__inner::before {
  background: linear-gradient(165deg, rgba(0,240,255,0.62), rgba(0,240,255,0.16) 38%, transparent 74%);
}

/* ============ D 线框高反差 ============ */
.cs-card--d .cs-card__inner {
  box-shadow: 0 28px 56px rgba(0,0,0,0.5);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--d .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08) 42%, transparent 78%);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  transition: background var(--motion-fast) var(--ease-out);
}
.cs-card--d .cs-card__inner-bg { background-color: var(--color-surface); }
.cs-card--d:hover .cs-card__inner::before {
  background: linear-gradient(165deg, rgba(255,255,255,0.4), rgba(255,255,255,0.12) 42%, transparent 78%);
}
`;
