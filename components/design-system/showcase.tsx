import Link from 'next/link'

import type { Locale, VerseStage } from '@/lib/data/fixture-repository'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { OutrunShell } from '@/components/global/app-shell'
import { getCopy } from '@/components/global/copy'
import { ProgressMeter, SectionHeading, StageBadge } from '@/components/global/signal-ui'

const STAGES: readonly VerseStage[] = ['genesis', 'locked', 'unlocked', 'refund']

const COLOR_ROLES = [
  { token: '--color-bg', zh: '页面底', en: 'Page background' },
  { token: '--color-surface', zh: '面板', en: 'Surface' },
  { token: '--color-surface-raised', zh: '抬升面板', en: 'Raised surface' },
  { token: '--color-surface-inset', zh: '凹陷面板', en: 'Inset surface' },
  { token: '--accent-primary', zh: '黄 · 主行动', en: 'Yellow · primary action' },
  { token: '--accent-link', zh: '青 · 功能/选中', en: 'Cyan · function / selection' },
  { token: '--accent-echo', zh: '品红 · 回声层', en: 'Magenta · echo layer' },
  { token: '--color-success', zh: '成功', en: 'Success' },
  { token: '--color-warning', zh: '警告', en: 'Warning' },
  { token: '--color-danger', zh: '危险', en: 'Danger' },
] as const

const TYPE_ROLES = [
  { className: 'ds-type-display', zh: '展示标题 · Saira Condensed', en: 'Display · Saira Condensed' },
  { className: 'ds-type-body', zh: '正文 · IBM Plex Sans', en: 'Body · IBM Plex Sans' },
  { className: 'ds-type-data', zh: '数据 · IBM Plex Mono', en: 'Data · IBM Plex Mono' },
] as const

const TONES = ['success', 'warning', 'danger', 'neutral'] as const

const COPY = {
  zh: {
    title: '设计系统',
    intro: '暗端信号台的活体契约。每个区块只用系统 token 与已登记组件，视觉一旦偏离即为回归。',
    tokens: '色彩角色',
    tokensDesc: '语义 token，而非色值。黄只做行动，青只做功能，品红只做回声。',
    type: '字体角色',
    typeDesc: '三族字体各司其职，数字一律 data-numeric。',
    controls: '基础控件',
    controlsDesc: 'components/ui 的品牌形态：斜切、青描边、黄主按钮。',
    stages: '阶段与状态',
    stagesDesc: '状态通过 data-stage / data-tone 表达，颜色由 CSS 映射。',
    form: '表单',
    formDesc: 'FieldGroup + Field；数字输入使用 data-numeric。',
    empty: '空态',
    emptyTitle: '这里还没有信号',
    emptyBody: '空态也要给出下一步。',
    back: '回到 Explore',
    guide: '规范入口：docs/design-system/README.md',
    progress: '创世进度',
    amountLabel: '数量',
    amountHint: '仅数字，不含单位。',
    sample: '灵活的信号台，稳定的价值',
    dataSample: '1,204,500.00',
  },
  en: {
    title: 'Design system',
    intro: 'Living contract of the dark signal deck. Every block uses only system tokens and registered components; any visual drift here is a regression.',
    tokens: 'Color roles',
    tokensDesc: 'Semantic tokens, never raw values. Yellow acts, cyan functions, magenta echoes.',
    type: 'Type roles',
    typeDesc: 'Three families, three jobs. Numbers always carry data-numeric.',
    controls: 'Base controls',
    controlsDesc: 'Brand form of components/ui: chamfers, cyan outline, yellow primary.',
    stages: 'Stages and status',
    stagesDesc: 'State is expressed through data-stage / data-tone; CSS owns the color mapping.',
    form: 'Forms',
    formDesc: 'FieldGroup + Field; numeric inputs use data-numeric.',
    empty: 'Empty state',
    emptyTitle: 'No signal here yet',
    emptyBody: 'Even empty states offer a next step.',
    back: 'Back to Explore',
    guide: 'Spec entry: docs/design-system/README.md',
    progress: 'Genesis progress',
    amountLabel: 'Amount',
    amountHint: 'Digits only, no unit.',
    sample: 'Flexible signal deck, stable value',
    dataSample: '1,204,500.00',
  },
} as const

