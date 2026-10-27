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
import { Calculator, Check, ChevronDown, Globe, ImagePlus, Info, RotateCcw, WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TxSuccessDialog } from '../global/tx-success-dialog'
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
  Asset,
  ChainInfo,
  CreateConfig,
} from '@/lib/data/fixture-repository'

import { ChainLogoMark } from '../global/chain-icons'
import { DiscordIcon, TelegramIcon, XIcon } from '../global/brand-icons'
import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { verseHref } from '../global/routes'
import { SourceRef, formatAmount } from '../global/signal-ui'
import { TxStatus } from '../global/tx-status'
import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import { buildSessionWrite, registerAtCenterCall, registerAtSpokeCall } from '@/lib/web3/session-actions'
import { parseEther, type Hex } from 'viem'

// Registration param scope = durationDays/name/symbol/uri/desc/uAsset/
// omnichainIds; initial pricing / minimum success amount are not registration params;
// lockup period = FIXED_LOCKUP_DURATION contract constant, not an input, shown in the review card's
// "Lockup period" row. Symbol occupancy = locked while the previous verse with the same symbol still
// has an open genesis window (RegistrationCenter SymbolNotUnlock; endTime = the genesis deadline;
// a window ending advances the nonce → a new uniqueId makes the symbol reusable again).
// Samples = derived from the verses snapshot genesis rows (repository); exact byte-string match
// (case-sensitive, no trim); the occupancy check reads on-chain values in production; the error line
// carries no unlock time or conditions and adds no ⊙. Layout: the Fees card merges into the
// form card below Communities;
// visible help copy is only the one line below Duration; all other explanations collapse into the
// ⊙ hover tooltip beside labels (Info)
const NAME_SYMBOL_MAX_BYTES = 31
const DESC_MAX_BYTES = 255
const LOGO_MAX_BYTES = 3 * 1024 * 1024
const LOGO_ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
// Success dialog "View Verse" target is a fixture sample: the verseId of a newly registered verse
// only comes into existence after on-chain registration, and the prototype has no wallet to get a
// receipt — jump to the fixture sample verse (production = verseId returned by the registration event)
const SAMPLE_VERSE_ID = 'verse-021'

/** Mainnet chainId → wallet testnet stand-in mapping (testnet stand-in shim, not domain values; same
 *  pattern as the vault card's GOVERNANCE_TESTNET): the quote decides "is the origin chain the
 *  governance chain" by comparing the wallet chainId against the governance chain's testnet
 *  counterpart */
const GOVERNANCE_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }

const encoder = new TextEncoder()

function byteLength(value: string) {
  return encoder.encode(value).length
}

/** Help copy template fill: {min}/{max} = genesis duration range, {days} = lockup period,
 *  {count} = remote chain count */
function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** ⊙ info icon beside a label: shows the explanation on hover, takes no layout space.
    By default renders a focusable button (keyboard accessible, valid aria-label); hoverOnly is for
    hosts embedded inside another button — nested interactive elements are illegal, so the host's
    sr-only text provides the explanation */
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

/** Registration success (2026-10-26 统一口径): the site-generic receipt dialog. Rows echo
    the registered identity; the View Verse CTA stays fixture-only (a real verse id exists
    only after indexing). */
function CreateSuccessDialog({
  locale,
  open,
  onOpenChange,
  name,
  symbol,
  chainName,
  hideVerseLink,
}: {
  locale: Locale
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  symbol: string
  chainName: string
  hideVerseLink?: boolean
}) {
  const copy = getCopy(locale)
  return (
    <TxSuccessDialog
      locale={locale}
      open={open}
      onOpenChange={onOpenChange}
      title={`${copy.create.launchDoneLead}${copy.create.launchDoneAccent}`}
      lead={copy.create.launchDoneLead}
      accent={copy.create.launchDoneAccent}
      rows={[
        { label: copy.create.nameLabel, value: name },
        { label: copy.create.symbolLabel, value: symbol },
        { label: copy.create.govChainLabel, value: chainName },
      ]}
      cta={
        hideVerseLink
          ? undefined
          : { label: copy.create.successViewVerse, href: verseHref(locale, SAMPLE_VERSE_ID) }
      }
    />
  )
}

