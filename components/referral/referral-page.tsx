import Link from 'next/link'

import {
  getFixtureReferral,
  getFixtureSnapshot,
  type FixtureReferral,
  type Locale,
} from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { ChainLogoMark } from '../global/chain-icons'
import { TokenIconMark } from '../global/token-icons'
import { getCopy } from '../global/copy'
import { ConnectWalletCta } from '../global/connect-wallet-cta'
import { localePath } from '../global/routes'
import { formatAmount, formatDay } from '../global/signal-ui'
import { UserDataGate } from '../global/user-data-gate'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { ReferralHistory } from './referral-history-tabs'
import { ReferralLinkPanel } from './referral-link-panel'
import { RelativeTime } from './relative-time'

/**
 * /referral（R-12；2026-10-07 v4：v3 行业共识骨架基础上运作方式上移一格（用户裁定，
 * 弃「三步居后」）：统计簇 → 链接 → 运作 → 待领 → tabs 历史）。
 * 最佳实践依据：ReferralRock/Webtonic 转化指南 + GMX/Jupiter/Binance 同构——
 * ①统计簇（Earned/Pending/Friends/Rate）首屏一组，首格 28px 主读数；
 * ②链接前置突出（56px 井 + 右端嵌入复制钮）；③三步说明紧随链接；④双 tab 历史收尾。
 * 卡片节奏（2026-10-07 用户裁定）：五卡各自独立、无分组，卡间一律 space-6。
 * 机制 G 源 = Memeverse hook swap 返佣（source-map M5/M14/M15）；推荐关系=
 * 被推荐人注册时绑定（应用层，2026-10-07 用户裁定）；friends 明细与短码为 S 级样本。
 * 2026-10-08 用户裁定无用户参与态：未连接时统计簇/邀请链接/待领/历史整体隐藏
 * （UserDataGate，无数据的卡片不显示），机制介绍（运作方式+分账条）保留常显；
 * 同日二轮裁定：断连时机制卡下方出黄色连接钱包 CTA（ax-ghost-cta 皮、居中）。
 */
