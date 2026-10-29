'use client'

import {
  useEffect,
  useMemo,
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
import { SwitchChainCta } from '../global/switch-chain-cta'
import { verseHref } from '../global/routes'
import { SourceRef, formatAmount } from '../global/signal-ui'
import {
  quoteRegistrationFanOut,
  readSymbolAvailable,
  type ContractReader,
} from '../global/execution-reads'
import { TxStatus } from '../global/tx-status'
import { executionChainId, getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import { buildSessionWrite, registerAtCenterCall } from '@/lib/web3/session-actions'
import { formatBaseUnits } from '@/lib/web3/base-units'
import { createPublicClient, custom, type Hex } from 'viem'

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

const encoder = new TextEncoder()

export function byteLength(value: string) {
  return encoder.encode(value).length
}

/** Help copy template fill: {min}/{max} = genesis duration range, {days} = lockup period,
 *  {count} = remote chain count */
export function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** Live hub read handle. Client chain reads ride the active wallet provider (§2.3) — client chain
 *  configs carry no RPC endpoints — so the fee quote and the symbol probe resolve their reader
 *  through this one construction. Null while the provider or the RegistrationCenter address is
 *  unavailable; `addresses` carries the deployed contract map for extra lookups (uAsset). */
function createHubReader(
  execChainId: number | null,
): { reader: ContractReader; center: Hex; addresses: Record<string, string> } | null {
  const provider = getActiveEip1193Provider()
  const exec = execChainId != null ? getClientChainConfig(execChainId) : null
  if (provider == null || exec?.status !== 'ok' || exec.config.contracts.status !== 'deployed') {
    return null
  }
  const addresses = exec.config.contracts.addresses
  const center = addresses.MemeverseRegistrationCenter as Hex | undefined
  if (center == null) return null
  const client = createPublicClient({
    chain: exec.config.viemChain,
    transport: custom({ request: provider.request }),
  })
  return {
    reader: { read: (params) => client.readContract(params) as Promise<unknown> },
    center,
    addresses,
  }
}

/** Genesis duration gate: an integer inside the chain config's [min,max] window. A missing
 *  config leaves the field unjudged — the submit button is already disabled in that state. */
export function durationInRange(
  duration: number,
  config: { minDurationDays: number; maxDurationDays: number } | null,
): boolean {
  return (
    config != null &&
    Number.isInteger(duration) &&
    duration >= config.minDurationDays &&
    duration <= config.maxDurationDays
  )
}

/** Submit-time registration gate: trimmed identity fields, byte limits, symbol occupancy and
 *  the duration window (the same predicate the CTA and the submit handler read). */
export function registrationInputsOk(input: {
  hasLogo: boolean
  name: string
  symbol: string
  desc: string
  occupiedSymbols: string[]
  /** Live hub verdict for `symbol` (previewRegistration). Optional so the fixture path is
   *  unchanged; null = not probed or unreadable, which must not be read as "available" — the
   *  async submit path re-probes and fails closed instead. */
  symbolAvailable?: boolean | null
  duration: number
  config: { minDurationDays: number; maxDurationDays: number } | null
}): boolean {
  return (
    input.hasLogo &&
    input.name.length >= 1 &&
    byteLength(input.name) <= NAME_SYMBOL_MAX_BYTES &&
    input.symbol.length >= 1 &&
    byteLength(input.symbol) <= NAME_SYMBOL_MAX_BYTES &&
    !input.occupiedSymbols.includes(input.symbol) &&
    input.symbolAvailable !== false &&
    input.desc.length >= 1 &&
    byteLength(input.desc) <= DESC_MAX_BYTES &&
    durationInRange(input.duration, input.config)
  )
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
  const center = useAccountCenter()
  const { connected, chainId: walletChainId, connectAction: toggleWallet } = center
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
  const tx = useTxCenter()
  const [resolving, setResolving] = useState(false)
  // Confirm-block reason for the review card's error slot: 'occupied' is deterministic (the
  // symbol stays taken until the genesis window ends — retry refails), 'unavailable' is transient
  const [resolveFailed, setResolveFailed] = useState<null | 'occupied' | 'unavailable'>(null)
  // Latest-wins token for resolve rounds: bumped on every handleSubmit/Revise, snapshotted at
  // buildAndStart entry — a round whose epoch moved on owns nothing anymore (neither the verdict
  // slot nor the wallet send it would trigger). Same stale-continuation class as useTxCenter's
  // runSeqRef, which cannot see this component-level promise chain.
  const resolveEpochRef = useRef(0)
  const [realFlow, setRealFlow] = useState(false)
  // Live hub fan-out quote (native base units); null = no quote yet or quote unavailable —
  // while a re-quote is in flight the previous shape's value stays on display until replaced
  const [fanOutFee, setFanOutFee] = useState<bigint | null>(null)
  // Live symbol occupancy, keyed by the probed symbol: a verdict for a symbol the user has
  // already edited past must not gate the current one. available=null = the probe has not landed
  // or cannot run, which is an unresolved verdict and never reads as "free".
  const [symbolProbe, setSymbolProbe] = useState<{
    symbol: string
    available: boolean | null
  } | null>(null)
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
  // so trailing whitespace only counts as a hit at submit time.
  // Two sources feed it: the fixture sample set, and the hub's own previewRegistration verdict.
  // The onchain term only counts inside the contract's length window — previewRegistration mirrors
  // registration's InvalidLength gate (.sol:115) and answers false for an empty or over-long
  // symbol, which the byte-limit error already reports and must not surface as "taken".
  const probeSymbol = symbol.trim()
  const probeInWindow =
    probeSymbol.length >= 1 && byteLength(probeSymbol) <= NAME_SYMBOL_MAX_BYTES
  const probeFresh = symbolProbe != null && symbolProbe.symbol === probeSymbol
  // null = unresolved (not probed, no wallet on the gov exec chain, or an unreadable probe)
  const probeVerdict = probeInWindow && probeFresh ? (symbolProbe?.available ?? null) : null
  const symbolTaken = occupiedSymbols.includes(symbol) || probeVerdict === false
  const symbolInvalid =
    symbolTaken ||
    symbolBytes > NAME_SYMBOL_MAX_BYTES ||
    ((symbolTouched || invalid) && symbolBytes < 1)
  const descInvalid =
    descBytes > DESC_MAX_BYTES || ((descTouched || invalid) && descBytes < 1)
  const durationRangeOk = durationInRange(numericDuration, config)
  // With config=null the submit button is already disabled; blur must not misreport "params
  // unavailable" as a user input error
  const durationInvalid = (durationTouched || invalid) && config != null && !durationRangeOk

  const govChainOption = chains.find((chain) => String(chain.chainId) === govChain) ?? null
  // Spoke chains = deployment chains other than the governance chain (the governance chain no longer
  // appears in the dropdown); each spoke costs one cross-chain fan-out fee
  const spokeOptions = chains.filter((chain) => String(chain.chainId) !== govChain)
  // Stable identity across renders: the quote effect keys on selectedChains, and a fresh filter
  // array every render would restart the debounce on unrelated interactions
  const selectedChains = useMemo(
    () => chains.filter((chain) => selectedChainIds.includes(String(chain.chainId))),
    [chains, selectedChainIds],
  )
  // Fee semantics: the registration tx pays the hub fan-out in one payment with msg.value, priced
  // by the live center quoteSend (see the quote effect below); the fee's native symbol therefore
  // follows the governance exec chain. Submission is gated to the governance exec chain — the
  // origin only decides which chain the wallet sits on ("governance chain = hub chain" remains a
  // sample-scenario assumption; hub chain ownership is unknown)
  const govWalletChainId = govChainOption
    ? executionChainId(govChainOption.chainId)
    : undefined
  const offGovChain =
    connected && govWalletChainId !== undefined && walletChainId !== govWalletChainId
  const connectedChain = offGovChain
    ? (walletChains.find((chain) => chain.chainId === walletChainId) ?? null)
    : null
  const nativeSymbol =
    (offGovChain ? connectedChain?.nativeSymbol : undefined) ?? govChainOption?.nativeSymbol ?? ''
  // Zero state (fee truly 0 = local-chain origin and no Spoke selected; also while the live quote
  // is in flight or unavailable): hide the whole cross-chain fee block, keep only the launch button
  const showFee = config != null && govChainOption != null && fanOutFee != null && fanOutFee > 0n

  // Onchain registration (RegistrationCenter.registration; uniqueId is center-generated, §M8):
  // execution chain = gov testnet (mainnet gov maps to its testnet stand-in, §26 chainset).
  const govChainId = govChainOption != null ? govChainOption.chainId : null
  const execChainId = govChainId != null ? executionChainId(govChainId) : null
  const uAssetKey = `UAsset.${fundType}`
  // One chain gate for everything gov-exec-chain-scoped: the fee quote and the symbol probe arm
  // on it, the submit gate derives from it — tightening here must reach all three.
  const quoteOnGovExecChain =
    connected &&
    center.source === 'real' &&
    center.chainSupported &&
    execChainId != null &&
    center.chainId === execChainId
  const executionReady = quoteOnGovExecChain && govChainOption != null
  // One predicate for both confirm-gate halves: the review button's disabled state and
  // buildAndStart's first-line guard must not drift apart (a diverged pair leaves either a
  // dead button or a click that silently no-ops).
  const confirmGated = !executionReady || resolving
  // Wrong-chain wallet parked on the review card: the fee block is hidden without a gov-exec-
  // chain quote, so a disabled Confirm alone reads as a dead end — the confirm slot becomes the
  // network switch instead, same in-place escape as the participation dialog. Real builds only;
  // harness/fixture keeps both buttons for the prototype baseline.
  const reviewWrongChain = center.source === 'real' && offGovChain

  // Targets travel in the contract's chain-id domain: quoteSend/registration compare
  // uint32(block.chainid) and the LzEndpointRegistry keys by chain id — never the LayerZero eid.
  function registrationTargets(): number[] {
    const ids: number[] = []
    for (const id of [govChainOption?.chainId, ...selectedChains.map((chain) => chain.chainId)]) {
      if (id == null) continue
      const entry = getClientChainConfig(id)
      if (entry.status === 'ok') ids.push(executionChainId(id))
    }
    return ids
  }

  // Live registration fee (page brief: 费用报价=RPC 参数联动刷新): re-quote the center's own
  // fan-out price whenever the registration shape moves; the fee card stays hidden until a real
  // quote lands. The quote rides the wallet provider — only meaningful on the gov exec chain,
  // the same gate that arms submission.
  useEffect(() => {
    if (!quoteOnGovExecChain) {
      setFanOutFee(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const hub = createHubReader(execChainId)
        if (hub == null) return
        const uAsset = hub.addresses[uAssetKey] as Hex | undefined
        if (uAsset == null) return
        const fee = await quoteRegistrationFanOut(hub.reader, hub.center, {
          name: name.trim(),
          symbol: symbol.trim(),
          uri: '',
          desc: desc.trim(),
          communities: [],
          omnichainIds: registrationTargets(),
          uAsset,
          flashGenesis: fast,
        })
        if (!cancelled) setFanOutFee(fee)
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    quoteOnGovExecChain,
    execChainId,
    uAssetKey,
    govChainOption,
    selectedChains,
    name,
    symbol,
    desc,
    fast,
  ])

  // Live symbol occupancy (page brief: symbol 占用校验=RPC 实时防抖): re-probe the hub whenever the
  // symbol moves. Occupancy is per-candidate and time-relative
  // (block.timestamp > symbolRegistry[symbol].endTime, .sol:112-118), so it can only be answered
  // for the symbol the user is typing — there is no enumerable occupied set for the page to
  // snapshot at render time, which is why the onchain repository hands down no occupancy list.
  useEffect(() => {
    // Outside the contract's length window previewRegistration answers false for a different
    // reason — .sol:115 mirrors registration's InvalidLength gate — and the derivation below
    // discards the value, so skip the read instead of spending an RPC on a verdict nothing consumes
    if (!quoteOnGovExecChain || !probeInWindow) {
      setSymbolProbe(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const hub = createHubReader(execChainId)
        if (hub == null) return
        const probed = symbol.trim()
        const available = await readSymbolAvailable(hub.reader, hub.center, probed)
        if (!cancelled) setSymbolProbe({ symbol: probed, available })
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [quoteOnGovExecChain, probeInWindow, execChainId, symbol])

  async function buildAndStart(): Promise<void> {
    if (confirmGated || execChainId == null || govChainOption == null) return
    const myEpoch = resolveEpochRef.current
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
    const hook = contracts.MemeverseUniswapHook as Hex | undefined
    const kernel = resolved.config.kernel7702Implementation as Hex
    const uAsset = contracts[uAssetKey] as Hex | undefined
    if (!hook || !uAsset || (!centerAddr && !spokeAddr)) {
      setResolveFailed('unavailable')
      return
    }
    const omnichainIds = registrationTargets()
    setResolving(true)
    setResolveFailed(null)
    try {
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
      if (centerAddr == null) {
        // Spoke-origin submission sits behind the same gov-exec-chain gate; a registrar-only
        // deployment has no quotable path, so fail closed instead of sending an unpriced tx.
        setResolveFailed('unavailable')
        return
      }
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      })
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      }
      // Fresh occupancy probe at submit: the debounced hint may predate the last edit, and
      // registration() reverts with SymbolNotUnlock, so fail closed rather than price and send
      const symbolFree = await readSymbolAvailable(reader, centerAddr, param.symbol)
      // A Revise/re-Launch while the probe was in flight superseded this round: bail before any
      // write — a stale verdict would refill the slot handleSubmit just cleared
      if (resolveEpochRef.current !== myEpoch) return
      if (symbolFree === false) {
        setSymbolProbe({ symbol: param.symbol, available: false })
        setResolveFailed('occupied')
        return
      }
      // Fresh quote at submit prices both the review card and msg.value — a stale display quote
      // never funds the send
      const totalFee = await quoteRegistrationFanOut(reader, centerAddr, param)
      // No yield between here and executeSession, so this check also covers the send — a
      // superseded round must not start the wallet flow for the abandoned parameters
      if (resolveEpochRef.current !== myEpoch) return
      if (totalFee == null) {
        setResolveFailed('unavailable')
        return
      }
      setFanOutFee(totalFee)
      const action = registerAtCenterCall(centerAddr, param, totalFee)
      const targetContract = centerAddr
      const { calls, calldata: batch } = buildSessionWrite({ hook, action })
      const spec: WriteSpec = {
        review: {
          chainId: execChainId,
          account: eoa,
          targetContract,
          functionName: centerAddr != null ? 'registration' : 'registerAtCenter',
          inputs: `${name.trim()} (${symbol.trim()})`,
          minOutput: '—',
          fee: totalFee > 0n ? `${formatBaseUnits(totalFee, 18, locale)} ${nativeSymbol}` : '—',
          gasPayer: eoa,
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: execChainId,
        batchCallData: batch,
        calls,
        value: totalFee,
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
      if (resolveEpochRef.current === myEpoch) setResolveFailed('unavailable')
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
    const ok = registrationInputsOk({
      hasLogo: logoUrl != null,
      name: cleanName,
      symbol: cleanSymbol,
      desc: cleanDesc,
      occupiedSymbols,
      symbolAvailable: probeVerdict,
      duration: numericDuration,
      config,
    })
    if (!ok) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    // Re-entry clears the previous resolve verdict: the review card renders resolveFailed
    // unconditionally, so a stale 'occupied' from an earlier Confirm would show before the
    // next one runs (handleSubmit is the only entry into reviewing). The epoch bump also
    // retires any resolve round still in flight — its continuation must not refill this
    // slot or send for the old parameters.
    resolveEpochRef.current += 1
    setResolveFailed(null)
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
            {/* quoteSend returns only the cross-chain fee total,
                not a per-chain breakdown — the UI shows a single total
                row */}
            <dl className="create-quote">
              <div className="create-quote__row create-quote__row--total">
                <dt>{copy.create.quoteTotal}</dt>
                <dd data-numeric>
                  {formatBaseUnits(fanOutFee ?? 0n, 18, locale)} {nativeSymbol}
                </dd>
              </div>
            </dl>
            {/* Payment semantics: paid in one payment with the registration tx's
                msg.value (governance exec chain native); the amount = quoteSend's
                live on-chain quote */}
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
                    {formatBaseUnits(fanOutFee ?? 0n, 18, locale)} {nativeSymbol}
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
                    resolveEpochRef.current += 1
                    setReviewing(false)
                    tx.reset()
                  }}
                >
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />
                  {copy.create.revise}
                </Button>
                {/* execChainId != null is implied by reviewWrongChain (offGovChain requires a
                    resolved gov chain); spelled out for the narrowing. */}
                {reviewWrongChain && execChainId != null ? (
                  <SwitchChainCta
                    className="ax-ghost-cta"
                    locale={locale}
                    execChain={execChainId}
                    chainName={govChainOption?.name ?? ''}
                    onSwitch={center.switchChainAction}
                  />
                ) : (
                  <Button
                    className="ax-ghost-cta"
                    disabled={confirmGated || tx.running}
                    onClick={() => void buildAndStart()}
                  >
                    {copy.verse.confirm}
                  </Button>
                )}
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
            {resolveFailed ? (
              <FieldError>
                {resolveFailed === 'occupied'
                  ? copy.create.symbolTaken
                  : copy.common.degrade.errorBody}
              </FieldError>
            ) : null}
            
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
