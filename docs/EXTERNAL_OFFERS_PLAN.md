# خطة ميزة «الأرخص من المنصات الأخرى»

> النسخة الكاملة (بالرسوم): https://claude.ai/artifact/6pjDjwZbF3EAZ6SBarAX1y — هذا ملخص المرجع داخل الريبو.

## الفكرة
عرض أرخص سعر للمنتج **الجديد** من منصتين كبيرتين في كل دولة بجانب إعلانات المستعمل. لا بيع داخل معرض:
النقر يمر على `/external/out/:offerId` (تسجيل) ثم 302 إلى صفحة المنتج الأصلية برابط عمولة.

## مصادر البيانات — رسمية فقط، لا scraping
| المصدر | الوصول | الحالة |
|---|---|---|
| Amazon Creators API (بديل PA-API 5 الموقوفة) | REST + OAuth 2.0؛ يدعم amazon.sa وamazon.ae وamazon.com.tr وamazon.eg | مؤكد |
| Noon | برنامج عمولة مباشر أو عبر DCMnetwork / Optimise | يحتاج تسجيل |
| Hepsiburada «Link Gelir» / Trendyol (Takefluence) / Admitad | روابط أو feeds | يحتاج تسجيل والتحقق من السماح داخل تطبيق |

## البنية
خدمة `external-offers-service` (Python 3.11 / FastAPI، منفذ 8003): Offers API، Click redirect، Matcher worker،
Sync scheduler (موصّل لكل مصدر، كل 4 ساعات). جداول `ext_*` في Postgres، فهرس ES منفصل `external_offers_v1`،
Redis للأقفال وطابور النقرات وحدث `listing.events` من listings-service.

## الجداول
`ext_sources` · `ext_offers` · `ext_price_history` (مقسّم) · `ext_category_map` · `ext_listing_matches` ·
`ext_clicks` (مقسّم) · `ext_conversions` · `ext_sync_runs`. الأسعار `bigint` بالوحدة الصغرى.

## المسارات
`GET /external/offers` · `GET /external/offers/:id` · `GET /external/listings/:id/new-price` ·
`POST /external/price-hint` · `GET /external/out/:offerId` · `POST /external/webhooks/:network` ·
`/external/admin/*` · `POST /internal/sync/:source`.

## الأمن
`/out` يقبل `offerId` فقط (لا open redirect)، قائمة نطاقات لكل مصدر، webhooks بتوقيع وزمن ثابت، IP مخزن كـ hash،
حد معدل وربط مع fraud-service ضد النقرات المزيفة.

## المراحل (~10 أسابيع لمطوّر واحد)
0 التسجيل (أسبوع 1–2) → 1 أساس الخدمة (3–4) → 2 الواجهة والتحويل (5–6) → 3 المطابقة وميزة البائع (7–8) → 4 إطلاق تدريجي (9–10).
البوابات: قبول مصدر · مزامنة 7 أيام و1000+ عرض · E2E + امتثال · دقة مطابقة ≥ 90% على 200 إعلان.
