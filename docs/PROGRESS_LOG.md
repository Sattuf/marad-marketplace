# سجل التقدم — Progress Log

> سجل زمني لكل ما تم (الأحدث في الأسفل). اقرأه أولاً عند بدء أي جلسة جديدة، ثم ROADMAP.md.

## 2026-11-24 — الجلسة 1

### T0 — الجرد والتدقيق ✅
- مسح الريبو (698 ملفاً، 43 commit) وتاريخه. آخر نقطة: مراجعة سبتمبر 2026 أنهت المرحلة 0 وجزءاً من 1 و3 من `REBUILD_PLAN.md`.
- تشغيل Docker daemon محلياً. البناء "كما هو" فشل: (1) `docker.elastic.co` محجوب، (2) لا دعم لـ CA داخل البناء، (3) حدود Docker Hub (429) — أُعيدت المحاولة بنجاح.
- خط الأساس: typecheck نظيف في 9 خدمات + الويب؛ 190 اختبار Node + 61 ويب + 19 Python — كلها ناجحة.
- التدقيق: gitleaks (تاريخ + شجرة)، `npm audit` (مساحة العمل: 4 حرجة/34 عالية)، `pip-audit` (python-jose، starlette)، مراجعة يدوية. Trivy: الصورة محجوبة بحد Docker Hub وروابط الإصدارات 404، فبُني من المصدر عبر `go install`.
- كُتبت: PROJECT_STATE، SECURITY_AUDIT (15 نتيجة + حكم + OWASP)، ROADMAP، DECISIONS (ADR-001..003)، OPEN_QUESTIONS.

### T1.1 + T2.1 — تقوية compose وصور الإنتاج ✅
- compose أُعيدت كتابته: كل بيانات الاعتماد من `infra/.env` (لا كلمة مرور حرفية)، anchors مشتركة، لا profiles، صور مثبتة الإصدار، إزالة `docker.sock` من localstack، `read_only` + `cap_drop: ALL` + `no-new-privileges`، لا منافذ داخلية منشورة، `depends_on: service_healthy` في كل مكان.
- `scripts/gen-env.sh` + `make up`: أمر واحد يولّد الأسرار عشوائياً ويبني ويشغّل وينتظر الصحة.
- Dockerfiles: عام للخدمات في مساحة العمل (`npm ci --workspace`)، ومُقوّاة لـ users/moderation/fraud/personalization، وصورة لمشغّل الترحيلات. القديمة في `archive/dockerfiles/`.
- `.gitleaks.toml` + `.gitleaksignore`: gitleaks نظيف على الشجرة والتاريخ.
- **خطأ اكتُشف وأُصلح:** search-service يُنشئ فهرس ES مرة واحدة دون إعادة محاولة؛ إن لم يكن ES جاهزاً يُنشأ الفهرس تلقائياً بـ mapping ديناميكي فيتعطل البحث المرتّب نهائياً (`script_exception`). الحل: إعادة محاولة مع backoff + اختباران + `action.auto_create_index=-marad_listings` في ES. وصار فحص البحث إلزامياً في smoke (كان يُتخطى بصمت).
- **بوابة الجودة:** 12 صورة تُبنى؛ 17 حاوية `healthy`؛ Prometheus: 12/12 targets UP؛ `e2e-smoke`: **52/52**؛ search-service: 22 اختباراً.

### T1.2 — ثغرات اعتماديات Node ✅
- `npm audit fix --legacy-peer-deps` ثم: next 16.2.9 → 16.4.6 (حرجة: تجاوز middleware)، bcrypt 5 → 6 (tar حرجة عبر node-pre-gyp)، sharp ^0.35.5، و`overrides` في الجذر وفي users/moderation (multer 2.5، body-parser 1.20.9، lodash 4.18.1، js-yaml 4.3.2، tar، postcss، grpc-js).
- محاولة 1: حذف مدخلات من lockfile → شجرة ناقصة (`Cannot find module 'lodash'`). محاولة 2: إعادة توليد lockfile من الصفر → نجحت.
- `services/listings-service/package-lock.json` (غير مستخدم داخل مساحة العمل) → `archive/lockfiles/`.
- **عائق بيئي:** امتلأ قرص الحصة → ES فرض `read_only_allow_delete`. أُضيف `cluster.routing.allocation.disk.threshold_enabled=false` لعنقود التطوير، ونُظّف build cache (25GB).
- **بوابة الجودة:** prod audit 0/0 في الجذر وusers وmoderation وdb؛ typecheck نظيف؛ 190 Node + 61 ويب + 2 جديدان؛ `next build` ناجح؛ 12 صورة؛ e2e **52/52**.
- ملاحظة: `eslint` الويب يُظهر 20 خطأ سابقاً (لا يشغّله CI) → T5.1.

