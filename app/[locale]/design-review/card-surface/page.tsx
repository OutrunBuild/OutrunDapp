import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: 'Card Surface Review',
  robots: { index: false, follow: false },
};

/**
 * 内部审阅工具（非产品界面）：大卡表面处理四方案 A/B/C/D 实物对比。
 * 2026-09-23 雨夜质感调研（Linear 顶光发丝边 / feTurbulence 噪点 / CP2077·Hyperliquid 素面板）
 * 结论沉淀为 B 方案「雨夜材质」——方向性湿边缘描边 + 噪点镀膜 + 单点霓虹洇光 + 悬浮投影。
 * 样式全部内联在本页 <style>，不进 globals.css / 不影响产品。
 */
export default async function CardSurfaceReviewPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const card = (variant: string) => (
    <figure className="cs-review__item">
      <div className={`cs-card cs-card--${variant}`}>
        <div className="cs-card__inner">
          {variant !== 'a' ? <span className="cs-card__inner-bg" aria-hidden="true" /> : null}
          {variant === 'b' ? <span className="cs-card__grain" aria-hidden="true" /> : null}
          <header className="cs-card__head">
            <h3 className="cs-card__title">PEPE2 / USDT</h3>
            <span className="cs-card__price">$0.015</span>
          </header>
          <dl className="cs-card__kpis" data-numeric>
            <div>
              <dt>MC</dt>
              <dd>$15.0M</dd>
            </div>
            <div>
              <dt>LIQ</dt>
              <dd>$2.4M</dd>
            </div>
            <div>
              <dt>24H VOL</dt>
              <dd>$860K</dd>
            </div>
          </dl>
          <div className="cs-card__plot" data-numeric>
            <span>0.015060</span>
            <span>0.015030</span>
            <span>0.015000</span>
          </div>
          <div className="cs-card__foot">
            <span className="cs-card__signal" />
            <span className="cs-card__cta">SWAP</span>
          </div>
        </div>
      </div>
      <figcaption className="cs-review__caption">{`方案 ${variant.toUpperCase()}`}</figcaption>
    </figure>
  );

  return (
    <main className="ax-hud ax-hud-inner cs-review">
      <style>{css}</style>
      <h1 className="cs-review__title">Card Surface · 四方案对比</h1>
      <p className="cs-review__note">
        A=现状基线（雨线+均匀顶光） ·
        B=雨夜材质【推荐：方向性湿边缘+噪点镀膜+图表区单点洇光+悬浮投影】 · C=洇光极简（B 去噪点） ·
        D=线框高反差（纯 Linear 学派，无色洗无噪点）
      </p>
      <div className="cs-review__grid">
        {card('a')}
        {card('b')}
        {card('c')}
        {card('d')}
      </div>
    </main>
  );
}

const css = `
.cs-review { min-block-size: 100vh; padding: 48px 32px 80px; display: grid; gap: 24px; align-content: start; }
.cs-review__title { margin: 0; font-family: var(--font-display); font-size: 28px; letter-spacing: 0.02em; }
.cs-review__note { margin: 0; max-inline-size: 900px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.7; }
.cs-review__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
.cs-review__item { margin: 0; display: grid; gap: 10px; }
.cs-review__caption { color: var(--color-text-secondary); font-family: var(--font-data); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }

.cs-card { position: relative; }
.cs-card__inner { position: relative; display: grid; gap: 18px; padding: 24px; min-block-size: 330px; }
.cs-card__head { display: flex; justify-content: space-between; align-items: baseline; }
.cs-card__title { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }
.cs-card__price { font-family: var(--font-data); font-size: 22px; font-weight: 600; }
.cs-card__kpis { display: flex; gap: 8px; margin: 0; }
.cs-card__kpis > div { display: grid; gap: 2px; min-inline-size: 96px; padding: 8px 12px; }
.cs-card__kpis dt { color: var(--color-text-secondary); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
.cs-card__kpis dd { margin: 0; font-family: var(--font-data); font-size: 15px; }
.cs-card__plot { display: grid; align-content: space-between; justify-items: end; min-block-size: 120px; padding: 10px 12px; font-family: var(--font-data); font-size: 11px; color: var(--color-text-secondary); }
.cs-card__foot { display: flex; align-items: center; justify-content: space-between; }
.cs-card__signal { inline-size: 5px; block-size: 5px; background: var(--or-cyan); }
.cs-card__cta { padding: 6px 18px; border: 1px solid var(--color-border-strong); font-size: 12px; letter-spacing: 0.08em; color: var(--color-text-secondary); }

/* 渐变描边通用内衬层（B/C/D）：::before=边色渐变，.cs-card__inner-bg=卡底+氛围层，露出 1px 边 */
.cs-card__inner-bg {
  position: absolute; inset: 1px; z-index: -1;
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%);
}

/* —— A 现状基线：border-signal + 均匀顶光 + 底缘品红 + 雨线 SVG —— */
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
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='900' viewBox='0 0 1200 900'%3E%3Cg stroke='%2300f0ff' stroke-width='1'%3E%3Cline x1='30' y1='20' x2='72' y2='220' opacity='.14'/%3E%3Cline x1='160' y1='120' x2='220' y2='360' opacity='.16'/%3E%3Cline x1='300' y1='60' x2='342' y2='240' opacity='.12'/%3E%3Cline x1='445' y1='180' x2='472' y2='320' opacity='.18'/%3E%3Cline x1='590' y1='40' x2='637' y2='260' opacity='.13'/%3E%3Cline x1='730' y1='130' x2='788' y2='380' opacity='.15'/%3E%3Cline x1='870' y1='240' x2='921' y2='430' opacity='.12'/%3E%3Cline x1='940' y1='60' x2='972' y2='210' opacity='.17'/%3E%3Cline x1='1070' y1='150' x2='1112' y2='320' opacity='.13'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 100% 100%, 100% 100%; background-repeat: no-repeat;
}

/* —— B 雨夜材质：方向性湿边缘描边 + 噪点镀膜 + 图表区单点洇光 + 品红角洗 + 悬浮投影 —— */
.cs-card--b .cs-card__inner {
  box-shadow: 0 24px 48px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--b .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(0,240,255,0.5), rgba(0,240,255,0.12) 36%, rgba(255,255,255,0.06) 70%, transparent);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--b .cs-card__inner-bg {
  background-color: var(--color-surface);
  background-image:
    radial-gradient(560px 260px at 32% 52%, rgba(0,240,255,0.08), transparent 62%),
    linear-gradient(135deg, rgba(255,6,181,0.1), transparent 34%);
}
.cs-card--b .cs-card__grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* —— C 洇光极简：B 去噪点去品红，仅图表区洇光 + 描边 + 投影 —— */
.cs-card--c .cs-card__inner {
  box-shadow: 0 24px 48px rgba(0,0,0,0.45);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--c .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(0,240,255,0.42), rgba(0,240,255,0.1) 38%, transparent 74%);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--c .cs-card__inner-bg {
  background-color: var(--color-surface);
  background-image: radial-gradient(560px 260px at 32% 52%, rgba(0,240,255,0.07), transparent 62%);
}

/* —— D 线框高反差：无色洗无噪点，白方向性发丝光 + 深投影（纯 Linear 学派） —— */
.cs-card--d .cs-card__inner {
  box-shadow: 0 24px 48px rgba(0,0,0,0.5);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--d .cs-card__inner::before {
  content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
  background: linear-gradient(165deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08) 42%, transparent 78%);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
}
.cs-card--d .cs-card__inner-bg {
  background-color: var(--color-surface);
}
`;
