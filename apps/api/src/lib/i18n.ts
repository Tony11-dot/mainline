import { english, makeTranslator, type Catalog, type Translator } from '@mainline/shared';
// Bundled by esbuild: the same catalogs the app uses (packages/shared/locales).
import ar from '../../../../packages/shared/locales/ar.json';
import de from '../../../../packages/shared/locales/de.json';
import es from '../../../../packages/shared/locales/es.json';
import fa from '../../../../packages/shared/locales/fa.json';
import fr from '../../../../packages/shared/locales/fr.json';
import he from '../../../../packages/shared/locales/he.json';
import hi from '../../../../packages/shared/locales/hi.json';
import id from '../../../../packages/shared/locales/id.json';
import it from '../../../../packages/shared/locales/it.json';
import ja from '../../../../packages/shared/locales/ja.json';
import ko from '../../../../packages/shared/locales/ko.json';
import nl from '../../../../packages/shared/locales/nl.json';
import pl from '../../../../packages/shared/locales/pl.json';
import pt from '../../../../packages/shared/locales/pt.json';
import ru from '../../../../packages/shared/locales/ru.json';
import tr from '../../../../packages/shared/locales/tr.json';
import uk from '../../../../packages/shared/locales/uk.json';
import vi from '../../../../packages/shared/locales/vi.json';
import zh from '../../../../packages/shared/locales/zh.json';

const CATALOGS: Record<string, Catalog> = { ar, de, es, fa, fr, he, hi, id, it, ja, ko, nl, pl, pt, ru, tr, uk, vi, zh };
const cache = new Map<string, Translator>();

/** Reminder wording in a subscriber's app language (English when unknown). */
export function translatorFor(lang: string | null | undefined): Translator {
  const dict = lang ? CATALOGS[lang] : undefined;
  if (!dict) return english;
  let tr = cache.get(lang!);
  if (!tr) cache.set(lang!, (tr = makeTranslator(lang!, dict)));
  return tr;
}
