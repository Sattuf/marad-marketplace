# حالة المشروع — Project State

> آخر تحديث: 2026-11-24 · يُحدَّث بعد كل مهمة. ابدأ بقراءة [PROGRESS_LOG.md](PROGRESS_LOG.md).

## 1. ما هو المشروع

**معرض الأشياء (Ma'rad Al-Ashya')** — سوق C2C (على غرار OLX) بالدفع عند اللقاء:
تطبيق جوال (Flutter) + موقع ويب (Next.js) + 11 خدمة خلفية (9 NestJS/TypeScript + 2 FastAPI/Python)
فوق PostgreSQL وRedis وElasticsearch.

## 2. جرد الخدمات

| الخدمة | اللغة / الإطار | المسؤولية | البيانات | المنفذ | التواصل |
|---|---|---|---|---|---|
| api-gateway | TS / NestJS 10 | نقطة الدخول الوحيدة `/api/v1/*`: توجيه، Rate limit، كاش GET قصير، حظر المسارات الداخلية، `/metrics` | Redis (كاش) | 3000 | HTTP proxy → كل الخدمات |
| auth-service | TS / NestJS + TypeORM | تسجيل/دخول، OTP، JWT (access+refresh مع تدوير)، OAuth Google/Facebook | Postgres `users`, Redis | 3001 | ← gateway؛ → fraud |
| listings-service | TS / NestJS + TypeORM | الإعلانات، التصنيفات، الصور (S3 أو قرص محلي)، الترويج (Stripe اختياري)، عدّاد المشاهدات | Postgres، Redis | 3002 | → search (فهرسة)، transactions، personalization |
| search-service | TS / NestJS | بحث نصي/خرائط/اقتراحات عبر Elasticsearch، ترتيب ذكي + تجربة A/B | Elasticsearch، Redis، Postgres (`ab_test_results`) | 3003 | ← listings |
| messaging-service | TS / NestJS + Socket.IO | محادثات فورية، صور، حظر، FCM | Postgres، Redis | 3004 | WebSocket + REST |
| transactions-service | TS / NestJS | الصفقات (FSM)، التقييمات الثنائية | Postgres، Redis (idempotency) | 3005 | → listings، fraud |
| identity-service | TS / NestJS | KYC عبر Didit، تشفير الوثائق بـ KMS (LocalStack محلياً) | Postgres | 3006 | → users؛ webhook HMAC |
| users-service | TS / NestJS (lockfile مستقل) | الملف الشخصي، الإشعارات، الإيقاف/التوثيق (داخلي) | Postgres | 3007 | ← moderation/identity/fraud |
| moderation-service | TS / NestJS + Bull (lockfile مستقل) | البلاغات، التصعيد الآلي، لوحة الإشراف | Postgres، Redis (Bull) | 3008 | → listings، users |
| fraud-service | Python 3.11 / FastAPI + scikit-learn | بصمة الأجهزة، سجل المعاملات، درجة خطورة (IsolationForest) | Postgres | 8001 | ← auth، transactions |
| personalization-service | Python 3.11 / FastAPI | أحداث المستخدم (جداول مقسّمة partitions)، توصيات | Postgres، Redis، ES | 8002 | ← listings |
| apps/web | TS / Next.js 16 + Tailwind 4 | واجهة المشتري/البائع + لوحة إدارة | — | 3100 | → gateway |
| apps/mobile | Dart / Flutter 3.38 | تطبيق أندرويد/iOS | — | — | → gateway + socket |

**قاعدة البيانات:** قاعدة Postgres واحدة مشتركة (`marad_db`) مع ملكية جداول موثّقة في
[POSTGRES.md](POSTGRES.md)، وترحيلات موحّدة في `db/migrations` يشغّلها `db/migrate.mjs`.

**المصادقة:** رموز وصول RS256 يوقّعها auth-service وحده بمفتاحه الخاص؛ كل خدمة تتحقق بالمفتاح العام (`JWT_PUBLIC_JWKS`، بـ `kid`) مع `iss`/`aud`. JWKS منشور على `/api/v1/auth/.well-known/jwks.json`. (كانت HS256 بسر مشترك حتى T4.2.)
الاتصال بين الخدمات عبر ترويسة `X-Internal-Secret` بمقارنة زمن ثابت.

## 3. المعمارية

```mermaid
graph LR
  subgraph Clients
    Web[Next.js web :3100]
    Mobile[Flutter app]
  end
  Web --> GW[api-gateway :3000]
  Mobile --> GW
  Mobile -. socket.io .-> MSG
  GW --> AUTH[auth :3001]
  GW --> LST[listings :3002]
  GW --> SRCH[search :3003]
  GW --> MSG[messaging :3004]
  GW --> TRX[transactions :3005]
  GW --> IDN[identity :3006]
  GW --> USR[users :3007]
  GW --> MOD[moderation :3008]
  GW --> FRD[fraud :8001]
  GW --> PRS[personalization :8002]
  LST -->|index| SRCH
  LST --> TRX
  TRX --> LST
  TRX --> FRD
  AUTH --> FRD
  MOD --> LST
  MOD --> USR
  IDN --> USR
  FRD --> USR
  subgraph Data
    PG[(PostgreSQL 16)]
    RD[(Redis 7)]
    ES[(Elasticsearch 8)]
  end
  AUTH & LST & MSG & TRX & IDN & USR & MOD & FRD & PRS --> PG
  GW & AUTH & LST & SRCH & MSG & TRX & MOD & PRS --> RD
  SRCH & PRS --> ES
```