export function DesignSystemShowcase({ locale }: { locale: Locale }) {
  const t = COPY[locale]
  const copy = getCopy(locale)

  return (
    <OutrunShell locale={locale} current="discover" accountAddress="">
      {/* v0 Design System Showcase Page */}
      <div className="page-intro">
        <div>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
      </div>

      <section className="ds-section" aria-labelledby="ds-tokens">
        <SectionHeading title={t.tokens} description={t.tokensDesc} />
        <ul className="ds-swatches" id="ds-tokens">
          {COLOR_ROLES.map((role) => (
            <li key={role.token} className="ds-swatch">
              <span className="ds-swatch__chip" style={{ background: `var(${role.token})` }} aria-hidden="true" />
              <span className="ds-swatch__meta">
                <strong>{role[locale]}</strong>
                <code data-numeric>{role.token}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ds-section" aria-labelledby="ds-type">
        <SectionHeading title={t.type} description={t.typeDesc} />
        <ul className="ds-type-list" id="ds-type">
          {TYPE_ROLES.map((role) => (
            <li key={role.className}>
              <small>{role[locale]}</small>
              <span className={role.className} data-numeric={role.className === 'ds-type-data' ? true : undefined}>
                {role.className === 'ds-type-data' ? t.dataSample : t.sample}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ds-section" aria-labelledby="ds-controls">
        <SectionHeading title={t.controls} description={t.controlsDesc} />
        <div className="ds-row" id="ds-controls">
          <Button>{copy.common.connect}</Button>
          <Button variant="outline">{copy.discovery.clear}</Button>
          <Button variant="secondary">{copy.common.home}</Button>
          <Button variant="ghost">{copy.common.discover}</Button>
          <Button disabled>{copy.common.unavailable}</Button>
        </div>
        <div className="ds-row">
          <Button size="sm">{copy.common.connect}</Button>
          <Button size="lg">{copy.common.connect}</Button>
        </div>
      </section>

      <section className="ds-section" aria-labelledby="ds-stages">
        <SectionHeading title={t.stages} description={t.stagesDesc} />
        <div className="ds-row" id="ds-stages">
          {STAGES.map((stage) => (
            <StageBadge key={stage} stage={stage} locale={locale} />
          ))}
        </div>
        <ul className="ds-row ds-tones">
          {TONES.map((tone) => (
            <li key={tone}>
              <span className="status-dot" data-tone={tone} aria-hidden="true" />
              <code>{tone}</code>
            </li>
          ))}
        </ul>
        <div className="ds-meter">
          <ProgressMeter label={t.progress} value={62.5} amount={625000} threshold={1000000} locale={locale} />
        </div>
      </section>

      <section className="ds-section" aria-labelledby="ds-form">
        <SectionHeading title={t.form} description={t.formDesc} />
        <div className="ds-form" id="ds-form">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ds-amount">{t.amountLabel}</FieldLabel>
              <Input id="ds-amount" className="numeric-input" inputMode="decimal" placeholder="0.00" data-numeric readOnly />
              <FieldDescription>{t.amountHint}</FieldDescription>
            </Field>
          </FieldGroup>
        </div>
      </section>

      <section className="ds-section" aria-labelledby="ds-empty">
        <SectionHeading title={t.empty} />
        <div className="empty-state" id="ds-empty">
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptyBody}</p>
          <Button nativeButton={false} render={<Link href={`/${locale}/memeverse`} />}>
            {t.back}
          </Button>
        </div>
      </section>

      <p className="ds-guide">{t.guide}</p>
    </OutrunShell>
  )
}
