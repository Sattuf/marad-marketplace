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

### T5.2 + T7.1 + T7.2 — CI: E2E، فحوص أمنية، بناء الصور ✅
- `ci.yml` → job جديد `e2e`: `gen-env.sh` ← `docker compose up --build --wait` (يبني الصور الـ 13) ← seed ← `e2e-smoke` (52 فحصاً) ← سجلات عند الفشل.
- `security.yml` جديد (push/PR + أسبوعياً): CodeQL `security-extended` لـ JS/TS وPython، gitleaks على كامل التاريخ، Trivy (vuln + misconfig + secret، يفشل على HIGH/CRITICAL)، `npm audit --omit=dev` للـ lockfiles الثلاثة.
- `dependabot.yml`: npm (4 lockfiles)، pip (2)، Docker، GitHub Actions — مجمّعة.
- **Trivy محلياً** (أول فحص كامل؛ الصورة كانت محجوبة بحد Docker Hub): الشجرة النشطة **0** HIGH/CRITICAL (ثغرات، إعدادات Dockerfile/compose، أسرار)؛ الإخفاقات الوحيدة في `archive/dockerfiles` (الأصلية بلا `USER`) — وهو دليل على ما أصلحه T2.1.
- تعذّر تشغيل workflows فعلياً هنا (لا GitHub runner)؛ تحققتُ من صحة YAML وشغّلت أمر Trivy نفسه محلياً بنجاح.

### T6.1–T6.3 — المراقبة ✅
- **سجلات JSON:** `nestjs-pino` في الخدمات التسع (`observability/logging.module.ts` مشترك)؛ سطر لكل طلب بـ method/url/status/duration و`requestId` و`trace_id`، مع حجب `authorization`/`cookie`/`x-internal-secret`. Python: `JsonFormatter` بـ trace_id.
- **تتبّع موزع:** `observability/tracing.ts` (OpenTelemetry NodeSDK + auto-instrumentations: http/express/nest/pg/ioredis/socket.io) و`observability.py` (FastAPI/asyncpg/httpx) → Jaeger (`:16686`). Sentry صار اختيارياً ولا يتعارض مع OTel.
- **Grafana:** لوحة "Ma'rad — Services" (حالة UP، CPU، ذاكرة، event-loop lag، heap، معدل/زمن طلبات Python) + مصدر بيانات Jaeger.
- 5 ملفات مشتركة جديدة أُضيفت لـ `check-shared-copies.mjs` (12 مجموعة، كلها متطابقة).
- **بوابة الجودة:** كل خدمات Node: tsc + اختبارات + lint ✅؛ Python 15/8 ✅؛ 19 حاوية healthy؛ e2e **52/52**؛ Jaeger يرى **11/11** خدمة، وطلب واحد يعطي trace عبر 5 خدمات (93 span)؛ سجل listings يحمل `requestId` المُرسل من العميل و`trace_id`.

### T8.1 + T8.2 — الواجهة + جلسة الويب الآمنة (S10) ✅
- T8.1: الواجهة موجودة أصلاً (رحلات المشتري/البائع + لوحة إدارة + لوحة الترتيب A/B)؛ تعمل الآن ضمن compose (T2.2) وتُختبر بالمتصفح.
- T8.2: auth-service: `SessionCookieInterceptor` على register/login/refresh/verify-otp/google/facebook — مع `X-Session-Cookie: 1` يُنقل رمز التحديث من JSON إلى كوكي `marad_rt` (HttpOnly، Secure، SameSite=Strict، Path=/api/v1/auth) + كوكي علم `marad_session`؛ refresh/logout يقرآن الكوكي؛ logout يمسحه. `COOKIE_DOMAIN`/`COOKIE_SECURE` قابلة للضبط.
- البوابة: تمرر `cookie`/`Set-Cookie` **لـ auth-service فقط**.
- الويب: رمز الوصول في ذاكرة الوحدة فقط، refresh أحادي (single-flight)، `SessionRestore` يستعيد الجلسة من الكوكي، middleware يعتمد على `marad_session`، حُذف `js-cookie`.
- **بوابة الجودة:** auth 31 (+4)، gateway 49، web 61 + lint 0 أخطاء؛ e2e **52/52** (مسار الجوال بالـ body لم يتغير)؛ اختبار Playwright حقيقي: دخول ← الكوكي `HttpOnly/Secure/Strict` ← `localStorage` فارغ ← `document.cookie` لا يحوي إلا العلم ← إعادة تحميل صفحة محمية `/my-listings` تبقى مسجّلاً.