export function ReferralPage({ locale, host }: { locale: Locale; host: string | null }) {
  const copy = getCopy(locale).referral
  const referral = getFixtureReferral()
  if (!referral) return null
  const now = Date.now()
  const snapshot = getFixtureSnapshot()

  // 链接 URL：host 头 SSR 定值（无水合闪变）；/ref/<短码> 与语言无关，两语言共用
  const origin = host
    ? host.startsWith('localhost') || host.startsWith('127.')
      ? `http://${host}`
      : `https://${host}`
    : ''
  const linkUrl = `${origin}/ref/${referral.referralCode}`

  // 分账条：LP 65 固定；协议 35 中切出返佣率给「你」（OB hook.md 65/35→65/25/10 表）
  const lpShare = 65
  const youShare = referral.ratePercent
  const protocolShare = 35 - youShare
  const splitAria = `${copy.split.lp} ${lpShare}% · ${copy.split.protocol} ${protocolShare}% · ${copy.split.you} ${youShare}%`

  return (
    <OutrunShell locale={locale} current="referral" accountAddress={snapshot.sampleAccount.address}>
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

      {/* 统计簇（行业共识：关键指标一组首屏；首格=主读数 28px 档）；无用户参与时隐藏 */}
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
            <div>
              <span className="ref-stats__label">{copy.stats.rate}</span>
              <strong className="ref-stats__value">{referral.ratePercent}%</strong>
            </div>
          </div>
        </section>
      </UserDataGate>

      {/* 链接 → 运作方式 → 待领（space-5 紧组）；链接=用户专属短码，随数据卡同隐藏 */}
      <UserDataGate>
        <ReferralLinkPanel locale={locale} url={linkUrl} />
      </UserDataGate>

      {/* 运作方式（v4 上移一格：紧随链接先懂机制，再看待领） */}
      <section className="pf-panel ref-how" aria-labelledby="ref-how-title">
        <header className="pf-panel__bar">
          <h2 className="ref-nameplate" id="ref-how-title">
            {copy.howTitle}
          </h2>
        </header>
        <div className="pf-panel__body">
          <ol className="ref-how__steps">
            {copy.steps.map((step, index) => (
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
              <span
                className="ref-split__seg ref-split__seg--protocol"
                style={{ flexGrow: protocolShare }}
              />
              <span className="ref-split__seg ref-split__seg--you" style={{ flexGrow: youShare }} />
            </div>
            <p className="ref-split__legend">
              <span>
                <i className="ref-split__dot ref-split__dot--lp" aria-hidden="true" />
                {copy.split.lp} <span data-numeric>{lpShare}%</span>
              </span>
              <span>
                <i className="ref-split__dot ref-split__dot--protocol" aria-hidden="true" />
                {copy.split.protocol} <span data-numeric>{protocolShare}%</span>
              </span>
              <span>
                <i className="ref-split__dot ref-split__dot--you" aria-hidden="true" />
                {copy.split.you} <span data-numeric>{youShare}%</span>
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 无用户参与时机制卡下方=连接 CTA（2026-10-08 二次裁定落位；连接后让位回数据卡） */}
      <ConnectWalletCta locale={locale} className="connect-cta--ref" />

      {/* 待领（无用户参与时随统计簇同隐藏） */}
      <UserDataGate>
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
                  {/* 原型不伪造成交：Claim 恒禁用（PolMintDialog/VerseShare 同契约） */}
                  <Button variant="outline" disabled>
                    {copy.claim}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </UserDataGate>

      <UserDataGate>
        <ReferralHistory locale={locale} friendsCount={referral.friendsCount}>
          {{
            transactions: <TransactionsPanel locale={locale} referral={referral} now={now} />,
            friends: <FriendsPanel locale={locale} referral={referral} />,
          }}
        </ReferralHistory>
      </UserDataGate>
    </OutrunShell>
  )
}

/** 缩略 hex（同 CopyAddress 语法：头 6 尾 4）；txid 与被推荐地址共用 */
const shortHex = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`

function TransactionsPanel({
  locale,
  referral,
  now,
}: {
  locale: Locale
  referral: FixtureReferral
  now: number
}) {
  const copy = getCopy(locale).referral
  if (referral.transactions.length === 0) {
    return (
      <div className="empty-state">
        <h3>{copy.tx.empty}</h3>
        <p>{copy.tx.emptyBody}</p>
        <Button
          className="ax-ghost-cta"
          nativeButton={false}
          render={<Link href={localePath(locale, '/memeverse/explore')} />}
        >
          {copy.tx.emptyCta}
        </Button>
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
                {shortHex(tx.txId)}
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
              <td className="ref-tx__mono">{shortHex(tx.friendAddress)}</td>
              <td data-numeric>
                <RelativeTime at={tx.at} locale={locale} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* 移动端堆叠台账行（决议 018 同构）：≤49rem 表格隐藏、此清单接管——返佣额
        领衔+相对时间右锚（钱包流水惯例），被推荐/网络双列事实格，txid 通栏审计槽 */}
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
                {shortHex(tx.friendAddress)}
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
                {shortHex(tx.txId)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
    </>
  )
}

function FriendsPanel({ locale, referral }: { locale: Locale; referral: FixtureReferral }) {
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
                {shortHex(friend.address)}
              </th>
              <td className="ref-dim">{formatDay(friend.joinedAt, locale)}</td>
              <td className="ref-dim">${formatAmount(friend.volumeUsd, locale)}</td>
              <td data-numeric>${formatAmount(friend.earnedUsd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* 移动端堆叠台账行（决议 018 同构）：地址领衔+返佣贡献右锚（桌面仅存的两主列），
        加入时间/交易量双列事实格（桌面 ref-dim 降噪同口径） */}
    <ul className="pf-mrows">
      {referral.friends.map((friend) => (
        <li key={friend.address} className="pf-mrow">
          <div className="pf-mrow__head">
            <span className="pf-mrow__id">
              <strong className="ref-tx__mono" data-numeric>
                {shortHex(friend.address)}
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
