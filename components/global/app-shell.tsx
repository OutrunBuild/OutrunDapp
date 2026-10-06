import Image from 'next/image'
import Link from 'next/link'
import { Compass, Home, Plus, UserRound, WalletCards } from 'lucide-react'

import { ChainSelectorDialog } from '@/components/global/chain-selector-dialog'

import { getFixtureChains, type Locale, type FixtureChain } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { LocaleMenu } from './locale-menu'
import { localePath } from './routes'
import { WalletControl } from './wallet-control'

type ShellProps = {
  locale: Locale
  current?: NavKey
  accountAddress: string
  children: React.ReactNode
}

const navItems = [
  { key: 'home', href: '', icon: Home, available: true },
  { key: 'discover', href: '/memeverse/explore', icon: Compass, available: true },
  { key: 'create', href: '/memeverse/launch', icon: Plus, available: true },
  { key: 'portfolio', href: '/portfolio', icon: WalletCards, available: true },
  { key: 'account', href: '/account', icon: UserRound, available: false },
] as const

// current 的合法值直接取导航键表：两份清单无法漂移
type NavKey = (typeof navItems)[number]['key']

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

function StatusCluster({ locale, chains }: { locale: Locale; chains: FixtureChain[] }) {
  return <ChainSelectorDialog locale={locale} chains={chains} />
}

function MarketingHeader({
  locale,
  address,
  chains,
}: {
  locale: Locale
  address: string
  chains: FixtureChain[]
}) {
  const copy = getCopy(locale)
  return (
    <header className="marketing-header">
      <Link className="marketing-brand" href={localePath(locale, '')} aria-label={copy.common.home}>
        <span className="marketing-brand__wide"><Brand /></span>
        <span className="marketing-brand__compact"><Brand compact /></span>
      </Link>
      <nav className="marketing-nav" aria-label="Primary">
        {[
          { href: '/memeverse/explore', label: copy.common.discover },
          { href: '/portfolio', label: copy.common.portfolio },
          { href: '/memeverse/launch', label: copy.common.create },
        ].map((item, index) => (
          <Link className="marketing-nav__link" href={localePath(locale, item.href)} key={item.href}>
            {/* 终端索引序号（决议 024）：装饰性编号，aria-hidden 不进可访问名 */}
            <span className="marketing-nav__index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="marketing-header__actions">
        <StatusCluster locale={locale} chains={chains} />
        <LocaleMenu locale={locale} />
        <WalletControl locale={locale} address={address} />
      </div>
    </header>
  )
}

function ProductSidebar({ locale, current, accountAddress }: Omit<ShellProps, 'children'>) {
  const copy = getCopy(locale)

  return (
    <aside className="product-sidebar ax-echo-rail">
      <Link className="product-sidebar__brand" href={localePath(locale, '')} aria-label={copy.common.home}>
        <Brand />
      </Link>
      <nav className="product-nav" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.key === current
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
    </aside>
  )
}

function MobileNavigation({ locale, current }: { locale: Locale; current?: NavKey }) {
  const copy = getCopy(locale)
  const items = navItems.slice(0, 4)
  return (
    <nav className="mobile-navigation" aria-label="Mobile primary">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.key === current
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
  children,
}: ShellProps) {
  const copy = getCopy(locale)
  // 用户裁定：查看链仅暴露 3 个测试网（主网选项移除）
  const chains = getFixtureChains().filter((c) => c.env === 'testnet')

  if (current === 'home') {
    return (
      <div className="outrun-site ax-hud" data-glow="on" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
        <a className="skip-link" href="#main-content">{copy.common.skip}</a>
        <MarketingHeader locale={locale} address={accountAddress} chains={chains} />
        <main className="marketing-main ax-hud-inner" id="main-content">{children}</main>
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
    </div>
  )
}
