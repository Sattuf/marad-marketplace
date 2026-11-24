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
