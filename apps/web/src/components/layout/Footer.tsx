import Link from 'next/link';
import { legalPath } from '@/lib/legal';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line py-6 text-sm text-fg-muted">
      <nav aria-label="روابط قانونية" className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4">
        <Link href={legalPath('privacy')} className="hover:text-fg">سياسة الخصوصية</Link>
        <Link href={legalPath('terms')} className="hover:text-fg">شروط الاستخدام</Link>
        <Link href={legalPath('account-deletion')} className="hover:text-fg">حذف الحساب</Link>
        <span>© معرض الأشياء</span>
      </nav>
    </footer>
  );
}