### T10.1 — Helm chart ✅
- `infra/helm/marad`: Deployment/Service/PDB لـ 12 مكوّناً، HPA، Ingress (API + socket + web)، NetworkPolicy (رفض افتراضي)، Job ترحيلات كـ hook، securityContext صارم، أسرار من Kubernetes Secrets خارجية (`marad-app`، و`marad-auth-signing` لـ auth وحده).
- `helm lint --strict` ✅، `helm template` → 44 كائناً ✅. Trivy (config) على المخرجات: لا HIGH/CRITICAL؛ المتبقي MEDIUM خاص بالبيئة (قائمة السجلات المسموحة) + تنبيه heuristic على اسم `COOKIE_DOMAIN`.
- kubeconform غير متاح (ghcr.io محجوب هنا) — Trivy بديلاً. `helm lint` أُضيف إلى CI. `docs/DEPLOYMENT.md`: البناء، الأسرار، التثبيت، تدوير المفاتيح. حُذف `infra/k8s/.gitkeep` الفارغ.

### T9.1 — README + مخطط + demo ✅
- `README.md` جديد ثنائي اللغة (الإنجليزية أولاً للجمهور المستهدف): أبرز النقاط، مخطط Mermaid، جدول الخدمات، التشغيل، أمثلة طلبات، 4 لقطات حقيقية (`docs/images/`: لوحة الإدارة، trace في Jaeger عبر 5 خدمات، Swagger الموحد، Grafana). القديم في `archive/`.
- `scripts/demo.sh` / `make demo`: جولة من 7 خطوات (صحة، seed، دخول بـ RS256، نشر إعلان مع Request ID، بحث A/B، رفض رمز مزوّر وحجب مسار داخلي، صيغة الخطأ الموحدة) — نُفّذت بنجاح.
- الأرقام في README تحققت منها: 13 صورة، 19 حاوية دائمة + job ترحيلات، ~300 اختبار.

### T11 — التحقق النهائي والتقرير ✅
- تشغيل من الصفر: `make clean` ← `make up` (2m16s، كل الخدمات healthy) ← `make seed` ← `make e2e` **52/52**.
- `docs/FINAL_REPORT.md` كُتب؛ PROJECT_STATE (ما يعمل الآن) وROADMAP (عمل مستقبلي F1–F7) حُدّثا.
- **انتهت كل مهام الخارطة. لا مهام ⛔.**

## 2026-11-27 — الجلسة 2: خطة الإطلاق (`docs/EXECUTION_PLAN.md`)

### فحص الجاهزية للإطلاق (قبل الخطة)
- كل الاختبارات على الفرع `ccr-bd089a46-bdh8fo`: gateway 49، auth 31، listings 33، search 26، messaging 10، transactions 36، identity 9، users 8، moderation 11، fraud 15 (+6 متخطاة تحتاج DB)، personalization 8 (+6) — **236 ناجحاً**. `next build` ناجح. `npm audit --omit=dev`: 0 حرجة/عالية، 43 متوسطة.
- ملاحظة: اختبارات transactions-service لا تنتهي بدون `--forceExit` (اتصال مفتوح) → ثانوي، في NEXT_STEPS لاحقاً.
- موانع النشر المكتشفة: لا صفحات خصوصية/شروط، لا حذف حساب، لا Sign in with Apple مع وجود Google/Facebook على iOS، صور الهاتف لا تُدوَّر حسب EXIF، أسماء صور المحادثات بـ `Math.random`.

