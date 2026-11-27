'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@/components/ui';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/errors';
import { legalPath } from '@/lib/legal';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Danger zone of the profile page. Re-authentication is required by the API; accounts
 * with a verified phone may use an SMS code instead of a password.
 */
export function DeleteAccountSection({ phone }: { phone?: string }) {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [secret, setSecret] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!phone) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.sendOtp(phone);
      setCodeSent(true);
    } catch (e) {
      setError(errorMessage(e, 'تعذّر إرسال الرمز'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.deleteAccount(method === 'password' ? { password: secret } : { otp: secret });
      clearAuth();
      router.replace('/?account=deleted');
    } catch (e) {
      setError(errorMessage(e, 'تعذّر حذف الحساب'));
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <section aria-labelledby="delete-account" className="mt-8 rounded-2xl border border-danger/30 p-6">
        <h2 id="delete-account" className="text-lg font-bold text-fg">حذف الحساب</h2>
        <p className="mt-2 text-sm leading-7 text-fg-muted">
          يُغلق حسابك فوراً وتختفي إعلاناتك. يمكنك التراجع بتسجيل الدخول خلال 30 يوماً، وبعدها تُحذف بياناتك نهائياً.{' '}
          <Link href={legalPath('account-deletion')} className="underline">التفاصيل</Link>
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          أريد حذف حسابي
        </Button>
      </section>
    );
  }

  const valid = understood && (method === 'password' ? secret.length > 0 : /^\d{6}$/.test(secret));
  return (
    <section aria-labelledby="delete-account" className="mt-8 space-y-4 rounded-2xl border border-danger/40 p-6">
      <h2 id="delete-account" className="text-lg font-bold text-fg">تأكيد حذف الحساب</h2>
      {phone && (
        <div role="radiogroup" aria-label="طريقة التأكيد" className="flex gap-4 text-sm">
          {(['password', 'otp'] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="reauth" checked={method === m} onChange={() => { setMethod(m); setSecret(''); }} />
              {m === 'password' ? 'بكلمة المرور' : 'برمز يصل إلى هاتفي'}
            </label>
          ))}
        </div>
      )}
      {method === 'password' ? (
        <Input label="كلمة المرور الحالية" type="password" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      ) : (
        <div className="space-y-2">
          <Button variant="secondary" size="sm" onClick={sendCode} loading={busy && !codeSent} disabled={codeSent}>
            {codeSent ? 'أُرسل الرمز' : 'أرسل رمز التحقق'}
          </Button>
          <Input label="رمز التحقق (6 أرقام)" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={secret} onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))} />
        </div>
      )}
      <label className="flex items-start gap-2 text-sm leading-6 text-fg">
        <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        أفهم أن حسابي سيُغلق الآن، وأن بياناتي ستُحذف نهائياً بعد 30 يوماً إن لم أسجّل الدخول.
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-3">
        <Button variant="danger" onClick={submit} loading={busy} disabled={!valid}>
          احذف حسابي
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setSecret(''); setError(null); }} disabled={busy}>
          إلغاء
        </Button>
      </div>
    </section>
  );
}
