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