### L0.1 — ملفات الخطة والسجل ✅
- جديد: `CLAUDE.md` (يُحمَّل تلقائياً: اقرأ الخطة ثم السجل ثم التالي)، `docs/EXECUTION_PLAN.md` (الأدوار، الحلقة، قائمة الأمن، القرارات L-D1..L-D7، البيئات، المراحل L0–L6)، `docs/NEXT_STEPS.md` (ما ينتظر صاحب المشروع + المهام التالية بالتفصيل)، `docs/IMPROVEMENT_BACKLOG.md`، `docs/EXTERNAL_OFFERS_PLAN.md`.
- **مراجعة أمنية:** وثائق فقط؛ لا أسرار. أهم نتيجة تصميمية: Supabase يكشف مخطط `public` عبر PostgREST لمفتاح `anon` العلني → قاعدة إلزامية في §6.2 قبل أي ترحيل إلى Supabase.

### L0.2 — CI على `launch/**` ✅
- `ci.yml` و`security.yml`: أُضيف `launch/**` إلى فروع push.
- **أول run كشف 4 أعطال سابقة** (موجودة في `ccr-bd089a46-bdh8fo` نفسه؛ لم تظهر لأن CI لم يكن يعمل على ذلك الفرع):
  1. **E2E:** Buildx الحديث يرفض secret من `/dev/null` بدون `--allow=fs.read` → الافتراضي صار `infra/docker/no-extra-ca.pem` (فارغ). تحديث ADR-003.
  2. **npm audit (عالية):** `glob` < 14.0.2 (GHSA-3g3m-2fjr-6pw4، GHSA-5j98-mcp5-4vw2) نُشر بعد 24 نوفمبر؛ المسار الإنتاجي `typeorm → glob@10.5.0`.
     المحاولة 1: `--package-lock-only` → لم يُطبَّق الـ override. المحاولة 2: حذف المدخل من lockfile → glob@10.4.5 رُفع للجذر (أسوأ).
     المحاولة 3 (نجحت): override مقيّد `typeorm → glob ^14.0.6` (يحتفظ بـ `sync` ويدعم Node 20) و`@nestjs/cli → glob ^10.5.0`، وإعادة توليد lockfile من الصفر بـ `--legacy-peer-deps`؛ نفس الشيء في users وmoderation.
  3. **Trivy (عالية):** CVE-2025-64756 في glob@10.4.5 (dev) → يُغلقه override `@nestjs/cli` نفسه.
  4. **gitleaks:** رمزان JWT مزيفان (رمز مزوّر عمداً في `demo.sh`، وfixture في اختبار محذوف) → بصمتان في `.gitleaksignore` بعد المراجعة.
- **التحقق المحلي بعد إعادة توليد lockfile:** `npm ci` (بدون أعلام) ناجح؛ tsc (tsconfig.build) نظيف في 9 خدمات + الويب؛ الاختبارات: 49+31+33+26+10+36+9+8+11 + ويب 61 — كلها ناجحة؛ `next build` ناجح؛ lint 0 أخطاء (36 تحذيراً معروفاً)؛ `npm audit --omit=dev --audit-level=high` نظيف في الجذر وusers وmoderation.
- ملاحظة: `search-service` spec فيه خطأ نوع (`null` إلى `string | undefined`) لا يظهر في CI لأن tsconfig.build يستبعد الاختبارات → ثانوي، في NEXT_STEPS.
- **مراجعة أمنية:** الـ override يرفع glob إلى إصدار مُصلَح فقط في مسار typeorm؛ typeorm يستدعي `glob.sync` على مسارات الكيانات من الإعداد (لا مدخلات مستخدم). البصمتان المستثناتان ليستا أسراراً حقيقية (راجعتُ المحتوى).

