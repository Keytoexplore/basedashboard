#!/usr/bin/env node
/**
 * Build data/psa-base.json for Base Set (EN) holo cards #1-16, PSA grades 6-9.
 *
 * Sources:
 * - Card list: PokemonPriceTracker API v2 /cards?setId=604 (Base Set)
 * - Graded sales aggregates: /cards?tcgPlayerId=...&includeEbay=true
 *   - ebay.salesByGrade.psa6..psa9
 *   - ebay.priceHistory.psa6..psa9 (date->avg/count)
 *
 * Safety:
 * - Cache card list + per-card details in data/cache/
 * - Gentle pacing + retry on 429
 */

const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';
const API_KEY = process.env.POKEMONPRICETRACKER_API_KEY || process.env.POKEPRICE_API_KEY;

if (!API_KEY) {
  console.error('Missing API key. Set POKEMONPRICETRACKER_API_KEY (preferred) or POKEPRICE_API_KEY.');
  process.exit(1);
}

const SET_ID = 604; // Base Set tcgPlayerNumericId
const SET_NAME = 'Base Set';
const LANGUAGE = 'english';

const GRADES = ['PSA6', 'PSA7', 'PSA8', 'PSA9', 'CGC6', 'CGC7', 'CGC8', 'CGC9'];

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'data', 'psa-base.json');
const cacheDir = path.join(root, 'data', 'cache');
const cacheListPath = path.join(cacheDir, `ppt-base-set-${SET_ID}-cards.json`);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, { rateLimitMs = 1400, maxRetries = 5 } = {}) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    await delay(rateLimitMs);

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (res.status === 429 && attempt <= maxRetries) {
      const retryAfter = Number(res.headers.get('retry-after') || 0);
      const backoffMs = Math.max(60000, retryAfter * 1000, 15000 * attempt);
      const body = await res.text().catch(() => '');
      console.warn(`⚠ 429 rate-limited. Waiting ${Math.round(backoffMs / 1000)}s then retrying (${attempt}/${maxRetries}). ${body.slice(0, 120)}`);
      await delay(backoffMs);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }
}

async function fetchAllSetCards() {
  ensureDir(cacheDir);

  if (!FORCE && fs.existsSync(cacheListPath)) {
    const cached = JSON.parse(fs.readFileSync(cacheListPath, 'utf8'));
    if (Array.isArray(cached?.data) && cached.data.length) {
      console.log(`📦 Using cached card list: ${path.relative(root, cacheListPath)}`);
      return cached;
    }
  }

  console.log(`📡 Fetching Base Set cards setId=${SET_ID} (${LANGUAGE})`);

  const limit = 50;
  let offset = 0;
  let all = [];
  let metadata = null;

  while (true) {
    const params = new URLSearchParams({
      setId: String(SET_ID),
      limit: String(limit),
      offset: String(offset),
      language: LANGUAGE,
    });

    const url = `${API_BASE_URL}/cards?${params.toString()}`;
    const page = await fetchJson(url);

    metadata = page.metadata || metadata;
    const chunk = Array.isArray(page.data) ? page.data : [];
    all.push(...chunk);

    const hasMore = Boolean(page.metadata?.hasMore);
    console.log(`  ✓ page offset=${offset} count=${chunk.length} hasMore=${hasMore}`);

    if (!hasMore || chunk.length === 0) break;
    offset += limit;
  }

  const out = { data: all, metadata };
  fs.writeFileSync(cacheListPath, JSON.stringify(out, null, 2));
  console.log(`💾 Wrote cache: ${path.relative(root, cacheListPath)} (${all.length} cards)`);
  return out;
}

function isHolo1to16(cardNumber) {
  // Base set holos are 001..016 (usually), keep only those.
  const m = String(cardNumber || '').match(/^(\d{3})\/\d{3}$/);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1 && n <= 16;
}

