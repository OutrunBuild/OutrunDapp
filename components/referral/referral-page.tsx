import {
  getReferral,
  getDisplayAccount,
  type Referral,
  type Locale,
} from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { ChainLogoMark } from '../global/chain-icons'
import { TokenIconMark } from '../global/token-icons'
import { getCopy } from '../global/copy'
import { ConnectWalletCta } from '../global/connect-wallet-cta'
import { formatAmount, formatDay, formatHex } from '../global/signal-ui'
import { UserDataGate } from '../global/user-data-gate'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { ReferralHistory } from './referral-history-tabs'
import { ReferralLinkPanel } from './referral-link-panel'
import { RelativeTime } from './relative-time'

/**
 * /referral: stats cluster → link → how it works → pending → tabs history, following industry
 * referral-page conventions — (1) stats cluster (Earned/Pending/Friends/Rate) as one group
 * in the first screen, first cell a 28px primary reading; (2) the link up front and prominent
 * (control-height well + right-end embedded copy button); (3) the three-step explanation right after the
 * link; (4) dual-tab history as the ending. Card rhythm: five cards
 * each independent, no grouping, always space-6 between cards. Mechanism = the
 * Memeverse hook swap rebate; the referral relationship is bound when the
 * referee registers (application layer); friend details and the shortcode
 * are fixture samples. No-user-participation state: when disconnected, the stats
 * cluster / invite link / pending / history hide entirely (UserDataGate, cards without data
 * do not show); the mechanism intro (how it works + split bar) stays always visible; when
 * disconnected, a yellow connect-wallet CTA appears below the mechanism card
 * (ax-ghost-cta skin, centered).
 */