### T1.3 — اعتماديات Python ✅
- `python-jose` (ثغرات بلا إصلاح) → `PyJWT 2.15.1` في fraud وpersonalization. fastapi 0.115 → 0.165 (starlette 1.10).
- كل الإصدارات مثبتة؛ pytest خارج صورة الإنتاج (`requirements-dev.txt`)؛ أُزيلت numpy/scikit-learn/python-dotenv غير المستخدمة من personalization.
- `services/fraud-service/app/` (هيكل فارغ من Sprint 0) واختباره → `archive/fraud-service-stub/`.
- تغيّر سلوك: FastAPI ≥ 0.120 يعيد **401** بدل 403 عند غياب رمز Bearer (مطابق لـ RFC 7235) — حُدّث اختباران.
- أُضيفت 3 اختبارات سلبية: `alg=none`، رمز منتهٍ، HS512 بدل HS256.
- **بوابة الجودة:** fraud 13 ✅ / personalization 8 ✅ (Python 3.11 في حاوية)، `pip-audit` لا ثغرات، الصور `healthy`، e2e **52/52**.

### T1.4 — التحقق من المدخلات ✅
- `ValidationPipe({ whitelist: true, transform: true })` عام في search وmessaging وidentity (كانت الوحيدة بدونه).
- اكتُشف أن الخدمات الثلاث لا تُعلن `class-validator`/`class-transformer` في `package.json` (تعمل فقط بفضل hoisting في مساحة العمل) → أُضيفت صراحة.
- DTOs البحث الخمسة صارت بمزخرفات (أنواع، أطوال، `IsUUID`، `IsLatitude`، `IsIn(['A','B'])`) مع الإبقاء على التقييد اللطيف (clamp) في الخدمة كي لا تنكسر قيم صالحة. DTO جديد `DecryptKycDto`.
- **بوابة الجودة:** search 26 (4 جديدة) / messaging 10 / identity 9؛ typecheck نظيف؛ e2e **52/52**؛ طلب بـ `variant: "Z"` → 400 برسالة واضحة.
- **اكتمال المرحلة 1 (الثغرات الحرجة والعالية):** لم تبقَ ثغرة حرجة أو عالية مفتوحة في SECURITY_AUDIT؛ المتبقي Medium (S10 رموز الويب، S11 المفتاح المتماثل) ومجدول في T8.2 وT4.2.

### T2.2 + T2.3 — الويب ضمن compose + بيانات تجريبية ✅
- `infra/docker/web.Dockerfile`: Next.js بمخرجات `standalone` (298MB)، غير root، healthcheck؛ `next.config.ts`: ترويسات أمان (nosniff، DENY، Referrer-Policy، Permissions-Policy) وإخفاء `X-Powered-By`.
- **3 أعطال اكتُشفت وأُصلحت:**
  1. `next/font/google` يحمّل الخطوط من Google وقت البناء → يفشل دون إنترنت/خلف بروكسي. الحل: خطوط مستضافة ذاتياً من npm (`@fontsource-variable/cairo|inter`) — لا طلبات لطرف ثالث من متصفح الزائر أيضاً.
  2. الويب يعتمد على `@types/jest` عبر hoisting فقط → أُضيف لـ devDependencies.
  3. **كل صور الإعلانات كانت محجوبة في الويب**: helmet في البوابة يضع `Cross-Origin-Resource-Policy: same-origin`، والويب (:3100) يحمّل الصور من البوابة (:3000). الحل: `same-site` (المنفذ لا يدخل في "الموقع"). تحقق بلقطة Playwright: 0 أخطاء متصفح.
