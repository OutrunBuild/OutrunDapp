import { CreatePage } from '@/components/create/create-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedCreate() {
  const locale = await getDisplayLocale();
  return <CreatePage locale={locale} />;
}
