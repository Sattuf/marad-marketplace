#!/usr/bin/env node
/**
 * Demo data — seeds a running stack through the public API, exactly like a real client.
 *
 *   make seed                (or: node scripts/seed-demo.mjs)
 *
 * Creates three accounts and a dozen listings with photos, then promotes the admin account
 * (the only step that cannot go through the API, by design: no endpoint grants admin).
 * Idempotent: running it again logs in to the existing accounts and adds nothing twice.
 *
 * Demo credentials (local stack only):
 *   seller@demo.marad.local / admin@demo.marad.local / buyer@demo.marad.local
 *   password: Demo!Passw0rd
 */
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

const API = (process.env.API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const PASSWORD = 'Demo!Passw0rd';
const COMPOSE = ['compose', '-f', new URL('../infra/docker-compose.yml', import.meta.url).pathname];

const ACCOUNTS = [
  { key: 'seller', email: 'seller@demo.marad.local', fullName: 'سامر البائع' },
  { key: 'buyer', email: 'buyer@demo.marad.local', fullName: 'بشرى المشترية' },
  { key: 'admin', email: 'admin@demo.marad.local', fullName: 'مشرف المنصة' },
];

// [category slug, title, description, price, RGB colour of the photo]
const LISTINGS = [
  ['cars', 'تويوتا كامري 2018 فل كامل', 'ممشى 85 ألف كم، صيانة وكالة، لون أبيض لؤلؤي، فحص كامل.', 14500, [245, 245, 240]],
  ['motorcycles', 'دراجة نارية هوندا 250cc', 'استعمال خفيف، خوذة هدية، أوراق نظامية.', 2300, [200, 30, 40]],
  ['apartments', 'شقة للإيجار 3 غرف قرب الجامعة', 'الطابق الثاني، مطبخ راكب، تدفئة مركزية، مناسبة للعائلات.', 450, [210, 190, 160]],
  ['computers', 'لابتوب ديل XPS 13 بحالة ممتازة', 'معالج i7، ذاكرة 16GB، SSD 512GB، بطارية ممتازة مع الشاحن.', 780, [60, 60, 70]],
  ['video-games', 'بلايستيشن 5 مع يدين و3 ألعاب', 'نسخة القرص، استعمال شهرين فقط، الكرتونة الأصلية موجودة.', 520, [235, 235, 245]],
  ['cameras', 'كاميرا كانون EOS 250D', 'عدسة 18-55، عداد 4000 لقطة، حقيبة وبطاقة ذاكرة 64GB.', 430, [30, 30, 30]],
  ['tv-audio', 'شاشة سامسونج 55 بوصة 4K', 'سمارت، ريموت أصلي، بدون أي خدوش.', 390, [20, 25, 35]],
  ['living-rooms', 'طقم كنب زاوية 7 مقاعد', 'قماش رمادي قابل للغسل، نظيف جداً، من منزل بدون أطفال.', 600, [150, 150, 155]],
  ['kitchen', 'ثلاجة إل جي إنفرتر 18 قدم', 'موفرة للطاقة، تبريد ممتاز، عمرها سنتان.', 340, [190, 195, 200]],
  ['watches-jewelry', 'ساعة كاسيو جي شوك أصلية', 'مقاومة للماء والصدمات، مع العلبة والضمان.', 95, [15, 15, 15]],
  ['men-clothing', 'جاكيت جلد رجالي مقاس L', 'جلد طبيعي، لُبس مرة واحدة.', 70, [90, 55, 30]],
  ['sports-hobbies', 'دراجة هوائية جبلية 27 سرعة', 'إطار ألمنيوم، فرامل قرصية، مناسبة للطرق الوعرة.', 210, [13, 148, 136]],
];

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get('retry-after')) || 60, 65);
      console.log(`  rate limited, waiting ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const text = await res.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    return { status: res.status, data };
  }
}

function fail(message, detail) {
  console.error(`✗ ${message}${detail ? `\n  ${JSON.stringify(detail)}` : ''}`);
  process.exit(1);
}

/** A 400×300 PNG: a solid colour with a lighter diagonal band (decodable by sharp). */
function photo([r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const bodyBuf = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(bodyBuf));
    return Buffer.concat([len, bodyBuf, sum]);
  };
  const [w, h] = [400, 300];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc(h * (1 + w * 3));
  const lift = (v) => Math.min(255, v + 40);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const band = Math.abs(x - y * 1.3 - 60) < 40;
      rows.set(band ? [lift(r), lift(g), lift(b)] : [r, g, b], y * (1 + w * 3) + 1 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function account({ email, fullName }) {
  const reg = await call('POST', '/auth/register', { body: { email, fullName, password: PASSWORD } });
  if (reg.status !== 201 && reg.status !== 409) fail(`register ${email}`, reg.data);
  const login = await call('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  if (login.status !== 200 && login.status !== 201) fail(`login ${email}`, login.data);
  console.log(`✓ ${email} ${reg.status === 409 ? '(exists)' : '(created)'}`);
  return { id: login.data.user.id, token: login.data.tokens.access_token };
}

function promoteAdmin(email) {
  // Deliberately not an API: no endpoint can grant the admin role.
  const sql = `UPDATE users SET role = 'admin' WHERE email = '${email.replace(/'/g, "''")}';`;
  execFileSync('docker', [...COMPOSE, 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$0"', sql], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  console.log(`✓ ${email} promoted to admin (sign in again to get an admin token)`);
}

const health = await fetch(API.replace(/\/api\/v1$/, '') + '/health').catch(() => null);
if (!health?.ok) fail(`gateway not reachable at ${API} — start the stack with "make up" first`);

const users = {};
for (const a of ACCOUNTS) users[a.key] = await account(a);

const categories = (await call('GET', '/categories')).data;
const bySlug = new Map();
for (const c of categories) {
  bySlug.set(c.slug, c.id);
  for (const child of c.children ?? []) bySlug.set(child.slug, child.id);
}

// A fresh query string skips the gateway's 30 s cache of public listing pages.
const existing = await call('GET', `/listings/user/${users.seller.id}?limit=50&fresh=${Date.now()}`);
const existingTitles = new Set((existing.data?.data ?? existing.data?.items ?? existing.data ?? []).map((l) => l.title));

let created = 0;
for (const [slug, title, description, price, colour] of LISTINGS) {
  if (existingTitles.has(title)) continue;
  const res = await call('POST', '/listings', {
    token: users.seller.token,
    body: { title, description, price, currency: 'USD', categoryId: bySlug.get(slug) },
  });
  if (res.status !== 201) fail(`create listing "${title}"`, res.data);
  const form = new FormData();
  form.append('file', new Blob([photo(colour)], { type: 'image/png' }), 'photo.png');
  const img = await call('POST', `/listings/${res.data.id}/images`, { token: users.seller.token, form });
  if (img.status !== 201) fail(`upload photo for "${title}"`, img.data);
  created++;
}
console.log(`✓ ${created} listings created (${LISTINGS.length - created} already present)`);

promoteAdmin('admin@demo.marad.local');

console.log(`
Demo ready — password for every account: ${PASSWORD}
  Web     http://localhost:3100   (seller@ / buyer@ / admin@demo.marad.local)
  Admin   http://localhost:3100/admin  (sign in as admin@demo.marad.local)`);
