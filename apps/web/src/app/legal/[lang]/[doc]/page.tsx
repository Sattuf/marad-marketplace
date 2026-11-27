import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOCS, LEGAL_LANGS, getLegal, isLegalDoc, isLegalLang } from '@/lib/legal';

// Only the generated language × document pairs exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_LANGS.flatMap((lang) => LEGAL_DOCS.map((doc) => ({ lang, doc })));
}

type Params = { params: Promise<{ lang: string; doc: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, doc } = await params;
  if (!isLegalLang(lang) || !isLegalDoc(doc)) return {};
  return { title: `${getLegal(lang, doc).title} — Ma'rad` };
}

export default async function LegalPage({ params }: Params) {
  const { lang, doc } = await params;
  if (!isLegalLang(lang) || !isLegalDoc(doc)) notFound();
  return <LegalDocument doc={doc} lang={lang} />;
}
