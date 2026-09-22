import Image from 'next/image'
import Link from 'next/link'
import { Compass, GitBranch, Home, Plus, UserRound, WalletCards } from 'lucide-react'

import { ChainSelectorDialog } from '@/components/global/chain-selector-dialog'

import { getPrototypeChains, type Locale, type PrototypeChain } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { LocaleMenu } from './locale-menu'
import { localePath } from './routes'
import { SourceRef } from './signal-ui'
import { WalletControl } from './wallet-control'

type CurrentSurface = 'home' | 'discover' | 'create' | 'verse' | 'portfolio'

type ShellProps = {
  locale: Locale
  current: CurrentSurface
  accountAddress: string
  accountSourceRef: string
  children: React.ReactNode
}

const navItems = [
  { key: 'home', href: '', icon: Home, available: true },
  { key: 'discover', href: '/memeverse', icon: Compass, available: true },
  { key: 'create', href: '/launch', icon: Plus, available: true },
  { key: 'bridge', href: '/bridge', icon: GitBranch, available: false },
  { key: 'portfolio', href: '/portfolio', icon: WalletCards, available: true },
  { key: 'account', href: '/account', icon: UserRound, available: false },
] as const

function Brand({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <Image
      className="brand-symbol"
      src="/brand/BRAND-04-symbol-transparent.png"
      width={512}
      height={382}
      alt="Outrun"
      priority
    />
  ) : (
    <Image
      className="brand-wordmark"
      src="/brand/BRAND-01-wordmark-transparent.png"
      width={2048}
      height={527}
      alt="Outrun"
      priority
    />
  )
}

function StatusCluster({ locale, chains }: { locale: Locale; chains: PrototypeChain[] }) {
  return <ChainSelectorDialog locale={locale} chains={chains} />
}

function MarketingHeader({ locale, address }: { locale: Locale; address: string }) {
  const copy = getCopy(locale)
  return (
    <header className="marketing-header">
      <Link className="marketing-brand" href={localePath(locale, '')} aria-label={copy.common.home}>
        <span className="marketing-brand__wide"><Brand /></span>
        <span className="marketing-brand__compact"><Brand compact /></span>
      </Link>
      <div className="marketing-header__actions">
        <LocaleMenu locale={locale} />
        <WalletControl locale={locale} address={address} />
      </div>
    </header>
  )
}

function ProductSidebar({ locale, current, accountAddress, accountSourceRef }: Omit<ShellProps, 'children'>) {
  const copy = getCopy(locale)

  return (
    <aside className="product-sidebar ax-echo-rail">
      <Link className="product-sidebar__brand" href={localePath(locale, '')} aria-label={copy.common.home}>
        <Brand />
      </Link>
      <nav className="product-nav" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.key === current || (item.key === 'discover' && current === 'verse')
          const label = copy.common[item.key]
          return item.available ? (
            <Link
              className={isActive ? 'product-nav__item ax-glow-nav' : 'product-nav__item'}
              data-active={isActive}
              href={localePath(locale, item.href)}
              key={item.key}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ) : (
            <span className="product-nav__item" data-disabled="true" key={item.key} title={copy.common.unavailable}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </span>
          )
        })}
      </nav>
      <div className="sidebar-account">
        <span className="sidebar-account__label">{copy.common.connected}</span>
        <span data-numeric>{`${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}`}</span>
        <span className="sidebar-account__state">
          <span className="status-dot" data-tone="success" aria-hidden="true" />
          {copy.common.mainnet}
        </span>
        <SourceRef value={accountSourceRef} id="acct-001" />
      </div>
    </aside>
  )
}

function MobileNavigation({ locale, current }: { locale: Locale; current: CurrentSurface }) {
  const copy = getCopy(locale)
  const items = navItems.slice(0, 4)
  return (
    <nav className="mobile-navigation" aria-label="Mobile primary">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.key === current || (item.key === 'discover' && current === 'verse')
        const label = copy.common[item.key]
        return item.available ? (
          <Link key={item.key} href={localePath(locale, item.href)} data-active={active} aria-current={active ? 'page' : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ) : (
          <span key={item.key} data-disabled="true" title={copy.common.unavailable}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </span>
        )
      })}
    </nav>
  )
}

export function OutrunShell({
  locale,
  current,
  accountAddress,
  accountSourceRef,
  children,
}: ShellProps) {
  const copy = getCopy(locale)
  // 用户裁定：查看链仅暴露 3 个测试网（主网选项移除）
  const chains = getPrototypeChains().filter((c) => c.env === 'testnet')

  if (current === 'home') {
    return (
      <div className="outrun-site ax-hud" data-glow="on" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
        <a className="skip-link" href="#main-content">{copy.common.skip}</a>
        <MarketingHeader locale={locale} address={accountAddress} />
        <main className="marketing-main ax-hud-inner" id="main-content">{children}</main>
        <div className="ax-scanlines" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="outrun-site product-shell ax-hud" data-glow="on" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <a className="skip-link" href="#main-content">{copy.common.skip}</a>
      <ProductSidebar
        locale={locale}
        current={current}
        accountAddress={accountAddress}
        accountSourceRef={accountSourceRef}
      />
      <div className="product-canvas ax-hud-inner">
        <header className="product-topbar">
          <Link className="mobile-brand" href={localePath(locale, '')} aria-label={copy.common.home}>
            <Brand compact />
          </Link>
          <StatusCluster locale={locale} chains={chains} />
          <div className="product-topbar__actions">
            <LocaleMenu locale={locale} />
            <WalletControl locale={locale} address={accountAddress} />
          </div>
        </header>
        <main className="product-main" id="main-content">{children}</main>
      </div>
      <MobileNavigation locale={locale} current={current} />
      <div className="ax-scanlines" aria-hidden="true" />
    </div>
  )
}