export async function ReferralPage({ locale, host }: { locale: Locale; host: string | null }) {
  const copy = getCopy(locale).referral
  const referral = await getReferral()
  if (!referral) return null
  // History tabs render only when at least one side has data; a lone dataset still shows both
  // tabs (the empty side keeps its title-only empty state)
  const hasHistory = referral.transactions.length > 0 || referral.friends.length > 0
  const now = Date.now()
  const displayAccount = await getDisplayAccount()

  // Link URL: fixed at SSR from the host header (no hydration flicker); /ref/<shortcode> is
  // locale-independent, shared by both languages. Onchain mode has no code source (null) →
  // the link panel renders nothing (never an empty-code /ref/ link)
  const origin = host
    ? host.startsWith('localhost') || host.startsWith('127.')
      ? `http://${host}`
      : `https://${host}`
    : ''
  const linkUrl =
    referral.referralCode != null ? `${origin}/ref/${referral.referralCode}` : null

  // Split bar: LP 65 fixed; the rebate rate is carved out of the protocol's 35 for "you".
  // Rate unread (null) → the protocol cut (35 − rate) is unknown with it: only the fixed LP
  // segment stays, you/protocol slots degrade — never a fabricated 0% split
  const lpShare = 65
  const splitShares =
    referral.ratePercent != null
      ? { you: referral.ratePercent, protocol: 35 - referral.ratePercent }
      : null
  const splitAria = splitShares
    ? `${copy.split.lp} ${lpShare}% · ${copy.split.protocol} ${splitShares.protocol}% · ${copy.split.you} ${splitShares.you}%`
    : `${copy.split.lp} ${lpShare}%`
  // The rate-bearing step claim can't render without the rate; the rest of the intro stays
  const steps = splitShares
    ? copy.steps
    : copy.steps.filter((step) => !step.title.includes('{rate}'))

  return (
    <OutrunShell locale={locale} current="referral" accountAddress={displayAccount.address}>
      <header className="page-intro">
        <div>
          <h1 className="ax-fault-title">
            {copy.title}
            <span className="ax-fault-title__chroma" data-dup={copy.title} aria-hidden="true" />
            <span className="ax-fault-title__rip" data-dup={copy.title} aria-hidden="true" />
          </h1>
          <p>{copy.sub}</p>
        </div>
      </header>

      {/* Stats cluster (industry consensus: key metrics grouped in the first screen; the first
          cell = primary reading at the 28px step); hidden when there is no user participation */}
      <UserDataGate>
        <section className="pf-panel ref-stats" aria-label={copy.statsLabel}>
          <div className="pf-panel__body ref-stats__grid" data-numeric>
            <div>
              <span className="ref-stats__label">{copy.stats.earned}</span>
              <strong className="ref-stats__value ref-stats__value--hero">
                <span className="ref-stats__approx">≈ </span>${formatAmount(referral.totalEarnedUsd, locale)}
              </strong>
            </div>
            <div>
              <span className="ref-stats__label">{copy.stats.pending}</span>
              <strong className="ref-stats__value">
                <span className="ref-stats__approx">≈ </span>${formatAmount(referral.pendingUsd, locale)}
              </strong>
            </div>
            <div>
              <span className="ref-stats__label">{copy.stats.friends}</span>
              <strong className="ref-stats__value">{referral.friendsCount}</strong>
            </div>
            {referral.ratePercent != null ? (
              <div>
                <span className="ref-stats__label">{copy.stats.rate}</span>
                <strong className="ref-stats__value">{referral.ratePercent}%</strong>
              </div>
            ) : null}
          </div>
        </section>
      </UserDataGate>

      {/* Link → how it works → pending (each card keeps the page's space-6 rhythm); the link =
          the user's own shortcode, hidden along with the data cards */}
      <UserDataGate>
        {linkUrl != null ? <ReferralLinkPanel locale={locale} url={linkUrl} /> : null}
      </UserDataGate>

      {/* How it works: right after the link, understand the mechanism before
          seeing pending */}
      <section className="pf-panel ref-how" aria-labelledby="ref-how-title">
        <header className="pf-panel__bar">
          <h2 className="ref-nameplate" id="ref-how-title">
            {copy.howTitle}
          </h2>
        </header>
        <div className="pf-panel__body">
          <ol className="ref-how__steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="ref-how__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{step.title.replaceAll('{rate}', `${referral.ratePercent}%`)}</h3>
                  <p>{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="ref-split">
            <span className="ref-split__label">{copy.splitLabel}</span>
            <div className="ref-split__bar" role="img" aria-label={splitAria}>
              <span className="ref-split__seg ref-split__seg--lp" style={{ flexGrow: lpShare }} />
              {splitShares ? (
                <>
                  <span
                    className="ref-split__seg ref-split__seg--protocol"
                    style={{ flexGrow: splitShares.protocol }}
                  />
                  <span
                    className="ref-split__seg ref-split__seg--you"
                    style={{ flexGrow: splitShares.you }}
                  />
                </>
              ) : (
                // Blank filler keeps the LP segment at its honest share (a lone flexGrow
                // segment would stretch to the full bar)
                <span aria-hidden="true" style={{ flexGrow: 100 - lpShare }} />
              )}
            </div>
            <p className="ref-split__legend">
              <span>
                <i className="ref-split__dot ref-split__dot--lp" aria-hidden="true" />
                {copy.split.lp} <span data-numeric>{lpShare}%</span>
              </span>
              {splitShares ? (
                <span>
                  <i className="ref-split__dot ref-split__dot--protocol" aria-hidden="true" />
                  {copy.split.protocol} <span data-numeric>{splitShares.protocol}%</span>
                </span>
              ) : null}
              {splitShares ? (
                <span>
                  <i className="ref-split__dot ref-split__dot--you" aria-hidden="true" />
                  {copy.split.you} <span data-numeric>{splitShares.you}%</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </section>

      {/* When there is no user participation, the connect CTA sits below the mechanism card
          (yields back to the data cards once connected) */}
      <ConnectWalletCta locale={locale} className="connect-cta--ref" />

      {/* Pending (hidden along with the stats cluster when there is no user participation;
          not rendered at all when nothing is pending) */}
      <UserDataGate>
        {referral.pending.length > 0 ? (
        <section className="pf-panel ref-pending" aria-labelledby="ref-pending-title">
          <header className="pf-panel__bar">
            <h2 className="ref-nameplate" id="ref-pending-title">
              {copy.pendingTitle}
            </h2>
          </header>
          <div className="pf-panel__body">
            {referral.pending.map((row) => (
              <div className="pf-claim-row" key={`${row.chainId}-${row.symbol}`}>
                <TokenIconMark symbol={row.symbol} size={28} aria-hidden="true" />
                <div className="pf-claim-row__id">
                  <strong>{row.symbol}</strong>
                  <span>{row.chainName}</span>
                </div>
                <div className="pf-claim-row__amount">
                  <strong data-numeric>
                    {formatAmount(row.amount, locale)} {row.symbol}
                  </strong>
                  {row.usd != null ? (
                    <span data-numeric>≈ ${formatAmount(row.usd, locale)}</span>
                  ) : null}
                </div>
                <div className="pf-claim-row__actions">
                  {/* The prototype does not fake settlement: the claimRebate hook is per-currency
                      pull, no session builder wired — Claim stays permanently disabled */}
                  <Button variant="outline" disabled>
                    {copy.claim}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}
      </UserDataGate>

      <UserDataGate>
        {hasHistory ? (
        <ReferralHistory locale={locale} friendsCount={referral.friendsCount}>
          {{
            transactions: <TransactionsPanel locale={locale} referral={referral} now={now} />,
            friends: <FriendsPanel locale={locale} referral={referral} />,
          }}
        </ReferralHistory>
        ) : null}
      </UserDataGate>
    </OutrunShell>
  )
}

function TransactionsPanel({
  locale,
  referral,
  now,
}: {
  locale: Locale
  referral: Referral
  now: number
}) {
  const copy = getCopy(locale).referral
  if (referral.transactions.length === 0) {
    return (
      <div className="empty-state">
        <h3>{copy.tx.empty}</h3>
      </div>
    )
  }
  return (
    <>
    <div className="pf-table-wrap">
      <table className="pf-table ref-tx">
        <colgroup>
          <col className="ref-tx__col-transaction" />
          <col className="ref-tx__col-commission" />
          <col className="ref-tx__col-network" />
          <col className="ref-tx__col-referred" />
          <col className="ref-tx__col-time" />
        </colgroup>
        <thead>
          <tr>
            <th>{copy.tx.transaction}</th>
            <th className="ref-tx__commission">{copy.tx.commission}</th>
            <th className="ref-tx__net">{copy.tx.network}</th>
            <th>{copy.tx.referred}</th>
            <th data-numeric>{copy.tx.time}</th>
          </tr>
        </thead>
        <tbody>
          {referral.transactions.map((tx) => (
            <tr key={tx.txId}>
              <th scope="row" className="ref-tx__mono">
                {formatHex(tx.txId)}
              </th>
              <td className="ref-tx__commission">
                <span className="ref-tx__rebate">
                  <span data-numeric>{formatAmount(tx.rebate.amount, locale)}</span>
                  <Tooltip>
                    <TooltipTrigger aria-label={tx.rebate.symbol} className="ref-tx__icon-trigger">
                      <TokenIconMark symbol={tx.rebate.symbol} size={16} aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{tx.rebate.symbol}</TooltipContent>
                  </Tooltip>
                </span>
              </td>
              <td className="ref-tx__net">
                <Tooltip>
                  <TooltipTrigger aria-label={tx.chainName} className="ref-tx__icon-trigger">
                    <ChainLogoMark chainId={tx.chainId} size={16} />
                  </TooltipTrigger>
                  <TooltipContent>{tx.chainName}</TooltipContent>
                </Tooltip>
              </td>
              <td className="ref-tx__mono">{formatHex(tx.friendAddress)}</td>
              <td data-numeric>
                <RelativeTime at={tx.at} locale={locale} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* Mobile stacked ledger rows: ≤49rem hides the table and this list
        takes over — the rebate amount leads + relative time right-anchored (wallet history
        convention), referred/network as a two-fact grid, txid as a full-width audit slot */}
    <ul className="pf-mrows">
      {referral.transactions.map((tx) => (
        <li key={tx.txId} className="pf-mrow">
          <div className="pf-mrow__head">
            <strong className="ref-mrow__gain" data-numeric>
              {formatAmount(tx.rebate.amount, locale)}
              <TokenIconMark symbol={tx.rebate.symbol} size={16} aria-hidden="true" />
            </strong>
            <span className="ref-mrow__when" data-numeric>
              <RelativeTime at={tx.at} locale={locale} now={now} />
            </span>
          </div>
          <dl className="pf-mrow__facts">
            <div>
              <dt>{copy.tx.referred}</dt>
              <dd className="ref-tx__mono" data-numeric>
                {formatHex(tx.friendAddress)}
              </dd>
            </div>
            <div>
              <dt>{copy.tx.network}</dt>
              <dd className="ref-mrow__chain">
                <ChainLogoMark chainId={tx.chainId} size={16} aria-hidden="true" />
                {tx.chainName}
              </dd>
            </div>
            <div className="ref-mrow__tx">
              <dt>{copy.tx.transaction}</dt>
              <dd className="ref-tx__mono" data-numeric>
                {formatHex(tx.txId)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
    </>
  )
}

function FriendsPanel({ locale, referral }: { locale: Locale; referral: Referral }) {
  const copy = getCopy(locale).referral
  if (referral.friends.length === 0) {
    return (
      <div className="empty-state">
        <h3>{copy.friendsTable.empty}</h3>
        <p>{copy.friendsTable.emptyBody}</p>
      </div>
    )
  }
  return (
    <>
    <div className="pf-table-wrap">
      <table className="pf-table ref-friends">
        <colgroup>
          <col className="ref-friends__col-address" />
          <col className="ref-friends__col-joined" />
          <col className="ref-friends__col-volume" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>{copy.friendsTable.address}</th>
            <th className="ref-dim">{copy.friendsTable.joined}</th>
            <th className="ref-dim">{copy.friendsTable.volume}</th>
            <th data-numeric>{copy.friendsTable.earned}</th>
          </tr>
        </thead>
        <tbody>
          {referral.friends.map((friend) => (
            <tr key={friend.address}>
              <th scope="row" className="ref-tx__mono">
                {formatHex(friend.address)}
              </th>
              <td className="ref-dim">{formatDay(friend.joinedAt, locale)}</td>
              <td className="ref-dim">${formatAmount(friend.volumeUsd, locale)}</td>
              <td data-numeric>${formatAmount(friend.earnedUsd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* Mobile stacked ledger rows: address leads + referral contribution
        right-anchored (the two remaining primary desktop columns), joined date / volume as a
        two-fact grid (same muting as the desktop ref-dim) */}
    <ul className="pf-mrows">
      {referral.friends.map((friend) => (
        <li key={friend.address} className="pf-mrow">
          <div className="pf-mrow__head">
            <span className="pf-mrow__id">
              <strong className="ref-tx__mono" data-numeric>
                {formatHex(friend.address)}
              </strong>
            </span>
            <strong className="ref-mrow__gain ref-mrow__gain--mono" data-numeric>
              ${formatAmount(friend.earnedUsd, locale)}
            </strong>
          </div>
          <dl className="pf-mrow__facts">
            <div>
              <dt>{copy.friendsTable.joined}</dt>
              <dd className="ref-dim" data-numeric>
                {formatDay(friend.joinedAt, locale)}
              </dd>
            </div>
            <div>
              <dt>{copy.friendsTable.volume}</dt>
              <dd className="ref-dim" data-numeric>
                ${formatAmount(friend.volumeUsd, locale)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
    </>
  )
}
