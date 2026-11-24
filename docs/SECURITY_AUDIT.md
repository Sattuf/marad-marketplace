# التدقيق الأمني — Security Audit

> تاريخ التدقيق: 2026-11-24 · يكمّل المراجعة السابقة في [REBUILD_PLAN.md](REBUILD_PLAN.md) (C1–C8، H1–H12).
> الأدوات: gitleaks 8.21 (الشجرة + كل تاريخ git)، `npm audit`، `pip-audit`، Trivy (fs + config)، مراجعة يدوية للكود.
> الحالة: ✅ مُصلح · 🔄 قيد العمل · ⏳ مخطط · ⚠️ مقبول/موثق

## 1. الحكم الصريح

**هل كان المشروع آمناً بشكل صحيح؟ لا — في نسخته الأصلية (يونيو 2026) لم يكن آمناً على الإطلاق.**
احتوى على ثغرات تسمح بالاستيلاء على أي حساب (OTP ثابت `123456`)، وتزوير رموز مدير (أسرار JWT مكتوبة في
الكود)، وقراءة كل المحادثات بلا مصادقة، وفك تشفير وثائق الهوية دون تسجيل دخول.

**بعد مراجعة سبتمبر 2026 أصبح الأساس سليماً:** الأسرار إلزامية ولا قيم افتراضية لها، والتحقق من توقيع JWT
موجود في كل خدمة مع تثبيت الخوارزمية (`HS256`)، والاتصال الداخلي محمي بسر يُقارن بزمن ثابت، والبوابة
تحجب المسارات الداخلية، وكل إصلاح يرافقه اختبار سلبي يمنع عودته.

**ما بقي خاطئاً (وجده هذا التدقيق):** اعتماديات بثغرات معروفة حرجة وعالية (Next.js، Express/Nest، python-jose)،
وإعدادات Docker غير آمنة (تشغيل كـ root، ربط `docker.sock`، وسوم `latest`، كلمة مرور Postgres في ملف compose)،
وغياب `ValidationPipe` في 3 خدمات، والرموز في `localStorage` في الويب، وسر JWT متماثل مشترك بين 11 خدمة.

### ما كان صحيحاً
- تصميم "fail closed": الخدمات ترفض الإقلاع دون الأسرار، وأقل من 32 حرفاً مرفوض في الإنتاج.
- تثبيت `algorithms: ['HS256']` في كل مكان (يمنع هجوم `alg: none` وخلط الخوارزميات).
- Rate limiting في البوابة مع `trust proxy` مضبوط، وقفل الحساب بعد 5 محاولات، وعدّادات OTP ذرية.
- استعلامات SQL كلها بمعاملات (`$1`) — لم يُعثر على حقن SQL؛ و`LIKE` مع هروب للأحرف الخاصة.
- CORS من قائمة صريحة، وhelmet، وSwagger معطّل في الإنتاج، وwebhooks بتوقيع HMAC على البايتات الخام.
- حدود حجم الطلب (1MB JSON، 5MB ملفات).

## 2. نتائج هذا التدقيق