### L1.5 — تدوير صور الهاتف حسب EXIF ✅
- `listings-service` (الصورة والمصغّرة) و`messaging-service`: `sharp().rotate()` قبل `resize`.
- **خطأ إضافي اكتُشف بالاختبار:** `fit: 'inside'` كان **يكبّر** الصور الصغيرة (64×48 → 1200×900): ضبابية وتخزين مهدور. أُضيف `withoutEnlargement: true` (والمحادثات كذلك).
- اختبار جديد بـ sharp حقيقي: صورة 64×48 بـ orientation=6 → الناتج 48×64، بلا orientation وبلا EXIF.
- **التحقق:** listings 34 (+1)، messaging 10؛ tsc نظيف؛ eslint نظيف للملفات المعدّلة.
- **مراجعة أمنية:** `withMetadata()` غير مستدعاة → sharp يحذف كل EXIF بما فيه GPS (أثبته الاختبار). لا مسار أو صلاحية جديدة.
- **تسويق:** الصور المقلوبة تجعل الإعلان يبدو رديئاً وتقلل الثقة والنقر؛ الآن كل صورة هاتف تظهر مستقيمة.
- **CI أخضر بالكامل** على الفرعين (كل الـ jobs بما فيها E2E للمكدس الكامل، CodeQL، Trivy، gitleaks، npm audit):
  `launch/plan` run 45992191103 و45992191086؛ `launch/L1.5-image-rotation` run 45992220966 و45992221026.

## 2026-11-27 — الجلسة 2 (تابع): الأسواق متعددة الدول

### قرار صاحب المشروع
تركيا والسعودية ومصر وسوريا (إن وُجدت خيارات محلية)، أوروبا، شرق آسيا، الخليج، المغرب العربي — لكل دولة خياراتها.
وطلب إضافي: «لو حصلت منتجات محلية لا تحتاج تسجيلاً وعمولة اعتمدها».

### البحث → `docs/MARKETS.md` ✅
- مصادر مؤكدة: Amazon Creators API (22 سوقاً منها sa/ae/com.tr/eg)، AliExpress Affiliate API، eBay Browse API، Jumia (مصر، المغرب…)، Coupang Partners API، Rakuten Web Service، Involve Asia (Shopee/Lazada).
- **بلا تسجيل وبلا عمولة:** لا يوجد مصدر مفتوح لأسعار الإلكترونيات/الأثاث إلا بالسحب (ممنوع). Open Prices غذائي، Open Products Facts كتالوج بلا أسعار. → **قرار L-D8: «متاجر معرض»** (محلات محلية تنشر منتجاتها الجديدة مباشرة) هي الطبقة الأولى في كل الدول.
- سوريا: رُفعت العقوبات الأمريكية الشاملة؛ ضوابط التصدير باقية جزئياً؛ لا برنامج عمولة يغطيها → متاجر معرض فقط.

### Supabase / Vercel
- الموصّلان مربوطان. إنشاء `marad-staging` **رُفض**: حد المشروعين المجانيين النشطين (`sanad`، `madinatuna`). إيقاف أحد مشاريعك قرارك → U1 في NEXT_STEPS.