## 4. آخر نقطة وصل إليها المشروع (قبل هذه الجلسة)

**الدليل من git:** 43 commit. التطوير الأصلي (Sprint 0→12، يونيو 2026) بنى كل الخدمات بسرعة،
ثم جاءت مراجعة شاملة (سبتمبر 2026، `3ca0288` → `b3dac0b`، PR #1 و#2) نفّذت:
- **المرحلة 0** من `docs/REBUILD_PLAN.md`: إغلاق 8 ثغرات حرجة و11 عالية (OTP ثابت، أسرار JWT افتراضية، messaging بلا مصادقة...).
- **المرحلة 1** جزئياً: ترحيلات موحّدة، فحص العقود بين العملاء والخادم، CI.
- أجزاء من **المرحلة 3**: نظام تصميم، نصوص UX، لوحة إدارة، Grafana.
- آخر commit (`4343b59`، 2026-10-17): تنظيف `dump.rdb` و`patch.js`.

**ما بقي مفتوحاً حسب الخطة نفسها:** H10 (الرموز في `localStorage`)، P8–P11 (Outbox، pg_trgm، Redis adapter للـ socket، عدّادات ذرية)، المرحلة 4 كاملة، وملفات `k8s/` فارغة.

## 5. نتيجة التشغيل "كما هو" (الجرد، 2026-11-24)

| الفحص | النتيجة |
|---|---|
| Typecheck لكل خدمات Node (9) + الويب | ✅ نظيف |
| اختبارات الوحدة Node | ✅ 190 اختباراً (gateway 40، auth 27، listings 33، search 20، messaging 10، transactions 33، identity 9، users 8، moderation 10) |
| اختبارات الويب (Jest) | ✅ 61 |
| Python (fraud / personalization) | ✅ 11 / 8 (+ اختبارات تكامل تتخطى بدون DB) |
| `docker compose --profile all up --build` | ❌ يفشل — انظر أدناه |
| Lint | ⚠️ إعدادات eslint موجودة في 3 خدمات فقط، وCI لا يشغّل lint للخدمات |
| Flutter | ⏭️ لا يوجد Flutter SDK في بيئة العمل؛ يعتمد على CI |

**أخطاء التشغيل في Docker:**
1. صورة `docker.elastic.co/elasticsearch` محجوبة في بيئة العمل → استبدالها بالصورة الرسمية على Docker Hub `elasticsearch:8.15.0`.
2. البناء داخل الحاويات (`npm install`/`pip install`) يفشل خلف بروكسي يعترض TLS → لا توجد آلية لشهادة CA إضافية.
3. الحاويات تعمل بهدف `builder` و`npm run start:dev` (وضع المراقبة/التطوير) لا بصور إنتاج؛ `npm install` بدلاً من `npm ci`؛ تعمل كـ root؛ لا `HEALTHCHECK` للخدمات ولا `depends_on: service_healthy` بينها.
4. `localstack` يربط `/var/run/docker.sock` (صلاحية root على المضيف).
5. صور بوسم `latest` (prometheus، grafana، localstack) → بناء غير قابل للتكرار.

## 6. ما يعمل الآن (2026-11-25 — بعد تنفيذ الخارطة)

| المجال | الحالة |
|---|---|
| التشغيل | `make up` من الصفر → 19 حاوية + job ترحيلات، كل الخدمات `healthy` خلال ~2.3 دقيقة؛ `make seed`، `make demo`، `make e2e` (52/52) |
| الأمن | 0 حرجة/عالية مفتوحة (npm audit prod، pip-audit، Trivy، gitleaks)؛ RS256 + JWKS؛ كوكي HttpOnly للويب؛ تحقق DTO في كل الخدمات؛ حاويات غير root وللقراءة فقط |
| التوحيد | بوابة واحدة، Swagger موحد لـ 10 خدمات، صيغة أخطاء واحدة + `X-Request-ID` |
| الاختبارات | ~300 اختبار وحدة/تكامل + E2E على المكدس الكامل في CI؛ lint بلا تحذيرات في الخدمات |
| المراقبة | سجلات JSON (requestId + trace_id)، OpenTelemetry → Jaeger (11/11 خدمة)، Prometheus + Grafana |
| CI/CD | build/lint/test/integration/E2E + CodeQL + Trivy + gitleaks + npm audit + Dependabot + helm lint |
| النشر | Helm chart جاهز (`docs/DEPLOYMENT.md`) — لم يُنشر |

```mermaid
graph TB
  U[Browser / Flutter] --> I[Ingress / localhost]
  I --> W[web :3100]
  I --> G[api-gateway :3000]
  I -. socket.io .-> M[messaging :3004]
  G --> S[10 services]
  S --> D[(Postgres · Redis · Elasticsearch)]
  G & S -. OTLP .-> J[Jaeger]
  P[Prometheus] -. scrape .-> G & S
  P --> GR[Grafana]
```

المتبقي والمفتوح: انظر "ما بقي" في [FINAL_REPORT.md](FINAL_REPORT.md).
