import { FaucetPage } from '@/components/faucet/faucet-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedFaucet() {
  const locale = await getDisplayLocale();
  return <FaucetPage locale={locale} />;
}