### L1.8 — سجل الأسواق ✅ (CI أخضر: run 45998711893 / 45998711916)
- `packages/markets/markets.json` (23 دولة، 21 عملة، موجات 1–5) + `build.mjs` يتحقق (رموز ISO، رموز اتصال بلا تداخل بادئات، خانات عشرية 0/2/3) ويولّد نسخاً لـ auth وlistings والويب والجوال؛ `--check` في CI.
- **OTP (جزء من L1.7):** إرسال الرسائل فقط لدول الموجات المفعّلة (`MARKETS_ACTIVE_WAVE`، افتراضي 1 = +90 و+966؛ أو `OTP_ALLOWED_CALLING_CODES`)، والفحص قبل أي عدّاد؛ وحد 10 طلبات/ساعة لكل IP. 6 اختبارات جديدة (auth: 18 في OTP).
- **أسماء العملات:** الويب والجوال كانا يعرفان 7 عملات فقط — **الليرة التركية غير موجودة** رغم أن تركيا دولة البداية. صارا يولَّدان من السجل (21 عملة).
- **عيب اكتُشف:** `currency` في `CreateListingDto` كان يقبل أي نص (العمود `VARCHAR(3)` → خطأ 500 بدل 400). صار `IsIn` على عملات السجل + 2 اختبار.
- **عيب أكبر اكتُشف:** نماذج النشر لا ترسل عملة → كل إعلان USD. حل مؤقت: `DEFAULT_LISTING_CURRENCY` (افتراضي TRY في compose)؛ الحل الكامل L1.9.
- **مراجعة أمنية:** قائمة الدول تقلل سطح احتيال SMS (أكبر تكلفة متغيرة في OTP)؛ الرفض قبل لمس Redis فلا يُستهلك حد الرقم الحقيقي؛ IP من `@Ip()` مع `TRUST_PROXY_HOPS` الموجود (لا ثقة بـ X-Forwarded-For مباشرة). `OTP_ALLOWED_CALLING_CODES` يُنظَّف (أرقام 1–3 فقط).
- **تسويق:** رسائل خطأ واضحة لدولة غير مدعومة («غير متاحة لهذا البلد بعد») بدل فشل غامض؛ أسعار بالليرة والريال بأسمائها.

### L1.6 — صور المحادثات خاصة ✅ (CI: run 45999069522 / 45999069521)
- **قبل:** `/media/messages/*` مجلد عام (express.static، cache 7 أيام) — أي شخص يعرف الرابط يفتح صورة محادثة خاصة؛ الأسماء `Date.now()-Math.random` (~30 بت عشوائية، والوقت معروف تقريباً).
- **بعد:** اسم `randomUUID` (122 بت) + **رابط موقّع منتهي الصلاحية**: HMAC-SHA256 على (الاسم، وقت الانتهاء) بمفتاح مشتق من `INTERNAL_SECRET` بتسمية ثابتة (لا سر جديد للنشر، والمفتاح المشتق لا يصلح لاستدعاء المسارات الداخلية). التوقيع يُضاف فقط عند قراءة/إرسال الرسائل (المسارات تتحقق من العضوية أصلاً) وفي أحداث socket.
- الصلاحية 7 أيام مقرّبة لليوم (رابط ثابت يومياً → كاش العميل يعمل)، ورفض أي انتهاء أبعد من 8 أيام (لا روابط دائمة حتى لو تسرّب المفتاح). `Cache-Control: private`، `Referrer-Policy: no-referrer`، `X-Robots-Tag: noindex`.
- الروابط القديمة المخزنة في القاعدة تستمر بالعمل (التوقيع يُشتق من آخر مقطع عند القراءة). الاسم المطلوب يُفحص بـ regex صارم (لا `/` ولا `..` ولا امتداد آخر).
- اختبارات: 10 جديدة (توقيع، انتهاء، عبث بالاسم/الوقت/التوقيع، traversal، أسماء قديمة، 403 للرابط غير الموقّع) → messaging 20؛ e2e: فحص جديد أن الرابط بلا توقيع → 403.
- **مراجعة أمنية:** IDOR على الصور مُغلق؛ مقارنة التوقيع بزمن ثابت (`safeEqual`)؛ لا مسار ملفات من مدخلات غير مفحوصة؛ `dotfiles: deny`. المتبقي: من يملك الرابط الموقّع يستطيع مشاركته خلال صلاحيته (مقبول، كأي تطبيق محادثة؛ البديل المرتفع التكلفة: بروكسي يتحقق من الجلسة لكل صورة).
- **تسويق:** «صورك في المحادثات خاصة» نقطة ثقة تُذكر في صفحة الخصوصية.

