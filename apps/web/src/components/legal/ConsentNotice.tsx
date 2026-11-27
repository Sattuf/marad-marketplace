import Link from 'next/link';
import { legalPath } from '@/lib/legal';

/** Shown wherever an account can be created (register, and OTP/social sign-in on login). */
export function ConsentNotice({ action = 'بالمتابعة' }: { action?: string }) {
  return (
    <p className="text-center text-xs leading-6 text-fg-muted">
      {action} فأنت توافق على{' '}
      <Link href={legalPath('terms')} className="underline hover:text-fg">شروط الاستخدام</Link> و
      <Link href={legalPath('privacy')} className="underline hover:text-fg">سياسة الخصوصية</Link>.
    </p>
  );
}
