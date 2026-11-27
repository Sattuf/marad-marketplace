# الخطوات القادمة — Next Steps

> يُحدَّث بعد كل مهمة. المنجز يُحذف من هنا ويُسجَّل في `PROGRESS_LOG.md`.
> الترتيب = ترتيب التنفيذ. الأرقام تشير إلى `EXECUTION_PLAN.md` §7.

## 🙋 ينتظرك (لا أستطيع فعله بنفسي)

| # | المطلوب | لماذا | كيف |
|---|---|---|---|
| U1 | ✅ الموصّل مربوط. **باقٍ:** الخطة المجانية تسمح بمشروعين نشطين فقط، و`sanad` و`madinatuna` نشطان → أوقف أحدهما مؤقتاً (Pause) أو رقِّ الخطة، ثم أنشئ أنا `marad-staging` (eu-central-1) | قاعدة البيانات الحقيقية (L2) | Supabase Dashboard → المشروع → Settings → Pause project |
| U2 | إضافة أسرار GitHub: `SUPABASE_DB_URL` (direct) و`SUPABASE_POOLER_URL` و`SUPABASE_ANON_KEY` | CI يتصل بـ Supabase؛ أنا لا أستطيع الاتصال المباشر من بيئتي | Repo → Settings → Secrets and variables → Actions |
| U3 | تفعيل GitHub Pages بمصدر «GitHub Actions» | نشر الصفحات القانونية (L1.2) | Repo → Settings → Pages → Source: GitHub Actions |
| U4 | فتح PR من `ccr-bd089a46-bdh8fo` إلى `main` ودمجه، ثم PR من `launch/plan` | `main` قديم (أكتوبر)؛ كل العمل الجديد مبني على الفرع | الروابط في رد المحادثة |
| U5 | ✅ Vercel مربوط (حساب شخصي، بلا فرق) | نشر الويب (L3.1) | — |
| U6 | ✅ تركيا والسعودية (الموجة 1)، ثم الخليج ومصر، سوريا والمغرب العربي، أوروبا، شرق آسيا (`MARKETS.md`) | — | — |
| U7 | التسجيل في Amazon Associates (amazon.com.tr وamazon.sa) + AliExpress Portals + Noon — **اختياري الآن**: الطبقة الأولى (متاجر معرض) لا تحتاجه | القبول يأخذ أسابيع (L5 المرحلة 0) | يحتاج هويتك وبياناتك الضريبية — لا أستطيع فعله نيابة عنك |
| U9 | اسم الجهة القانونية المشغّلة وبريد الخصوصية → متغيرات المستودع `LEGAL_ENTITY_NAME` و`LEGAL_CONTACT_EMAIL` (Settings → Secrets and variables → Actions → **Variables**) | يظهران في صفحات الخصوصية؛ لن أخترعهما | — |
| U8 | (لاحقاً، L3.2) اختيار مزود VPS والدفع | تشغيل الخدمات الخلفية | سأقترح مواصفات محددة عند الوصول |

## ▶️ التالي: L1.3b ثم L1.9 ثم L1.4 (لا تحتاج شيئاً منك)

### L1.9 — دولة لكل إعلان (اكتُشف في L1.8)
- نماذج النشر في الويب والجوال **لا ترسل عملة**، فكل إعلان كان يُحفظ USD. حل مؤقت في L1.8: `DEFAULT_LISTING_CURRENCY` (افتراضي TRY).
- الحل الكامل: عمود `country` في `listings` (ترحيل، افتراضي من `DEFAULT_LISTING_COUNTRY`)، حقل دولة في الملف الشخصي، قائمة عملات في النموذج تبدأ بعملة دولة البائع، وفلتر دولة في البحث (فهرس ES).
- **أمن:** الدولة والعملة من قائمة السجل فقط (`IsIn`)؛ لا ثقة بموقع الجهاز.

## (منجز، للمرجع) L0.2 — CI على فروع `launch/**`

- **ما:** إضافة `launch/**` إلى `on.push.branches` في `.github/workflows/ci.yml` و`security.yml`.
- **لماذا:** لا أستطيع فتح PR (لا رمز GitHub API)، فبدون هذا لن يعمل CI على فروعي.
- **التحقق:** `curl -s "https://api.github.com/repos/Sattuf/marad-marketplace/actions/runs?branch=launch/plan"` → `conclusion: success`.
- **أمن:** لا تغيير في الصلاحيات؛ `permissions:` في الـ workflow تبقى أقل ما يمكن. انتبه: CI على push لا يكشف أسراراً لـ forks.

## بعده بالترتيب

### L1.3b — المسح النهائي بعد 30 يوماً + الجوال
- **cron يومي في auth-service** (قفل Redis كي لا تعمل نسختان): المستخدمون بـ `deleted_at < now() - 30 days` ولم يُمسحوا بعد.
- **لا حذف لصف `users`**: جداول المحادثة `ON DELETE CASCADE` ستحذف محادثات الطرف الآخر. بدلاً من ذلك tombstone: `full_name='مستخدم محذوف'`، و`NULL` لـ email/phone/password/avatar/bio/city/location/google_id/facebook_id/fcm_token، و`status`=`banned`؟ (لا — عمود `purged_at` جديد أوضح).
- مسارات داخلية لكل خدمة (كل منها يحذف بياناته هو، حسب ملكية الجداول في POSTGRES.md):
  listings: حذف الإعلانات وصورها (ملفات/S3) · users-service: المفضلة والصورة الشخصية · personalization: `DELETE FROM user_events WHERE user_id` · identity: وثائق KYC (مع المفاتيح) · messaging: صور المحادثات التي أرسلها (الرسائل النصية تبقى بلا اسم) · fraud: يبقى حتى 12 شهراً (مذكور في السياسة).
- كل خطوة idempotent وتُعاد في اليوم التالي إن فشلت؛ مقياس `account_purge_total{result}` وتنبيه عند الفشل المتكرر.
- **الجوال (Flutter):** شاشة الإعدادات: روابط الخصوصية/الشروط (`/privacy` …) + «حذف الحساب» بنفس منطق الويب (كلمة مرور أو SMS). شرط App Store: الحذف من داخل التطبيق.
- **قرار مرتبط:** حظر الإشراف (`users/:id/status = banned`) يجب أن يستدعي `visibility hidden=true` أيضاً (اكتُشف في L1.3a: الإعلانات تبقى ظاهرة بعد الحظر).

### L1.7 — حماية OTP
- حد لكل رقم (3/ساعة)، لكل IP (10/ساعة)، قائمة دول مسموحة من `OTP_ALLOWED_COUNTRY_CODES`، رفض الأرقام المميزة.
- مقياس `otp_sent_total{country}` وتنبيه عند قفزة.

### صيانة صغيرة (تُدمج مع أقرب مهمة تلمس الملف)
- `search-service/src/ranking/ranking.service.spec.ts:38`: `null` → `undefined` (خطأ نوع لا يراه CI لأن tsconfig.build يستبعد الاختبارات). الأفضل: خطوة CI تشغّل `tsc -p tsconfig.json` أيضاً لتشمل الاختبارات.
- `transactions-service`: الاختبارات لا تنتهي بدون `--forceExit` (اتصال Redis/DB مفتوح في الاختبارات) → إغلاقه في `afterAll`.

