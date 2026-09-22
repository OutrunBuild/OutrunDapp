'use client'

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Calculator, Check, ChevronDown, Globe, ImagePlus, Info, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  Locale,
  PrototypeAsset,
  PrototypeChain,
  PrototypeCreateConfig,
} from '@/lib/data/prototype-repository'

import { ChainLogoMark } from './chain-icons'
import { DiscordIcon, TelegramIcon, XIcon } from './brand-icons'
import { getCopy } from './copy'
import { SourceRef, formatAmount } from './signal-ui'

// 注册参数口径=SPEC-M8 registration-details §3（durationDays/name/symbol/uri/desc/uAsset/
// omnichainIds）；初始定价/最低成功额度非注册参数（2026-09-22 用户裁定移除，OB lifecycle.md:22
// 张力登记 source-map §6 对账区）；锁定期=FIXED_LOCKUP_DURATION 合约常量，不输入，侧栏仅展示。
// 布局与 demo（demo.outrun.build/memeverse/create）一致：可见帮助文案仅时长下方一句，
// 其余说明收进标签旁 ⊙ 悬浮提示（Info）
const NAME_SYMBOL_MAX_BYTES = 31
const DESC_MAX_BYTES = 255

const encoder = new TextEncoder()

function byteLength(value: string) {
  return encoder.encode(value).length
}

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole}.${fraction.join('')}` : whole
}

/** 帮助文案模板填充：{min}/{max}=创世时长区间、{days}=锁定期、{count}=异链数 */
function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** demo 式标签旁 ⊙ 信息图标：悬浮显示说明，不在版面上占位 */
function FieldInfo({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="create-info" aria-label={text} />}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

type CreateFormProps = {
  locale: Locale
  assets: PrototypeAsset[]
  chains: PrototypeChain[]
  config: PrototypeCreateConfig | null
}

export function CreateForm({ locale, assets, chains, config }: CreateFormProps) {
  const copy = getCopy(locale)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [desc, setDesc] = useState('')
  const [linksOpen, setLinksOpen] = useState(false)
  const [website, setWebsite] = useState('')
  const [xHandle, setXHandle] = useState('')
  const [discord, setDiscord] = useState('')
  const [telegram, setTelegram] = useState('')
  const [fundType, setFundType] = useState(assets[0]?.symbol ?? '')
  const [govChain, setGovChain] = useState(chains[0] ? String(chains[0].chainId) : '')
  // Spoke chains=治理链之外的部署链；初始空=显「Select Chains」占位（demo 口径）
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [fast, setFast] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [invalid, setInvalid] = useState(false)

  const nameBytes = byteLength(name)
  const symbolBytes = byteLength(symbol)
  const descBytes = byteLength(desc)
  const numericDuration = Number(duration || 0)

  const nameInvalid = invalid && (nameBytes < 1 || nameBytes > NAME_SYMBOL_MAX_BYTES)
  const symbolInvalid = invalid && (symbolBytes < 1 || symbolBytes > NAME_SYMBOL_MAX_BYTES)
  const descInvalid = invalid && (descBytes < 1 || descBytes > DESC_MAX_BYTES)
  const durationRangeOk =
    config != null &&
    Number.isInteger(numericDuration) &&
    numericDuration >= config.minDurationDays &&
    numericDuration <= config.maxDurationDays
  const durationInvalid = invalid && !durationRangeOk

  const govChainOption = chains.find((chain) => String(chain.chainId) === govChain) ?? null
  // Spoke chains=治理链之外的部署链（治理链不再出现在下拉里）；每条 spoke 一笔跨链 fan-out 费
  const spokeOptions = chains.filter((chain) => String(chain.chainId) !== govChain)
  const selectedChains = chains.filter((chain) => selectedChainIds.includes(String(chain.chainId)))
  // 报价口径=SPEC-M8 §9：跨链费=逐条异链 LayerZero fan-out 累加；治理链本链 fee=0，无注册费
  const remoteCount = config ? selectedChains.length : 0
  const crossChainFee = config ? config.remoteDeployFee * remoteCount : 0
  const nativeSymbol = govChainOption?.nativeSymbol ?? ''
  const links = [website, xHandle, discord, telegram].filter((link) => link.trim().length > 0)

  function pickLogo(file: File | undefined) {
    if (!file) return
    if (logoUrl) URL.revokeObjectURL(logoUrl)
    setLogoUrl(URL.createObjectURL(file))
  }

  function removeLogo() {
    if (logoUrl) URL.revokeObjectURL(logoUrl)
    setLogoUrl(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  /** 输入法组词期间的 Enter 不触发提交（全站数字输入同一守卫） */
  function guardImeEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
      event.preventDefault()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const ok =
      nameBytes >= 1 &&
      nameBytes <= NAME_SYMBOL_MAX_BYTES &&
      symbolBytes >= 1 &&
      symbolBytes <= NAME_SYMBOL_MAX_BYTES &&
      descBytes >= 1 &&
      descBytes <= DESC_MAX_BYTES &&
      durationRangeOk
    if (!ok) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setReviewing(true)
  }

  function renderSidebar(showCreate: boolean) {
    return (
      <aside className="workbench-secondary">
        <section className="action-panel" aria-labelledby="create-quote-title">
          <div className="action-panel__head">
            <span className="action-panel__icon" aria-hidden="true">
              <Calculator />
            </span>
            <h2 id="create-quote-title">{copy.create.quoteTitle}</h2>
          </div>
          {config && govChainOption ? (
            <>
              {/* quoteRegister 返回的是跨链费总和（AtLocal:56），不暴露逐链拆分——界面只呈现总额 */}
              <dl className="create-quote">
                <div className="create-quote__row create-quote__row--total">
                  <dt>{copy.create.quoteTotal}</dt>
                  <dd data-numeric>
                    {formatAmount(crossChainFee, locale)} {nativeSymbol}
                  </dd>
                </div>
              </dl>
              {/* 支付口径=SPEC-M8 §9 + RegistrarAtLocal:71-77：随注册交易 msg.value 一笔支付，
                  金额=quoteRegister 链上实时报价 */}
              <FieldDescription>{copy.create.quotePaidNote}</FieldDescription>
            </>
          ) : (
            <p>{copy.create.quoteEmpty}</p>
          )}
          {showCreate ? (
            <Button
              type="submit"
              form="create-form"
              className="ax-glow-cta create-submit"
              size="lg"
              disabled={assets.length === 0 || chains.length === 0 || config == null}
            >
              {copy.create.submit}
            </Button>
          ) : null}
          {config ? <SourceRef value={config.sourceRef} /> : null}
        </section>
      </aside>
    )
  }

  if (reviewing) {
    return (
      <div className="create-layout">
        <div className="workbench-primary">
          <div className="participation-review" aria-live="polite">
            <div className="participation-review__heading">
              <span className="review-check" aria-hidden="true">
                <Check />
              </span>
              <div>
                <h3>{copy.create.reviewTitle}</h3>
                {confirmed ? <p>{copy.create.reviewNote}</p> : null}
              </div>
            </div>
            <dl>
              <div>
                <dt>{copy.create.rowIdentity}</dt>
                <dd>
                  {name} <b data-numeric>({symbol})</b>
                </dd>
              </div>
              <div>
                <dt>{copy.create.rowChains}</dt>
                <dd>
                  {[govChainOption?.name, ...selectedChains.map((chain) => chain.name)]
                    .filter((chainName, index, all) => chainName && !all.includes(chainName, index + 1))
                    .join(' · ')}
                </dd>
              </div>
              <div>
                <dt>{copy.create.rowFundType}</dt>
                <dd data-numeric>{fundType}</dd>
              </div>
              <div>
                <dt>{copy.create.rowDuration}</dt>
                <dd data-numeric>
                  {formatAmount(numericDuration, locale)} {copy.create.dayUnit}
                </dd>
              </div>
              <div>
                <dt>{copy.create.rowFast}</dt>
                <dd>{fast ? copy.create.enabled : copy.create.disabled}</dd>
              </div>
              <div>
                <dt>{copy.create.rowLockup}</dt>
                <dd data-numeric>
                  {config
                    ? `${formatAmount(config.lockupDays, locale)} ${copy.create.dayUnit}`
                    : copy.create.noneYet}
                </dd>
              </div>
              <div>
                <dt>{copy.create.rowLinks}</dt>
                <dd>{links.length > 0 ? links.join(' · ') : copy.create.noneYet}</dd>
              </div>
              {config && govChainOption ? (
                <>
                  <div className="create-quote__total">
                    <dt>{copy.create.quoteTotal}</dt>
                    <dd data-numeric>
                      {formatAmount(crossChainFee, locale)} {nativeSymbol}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
            <div className="participation-review__actions">
              <Button
                variant="outline"
                onClick={() => {
                  setReviewing(false)
                  setConfirmed(false)
                }}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
                {copy.create.revise}
              </Button>
              <Button
                className="ax-glow-cta"
                onClick={() => setConfirmed(true)}
                disabled={confirmed}
              >
                {confirmed ? copy.create.reviewNote : copy.verse.confirmPrototype}
              </Button>
            </div>
          </div>
        </div>
        {renderSidebar(false)}
      </div>
    )
  }

  return (
    <div className="create-layout">
      <div className="workbench-primary">
        <form id="create-form" className="create-form" onSubmit={handleSubmit} noValidate>
          {/* demo 首项：Flash Genesis（OutrunBook 术语=Fast Genesis）=标签 + ⊙ + 切换开关；默认关闭即天然可选，不挂角标 */}
          <Field>
            <div className="create-fast-row">
              <span className="create-fast__label">{copy.create.fastLabel}</span>
              <FieldInfo text={copy.create.fastNote} />
              <Switch
                aria-label={copy.create.fastLabel}
                checked={fast}
                onCheckedChange={(checked) => setFast(checked)}
              />
            </div>
          </Field>

          <FieldSet>
            <FieldGroup>
              <div className="create-identity">
                <Field className="create-identity__logo">
                  <FieldLabel htmlFor="create-logo">{copy.create.logoLabel}</FieldLabel>
                  <div className="create-logo">
                    <label className="create-logo__box" htmlFor="create-logo">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" />
                      ) : (
                        <>
                          <ImagePlus aria-hidden="true" />
                          <span>{copy.create.logoChoose}</span>
                        </>
                      )}
                    </label>
                    {logoUrl ? (
                      <div className="create-logo__actions">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {copy.create.logoReplace}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                          {copy.create.logoRemove}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <input
                    ref={logoInputRef}
                    id="create-logo"
                    name="create-logo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => pickLogo(event.target.files?.[0])}
                  />
                </Field>
                <Field data-invalid={nameInvalid ? true : undefined}>
                  <FieldLabel htmlFor="create-name">{copy.create.nameLabel}</FieldLabel>
                  <Input
                    id="create-name"
                    name="create-name"
                    value={name}
                    maxLength={NAME_SYMBOL_MAX_BYTES * 4}
                    autoComplete="off"
                    aria-invalid={nameInvalid ? true : undefined}
                    placeholder={copy.create.namePlaceholder}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={guardImeEnter}
                  />
                  {nameInvalid ? <FieldError>{copy.create.nameError}</FieldError> : null}
                </Field>
                <Field data-invalid={symbolInvalid ? true : undefined}>
                  <FieldLabel htmlFor="create-symbol">{copy.create.symbolLabel}</FieldLabel>
                  <Input
                    id="create-symbol"
                    name="create-symbol"
                    value={symbol}
                    maxLength={NAME_SYMBOL_MAX_BYTES * 4}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="numeric-input"
                    aria-invalid={symbolInvalid ? true : undefined}
                    placeholder={copy.create.symbolPlaceholder}
                    onChange={(event) => setSymbol(event.target.value)}
                    onKeyDown={guardImeEnter}
                  />
                  {symbolInvalid ? <FieldError>{copy.create.symbolError}</FieldError> : null}
                </Field>

                {/* demo 行位：时长与资金类型并排填入 logo 右侧空位 */}
                <Field data-invalid={durationInvalid ? true : undefined}>
                  <FieldLabel htmlFor="create-duration">
                    {copy.create.durationLabel}
                    <FieldInfo
                      text={
                        config
                          ? `${copy.create.durationInfo} ${fill(copy.create.durationNote, {
                              min: String(config.minDurationDays),
                              max: String(config.maxDurationDays),
                            })}`
                          : copy.discovery.unavailable
                      }
                    />
                  </FieldLabel>
                  <div className="create-suffix">
                    <Input
                      id="create-duration"
                      name="create-duration"
                      className="numeric-input"
                      inputMode="numeric"
                      autoComplete="off"
                      value={duration}
                      aria-invalid={durationInvalid ? true : undefined}
                      placeholder={config ? `${config.minDurationDays}–${config.maxDurationDays}` : ''}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^\d]/g, '')
                        // 超界输入强制夹回 [min,max]（用户裁定 2026-09-22）：如输 9 → 夹到 3
                        if (config && digits !== '') {
                          const clamped = String(
                            Math.min(Math.max(Number(digits), config.minDurationDays), config.maxDurationDays),
                          )
                          setDuration(clamped)
                          return
                        }
                        setDuration(digits)
                      }}
                      onKeyDown={guardImeEnter}
                    />
                    <span data-numeric>{copy.create.dayUnit}</span>
                  </div>
                  {config ? (
                    <FieldDescription>
                      {fill(copy.create.durationNote, {
                        min: String(config.minDurationDays),
                        max: String(config.maxDurationDays),
                      })}
                    </FieldDescription>
                  ) : null}
                  {durationInvalid ? <FieldError>{copy.create.durationError}</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-fund-type">
                    {copy.create.fundTypeLabel}
                    <FieldInfo text={copy.create.fundTypeHint} />
                  </FieldLabel>
                  <Select
                    name="create-fund-type"
                    items={assets.map((asset) => ({ value: asset.symbol, label: asset.symbol }))}
                    value={fundType}
                    onValueChange={(value) => {
                      if (value) setFundType(value)
                    }}
                  >
                    <SelectTrigger id="create-fund-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.symbol}>
                            {asset.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="create-row create-row--2">
                <Field>
                  <FieldLabel htmlFor="create-gov-chain">
                    {copy.create.govChainLabel}
                    <FieldInfo text={copy.create.govChainNote} />
                  </FieldLabel>
                  <Select
                    name="create-gov-chain"
                    items={chains.map((chain) => ({
                      value: String(chain.chainId),
                      label: chain.name,
                    }))}
                    value={govChain}
                    onValueChange={(value) => {
                      if (!value) return
                      setGovChain(value)
                      setSelectedChainIds(selectedChainIds.filter((id) => id !== value))
                    }}
                  >
                    <SelectTrigger id="create-gov-chain">
                      {/* 触发器同步显示选中链图标（用户裁定 2026-09-22）：children 函数接收选中 value */}
                      <SelectValue>
                        {(value: string | null) => {
                          const chain = chains.find((c) => String(c.chainId) === String(value))
                          return (
                            <>
                              {chain ? <ChainLogoMark chainId={chain.chainId} size={16} /> : null}
                              {chain?.name ?? ''}
                            </>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {chains.map((chain) => (
                          <SelectItem key={chain.chainId} value={String(chain.chainId)}>
                            <ChainLogoMark chainId={chain.chainId} size={16} />
                            {chain.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>
                    {copy.create.chainsLabel}
                    <span className="create-optional-tag">{copy.create.optionalTag}</span>
                    <FieldInfo text={copy.create.chainsHint} />
                  </FieldLabel>
                  {/* demo「Select Chains」多选下拉；选项=治理链之外的 Spoke 链 */}
                  <Select
                    name="create-spoke-chains"
                    multiple
                    items={spokeOptions.map((chain) => ({
                      value: String(chain.chainId),
                      label: chain.name,
                    }))}
                    value={selectedChainIds}
                    onValueChange={(value) => setSelectedChainIds(value)}
                  >
                    <SelectTrigger aria-label={copy.create.chainsLabel}>
                      <SelectValue placeholder={copy.create.chainsSelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {spokeOptions.map((chain) => (
                          <SelectItem key={chain.chainId} value={String(chain.chainId)}>
                            <ChainLogoMark chainId={chain.chainId} size={16} />
                            {chain.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field data-invalid={descInvalid ? true : undefined}>
                <div className="create-label-row">
                  <FieldLabel htmlFor="create-desc">{copy.create.descLabel}</FieldLabel>
                  <span className="create-counter" data-numeric>
                    {descBytes}/{DESC_MAX_BYTES}
                  </span>
                </div>
                <Textarea
                  id="create-desc"
                  name="create-desc"
                  value={desc}
                  aria-invalid={descInvalid ? true : undefined}
                  placeholder={copy.create.descPlaceholder}
                  onChange={(event) => setDesc(event.target.value)}
                />
                {descInvalid ? (
                  <FieldError>
                    {descBytes < 1 ? copy.create.descRequired : copy.create.descError}
                  </FieldError>
                ) : null}
              </Field>

              {/* demo 折叠面板：Communities（图标在输入框内，全部选填） */}
              <div className="create-disclosure">
                <button
                  type="button"
                  className="create-disclosure__trigger"
                  aria-expanded={linksOpen}
                  onClick={() => setLinksOpen((open) => !open)}
                >
                  <span className="create-disclosure__label">
                    <span>
                      {copy.create.linksLegend}
                      <span className="create-optional-tag">{copy.create.optionalTag}</span>
                    </span>
                    <FieldInfo text={copy.create.linksInfo} />
                  </span>
                  <ChevronDown data-open={linksOpen || undefined} aria-hidden="true" />
                </button>
                {linksOpen ? (
                  <>
                    <div className="create-links">
                      <label className="create-social">
                        <Globe aria-hidden="true" />
                        <Input
                          name="create-website"
                          type="url"
                          value={website}
                          autoComplete="off"
                          aria-label={copy.create.websitePlaceholder}
                          placeholder={copy.create.websitePlaceholder}
                          onChange={(event) => setWebsite(event.target.value)}
                        />
                      </label>
                      <label className="create-social">
                        <XIcon aria-hidden="true" />
                        <Input
                          name="create-x"
                          value={xHandle}
                          autoComplete="off"
                          aria-label={copy.create.xPlaceholder}
                          placeholder={copy.create.xPlaceholder}
                          onChange={(event) => setXHandle(event.target.value)}
                        />
                      </label>
                      <label className="create-social">
                        <DiscordIcon aria-hidden="true" />
                        <Input
                          name="create-discord"
                          value={discord}
                          autoComplete="off"
                          aria-label={copy.create.discordPlaceholder}
                          placeholder={copy.create.discordPlaceholder}
                          onChange={(event) => setDiscord(event.target.value)}
                        />
                      </label>
                      <label className="create-social">
                        <TelegramIcon aria-hidden="true" />
                        <Input
                          name="create-telegram"
                          value={telegram}
                          autoComplete="off"
                          aria-label={copy.create.telegramPlaceholder}
                          placeholder={copy.create.telegramPlaceholder}
                          onChange={(event) => setTelegram(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className="create-disclosure__note">{copy.create.linksOptional}</p>
                  </>
                ) : null}
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </div>
      {renderSidebar(true)}
    </div>
  )
}