| # | الخطورة | الفئة (OWASP API 2023) | المكان | المشكلة | الحالة |
|---|---|---|---|---|---|
| S1 | **Critical** | API8 / مكونات ضعيفة | `apps/web` (`next` 16.2.9)، شجرة npm | `npm audit`: 4 حرجة و34 عالية في مساحة العمل (next، proxy-addr، handlebars، tar، multer، axios، socket.io-parser، ws...) | ✅ `npm audit --omit=dev`: **0 حرجة / 0 عالية** (كانت 4 / 34). next 16.4.6، bcrypt 6، sharp 0.35.5، و`overrides` للاعتماديات الانتقالية (ADR-005). بقيت 4 عالية في أدوات البناء فقط (`@nestjs/cli`: glob، picomatch، tmp) — لا تُشحن في الصور ⚠️ |
| S2 | **High** | API8 | `users-service`، `moderation-service` | 2 حرجة و13 عالية لكل منهما (lockfile مستقل) | ✅ 0 / 0 في اعتماديات الإنتاج |
| S3 | **High** | API2 | `fraud-service` | `python-jose 3.3.0`: ثغرات خلط الخوارزمية وDoS (PYSEC-2024-232/233) وثغرات بلا إصلاح (PYSEC-2025-185، 2026-4298)، و`ecdsa` بلا إصلاح | ✅ استُبدل بـ PyJWT 2.15 في fraud وpersonalization + اختبارات `alg=none` ورمز منتهٍ وخوارزمية أخرى |
| S4 | **High** | API8 | `fraud-service` | `starlette 0.38.6` (عبر fastapi 0.115.0): عدة ثغرات DoS/multipart | ✅ fastapi 0.165 / starlette 1.10؛ `pip-audit`: لا ثغرات |
| S5 | **High** | API8 / Docker | `infra/docker-compose.yml` | `localstack` يربط `/var/run/docker.sock` → صلاحية root على المضيف لأي اختراق للحاوية | ✅ أُزيل الربط (KMS لا يحتاجه) |
| S6 | Medium | API8 / Docker | كل `Dockerfile` | الحاويات تعمل كـ root، `npm install` بدل `npm ci`، تشغيل `start:dev` بدل صورة إنتاج، لا `HEALTHCHECK` | ✅ صور multi-stage بـ `npm ci`، مستخدم غير root، `HEALTHCHECK`، وفي compose: `read_only` و`cap_drop: ALL` و`no-new-privileges` |
| S7 | Medium | API8 / سلسلة التوريد | compose | وسوم `latest` (prometheus، grafana، localstack) واعتماديات Python غير مثبتة في personalization | ✅ الصور واعتماديات Python كلها مثبتة الإصدار، وأدوات الاختبار في `requirements-dev.txt` خارج الصور |
| S8 | Medium | أسرار | compose | كلمة مرور Postgres (`marad_dev_password`) مكتوبة 9 مرات في compose | ✅ من `infra/.env` (يولّده `scripts/gen-env.sh` عشوائياً) |
| S9 | Medium | API3 / التحقق من المدخلات | identity، messaging، search | لا `ValidationPipe` عام؛ قيود DTO لا تُطبَّق (search يتحقق يدوياً فالأثر محدود) | ✅ `ValidationPipe({whitelist, transform})` في الخدمات الثلاث + مزخرفات class-validator لكل DTOs البحث وDTO لفك تشفير KYC + 4 اختبارات |
| S10 | Medium | API2 | `apps/web/src/lib/api/auth.ts` | رمز الوصول في `localStorage` ورمز التحديث في كوكي يقرؤه JS (ليس httpOnly) → سرقة بأي XSS (H10 السابق) | ⏳ T3.x |
| S11 | Medium | API2 / تصميم | كل الخدمات | سر JWT متماثل (HS256) مشترك: اختراق أي خدمة يسمح بسكّ رموز مدير. الحل: RS256/EdDSA، auth يوقّع والباقي يتحقق بالمفتاح العام | ⏳ T4.2 |
| S12 | Low | أسرار | `apps/mobile/android/app/google-services.json` (commit `68b4035`) | مفتاح Firebase Android API في git. مفاتيح Firebase للعميل ليست سرية بطبيعتها، لكن يجب تقييدها (package name + SHA-1) وتفعيل App Check | ⚠️ موثق — إجراء يدوي في Google Cloud Console |
| S13 | Info | — | `services/*/README.md` | gitleaks: a placeholder CircleCI badge token في قالب NestJS README — **إيجابية كاذبة** | ✅ أُضيف `.gitleaks.toml` (T1.1) |
| S14 | Low | API4 | compose | منافذ الخدمات الداخلية (3004–3008، 8001–8002) منشورة على `127.0.0.1` فتتجاوز Rate limit البوابة محلياً | ✅ لا يُنشر إلا البوابة وsocket المحادثات |
| S15 | Low | API9 | users-service | المنفذ الافتراضي 3000 يتعارض مع البوابة عند غياب `PORT` | ⚠️ compose وHelm يمرران `PORT` دائماً |

**gitleaks (تاريخ git كامل، 41 commit):** 5 نتائج — 4 إيجابيات كاذبة (S13) + مفتاح Firebase (S12).
لا أسرار خادم (JWT، قواعد بيانات، AWS، Stripe) في التاريخ. الأسرار الافتراضية القديمة (`your-secret-key`...)
كانت قيماً افتراضية في الكود وأُزيلت، وCI يمنع عودتها.

## 3. مقارنة مع OWASP API Security Top 10 (2023)

| البند | الوضع |
|---|---|
| API1 BOLA | ✅ التحقق من الملكية/العضوية في المحادثات والمعاملات والإعلانات (C4، H12) مع اختبارات |
| API2 Broken Authentication | 🟡 قوي على الخادم؛ ضعيف في تخزين الويب (S10) وتصميم المفتاح المتماثل (S11) |
| API3 BOPLA | 🟡 `whitelist` في 6 خدمات؛ مفقود في 3 (S9)؛ `status` محمي (H11) |
| API4 Resource Consumption | ✅ Rate limit، حدود الحجم، ترقيم صفحات بحد أقصى، مهلات استعلام |
| API5 BFLA | ✅ أدوار admin مُتحقق منها في الخادم، والمسارات الداخلية محجوبة في البوابة |
| API6 Sensitive Business Flows | ✅ OTP محدود وذري، idempotency للمعاملات، قفل الحساب |
| API7 SSRF | ✅ لا طلبات إلى عناوين يحددها المستخدم |
| API8 Security Misconfiguration | ❌ → S1–S8 (اعتماديات وDocker) — الأولوية الأولى |
| API9 Improper Inventory | 🟡 Swagger لكل خدمة، لكن لا فهرس موحد في البوابة (T4.1) |
| API10 Unsafe Consumption | ✅ webhooks Didit/Stripe بتوقيع HMAC، والتحقق من `aud` لرموز Google/Facebook |

## 4. سجل الإصلاح

يُحدَّث مع كل مهمة أمنية. التفاصيل في [ROADMAP.md](ROADMAP.md) و[PROGRESS_LOG.md](PROGRESS_LOG.md).
