'use client'

import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Locale, PrototypeAsset, PrototypeYieldSource } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { formatAmount, ProgressMeter, SourceRef } from './signal-ui'

// 预购与普通/杠杆创世同级的独立路径（用户裁定 2026-09-21）；普通/杠杆模式内提供一键预购
type ParticipationMode = 'standard' | 'leverage' | 'preorder'
// credit=杠杆利息创世积分直付（仅杠杆模式；polend.md 两种付息方式之一，锁定时销毁）
// direct=直接参与：募集 uAsset 直付或储备资产面值直兑合并为一路径（2026-09-22 用户裁定，支付资产下拉区分）
type ParticipationRoute = 'direct' | 'stake' | 'credit'

// 预购容量公式系数（容量=(普通资金+杠杆债务本金)×70%×容量比例——glossary；一次性比例非年化）
const PREORDER_CAP_RATE = 0.7

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole}.${fraction.join('')}` : whole
}

/** 帮助文案模板填充：{asset}=所选支付资产、{raise}=本 Verse 募集 uAsset 符号 */
function fill(template: string, values: { asset: string; raise: string }) {
  return template.replace(/\{asset\}/g, values.asset).replace(/\{raise\}/g, values.raise)
}

export function ParticipationPanel({
  locale,
  raiseAsset,
  reserves,
  yieldSourceRegistry,
  creditAsset,
  normalRaised,
  preorderRaised,
  preorderCapacityRatio,
  leverageInterestRate,
  leverageDebtCap,
  leverageInterestRaised,
  sourceRef,
}: {
  locale: Locale
  raiseAsset: PrototypeAsset | null
  reserves: PrototypeAsset[]
  yieldSourceRegistry: PrototypeYieldSource[]
  creditAsset: PrototypeAsset | null
  normalRaised: number
  preorderRaised: number
  preorderCapacityRatio: number | null
  leverageInterestRate: number | null
  leverageDebtCap: number | null
  leverageInterestRaised: number
  sourceRef: string
}) {
  const copy = getCopy(locale)
  const [mode, setMode] = useState<ParticipationMode>('standard')
  const [route, setRoute] = useState<ParticipationRoute>('direct')
  const [asset, setAsset] = useState('')
  // 一键预购支付资产独立于主支付资产选择（用户裁定 2026-09-25：预购金额也拆 Pay with+amount 并排）
  const [preorderAsset, setPreorderAsset] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [amount, setAmount] = useState('')
  const [preorderEnabled, setPreorderEnabled] = useState(false)
  const [preorderAmount, setPreorderAmount] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const numericAmount = Number(amount || 0)
  const numericPreorder = Number(preorderAmount || 0)
  const preorderOnly = mode === 'preorder'
  // 路径集随模式变化：杠杆无质押项、普通无创世积分项——跨模式残留选择回落直接参与
  const effectiveRoute: ParticipationRoute =
    route === 'stake' && mode === 'leverage'
      ? 'direct'
      : route === 'credit' && mode !== 'leverage'
        ? 'direct'
        : preorderOnly
          ? 'direct'
          : route
  const raiseAssetSymbol = raiseAsset?.symbol ?? ''
  // 质押来源→参与资产两级：选来源后才确定可参与资产组（用户裁定 2026-09-22）
  const activeSource =
    yieldSourceRegistry.find((source) => source.id === sourceId) ?? yieldSourceRegistry[0] ?? null
  // 直接参与=募集 uAsset 直付（首选）+ PSM 配对储备资产面值直兑；质押=所选来源资产组；创世积分=杠杆利息直付；
  // 预购支付资产组与直接参与同款（用户裁定 2026-09-25：预购也支持 Pay with 下拉——uAsset 直付或储备面值直兑，预购金额仍按募集 uAsset 计价）
  const preorderAssets = raiseAsset ? [raiseAsset, ...reserves] : reserves
  const routeAssets = preorderOnly
    ? preorderAssets
    : effectiveRoute === 'direct'
      ? raiseAsset
        ? [raiseAsset, ...reserves]
        : reserves
      : effectiveRoute === 'stake'
        ? (activeSource?.assets ?? [])
        : creditAsset
          ? [creditAsset]
          : []
  const payAssetRecord = routeAssets.find((item) => item.symbol === asset) ?? routeAssets[0] ?? null
  const payAsset = payAssetRecord?.symbol ?? ''
  const amountInvalid = invalid && numericAmount <= 0
  const preorderInvalid = invalid && !preorderOnly && preorderEnabled && numericPreorder <= 0
  // 杠杆：一次性利率（注册时锁定、非年化）；借贷资金=利息÷利率（UI 词=用户裁定 2026-09-25，机制口径仍 OB debt quota）；余量=债务上限−已建债务（POLend LeveragedDebtInfo）
  const leverageRate = leverageInterestRate != null && leverageInterestRate > 0 ? leverageInterestRate : null
  const leverageReady = leverageRate != null && leverageDebtCap != null
  const leverageCurrentDebt = leverageRate != null ? leverageInterestRaised / leverageRate : null
  const leverageQuota = leverageRate != null && numericAmount > 0 ? numericAmount / leverageRate : null
  const leverageHeadroom =
    leverageRate != null && leverageDebtCap != null && leverageCurrentDebt != null
      ? Math.max(leverageDebtCap - leverageCurrentDebt, 0)
      : null
  const leverageExceeded = leverageQuota != null && leverageHeadroom != null && leverageQuota > leverageHeadroom
  // 质押路径折算：sy 资产按实时价值折算 uAsset（OB:outstake/uasset.md:21，fixture anchorValue 样本率；缺率兜底面值 1——样本缺失不显槽位，用户裁定 2026-09-25）；
  // direct=面值 1:1 直兑（PSM par，directHelp 口径）
  const convertedAmount = numericAmount * (effectiveRoute === 'stake' ? (payAssetRecord?.anchorValue ?? 1) : 1)
  // 一键预购上限=创世资金按面值折算 uAsset（PSM 面值 1:1）×70%×容量比例；杠杆创世资金=借贷资金；缺容量比例=null→仅显槽位
  const genesisFunds = mode === 'leverage' ? (leverageQuota ?? 0) : convertedAmount
  const preorderCap =
    preorderCapacityRatio != null && genesisFunds > 0
      ? genesisFunds * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  const preorderExceeded = preorderCap != null && numericPreorder > preorderCap
  // 预购 tab：Verse 级容量（MemeverseLauncherLib.preorderMaxCapacity）=（普通创世资金+杠杆债务本金）×70%×容量比例；
  // 债务本金=已收利息÷利率；已用=PreorderState.totalFunds 快照（fixture preorderRaised）；余量=容量−已用（先到先得）
  const versePreorderBase = leverageRate != null ? normalRaised + leverageInterestRaised / leverageRate : null
  const versePreorderCap =
    preorderCapacityRatio != null && versePreorderBase != null
      ? versePreorderBase * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  const versePreorderRemaining =
    versePreorderCap != null ? Math.max(versePreorderCap - preorderRaised, 0) : null
  const versePreorderPercent =
    versePreorderCap != null && versePreorderCap > 0 ? (preorderRaised / versePreorderCap) * 100 : 0
  const preorderTabExceeded =
    preorderOnly && versePreorderRemaining != null && numericAmount > versePreorderRemaining
  const modeLabel =
    mode === 'standard' ? copy.verse.standardMode : mode === 'leverage' ? copy.verse.leverageMode : copy.verse.preorderMode
  // 审阅屏行模型（分组化——用户裁定 2026-09-25）：支付组=实付代币视角（利息/本金/预购），进创世组=折算或借贷后的 uAsset；
  // 合计仅当支付项同资产（杠杆利息与预购同为 uAsset 时直加；质押资产+预购异资产不硬凑）
  const preorderRowAmount = preorderOnly ? numericAmount : numericPreorder
  // 预购支付资产独立可选（面值 1:1，数值与计价额相同）：独立 tab 用主选择、一键预购用预购资产选择，均回落募集 uAsset
  const effectivePreorderAsset =
    preorderAssets.find((item) => item.symbol === preorderAsset)?.symbol ?? preorderAssets[0]?.symbol ?? ''
  const preorderRowAsset = preorderOnly ? payAsset : effectivePreorderAsset
  const payRows: Array<{ label: string; amount: number; asset: string }> = preorderOnly
    ? [{ label: copy.verse.preorderAmountLabel, amount: preorderRowAmount, asset: preorderRowAsset }]
    : [
        {
          label: mode === 'leverage' ? copy.verse.leverageInterestLabel : copy.verse.payAmount,
          amount: numericAmount,
          asset: payAsset,
        },
        ...(preorderEnabled
          ? [{ label: copy.verse.preorderAmountLabel, amount: preorderRowAmount, asset: preorderRowAsset }]
          : []),
      ]
  const sameAssetPay = payRows.length > 1 && payRows.every((row) => row.asset === payRows[0].asset)
  const totalPaid = sameAssetPay ? payRows.reduce((sum, row) => sum + row.amount, 0) : null
  // 预购资金主池开放后才买入，不进创世——preorder-only 无进创世组
  const genesisRow = preorderOnly
    ? null
    : mode === 'leverage'
      ? { label: copy.verse.leverageDebtQuota, amount: leverageQuota ?? 0 }
      : { label: copy.verse.genesisAmount, amount: convertedAmount }

  function resetReview() {
    setReviewing(false)
    setConfirmed(false)
    setInvalid(false)
  }

  // 金额输入 Field：stake 分支独立成行；direct/credit/预购与 Pay with 并排（用户裁定 2026-09-25 排版收紧）
  const amountField = (
    <Field
      data-invalid={
        amountInvalid || (mode === 'leverage' && leverageExceeded) || preorderTabExceeded ? true : undefined
      }
    >
      <FieldLabel htmlFor="participation-amount">
        {preorderOnly
          ? copy.verse.preorderAmountLabel
          : mode === 'leverage'
            ? copy.verse.leverageInterestLabel
            : copy.verse.amount}
      </FieldLabel>
      <Input
        id="participation-amount"
        name="participation-amount"
        className="numeric-input"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        aria-invalid={
          amountInvalid || (mode === 'leverage' && leverageExceeded) || preorderTabExceeded ? true : undefined
        }
        onChange={(event) => {
          setAmount(sanitizeAmount(event.target.value))
          resetReview()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}
        placeholder={copy.verse.amountPlaceholder}
      />
      {amountInvalid ? <FieldError>{copy.verse.inputError}</FieldError> : null}
      {preorderTabExceeded && versePreorderRemaining != null ? (
        <FieldError>
          {copy.verse.preorderCapacityExceeded.replace(
            '{cap}',
            `${formatAmount(versePreorderRemaining, locale)} ${raiseAssetSymbol}`,
          )}
        </FieldError>
      ) : null}
      {preorderOnly && versePreorderRemaining != null ? (
        <FieldDescription>
          {copy.verse.preorderHeadroom}{' '}
          <b data-numeric>
            {formatAmount(versePreorderRemaining, locale)} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
      {mode === 'leverage' && leverageExceeded && leverageHeadroom != null ? (
        <FieldError>
          {copy.verse.leverageCapExceeded.replace(
            '{quota}',
            `${formatAmount(leverageHeadroom, locale)} ${raiseAssetSymbol}`,
          )}
        </FieldError>
      ) : null}
      {mode === 'leverage' && leverageQuota != null && leverageRate != null ? (
        <FieldDescription>
          {copy.verse.leverageDebtQuota}{' '}
          <b data-numeric>
            {formatAmount(leverageQuota, locale)} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
      {mode === 'leverage' && leverageHeadroom != null ? (
        <FieldDescription>
          {copy.verse.leverageCapHeadroom}{' '}
          <b data-numeric>
            {formatAmount(leverageHeadroom, locale)} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
    </Field>
  )

  if (reviewing) {
    return (
      <div className="participation-review" aria-live="polite">
        <div className="participation-review__heading">
          <span className="review-check" aria-hidden="true">
            <Check />
          </span>
          <div>
            <h3>{copy.verse.reviewTitle}</h3>
            {confirmed ? <p>{copy.verse.reviewReady}</p> : null}
          </div>
        </div>
        <div className="participation-review__rows">
          <div className="participation-review__row">
            <span>{copy.verse.modeLabel}</span>
            <span>{modeLabel}</span>
          </div>
          <div className="participation-review__row">
            <span>{copy.verse.payAsset}</span>
            <span data-numeric>{payAsset}</span>
          </div>
        </div>
        {genesisRow ? (
          <section
            className="participation-review__group participation-review__group--genesis"
            aria-label={copy.verse.genesisGroupTitle}
          >
            <h4 className="participation-review__group-label">{copy.verse.genesisGroupTitle}</h4>
            <div className="participation-review__rows">
              <div className="participation-review__row participation-review__row--genesis">
                <span>{genesisRow.label}</span>
                <span data-numeric>
                  {formatAmount(genesisRow.amount, locale)} {raiseAssetSymbol}
                </span>
              </div>
            </div>
          </section>
        ) : null}
        <section className="participation-review__group" aria-label={copy.verse.payGroupTitle}>
          <h4 className="participation-review__group-label">{copy.verse.payGroupTitle}</h4>
          <div className="participation-review__rows">
            {payRows.map((row) => (
              <div key={row.label} className="participation-review__row">
                <span>{row.label}</span>
                <span data-numeric>
                  {formatAmount(row.amount, locale)} {row.asset}
                </span>
              </div>
            ))}
            {totalPaid != null ? (
              <div className="participation-review__row participation-review__row--total">
                <span>{copy.verse.totalPaid}</span>
                <span data-numeric>
                  {formatAmount(totalPaid, locale)} {payRows[0].asset}
                </span>
              </div>
            ) : null}
          </div>
        </section>
        <SourceRef value={sourceRef} />
        <div className="participation-review__actions">
          <Button variant="outline" onClick={() => setReviewing(false)}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            {copy.verse.revise}
          </Button>
          <Button className="ax-ghost-cta" onClick={() => setConfirmed(true)} disabled={confirmed}>
            {confirmed ? copy.verse.reviewReady : copy.verse.confirmPrototype}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="participation-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          numericAmount <= 0 ||
          (mode === 'leverage' && (!leverageReady || leverageExceeded)) ||
          (preorderOnly && (versePreorderRemaining == null || preorderTabExceeded)) ||
          (!preorderOnly && preorderEnabled && (numericPreorder <= 0 || preorderExceeded))
        ) {
          setInvalid(true)
          return
        }
        setReviewing(true)
      }}
    >
      <FieldSet>
        <FieldLegend>{copy.verse.participateTitle}</FieldLegend>
        <FieldGroup>
          <Field>
            {/* 顶层模式切换：tab 风格，底边线兼作分割线（ax-echo-bar 签名线锚定其下），区别于路径的分段框 */}
            <ToggleGroup
              className="participation-toggle participation-toggle--mode ax-echo-bar"
              variant="outline"
              spacing={0}
              aria-label={copy.verse.modeLabel}
              value={[mode]}
              onValueChange={(value) => {
                if (!value[0]) return
                setMode(value[0] as ParticipationMode)
                resetReview()
              }}
            >
              <ToggleGroupItem value="standard">{copy.verse.standardMode}</ToggleGroupItem>
              <ToggleGroupItem value="leverage">{copy.verse.leverageMode}</ToggleGroupItem>
              <ToggleGroupItem value="preorder">{copy.verse.preorderMode}</ToggleGroupItem>
            </ToggleGroup>
            {mode === 'leverage' ? (
              <FieldDescription className="form-warning">
                {leverageReady ? copy.verse.leverageDisclosure : copy.verse.leverageRateSlot}
              </FieldDescription>
            ) : null}
            {preorderOnly ? <FieldDescription>{copy.verse.preorderHelp}</FieldDescription> : null}
          </Field>

          {!preorderOnly ? (
            <Field>
              <FieldLabel>{copy.verse.route}</FieldLabel>
              <ToggleGroup
                className="participation-toggle participation-toggle--routes"
                variant="outline"
                spacing={0}
                value={[effectiveRoute]}
                onValueChange={(value) => {
                  if (!value[0]) return
                  setRoute(value[0] as ParticipationRoute)
                  resetReview()
                }}
              >
                <ToggleGroupItem value="direct" disabled={!raiseAsset && reserves.length === 0}>
                  {copy.verse.directRoute}
                </ToggleGroupItem>
                {mode === 'leverage' ? (
                  <ToggleGroupItem value="credit" disabled={!creditAsset}>
                    {copy.verse.leverageCreditRoute}
                  </ToggleGroupItem>
                ) : (
                  <ToggleGroupItem value="stake" disabled={yieldSourceRegistry.length === 0}>
                    {copy.verse.stakeRoute}
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
              {/* 路径说明只留 stake（描述路径行为，用户裁定 2026-09-25）；direct/credit 的支付方式说明移至 Pay with 下拉下方 */}
              {effectiveRoute === 'stake' ? (
                <FieldDescription>{fill(copy.verse.stakeHelp, { asset: payAsset, raise: raiseAssetSymbol })}</FieldDescription>
              ) : null}
            </Field>
          ) : null}

          {/* 预购 tab：Verse 级容量进度条（已用/上限），位于支付资产+金额前作约束上下文；快照缺失→槽位+CTA 禁用 */}
          {preorderOnly ? (
            versePreorderCap != null ? (
              <Field>
                <ProgressMeter
                  label={copy.verse.preorderCapacityLabel}
                  value={versePreorderPercent}
                  amount={preorderRaised}
                  threshold={versePreorderCap}
                  unit={raiseAssetSymbol}
                  locale={locale}
                />
                <FieldDescription>{copy.verse.preorderCapacityNote}</FieldDescription>
              </Field>
            ) : (
              <FieldDescription className="form-warning">{copy.verse.preorderCapacitySlot}</FieldDescription>
            )
          ) : null}

          {effectiveRoute === 'stake' ? (
            /* 质押路径三格同行（用户裁定 2026-09-25）：来源/参与资产/金额一排，金额列最宽 */
            <div className="participation-trio">
              <Field>
                <FieldLabel htmlFor="stake-source">{copy.verse.stakeSourceLabel}</FieldLabel>
                <Select
                  name="stake-source"
                  items={yieldSourceRegistry.map((source) => ({ value: source.id, label: source.name }))}
                  value={activeSource?.id ?? ''}
                  onValueChange={(value) => {
                    if (value) setSourceId(value)
                    setAsset('')
                    resetReview()
                  }}
                >
                  <SelectTrigger id="stake-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} align="start">
                    <SelectGroup>
                      {yieldSourceRegistry.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="stake-asset">{copy.verse.stakeAssetLabel}</FieldLabel>
                {routeAssets.length > 1 ? (
                  <Select
                    name="stake-asset"
                    items={routeAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                    value={payAsset}
                    onValueChange={(value) => {
                      if (value) setAsset(value)
                      resetReview()
                    }}
                  >
                    <SelectTrigger id="stake-asset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {routeAssets.map((item) => (
                          <SelectItem key={item.id} value={item.symbol}>
                            {item.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : payAsset ? (
                  <p className="participation-fixed-asset" data-numeric>
                    {payAsset}
                  </p>
                ) : null}
              </Field>
              {amountField}
            </div>
          ) : (
            /* 支付资产与金额并排（用户裁定 2026-09-25：单行各占一格太占空间）；预购支付资产组与直付同款（uAsset 直付+储备面值直兑） */
            <div className="participation-duo">
              <Field>
                <FieldLabel>{copy.verse.payAsset}</FieldLabel>
                {routeAssets.length > 1 ? (
                  <Select
                    name="payment-asset"
                    items={routeAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                    value={payAsset}
                    onValueChange={(value) => {
                      if (value) setAsset(value)
                      resetReview()
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {routeAssets.map((item) => (
                          <SelectItem key={item.id} value={item.symbol}>
                            {item.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : payAsset ? (
                  <p className="participation-fixed-asset" data-numeric>
                    {payAsset}
                  </p>
                ) : null}
                {/* 支付方式说明紧贴 Pay with 下拉（用户裁定 2026-09-25）：预购/普通/杠杆 direct/credit 统一分发 */}
                <FieldDescription>
                  {fill(
                    preorderOnly
                      ? payAsset === raiseAssetSymbol
                        ? copy.verse.uassetHelp
                        : copy.verse.directHelp
                      : effectiveRoute === 'credit'
                        ? copy.verse.leverageCreditHelp
                        : payAsset === raiseAssetSymbol
                          ? mode === 'leverage'
                            ? copy.verse.leverageUassetHelp
                            : copy.verse.uassetHelp
                          : mode === 'leverage'
                            ? copy.verse.leverageDirectHelp
                            : copy.verse.directHelp,
                    { asset: payAsset, raise: raiseAssetSymbol },
                  )}
                </FieldDescription>
              </Field>
              {amountField}
            </div>
          )}

          {!preorderOnly ? (
            <>
              <Field>
                <ToggleGroup
                  className="participation-toggle"
                  variant="outline"
                  spacing={0}
                  aria-label={copy.verse.oneClickPreorder}
                  value={preorderEnabled ? ['enabled'] : []}
                  onValueChange={(value) => {
                    setPreorderEnabled(value.includes('enabled'))
                    resetReview()
                  }}
                >
                  <ToggleGroupItem value="enabled">{copy.verse.oneClickPreorder}</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {preorderEnabled ? (
                <div className="participation-duo">
                  <Field>
                    <FieldLabel>{copy.verse.payAsset}</FieldLabel>
                    {preorderAssets.length > 1 ? (
                      <Select
                        name="preorder-asset"
                        items={preorderAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                        value={effectivePreorderAsset}
                        onValueChange={(value) => {
                          if (value) setPreorderAsset(value)
                          resetReview()
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} align="start">
                          <SelectGroup>
                            {preorderAssets.map((item) => (
                              <SelectItem key={item.id} value={item.symbol}>
                                {item.symbol}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : effectivePreorderAsset ? (
                      <p className="participation-fixed-asset" data-numeric>
                        {effectivePreorderAsset}
                      </p>
                    ) : null}
                  </Field>
                  <Field data-invalid={preorderInvalid || preorderExceeded ? true : undefined}>
                    <FieldLabel htmlFor="preorder-amount">{copy.verse.preorderAmountLabel}</FieldLabel>
                  <Input
                    id="preorder-amount"
                    name="preorder-amount"
                    className="numeric-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={preorderAmount}
                    aria-invalid={preorderInvalid || preorderExceeded ? true : undefined}
                    onChange={(event) => {
                      setPreorderAmount(sanitizeAmount(event.target.value))
                      resetReview()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
                        event.preventDefault()
                    }}
                    placeholder={copy.verse.amountPlaceholder}
                  />
                  {preorderInvalid ? <FieldError>{copy.verse.inputError}</FieldError> : null}
                  {preorderExceeded && preorderCap != null ? (
                    <FieldError>
                      {copy.verse.preorderCapExceeded.replace(
                        '{cap}',
                        `${formatAmount(preorderCap, locale)} ${raiseAssetSymbol}`,
                      )}
                    </FieldError>
                  ) : null}
                  {preorderCap != null ? (
                    <FieldDescription>
                      {copy.verse.preorderCapLabel}
                      {' '}
                      <b data-numeric>
                        {formatAmount(preorderCap, locale)} {raiseAssetSymbol}
                      </b>
                    </FieldDescription>
                  ) : null}
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <SourceRef value={sourceRef} />
      <Button
        type="submit"
        className="ax-ghost-cta"
        size="lg"
        disabled={(mode === 'leverage' && !leverageReady) || (preorderOnly && versePreorderRemaining == null)}
      >
        {copy.verse.review}
      </Button>
    </form>
  )
}