type CreateFormProps = {
  locale: Locale
  assets: Asset[]
  chains: ChainInfo[]
  /** Full six-chain list (incl. testnet stand-ins): look up the origin chain's native symbol by the
   *  wallet's connected chain */
  walletChains: ChainInfo[]
  config: CreateConfig | null
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
  // Wallet connected chain = the quote's "origin chain" dimension (no cross-chain notice shown —
  // cross-chain is the norm for registration,
  // a notice would imply "cross-chain happens only in this case")
  const { connected, chainId: walletChainId, connectAction: toggleWallet } = useAccountCenter()
  // Error association: the id is only referenced back by aria-describedby while the error renders,
  // avoiding references to non-existent nodes
  const logoErrorId = useId()
  const nameErrorId = useId()
  const symbolErrorId = useId()
  const durationErrorId = useId()
  const descErrorId = useId()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Upload required: report missing after blur (incl. canceling the selection); on
  // submit failure show everything at once — same touched discipline as below
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
  // Spoke chains = deployment chains other than the governance chain; initially empty = show the
  // "Select Chains" placeholder (intentional: no spoke preselected)
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [fast, setFast] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  // Registration success display = dialog; after closing, the card
  // keeps a completed step + View Verse CTA fallback
  const [successOpen, setSuccessOpen] = useState(false)
  // Tx pipeline (replaces the retired timer simulation): review card → TxReviewPanel →
  // Type-4 session registration(). Spoke fan-out rides the same session batch (payable legs
  // carry the quoted native fees); the center generates uniqueId on-chain (§M8 protocol).
  const center = useAccountCenter()
  const tx = useTxCenter()
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [realFlow, setRealFlow] = useState(false)
  // object URL lifetime = component lifetime: replace/remove/unmount all reclaim it here in one
  // place (cleanup runs after the DOM image swap, so the old URL has no remaining references);
  // pickLogo/removeLogo no longer scatter revoke calls
  useEffect(
    () => () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl)
    },
    [logoUrl],
  )
  const [invalid, setInvalid] = useState(false)
  // Instant validation (only changes when errors are reported, no counters
  // added for name/symbol): exceeding the byte limit reports during typing (value-driven); missing
  // required fields report after blur, untouched fields raise no early alarm; submit failure still
  // shows everything at once
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
  // Occupancy is judged on the raw value: value-driven like the byte limit, reported during typing;
  // submit interception uses the trimmed cleanSymbol (same source as the actual registration param),
  // so trailing whitespace only counts as a hit at submit time
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
  // With config=null the submit button is already disabled; blur must not misreport "params
  // unavailable" as a user input error
  const durationInvalid = (durationTouched || invalid) && config != null && !durationRangeOk

  const govChainOption = chains.find((chain) => String(chain.chainId) === govChain) ?? null
  // Spoke chains = deployment chains other than the governance chain (the governance chain no longer
  // appears in the dropdown); each spoke costs one cross-chain fan-out fee
  const spokeOptions = chains.filter((chain) => String(chain.chainId) !== govChain)
  const selectedChains = chains.filter((chain) => selectedChainIds.includes(String(chain.chainId)))
  // Quote semantics: Total = per-remote-chain
  // fan-out (hub-chain quoteSend; the "local-chain fee=0" rule applies to the hub-chain target,
  // not the governance chain) + when originating off-chain, an origin→hub send
  // fee (RegistrarOmnichain quoteRegister). Whether cross-chain applies is decided by the
  // deployment target, not the origin — a governance chain target is free iff it equals the hub
  // chain. "Governance chain = hub chain" is a sample-scenario assumption
  // (hub chain ownership is unknown); hence the origin-fee test = wallet
  // connected chain ≠ governance chain; when not connected, treat as originating on the local chain
  // (same precedent as the vault card). Fees are paid in one payment in the origin chain's native
  // asset → the fee's native currency (its symbol) follows the origin chain
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
  // Zero state (fee truly 0 = local-chain origin and no Spoke selected): hide the whole cross-chain
  // fee block, keep only the launch button
  const showFee = config != null && govChainOption != null && crossChainFee > 0

  // Onchain registration (RegistrationCenter.registration; uniqueId is center-generated, §M8):
  // execution chain = gov testnet (mainnet gov maps to its testnet stand-in, §26 chainset).
  const MAINNET_TO_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }
  const govChainId = govChainOption != null ? govChainOption.chainId : null
  const execChainId =
    govChainId != null ? (MAINNET_TO_TESTNET[govChainId] ?? govChainId) : null
  const uAssetKey = `UAsset.${fundType}`
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    execChainId != null &&
    center.chainId === execChainId &&
    govChainOption != null

  async function buildAndStart(): Promise<void> {
    if (!executionReady || resolving || execChainId == null || govChainOption == null) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    if (!provider || !eoa) return
    const resolved = getClientChainConfig(execChainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    // Hub (97) takes RegistrationCenter.registration; spokes take
    // RegistrarOmnichain.registerAtCenter (same param, forwarded to the hub).
    const centerAddr = contracts.MemeverseRegistrationCenter as Hex | undefined
    const spokeAddr = contracts.MemeverseRegistrarOmnichain as Hex | undefined
    const hook = contracts.MemeverseUniswapHook as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    const uAsset = contracts[uAssetKey] as Hex | undefined
    if (!uAsset || (!centerAddr && !spokeAddr)) {
      setResolveFailed(true)
      return
    }
    const omnichainIds: number[] = []
    for (const id of [govChainId, ...selectedChains.map((chain) => chain.chainId)]) {
      if (id == null) continue
      const entry = getClientChainConfig(id)
      if (entry.status === 'ok') omnichainIds.push(entry.config.layerZeroEid)
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      const value = crossChainFee > 0 ? parseEther(String(crossChainFee)) : 0n
      const param = {
        name: name.trim(),
        symbol: symbol.trim(),
        uri: '',
        desc: desc.trim(),
        communities: [],
        durationDays: BigInt(numericDuration),
        omnichainIds,
        uAsset,
        flashGenesis: fast,
      }
      const action =
        centerAddr != null
          ? registerAtCenterCall(centerAddr, param, value)
          : registerAtSpokeCall(spokeAddr as Hex, param, value)
      const targetContract = (centerAddr ?? spokeAddr) as Hex
      const { calls, calldata: batch } = buildSessionWrite({ hook, action })
      const spec: WriteSpec = {
        review: {
          chainId: execChainId,
          account: eoa,
          targetContract,
          functionName: centerAddr != null ? 'registration' : 'registerAtCenter',
          inputs: `${name.trim()} (${symbol.trim()})`,
          minOutput: '—',
          fee: crossChainFee > 0 ? `${crossChainFee} ${nativeSymbol}` : '—',
          gasPayer: eoa,
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: execChainId,
        batchCallData: batch,
        calls,
        value,
        quoteId: `register:${symbol.trim()}:${govChain}:${selectedChainIds.join(',')}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: selectedChains.length > 0,
      }
      setRealFlow(true)
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  // Success dialog opens on real confirm.
  useEffect(() => {
    if (tx.display === 'confirmed') setSuccessOpen(true)
  }, [tx.display])
  // Review rows grouped by platform (bare values side by side are unreadable); icons match the
  // form input blocks
  const linkItems = [
    { id: 'website', icon: Globe, label: copy.create.linkWebsite, value: website },
    { id: 'x', icon: XIcon, label: copy.create.linkX, value: xHandle },
    { id: 'discord', icon: DiscordIcon, label: copy.create.linkDiscord, value: discord },
    { id: 'telegram', icon: TelegramIcon, label: copy.create.linkTelegram, value: telegram },
  ].filter((item) => item.value.trim().length > 0)

  function pickLogo(file: File | undefined) {
    // The file picker can bypass the accept restriction: type/size get a second guard in onChange,
    // a bad type breaks the <img> immediately
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

  /** Enter during IME composition does not trigger submit (same guard for all numeric inputs
   *  site-wide) */
  function guardImeEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
      event.preventDefault()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Whitespace-only is not valid input: trim first, then test emptiness, write the cleaned value
    // back to state (review page/success dialog draw from the same source as validation)
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

  /** Fees card merged at the tail of the form card: below the Communities
      disclosure row, in order: quote head / total row / payment note / Launch CTA; in the zero
      state (fee truly 0) the head and quote row hide together, keeping only the launch button */
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
            {/* quoteRegister returns only the cross-chain fee total,
                not a per-chain breakdown — the UI shows a single total
                row */}
            <dl className="create-quote">
              <div className="create-quote__row create-quote__row--total">
                <dt>{copy.create.quoteTotal}</dt>
                <dd data-numeric>
                  {formatAmount(crossChainFee, locale)} {nativeSymbol}
                </dd>
              </div>
            </dl>
            {/* Payment semantics: paid in one payment with the registration tx's
                msg.value (local chain = governance chain native; off-chain origin = origin chain
                native); the amount = quoteRegister's live on-chain quote */}
            <FieldDescription>{copy.create.quotePaidNote}</FieldDescription>
          </>
        ) : !config || !govChainOption ? (
          <p>{copy.create.quoteEmpty}</p>
        ) : null}
        {/* No user involvement: the submit slot is wholly replaced by a
            connect-wallet button — the slot keeps the ax-ghost-cta skin as-is (same
            style as the header wallet button); clicking it hits the same connection toggle
            as the header, and Launch returns unchanged after connecting; form fields stay fillable
            as usual and connecting resets no entered drafts */}
        {connected ? (
          <Button
            type="submit"
            className="ax-ghost-cta create-submit"
            size="lg"
            disabled={assets.length === 0 || chains.length === 0 || config == null}
          >
            {copy.create.submit}
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            className="ax-ghost-cta create-submit"
            size="lg"
            onClick={toggleWallet}
          >
            <WalletCards data-icon="inline-start" aria-hidden="true" />
            {copy.common.connect}
          </Button>
        )}
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
            {/* Payment note merged into the review card along with the sidebar (below the total row,
                same copy as the sidebar) */}
            {showFee ? <FieldDescription>{copy.create.quotePaidNote}</FieldDescription> : null}
            {tx.display === 'idle' ? (
              <div className="participation-review__actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewing(false)
                    tx.reset()
                  }}
                >
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />
                  {copy.create.revise}
                </Button>
                <Button
                  className="ax-ghost-cta"
                  disabled={resolving || tx.running || (center.source === 'real' && !executionReady)}
                  onClick={() => void buildAndStart()}
                >
                  {copy.verse.confirm}
                </Button>
              </div>
            ) : tx.display === 'confirmed' ? (
              <>
                {/* The dialog already carries the success display; the
                    card keeps a completed step + View Verse fallback (real flows hide the
                    sample link — the verse id only exists after indexing) */}
                <TxStatus locale={locale} state="confirmed" />
                {realFlow ? null : (
                  <Button
                    className="ax-ghost-cta"
                    nativeButton={false}
                    render={<Link href={verseHref(locale, SAMPLE_VERSE_ID)} />}
                  >
                    {copy.create.successViewVerse}
                  </Button>
                )}
              </>
            ) : (
              <TxStatus locale={locale} state={tx.display} />
            )}
            {resolveFailed ? <FieldError>{copy.common.degrade.errorBody}</FieldError> : null}
            
          </div>
        </div>
      </div>
      <CreateSuccessDialog
        locale={locale}
        open={tx.display === 'confirmed' && successOpen}
        onOpenChange={setSuccessOpen}
        name={name}
        symbol={symbol}
        chainName={govChainOption?.name ?? ''}
        hideVerseLink={realFlow}
      />
      </>
    )
  }

  return (
    <div className="create-layout">
      <div className="workbench-primary">
        {/* required only carries the required-field semantics for screen-reader announcement;
            validation goes through handleSubmit (noValidate disables native constraints) */}
        <form id="create-form" className="create-form" onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* First form item: Fast Genesis = label + ⊙ + toggle switch; off by default so it is
              naturally optional, no badge attached */}
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
                    /* aria-label pins the name: overrides the multi-label concatenation so screen
                       readers announce only the field name, without the target box copy */
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

                {/* Row placement: Duration and Fund Type sit side by side in the space right
                    of the logo */}
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
                        // Out-of-range input is force-clamped back to [min,max]:
                        // e.g. entering 9 → clamped to 3
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
                      {/* The trigger also shows the selected chain's icon:
                          the children function receives the selected value */}
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
                  {/* "Select Chains" multi-select dropdown; options = Spoke chains other than
                      the governance chain */}
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

              {/* Disclosure panel: Communities (icons inside the inputs, all optional) */}
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
                {/* sr-only placed outside the button: inside it would be merged into the button's
                    accessible name; the description should be announced separately via describedby */}
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