- `scripts/seed-demo.mjs` + `make seed`: 3 حسابات (بائع، مشترٍ، مشرف) و12 إعلاناً بصور، عبر الـ API العامة؛ ترقية المشرف عبر SQL لأنه لا يوجد (عمداً) endpoint يمنح دور admin. Idempotent (أول نسخة لم تكن كذلك بسبب كاش البوابة 30 ثانية — أُصلح).
- **بوابة الجودة:** web tsc + 61 اختباراً + `next build`؛ gateway tsc؛ 18 حاوية healthy؛ seed مرتين بلا تكرار.

### T3.1 — Socket.IO عبر Redis (P10) ✅
- وُجد أن بث الحضور كان مقصوراً على الغرف أصلاً وتتبّع الاتصالات في Redis؛ الناقص كان الـ adapter فقط: كل نسخة من messaging كانت ترى عملاءها وحدهم.
- `RedisIoAdapter` (`@socket.io/redis-adapter` + ioredis pub/sub) مفعّل افتراضياً (`SOCKET_REDIS_ADAPTER=false` للتعطيل).
- اختبار تكامل: خادما Socket.IO على Redis حقيقي؛ حدث يُبث من A يصل لعميل متصل بـ B. (المحاولة الأولى علِقت لأن IoAdapter بدون تطبيق Nest يُنشئ خادم HTTP خاصاً به — صُحّح.)
- **بوابة الجودة:** 10 اختبارات وحدة + اختبار التكامل؛ الحاوية healthy مع سجل "rooms are shared through Redis"؛ e2e **52/52**.

### T3.2 + T3.3 — فهرس trigram + عدّادات بلاغات ذرية (P9، P11) ✅
- `db/migrations/0006_listings_title_trgm.sql`: `pg_trgm` + فهرس GIN على `listings.title`؛ `EXPLAIN` يُظهر `Bitmap Index Scan on idx_listings_title_trgm` لـ `ILIKE '%جوال%'`.
- moderation: زيادة العداد صارت upsert ذرياً واحداً (`INSERT … ON CONFLICT DO UPDATE … RETURNING`)، والإنقاص `UPDATE … WHERE pending_count > 0`. السابق (قراءة-تعديل-كتابة) كان يفقد زيادات تحت التزامن، فقد لا يبلغ عتبة المراجعة الآلية.
- تحقق على Postgres حقيقي: 50 بلاغاً متزامناً → `pending_count = 50`.
- **بوابة الجودة:** moderation 11 اختباراً (1 جديد)؛ اختبارات مشغّل الترحيلات 4/4؛ بلاغ عبر البوابة 201؛ e2e **52/52**.
- **المرحلة 3 مكتملة.**

### T4.3 — صيغة أخطاء موحدة + Request ID ✅
- البوابة: middleware `requestId` يقبل معرّف العميل إن كان آمناً (`[A-Za-z0-9._-]{8,64}` — يمنع حقن أسطر في السجلات) وإلا يولّد UUID، يمرّره للخدمة ويعيده في `X-Request-ID` (مع `exposedHeaders` لـ CORS).
- الفلتر المشترك (9 نسخ متطابقة): `{statusCode, error, message, requestId, timestamp, path}`؛ أخطاء 500 لا تكشف التفاصيل وتُسجَّل مع requestId.
- FastAPI: `errors.py` (نسختان متطابقتان، أُضيفتا لـ `check-shared-copies.mjs`) بنفس الشكل؛ أخطاء التحقق 400 بدل 422.
- **بوابة الجودة:** gateway 46 (+6)، كل خدمات Node خضراء، fraud 14، personalization 8؛ 18 حاوية healthy؛ e2e **52/52**؛ تحقق يدوي: الخطأ نفسه الشكل من Nest ومن FastAPI مع `requestId` المُمرَّر.