function pickLastSaleFromHistoryMap(map) {
  // map is like { '2026-02-01': { average, count, totalValue, ... }, ... }
  if (!map || typeof map !== 'object') return null;
  const dates = Object.keys(map).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (dates.length === 0) return null;
  const last = dates[dates.length - 1];
  const row = map[last] || null;
  if (!row) return null;
  return {
    date: last,
    average: row.average ?? null,
    count: row.count ?? null,
    totalValue: row.totalValue ?? null,
  };
}

async function fetchCardWithEbay(tcgPlayerId) {
  ensureDir(cacheDir);
  const cachePath = path.join(cacheDir, `ppt-card-${tcgPlayerId}-ebay.json`);

  if (!FORCE && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached?.data?.tcgPlayerId) {
      return cached;
    }
  }

  const params = new URLSearchParams({
    tcgPlayerId: String(tcgPlayerId),
    includeEbay: 'true',
    // NOTE: includeHistory isn't required for ebay.priceHistory; keep it off to reduce payload.
    language: LANGUAGE,
  });

  const url = `${API_BASE_URL}/cards?${params.toString()}`;
  const json = await fetchJson(url);

  // cache as-is
  fs.writeFileSync(cachePath, JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  console.log('='.repeat(70));
  console.log(`🏗️  Build PSA dashboard dataset: ${SET_NAME} (setId=${SET_ID})`);
  console.log('='.repeat(70));

  const list = await fetchAllSetCards();

  const cards = (list.data || [])
    .filter((c) => c?.rarity && String(c.rarity).toLowerCase().includes('holo'))
    .filter((c) => isHolo1to16(c.cardNumber))
    .sort((a, b) => String(a.cardNumber).localeCompare(String(b.cardNumber)));

  console.log(`🎯 Holos 1-16 found: ${cards.length}`);

  const outCards = [];

  for (const c of cards) {
    const tcgPlayerId = String(c.tcgPlayerId);
    console.log(`\n🃏 ${c.name} #${c.cardNumber} (tcgPlayerId=${tcgPlayerId})`);

    const detail = await fetchCardWithEbay(tcgPlayerId);
    const d = detail?.data || null;
    const ebay = d?.ebay || null;

    const grades = {};

    for (const g of GRADES) {
      const key = g.toLowerCase(); // psa9
      const stats = ebay?.salesByGrade?.[key] || null;
      const hist = ebay?.priceHistory?.[key] || null;
      const lastSale = pickLastSaleFromHistoryMap(hist);

      grades[g] = {
        stats: stats
          ? {
              count: stats.count ?? 0,
              averagePrice: stats.averagePrice ?? null,
              medianPrice: stats.medianPrice ?? null,
              minPrice: stats.minPrice ?? null,
              maxPrice: stats.maxPrice ?? null,
              marketPrice7Day: stats.marketPrice7Day ?? null,
              marketPriceMedian7Day: stats.marketPriceMedian7Day ?? null,
              dailyVolume7Day: stats.dailyVolume7Day ?? null,
              marketTrend: stats.marketTrend ?? null,
              lastMarketUpdate: stats.lastMarketUpdate ?? null,
              smartMarketPrice: stats.smartMarketPrice
                ? {
                    price: stats.smartMarketPrice.price ?? null,
                    confidence: stats.smartMarketPrice.confidence ?? null,
                    method: stats.smartMarketPrice.method ?? null,
                    daysUsed: stats.smartMarketPrice.daysUsed ?? null,
                  }
                : null,
            }
          : null,
        lastSale,
        priceHistoryDays: hist && typeof hist === 'object' ? Object.keys(hist).length : 0,
      };
    }

    outCards.push({
      tcgPlayerId,
      name: d?.name || c.name,
      cardNumber: d?.cardNumber || c.cardNumber,
      setName: d?.setName || c.setName,
      rarity: d?.rarity || c.rarity,
      tcgPlayerUrl: d?.tcgPlayerUrl || c.tcgPlayerUrl || null,
      grades,
    });
  }

  const dataset = {
    meta: {
      builtAt: new Date().toISOString(),
      setName: SET_NAME,
      setId: SET_ID,
      grades: GRADES,
    },
    cards: outCards,
  };

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`\n✅ Wrote ${path.relative(root, outPath)} (${outCards.length} cards)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
