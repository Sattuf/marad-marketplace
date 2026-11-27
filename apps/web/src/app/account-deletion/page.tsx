import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { getLegal } from '@/lib/legal';

// Short public URL used in the app stores; Arabic. Other languages: /legal/<lang>/account-deletion
export const metadata: Metadata = { title: `${getLegal('ar', 'account-deletion').title} — معرض الأشياء` };

export default function Page() {
  return <LegalDocument doc="account-deletion" lang="ar" />;
}
