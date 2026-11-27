import Link from 'next/link';
import { LANG_NAMES, LEGAL_LANGS, getLegal, legalPath, type LegalDocId, type LegalLang } from '@/lib/legal';

/** Server component: plain text from content/legal (no HTML is ever injected). */
export function LegalDocument({ doc, lang }: { doc: LegalDocId; lang: LegalLang }) {
  const d = getLegal(lang, doc);
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <article lang={d.lang} dir={d.dir} className="space-y-6">
        <nav aria-label={d.labels.languages} className="flex flex-wrap gap-3 text-sm">
          {LEGAL_LANGS.map((l) => (
            <Link
              key={l}
              href={legalPath(doc, l)}
              lang={l}
              aria-current={l === lang ? 'page' : undefined}
              className={l === lang ? 'font-bold text-primary' : 'text-fg-muted hover:text-fg'}
            >
              {LANG_NAMES[l]}
            </Link>
          ))}
        </nav>
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold text-fg">{d.title}</h1>
          <p className="text-sm text-fg-muted">
            {d.labels.updated}: <time dateTime={d.updated}>{d.updated}</time>
          </p>
          <p className="leading-8 text-fg">{d.intro}</p>
        </header>
        {d.sections.map((s) => (
          <section key={s.h} className="space-y-3">
            <h2 className="text-xl font-bold text-fg">{s.h}</h2>
            <ul className="list-disc space-y-2 ps-6 leading-8 text-fg">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {s.note && <p className="leading-8 text-fg-muted">{s.note}</p>}
          </section>
        ))}
        <p className="border-t border-line pt-4 text-xs text-fg-subtle">{d.labels.draft}</p>
      </article>
    </main>
  );
}