### L1.1 + L1.2 — الصفحات القانونية ✅ (CI: run 45999804767 / 45999804592؛ النشر على Pages ينتظر U3)
- المحتوى في `apps/web/content/legal/{ar,tr,en}.json` (خصوصية، شروط، حذف الحساب) — **مكتوب من الكود الفعلي**: الحقول المخزنة، حذف EXIF، الروابط الموقّعة لصور المحادثات، بصمة الجهاز وIP لكشف الاحتيال، أحداث الاستخدام 6 أشهر (`keep_months=6`)، مهلة الحذف 30 يوماً (L-D5)، المعالِجون (Twilio، Firebase، Google، Didit، Stripe، السحابة)، إفصاح العمولة للعروض الخارجية، وسلطات الشكوى (KVKK، PDPL، مصر، GDPR).
- اسم الجهة وبريد التواصل من البيئة (`LEGAL_ENTITY_NAME`، `LEGAL_CONTACT_EMAIL`) — لا يُنشر اسم أو بريد مُختلَق؛ بريد غير صالح يُتجاهل. → U9.
- الويب: `/privacy` `/terms` `/account-deletion` (عربي، روابط قصيرة للمتاجر) + `/legal/{tr,en}/…`؛ كلها SSG (`dynamicParams=false`)؛ تذييل جديد بالروابط في كل الصفحات؛ سطر موافقة في التسجيل والدخول (الدخول بـ OTP ينشئ حساباً).
- **L1.2:** `scripts/build-legal-pages.mjs` يصدّر نسخة HTML ثابتة من نفس الملفات (كل نص مُهرَّب، CSP `default-src 'none'`) + `.github/workflows/legal-pages.yml` ينشرها على GitHub Pages عند تغيّر المحتوى على `main`؛ والتصدير يُبنى في CI أيضاً. → يحتاج U3 (تفعيل Pages).
- اختبارات ويب: 5 جديدة (تطابق أقسام اللغات الثلاث، لا عناصر نائبة ولا HTML، بريد غير صالح يُرفض، مدد الاحتفاظ تطابق الكود، المسارات) → 66.
- **مراجعة أمنية:** لا `dangerouslySetInnerHTML`؛ نص فقط؛ صفحة Pages بلا سكربتات وبـ CSP مغلق. الصفحات عامة (ليست في `route-access` PROTECTED).
- **تسويق:** متطلب إلزامي للنشر في Google Play وApp Store؛ نص واضح «لا نبيع بياناتك» و«صور محادثاتك خاصة» نقطة ثقة.
- **ناقص:** روابط الصفحات داخل تطبيق Flutter (الإعدادات) → مع L1.3 (شاشة حذف الحساب في نفس المكان).

### L1.3a — حذف الحساب (الإغلاق القابل للاسترجاع) ✅ (CI: run 46000837698 / 46000837691، بما فيه E2E مع ترحيل 0007 وفحص تطابق الكيانات)
- **ترحيل 0007:** `users.deleted_at` و`listings.owner_hidden_at` + فهرسان جزئيان. لا قيمة enum جديدة (لا تعديل على `user_status`).
- **auth-service:** `POST /auth/account/delete` (POST لأن بعض البروكسيات تُسقط جسم DELETE) يتطلب **إعادة تحقق**: كلمة المرور، أو رمز SMS (عبر `consumeCode` المستخرج من OTP بنفس القفل وعدّ المحاولات)، أو Google ID token حديث لحسابات Google فقط. التحديث الصامت للجلسة **لا** يكفي.
  الترتيب: إخفاء الإعلانات أولاً (إن فشلت الخدمة → 502 ولا شيء تغيّر)، ثم `deleted_at` + مسح رمز الإشعارات، ثم إبطال كل رموز التحديث. JwtStrategy والتجديد يرفضان الحساب المغلق فوراً.
  **الاسترجاع:** أي دخول ناجح (كلمة مرور/OTP/Google) خلال 30 يوماً يعيد الحساب ويُظهر الإعلانات؛ بعدها يُرفض كحساب غير موجود.
