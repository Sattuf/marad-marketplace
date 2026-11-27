# الخطوات القادمة — Next Steps

> يُحدَّث بعد كل مهمة. المنجز يُحذف من هنا ويُسجَّل في `PROGRESS_LOG.md`.
> الترتيب = ترتيب التنفيذ. الأرقام تشير إلى `EXECUTION_PLAN.md` §7.

## 🙋 ينتظرك (لا أستطيع فعله بنفسي)

| # | المطلوب | لماذا | كيف |
|---|---|---|---|
| U1 | ✅ الموصّل مربوط. **باقٍ:** الخطة المجانية تسمح بمشروعين نشطين فقط، و`sanad` و`madinatuna` نشطان → أوقف أحدهما مؤقتاً (Pause) أو رقِّ الخطة، ثم أنشئ أنا `marad-staging` (eu-central-1) | قاعدة البيانات الحقيقية (L2) | Supabase Dashboard → المشروع → Settings → Pause project |
| U2 | إضافة أسرار GitHub: `SUPABASE_DB_URL` (direct) و`SUPABASE_POOLER_URL` و`SUPABASE_ANON_KEY` | CI يتصل بـ Supabase؛ أنا لا أستطيع الاتصال المباشر من بيئتي | Repo → Settings → Secrets and variables → Actions |
| U3 | تفعيل GitHub Pages بمصدر «GitHub Actions» | نشر الصفحات القانونية (L1.2) | Repo → Settings → Pages → Source: GitHub Actions |
| U4 | فتح PR من `launch/L1.3-account-deletion` إلى `main` ودمجه — **فرع واحد يحمل كل العمل** (مكدّس: ccr → plan → L1.5 → L1.8 → L1.6 → L1.1 → L1.3)، وكل طبقة CI أخضر | `main` قديم (أكتوبر)؛ كل العمل الجديد مبني على الفرع | الروابط في رد المحادثة |
| U5 | ✅ Vercel مربوط (حساب شخصي، بلا فرق) | نشر الويب (L3.1) | — |
| U6 | ✅ تركيا والسعودية (الموجة 1)، ثم الخليج ومصر، سوريا والمغرب العربي، أوروبا، شرق آسيا (`MARKETS.md`) | — | — |
| U7 | التسجيل في Amazon Associates (amazon.com.tr وamazon.sa) + AliExpress Portals + Noon — **اختياري الآن**: الطبقة الأولى (متاجر معرض) لا تحتاجه | القبول يأخذ أسابيع (L5 المرحلة 0) | يحتاج هويتك وبياناتك الضريبية — لا أستطيع فعله نيابة عنك |
| U9 | اسم الجهة القانونية المشغّلة وبريد الخصوصية → متغيرات المستودع `LEGAL_ENTITY_NAME` و`LEGAL_CONTACT_EMAIL` (Settings → Secrets and variables → Actions → **Variables**) | يظهران في صفحات الخصوصية؛ لن أخترعهما | — |
| U8 | (لاحقاً، L3.2) اختيار مزود VPS والدفع | تشغيل الخدمات الخلفية | سأقترح مواصفات محددة عند الوصول |

## ▶️ التالي: P1 — أرشفة كود السوق (`PIVOT_PLAN.md` §7)

الخطوات بالترتيب، فرع `launch/P1-archive-marketplace`:
1. `git mv` إلى `archive/services/`: listings، messaging، transactions، moderation، identity، personalization.
2. الجذر: إزالتها من `workspaces` وسكربتات `dev:*`؛ إعادة توليد lockfile (`--legacy-peer-deps`) والتحقق بـ `npm ci` نظيف.
3. `infra/docker-compose.yml`، `infra/helm/marad/values.yaml`، `infra/monitoring` (أهداف Prometheus)، `Makefile`: الخدمات الباقية فقط.
4. البوابة: `services.config.ts` + `BLOCKED_ROUTES` + مجمّع OpenAPI: إزالة الخدمات المؤرشفة؛ اختبارات البوابة تُحدَّث.
5. search-service: يعتمد على listings في الفهرسة/الترتيب → تعطيل الاعتماد مؤقتاً (يُعاد توجيهه في P3).
6. auth-service: إزالة نداء `visibility` للإعلانات من حذف الحساب (لا إعلانات) — مع إبقاء الحذف/الاسترجاع.
7. الويب والجوال: نقل الشاشات المعتمدة على الخدمات المؤرشفة إلى `archive/apps/`؛ صفحة رئيسية مؤقتة «قريباً: أرخص سعر» + الدخول + الصفحات القانونية + الملف الشخصي وحذف الحساب.
8. CI: مصفوفة الخدمات، `check-shared-copies`، `check-contracts`، `check-entity-schema`، E2E (يُعاد بمسار: صحة الخدمات + دخول + حذف حساب).
9. **بوابة:** CI أخضر بالكامل؛ `make up` يشغّل الباقي فقط؛ لا استيراد من `archive/` (فحص grep في CI).

## بعده
- **P2 البحث** (تركيا ← السعودية ← سوريا) كما في `PIVOT_PLAN.md` §5 — أبدأه بالتوازي مع P1 لأنه لا يلمس الكود.
- **L1.3b** المسح النهائي بعد 30 يوماً (أبسط بعد الأرشفة: auth + users فقط).
- **L1.4** Sign in with Apple (ما زال شرطاً للمتجر).
