import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { getLegal } from '@/lib/legal';

// Short public URL used in the app stores; Arabic. Other languages: /legal/<lang>/privacy
export const metadata: Metadata = { title: `${getLegal('ar', 'privacy').title} — معرض الأشياء` };

export default function Page() {
  return <LegalDocument doc="privacy" lang="ar" />;
}