- **listings-service:** `PUT /listings/internal/owners/:userId/visibility` (داخلي، محجوب في البوابة لكل الطرق) يخفي/يُظهر كل إعلانات المالك دون لمس حالتها، ويحذفها من فهرس البحث/يعيد فهرسة النشطة فقط. كل الاستعلامات العامة (`findAll`، `findOne`، `findBatch`) تستبعد المخفي.
- **users-service:** الملف العام لحساب مغلق = «مستخدم محذوف» بلا صورة ولا نبذة ولا مدينة (لا 404: محادثات وصفقات الآخرين تشير إليه).
- **الويب:** قسم «حذف الحساب» في الملف الشخصي: كلمة مرور أو رمز SMS (إن وُجد هاتف) + إقرار صريح؛ بعد النجاح تُمسح الجلسة.
- **اكتُشف:** الحذف النهائي للصف سيحذف محادثات الطرف الآخر (`ON DELETE CASCADE` على جداول المحادثة) → المسح النهائي في L1.3b = **تنظيف البيانات الشخصية (tombstone)** لا حذف الصف.
- **اكتُشف (سابق):** حظر مستخدم من الإشراف لا يخفي إعلاناته → يمكن الآن استخدام نفس مسار `visibility` (في NEXT_STEPS).
- **الاختبارات:** auth 47 (+10 حذف/استرجاع)، listings 40 (+3)، users 9 (+1)، gateway 51 (+2 حجب)، ويب 69 (+3)؛ `check-contracts` ✅.
- **مراجعة أمنية:** إعادة التحقق تمنع حذف حساب من جلسة مسروقة أو جهاز مفتوح؛ رمز SMS يمر بنفس حد المحاولات والقفل؛ Google token يُتحقق من `aud` وأن `sub` = حساب المستخدم؛ رموز الوصول القديمة تُرفض فوراً عبر `deleted_at`؛ المسار الداخلي يتحقق من `INTERNAL_SECRET` ومحجوب في البوابة؛ لا تسريب لوجود الحساب (رسالة موحدة بعد انتهاء المهلة).
- **تسويق:** الحذف بنقرتين + إمكانية التراجع 30 يوماً تقلل الحذف النادم وتحترم المستخدم؛ شرط المتاجر مستوفى من التطبيق والموقع.

## 2026-11-27 — الجلسة 2 (تابع): التحوّل إلى «أرخص سعر»

### P0 — الخطة ✅
- **قرار صاحب المشروع:** إيقاف نشر/عرض منتجات المستخدمين؛ التطبيق يعرض أرخص المنتجات من منصات حقيقية (عالمية ومحلية: Amazon، Trendyol، ومتاجر محلية) ويحوّل للشراء؛ الدخل عمولة/اشتراك رمزي/دعم؛ أرشفة الكود غير المستخدم خارج البناء والتشغيل؛ بحث دقيق لكل دولة (سوريا، السعودية، تركيا أولاً).
- **البحث:** Amazon Creators API يشترط 10 مبيعات/30 يوماً؛ Trendyol API للبائعين فقط وبرنامج المؤثرين 10 آلاف متابع؛ Hepsiburada على Admitad مغلق؛ المنافسون (Akakçe، Cimri، Pricena) يعتمدون feeds المتاجر + رسوم النقرة؛ سوريا بلا منافس وتجارة إلكترونية ناشئة (~150 متجر WooCommerce).
- **المخرَج:** `docs/PIVOT_PLAN.md`: النموذج الرياضي (السعر الواصل، القيمة المعدلة بالمخاطرة، الثقة، كشف التخفيض الوهمي، معايير دقة)، منهج البحث لكل دولة (سجل مصادر + سلة 50 منتجاً)، معادلة الدخل والقرار (عمولة + CPC محلي + اشتراك اختياري؛ رفض الدفع قبل الدخول)، قائمة الأرشفة، المراحل P0–P7.
- `CLAUDE.md` يبدأ الآن بـ PIVOT_PLAN؛ L1.9 أُلغي.
