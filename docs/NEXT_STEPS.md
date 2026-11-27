# الخطوات القادمة — Next Steps

> يُحدَّث بعد كل مهمة. المنجز يُحذف من هنا ويُسجَّل في `PROGRESS_LOG.md`.
> الترتيب = ترتيب التنفيذ. الأرقام تشير إلى `EXECUTION_PLAN.md` §7.

## 🙋 ينتظرك (لا أستطيع فعله بنفسي)

| # | المطلوب | لماذا | كيف |
|---|---|---|---|
| U1 | ربط موصّل **Supabase** في claude.ai، وإنشاء مشروع مجاني باسم `marad-staging` (أو أنشئه أنا بعد الربط) | قاعدة البيانات الحقيقية (L2) | claude.ai → Settings → Connectors → Supabase |
| U2 | إضافة أسرار GitHub: `SUPABASE_DB_URL` (direct) و`SUPABASE_POOLER_URL` و`SUPABASE_ANON_KEY` | CI يتصل بـ Supabase؛ أنا لا أستطيع الاتصال المباشر من بيئتي | Repo → Settings → Secrets and variables → Actions |
| U3 | تفعيل GitHub Pages بمصدر «GitHub Actions» | نشر الصفحات القانونية (L1.2) | Repo → Settings → Pages → Source: GitHub Actions |
| U4 | فتح PR من `ccr-bd089a46-bdh8fo` إلى `main` ودمجه، ثم PR من `launch/plan` | `main` قديم (أكتوبر)؛ كل العمل الجديد مبني على الفرع | الروابط في رد المحادثة |
| U5 | ربط موصّل **Vercel** (اختياري الآن، مطلوب في L3.1) | نشر الويب | claude.ai → Connectors → Vercel |
| U6 | اختيار دولة البداية: تركيا أم السعودية | يحدد لغة الصفحات القانونية الأولى، وقائمة دول OTP، وبرامج العمولة | رد في المحادثة |
| U7 | التسجيل في Amazon Associates لدولة البداية + برنامج Noon أو شبكة تركية | القبول يأخذ أسابيع (L5 المرحلة 0) | يحتاج هويتك وبياناتك الضريبية — لا أستطيع فعله نيابة عنك |
| U8 | (لاحقاً، L3.2) اختيار مزود VPS والدفع | تشغيل الخدمات الخلفية | سأقترح مواصفات محددة عند الوصول |

## ▶️ التالي: L1.6 ثم L1.1 ثم L1.3 (لا تحتاج شيئاً منك)

## (منجز، للمرجع) L0.2 — CI على فروع `launch/**`

- **ما:** إضافة `launch/**` إلى `on.push.branches` في `.github/workflows/ci.yml` و`security.yml`.
- **لماذا:** لا أستطيع فتح PR (لا رمز GitHub API)، فبدون هذا لن يعمل CI على فروعي.
- **التحقق:** `curl -s "https://api.github.com/repos/Sattuf/marad-marketplace/actions/runs?branch=launch/plan"` → `conclusion: success`.
- **أمن:** لا تغيير في الصلاحيات؛ `permissions:` في الـ workflow تبقى أقل ما يمكن. انتبه: CI على push لا يكشف أسراراً لـ forks.

## بعده بالترتيب

### L1.6 — صور المحادثات
- استبدال `Date.now()-Math.random` بـ `randomUUID()`.
- **السؤال الأمني:** هل `/media/messages/*` تُقدَّم لأي شخص يعرف الرابط؟ إن نعم → إما رابط موقّع قصير العمر، أو مسار محمي يتحقق أن الطالب طرف في المحادثة. الخيار المفضل: مسار محمي في messaging-service (البساطة، ولا S3 مطلوب محلياً).
- **اختبار:** مستخدم ثالث يطلب الصورة → 403.

### L1.1 — الصفحات القانونية
- مسارات Next.js ثابتة في `apps/web/src/app/(legal)/` بثلاث لغات، محتوى من ملفات Markdown في `apps/web/content/legal/`.
- **المحتوى يغطي فعلياً ما نجمعه:** الهاتف، البريد، الموقع التقريبي للإعلان، الصور، الرسائل، بصمة الجهاز (fraud-service)، أحداث الاستخدام (personalization)، وثائق KYC (Didit)، الإشعارات (FCM)، وأين تُخزَّن ومدة الاحتفاظ.
- **تنبيه:** النص مسودة تقنية دقيقة، وليس استشارة قانونية؛ يُراجَع من محامٍ قبل الإنتاج (KVKK في تركيا، PDPL في السعودية).
- روابط في: التذييل، شاشة التسجيل (موافقة صريحة)، إعدادات التطبيق.

### L1.3 — حذف الحساب
- `DELETE /auth/me` في auth-service: يتطلب `password` أو `otp` حديثاً → يضع `deleted_at`، يبطل كل رموز التحديث، ويرسل حدث `user.deleted` (internal secret) إلى listings (إخفاء الإعلانات) وmessaging (تجهيل الاسم) وusers (حذف الملف والمفضلة) وpersonalization (حذف الأحداث).
- مهمة cron يومية تمسح نهائياً بعد 30 يوماً.
- `/account-deletion` في الويب يشرح الخطوات ويوفر الحذف لمن لا يملك التطبيق (شرط Google Play).
- **اختبارات سلبية:** بلا إعادة تحقق → 401؛ رمز قديم بعد الحذف → 401؛ مستخدم آخر لا يحذف غيره.

### L1.7 — حماية OTP
- حد لكل رقم (3/ساعة)، لكل IP (10/ساعة)، قائمة دول مسموحة من `OTP_ALLOWED_COUNTRY_CODES`، رفض الأرقام المميزة.
- مقياس `otp_sent_total{country}` وتنبيه عند قفزة.

### صيانة صغيرة (تُدمج مع أقرب مهمة تلمس الملف)
- `search-service/src/ranking/ranking.service.spec.ts:38`: `null` → `undefined` (خطأ نوع لا يراه CI لأن tsconfig.build يستبعد الاختبارات). الأفضل: خطوة CI تشغّل `tsc -p tsconfig.json` أيضاً لتشمل الاختبارات.
- `transactions-service`: الاختبارات لا تنتهي بدون `--forceExit` (اتصال Redis/DB مفتوح في الاختبارات) → إغلاقه في `afterAll`.