### T4.2 — مصادقة مركزية غير متماثلة (S11) ✅
- auth-service وحده يملك `JWT_PRIVATE_KEY_B64` ويوقّع RS256 بـ `kid` (بصمة RFC 7638) و`iss=marad-auth` و`aud=marad-api`؛ الخدمات العشر الأخرى لا تملك إلا `JWT_PUBLIC_JWKS`. `GET /.well-known/jwks.json` للمستهلكين الخارجيين.
- `security.ts` المشترك (8 نسخ) + 4 استراتيجيات Passport + `jwt_keys.py` المشترك (fraud، personalization) — كلها RS256 فقط مع iss/aud، والمفاتيح تُحمَّل عند الإقلاع.
- رموز التحديث: HS256 مثبتة + جمهور `marad-refresh` (لا يمكن تبادل النوعين).
- `scripts/gen-jwt-keys.mjs` + `gen-env.sh` يولّد زوج المفاتيح، ويضيفه لـ `.env` موجود دون مسح قيمه.
- مراجعة مستقلة قبل التنفيذ غيّرت التصميم في 6 نقاط (ADR-007)، وكشفت S16 الجديد.
- **بوابة الجودة:** كل خدمات Node خضراء (transactions 36 مع 4 اختبارات سلبية جديدة)؛ fraud 15 (+2)؛ personalization 8؛ 18 حاوية healthy؛ e2e **52/52**؛ تحقق حي: رمز HS256 مزوّر بدور admin → 401 في moderation/fraud/auth، والرمز الحقيقي → 200.

### T4.1 — OpenAPI موحد في البوابة ✅
- `GET /api/docs/specs/<service>.json`: البوابة تجلب مواصفة كل خدمة داخلياً (Nest `/api/docs-json` أو FastAPI `/openapi.json`) وتعيد كتابتها بالمسارات العامة: `servers: /api/v1`، إضافة البادئة حسب قواعد التوجيه (strip/override، وتلميح `docsPrefixByTag` لخدمة خلف عدة بادئات)، وحذف المسارات المحجوبة (internal) و health/metrics.
- Swagger UI في `/api/docs` بقائمة منسدلة لـ 11 مواصفة (البوابة + 10 خدمات)؛ "Try it out" يمر عبر البوابة مع Bearer.
- users-service لم يكن فيه Swagger أصلاً → أُضيف (وأصبح منفذه الافتراضي 3007 بدل 3000، يغلق S15).
- **بوابة الجودة:** gateway 49 (+3)، users 8؛ كل المواصفات العشر تُجلب؛ تحقق: مسارات transactions/moderation تطابق التوجيه الفعلي (GET `/api/v1/transactions` → 200).

### T5.1 — Lint موحد ✅
- `eslint.config.mjs` في الجذر (ESLint 9 + typescript-eslint) للخدمات السبع في مساحة العمل؛ `--max-warnings=0`. users/moderation على `.eslintrc.js` الخاص بهما (`ESLINT_USE_FLAT_CONFIG=false`)، وأُزيلت قاعدة Prettier منها لأنها تعيد تنسيق الملفات المشتركة فتكسر ضمان النسخ المتطابقة.
- إصلاحات حقيقية: استيرادات غير مستخدمة (`getSignedUrl`، `firebase-admin`، `IsNull`، `Headers`، `UpdateDateColumn`)، هروب زائد في regex البوابة، `prefer-const`.
- الويب: 20 خطأ → 0. استُبدل `any` بأنواع حقيقية (`types/fraud.ts`)، وكشف ذلك عيبين فعليين في لوحة الاحتيال: عوامل الخطورة قد تكون نصوصاً (كانت تُعرض ككائن)، وتاريخ الإشارة قد يغيب (`Invalid Date`). `react-hooks/set-state-in-effect` (قاعدة React Compiler الجديدة) → تحذير موثق كدَين تقني، مع 17 تحذير `<img>`.
- CI: خطوة lint لكل خدمة Node وللويب.
- **بوابة الجودة:** lint نظيف في 9 خدمات؛ الويب tsc + 61 اختباراً + build؛ خدمات Node كلها خضراء.
