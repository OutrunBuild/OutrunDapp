import { getVerse } from '@/lib/data/fixture-repository';

/**
 * Page title source for /memeverse/<verseId>: `app/**` may not reference the repository
 * (fixture boundary keeps app/ as pure route shells), so the detail page's generateMetadata
 * reads the verse name through this component-layer helper. Returns null for an unknown id —
 * the caller then keeps the root default title, matching the page body's own notFound().
 */
export async function getVerseTitle(verseId: string): Promise<string | null> {
  const verse = await getVerse(verseId);
  return verse?.name ?? null;
}
