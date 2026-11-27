import ar from '../../content/legal/ar.json';
import en from '../../content/legal/en.json';
import tr from '../../content/legal/tr.json';

/**
 * Legal pages (privacy, terms, account deletion) in every launch language.
 * Source: apps/web/content/legal/<lang>.json — the same files are exported to GitHub
 * Pages by scripts/build-legal-pages.mjs, so the store listings and the app show one text.
 */
export const LEGAL_LANGS = ['ar', 'tr', 'en'] as const;
export const LEGAL_DOCS = ['privacy', 'terms', 'account-deletion'] as const;
export type LegalLang = (typeof LEGAL_LANGS)[number];
export type LegalDocId = (typeof LEGAL_DOCS)[number];

export interface LegalSection {
  h: string;
  items: string[];
  note?: string;
}
export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}
interface LegalBundle {
  lang: string;
  dir: string;
  updated: string;
  labels: { updated: string; languages: string; draft: string };
  contactFallback: string;
  docs: Record<LegalDocId, LegalDoc>;
}

const BUNDLES: Record<LegalLang, LegalBundle> = { ar, tr, en } as Record<LegalLang, LegalBundle>;

const DEFAULT_ENTITY: Record<LegalLang, string> = {
  ar: 'مشغّل منصة «معرض الأشياء»',
  tr: "Ma'rad platformunun işletmecisi",
  en: "the operator of Ma'rad",
};

export const LANG_NAMES: Record<LegalLang, string> = { ar: 'العربية', tr: 'Türkçe', en: 'English' };

export const isLegalLang = (v: string): v is LegalLang => (LEGAL_LANGS as readonly string[]).includes(v);
export const isLegalDoc = (v: string): v is LegalDocId => (LEGAL_DOCS as readonly string[]).includes(v);

/**
 * The legal entity and contact email come from the deployment (LEGAL_ENTITY_NAME,
 * LEGAL_CONTACT_EMAIL) so a placeholder name or address is never published as fact.
 */
export function fill(text: string, lang: LegalLang): string {
  const entity = process.env.LEGAL_ENTITY_NAME?.trim() || DEFAULT_ENTITY[lang];
  const email = process.env.LEGAL_CONTACT_EMAIL?.trim();
  const contact = email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : BUNDLES[lang].contactFallback;
  return text.replaceAll('{{entity}}', entity).replaceAll('{{contact}}', contact);
}

export function getLegal(lang: LegalLang, doc: LegalDocId) {
  const bundle = BUNDLES[lang];
  const d = bundle.docs[doc];
  return {
    lang,
    dir: bundle.dir as 'rtl' | 'ltr',
    updated: bundle.updated,
    labels: bundle.labels,
    title: d.title,
    intro: fill(d.intro, lang),
    sections: d.sections.map((s) => ({ h: s.h, items: s.items.map((i) => fill(i, lang)), note: s.note && fill(s.note, lang) })),
  };
}

/** Path of a legal page; Arabic keeps the short public URL (/privacy). */
export const legalPath = (doc: LegalDocId, lang: LegalLang = 'ar') => (lang === 'ar' ? `/${doc}` : `/legal/${lang}/${doc}`);
