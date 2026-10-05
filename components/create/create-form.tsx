'use client'

import {
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { Calculator, Check, ChevronDown, Globe, ImagePlus, Info, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  FixtureAsset,
  FixtureChain,
  FixtureCreateConfig,
} from '@/lib/data/fixture-repository'

import { ChainLogoMark } from '../global/chain-icons'
import { DiscordIcon, TelegramIcon, XIcon } from '../global/brand-icons'
import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { localePath, verseHref } from '../global/routes'
import { SourceRef, formatAmount } from '../global/signal-ui'
import { TxStatus, type TxState } from '../global/tx-status'

// 注册参数口径=SPEC-M8 registration-details §3（durationDays/name/symbol/uri/desc/uAsset/
// omnichainIds）；初始定价/最低成功额度非注册参数（2026-09-22 用户裁定移除，OB lifecycle.md:22
// 张力登记 source-map §6 对账区）；锁定期=FIXED_LOCKUP_DURATION 合约常量，不输入，审阅卡「锁定期」行展示。
// Symbol 占用=同 symbol 上一 verse 创世窗口未结束即锁定（RegistrationCenter:178 SymbolNotUnlock；
// endTime=创世截止 :186+LaunchImpl:311-322；窗口结束 nonce+1→新 uniqueId 可复用 :189-195）。
// 样本=verses 快照 genesis 行派生（repository）；精确字节串匹配（大小写敏感、不 trim）；
// 占用判定以链上读值为准；错误行不带解锁时刻与条件、不加 ⊙（2026-10-02 用户裁定）。
// 布局：Fees 卡并入表单卡 Communities 下方（2026-10-04 用户裁定，脱离 demo 双栏——
// demo.outrun.build/memeverse/create 为右列侧栏旧制）；可见帮助文案仅时长下方一句，
// 其余说明收进标签旁 ⊙ 悬浮提示（Info）
const NAME_SYMBOL_MAX_BYTES = 31
const DESC_MAX_BYTES = 255
const LOGO_MAX_BYTES = 3 * 1024 * 1024
const LOGO_ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
// T6 成功弹窗「查看 Verse」跳转目标=S 级样本：新注册 verse 的 verseId 链上注册后才产生，
// 原型无钱包拿不到回执——跳 fixture 样本 verse（生产=注册事件返回的 verseId）
const SAMPLE_VERSE_ID = 'verse-021'

/** 主网 chainId → 钱包测试网替身映射（模拟粘合层非领域数值，vault 卡 GOVERNANCE_TESTNET 同款）：
 *  报价判「发起链是否治理链」用钱包 chainId 比对治理链的测试网对应链 */
const GOVERNANCE_TESTNET: Record<number, number> = { 1: 11155111, 8453: 84532, 56: 97 }

const encoder = new TextEncoder()

function byteLength(value: string) {
  return encoder.encode(value).length
}

/** 帮助文案模板填充：{min}/{max}=创世时长区间、{days}=锁定期、{count}=异链数 */
function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** demo 式标签旁 ⊙ 信息图标：悬浮显示说明，不在版面上占位。
    默认渲染可聚焦 button（键盘可达、aria-label 合法）；hoverOnly 用于
    嵌在另一按钮内部的宿主——嵌套交互元素非法，说明由宿主 sr-only 提供 */
function FieldInfo({ text, hoverOnly }: { text: string; hoverOnly?: boolean }) {
  if (hoverOnly) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="create-info" aria-hidden="true" />}>
          <Info aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger className="create-info" aria-label={text}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

type CreateFormProps = {
  locale: Locale
  assets: FixtureAsset[]
  chains: FixtureChain[]
  /** 全六链名单（含测试网替身）：按钱包连接链查发起链原生币种 */
  walletChains: FixtureChain[]
  config: FixtureCreateConfig | null
  occupiedSymbols: string[]
}

export function CreateForm({
  locale,
  assets,
  chains,
  walletChains,
  config,
  occupiedSymbols,
}: CreateFormProps) {
  const copy = getCopy(locale)
  const linksNoteId = useId()
  // 钱包连接链=报价的「发起链」维度（2026-10-02 用户裁定进创建页；不显示跨链提示——
  // 跨链是注册常态，提示会造「只有这种情况才跨链」的歧义）
  const { connected, chainId: walletChainId } = useMockWallet()
  // 错误关联：id 只在错误渲染期间被 aria-describedby 条件回指，避免引用不存在的节点
  const logoErrorId = useId()
  const nameErrorId = useId()
  const symbolErrorId = useId()
  const durationErrorId = useId()
  const descErrorId = useId()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  // 上传必填（用户裁定）：失焦（含取消选择）后报缺，提交失败一并全显——同下方 touched 纪律
  const [logoTouched, setLogoTouched] = useState(false)
  const [logoReject, setLogoReject] = useState<'type' | 'size' | null>(null)
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
  // 交易签名模拟（state-matrix T4→T5→T6）：确认后前端定时推进，无钱包
  const [txState, setTxState] = useState<TxState>('idle')
  // T6 注册成功展示=弹窗（2026-10-01 用户裁定）；关闭后卡片留完成步骤+查看 Verse CTA 兜底
  const [successOpen, setSuccessOpen] = useState(false)
  const txTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => txTimers.current.forEach(clearTimeout), [])
  // object URL 生命周期=组件等长：换图/移除/卸载统一在此回收（cleanup 跑在 DOM 换图之后，
  // 旧 URL 已无引用），pickLogo/removeLogo 不再散落 revoke
  useEffect(
    () => () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl)
    },
    [logoUrl],
  )
  const [invalid, setInvalid] = useState(false)
  // 即时校验（2026-10-01 用户裁定：只改报错时机，name/symbol 不加计数器）：超字节上限在输入
  // 过程中即报（值驱动）；必填缺失失焦后再报，未动过的字段不提前报警；提交失败仍一次性全显
  const [nameTouched, setNameTouched] = useState(false)
  const [symbolTouched, setSymbolTouched] = useState(false)
  const [durationTouched, setDurationTouched] = useState(false)
  const [descTouched, setDescTouched] = useState(false)

  const nameBytes = byteLength(name)
  const symbolBytes = byteLength(symbol)
  const descBytes = byteLength(desc)
  const numericDuration = Number(duration || 0)

  const logoInvalid = (logoTouched || invalid) && logoUrl == null
  const nameInvalid =
    nameBytes > NAME_SYMBOL_MAX_BYTES || ((nameTouched || invalid) && nameBytes < 1)
  // 占用按原始值判定：与字节超限同为值驱动，输入过程中即报；提交拦截用 trim 后的
  // cleanSymbol（与实际注册参数同源），尾部空白在提交时才计为命中
  const symbolTaken = occupiedSymbols.includes(symbol)
  const symbolInvalid =
    symbolTaken ||
    symbolBytes > NAME_SYMBOL_MAX_BYTES ||
    ((symbolTouched || invalid) && symbolBytes < 1)
  const descInvalid =
    descBytes > DESC_MAX_BYTES || ((descTouched || invalid) && descBytes < 1)
  const durationRangeOk =
    config != null &&
    Number.isInteger(numericDuration) &&
    numericDuration >= config.minDurationDays &&
    numericDuration <= config.maxDurationDays
  // config=null 时提交按钮已被禁用，失焦不得把「参数不可得」误报成用户输入错误
  const durationInvalid = (durationTouched || invalid) && config != null && !durationRangeOk

  const govChainOption = chains.find((chain) => String(chain.chainId) === govChain) ?? null
  // Spoke chains=治理链之外的部署链（治理链不再出现在下拉里）；每条 spoke 一笔跨链 fan-out 费
  const spokeOptions = chains.filter((chain) => String(chain.chainId) !== govChain)
  const selectedChains = chains.filter((chain) => selectedChainIds.includes(String(chain.chainId)))
  // 报价口径（三合约核对 2026-10-02）：Total=逐条异链 fan-out（Center quoteSend；SPEC-M8 §9 的
  // 「本链 fee=0」主语=注册中心链目标，非治理链）+ 异链发起时 发起链→中心链 发送费
  // （RegistrarOmnichain quoteRegister）。跨链与否由部署目标决定，不由发起地决定——治理链目标
  // 免费当且仅当它=中心链。「治理链=注册中心链」为样本场景假设（真源 deployment.md §8：中心链
  // 归属[未知]），故发起费判据=钱包连接链≠治理链；未连接按本链发起处理（vault 卡同款先例）。
  // 费用以发起链原生资产一笔支付（§9）→ 币种随发起链取
  const govWalletChainId = govChainOption
    ? (GOVERNANCE_TESTNET[govChainOption.chainId] ?? govChainOption.chainId)
    : undefined
  const offGovChain =
    connected && govWalletChainId !== undefined && walletChainId !== govWalletChainId
  const remoteCount = config ? selectedChains.length : 0
  const crossChainFee = config
    ? config.remoteDeployFee * remoteCount + (offGovChain ? config.remoteSendFee : 0)
    : 0
  const connectedChain = offGovChain
    ? (walletChains.find((chain) => chain.chainId === walletChainId) ?? null)
    : null
  const nativeSymbol =
    (offGovChain ? connectedChain?.nativeSymbol : undefined) ?? govChainOption?.nativeSymbol ?? ''
  // 0 态（费用真为 0=本链发起且未选 Spoke）跨链费整块不显示，仅留启动按钮（2026-10-02 用户裁定）
  const showFee = config != null && govChainOption != null && crossChainFee > 0
  // 审阅行按平台成组展示（裸值并排不可读——2026-10-01 用户反馈），图标与表单输入块一致
  const linkItems = [
    { id: 'website', icon: Globe, label: copy.create.linkWebsite, value: website },
    { id: 'x', icon: XIcon, label: copy.create.linkX, value: xHandle },
    { id: 'discord', icon: DiscordIcon, label: copy.create.linkDiscord, value: discord },
    { id: 'telegram', icon: TelegramIcon, label: copy.create.linkTelegram, value: telegram },
  ].filter((item) => item.value.trim().length > 0)

  function pickLogo(file: File | undefined) {
    // file picker 可绕过 accept 限定：类型/体积在 onChange 二次守卫，坏类型进 <img> 即破图
    if (!file) return
    if (!LOGO_ACCEPTED_TYPES.has(file.type)) {
      setLogoReject('type')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoReject('size')
      return
    }
    setLogoReject(null)
    setLogoUrl(URL.createObjectURL(file))
  }

  function removeLogo() {
    setLogoUrl(null)
    setLogoReject(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  /** 输入法组词期间的 Enter 不触发提交（全站数字输入同一守卫） */
  function guardImeEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
      event.preventDefault()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // 纯空格不算有效输入：先 trim 再判空，清理值回填 state（审阅页/成功弹窗与校验同源）
    const cleanName = name.trim()
    const cleanSymbol = symbol.trim()
    const cleanDesc = desc.trim()
    setName(cleanName)
    setSymbol(cleanSymbol)
    setDesc(cleanDesc)
    const ok =
      logoUrl != null &&
      cleanName.length >= 1 &&
      byteLength(cleanName) <= NAME_SYMBOL_MAX_BYTES &&
      cleanSymbol.length >= 1 &&
      byteLength(cleanSymbol) <= NAME_SYMBOL_MAX_BYTES &&
      !occupiedSymbols.includes(cleanSymbol) &&
      cleanDesc.length >= 1 &&
      byteLength(cleanDesc) <= DESC_MAX_BYTES &&
      durationRangeOk
    if (!ok) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setReviewing(true)
  }

  /** 签名模拟推进：T4 等待签名 ≈1.6s → T5 上链确认 ≈1.2s → T6 已确认 */
  function beginSigning() {
    setTxState('signing')
    txTimers.current.push(setTimeout(() => setTxState('confirming'), 1600))
    txTimers.current.push(
      setTimeout(() => {
        setTxState('confirmed')
        setSuccessOpen(true)
      }, 2800),
    )
  }

  /** Fees 卡并入表单卡尾部（2026-10-04 用户裁定）：Communities 折叠行下方顺排
      报价头/总额行/支付说明/Launch CTA；0 态（费用真为 0）头部与报价行一并隐藏，
      只留启动按钮（2026-10-02 用户裁定沿用） */
  function renderLaunchFoot() {
    return (
      <section
        className="create-launch-foot"
        aria-labelledby={showFee || !config || !govChainOption ? 'create-quote-title' : undefined}
      >
        {showFee || !config || !govChainOption ? (
          <div className="action-panel__head">
            <span className="action-panel__icon" aria-hidden="true">
              <Calculator />
            </span>
            <h2 id="create-quote-title">{copy.create.quoteTitle}</h2>
          </div>
        ) : null}
        {showFee ? (
          <>
            {/* quoteRegister 只回跨链费总和（AtLocal:56 / RegistrarOmnichain:59-66），不暴露
                逐链拆分——界面只呈现一行总额（#69 用户裁定） */}
            <dl className="create-quote">
              <div className="create-quote__row create-quote__row--total">
                <dt>{copy.create.quoteTotal}</dt>
                <dd data-numeric>
                  {formatAmount(crossChainFee, locale)} {nativeSymbol}
                </dd>
              </div>
            </dl>
            {/* 支付口径=SPEC-M8 §9：随注册交易 msg.value 一笔支付（本链=治理链原生；
                异链发起=发起链原生），金额=quoteRegister 链上实时报价 */}
            <FieldDescription>{copy.create.quotePaidNote}</FieldDescription>
          </>
        ) : !config || !govChainOption ? (
          <p>{copy.create.quoteEmpty}</p>
        ) : null}
        <Button
          type="submit"
          className="ax-ghost-cta create-submit"
          size="lg"
          disabled={assets.length === 0 || chains.length === 0 || config == null}
        >
          {copy.create.submit}
        </Button>
        {config ? <SourceRef value={config.sourceRef} /> : null}
      </section>
    )
  }

  if (reviewing) {
    return (
      <>
        <div className="create-layout">
          <div className="workbench-primary">
          <div className="participation-review" aria-live="polite">
            <div className="participation-review__heading">
              <span className="review-check" aria-hidden="true">
                <Check />
              </span>
              <div>
                <h3>{copy.create.reviewTitle}</h3>
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
                <dd>
                  {linkItems.length > 0 ? (
                    <ul className="create-review-links">
                      {linkItems.map((item) => (
                        <li key={item.id}>
                          <item.icon aria-hidden="true" />
                          <span className="create-review-links__label">{item.label}</span>
                          <span>{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    copy.create.noneYet
                  )}
                </dd>
              </div>
              {showFee ? (
                <div className="create-quote__total">
                  <dt>{copy.create.quoteTotal}</dt>
                  <dd data-numeric>
                    {formatAmount(crossChainFee, locale)} {nativeSymbol}
                  </dd>
                </div>
              ) : null}
            </dl>
            {/* 支付说明随侧栏并入审阅卡（总额行下方，同侧栏原文案） */}
            {showFee ? <FieldDescription>{copy.create.quotePaidNote}</FieldDescription> : null}
            {txState === 'idle' ? (
              <div className="participation-review__actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewing(false)
                    setTxState('idle')
                  }}
                >
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />
                  {copy.create.revise}
                </Button>
                <Button className="ax-ghost-cta" onClick={beginSigning}>
                  {copy.verse.confirmPrototype}
                </Button>
              </div>
            ) : txState === 'confirmed' ? (
              <>
                {/* 弹窗已承载成功展示（2026-10-01 用户裁定）；卡片留完成步骤+查看 Verse 兜底 */}
                <TxStatus locale={locale} state="confirmed" />
                <Button
                  className="ax-ghost-cta"
                  nativeButton={false}
                  render={<Link href={verseHref(locale, SAMPLE_VERSE_ID)} />}
                >
                  {copy.create.successViewVerse}
                </Button>
              </>
            ) : (
              <TxStatus locale={locale} state={txState} />
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={txState === 'confirmed' && successOpen}
        onOpenChange={(open) => setSuccessOpen(open)}
      >
        <DialogContent>
          {/* 壳复用 .pol-mint（同 DAO/POL 弹窗）：底色/描边光/padding 都在这层 */}
          <div className="pol-mint">
            <header className="pol-mint__head">
              <DialogTitle className="pol-mint__title">
                {copy.create.launchDoneLead}
                {copy.create.launchDoneAccent ? (
                  <span className="create-success-pop__title-accent">
                    {copy.create.launchDoneAccent}
                  </span>
                ) : null}
              </DialogTitle>
              <div className="pol-mint__controls">
                <DialogClose
                  render={<button type="button" className="pol-mint__close" aria-label={copy.common.close} />}
                >
                  <X aria-hidden="true" size={16} />
                </DialogClose>
              </div>
            </header>
            <div className="create-success-pop__body">
              <p className="tx-success__summary">
                {fill(copy.create.launchSummary, {
                  name,
                  symbol,
                  chain: govChainOption?.name ?? '',
                })}
              </p>
              <Button
                className="ax-ghost-cta"
                nativeButton={false}
                render={<Link href={verseHref(locale, SAMPLE_VERSE_ID)} />}
              >
                {copy.create.successViewVerse}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>
    )
  }

  return (
    <div className="create-layout">
      <div className="workbench-primary">
        {/* required 仅承载必填语义供读屏播报；校验走 handleSubmit（noValidate 关闭原生约束） */}
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
                <Field
                  className="create-identity__logo"
                  data-invalid={logoInvalid || logoReject ? true : undefined}
                >
                  <FieldLabel htmlFor="create-logo">
                    {copy.create.logoLabel}
                    <FieldInfo text={copy.create.logoHint} />
                  </FieldLabel>
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
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    required
                    /* aria-label 定名：压过多 label 拼接，读屏单念字段名不捎带靶位文案 */
                    aria-label={copy.create.logoLabel}
                    aria-invalid={logoInvalid || logoReject ? true : undefined}
                    aria-describedby={logoInvalid || logoReject ? logoErrorId : undefined}
                    onBlur={() => setLogoTouched(true)}
                    onChange={(event) => pickLogo(event.target.files?.[0])}
                  />
                  {logoReject ? (
                    <FieldError id={logoErrorId}>
                      {logoReject === 'size' ? copy.create.logoTooLarge : copy.create.logoUnsupported}
                    </FieldError>
                  ) : logoInvalid ? (
                    <FieldError id={logoErrorId}>{copy.create.logoRequired}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={nameInvalid ? true : undefined}>
                  <FieldLabel htmlFor="create-name">{copy.create.nameLabel}</FieldLabel>
                  <Input
                    id="create-name"
                    name="create-name"
                    value={name}
                    maxLength={NAME_SYMBOL_MAX_BYTES * 4}
                    autoComplete="off"
                    required
                    aria-invalid={nameInvalid ? true : undefined}
                    aria-describedby={nameInvalid ? nameErrorId : undefined}
                    placeholder={copy.create.namePlaceholder}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => setNameTouched(true)}
                    onKeyDown={guardImeEnter}
                  />
                  {nameInvalid ? (
                    <FieldError id={nameErrorId}>{copy.create.nameError}</FieldError>
                  ) : null}
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
                    required
                    aria-invalid={symbolInvalid ? true : undefined}
                    aria-describedby={symbolInvalid ? symbolErrorId : undefined}
                    placeholder={copy.create.symbolPlaceholder}
                    onChange={(event) => setSymbol(event.target.value)}
                    onBlur={() => setSymbolTouched(true)}
                    onKeyDown={guardImeEnter}
                  />
                  {symbolInvalid ? (
                    <FieldError id={symbolErrorId}>
                      {symbolTaken ? copy.create.symbolTaken : copy.create.symbolError}
                    </FieldError>
                  ) : null}
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
                      required
                      value={duration}
                      aria-invalid={durationInvalid ? true : undefined}
                      aria-describedby={durationInvalid ? durationErrorId : undefined}
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
                      onBlur={() => setDurationTouched(true)}
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
                  {durationInvalid ? (
                    <FieldError id={durationErrorId}>{copy.create.durationError}</FieldError>
                  ) : null}
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
                    <FieldInfo text={copy.create.chainsHint} />
                    <span className="create-optional-tag">{copy.create.optionalTag}</span>
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
                  required
                  aria-invalid={descInvalid ? true : undefined}
                  aria-describedby={descInvalid ? descErrorId : undefined}
                  placeholder={copy.create.descPlaceholder}
                  onChange={(event) => setDesc(event.target.value)}
                  onBlur={() => setDescTouched(true)}
                />
                {descInvalid ? (
                  <FieldError id={descErrorId}>
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
                  aria-describedby={linksNoteId}
                  onClick={() => setLinksOpen((open) => !open)}
                >
                  <span className="create-disclosure__label">
                    {copy.create.linksLegend}
                    <FieldInfo text={copy.create.linksInfo} hoverOnly />
                    <span className="create-optional-tag">{copy.create.optionalTag}</span>
                  </span>
                  <ChevronDown data-open={linksOpen || undefined} aria-hidden="true" />
                </button>
                {/* sr-only 置于按钮外：放内部会被并进按钮可访问名称，说明应由 describedby 单独播报 */}
                <span id={linksNoteId} className="sr-only">
                  {copy.create.linksInfo}
                </span>
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
          {renderLaunchFoot()}
        </form>
      </div>
    </div>
  )
}
