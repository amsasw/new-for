import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../data/hotspots.json', import.meta.url);
const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 12000);
const userAgent = process.env.USER_AGENT || 'HotCacheHub/3.0 (+https://github.com/amsasw/new-for)';

const COUNTRIES = [
  {
    code: 'CN',
    name: 'China',
    hl: 'zh-CN',
    gl: 'CN',
    ceid: 'CN:zh-Hans',
    query: '编程 OR 开源 OR 软件开发 OR GitHub OR 人工智能 OR AI OR 云计算 OR 开发者'
  },
  {
    code: 'US',
    name: 'United States',
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en',
    query: 'programming OR open source OR software engineering OR GitHub OR AI OR cloud computing OR developer tools'
  },
  {
    code: 'JP',
    name: 'Japan',
    hl: 'ja',
    gl: 'JP',
    ceid: 'JP:ja',
    query: 'プログラミング OR オープンソース OR ソフトウェア開発 OR GitHub OR AI OR クラウド OR 開発者'
  },
  {
    code: 'KR',
    name: 'South Korea',
    hl: 'ko',
    gl: 'KR',
    ceid: 'KR:ko',
    query: '프로그래밍 OR 오픈소스 OR 소프트웨어 개발 OR GitHub OR AI OR 클라우드 OR 개발자'
  }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function techFeed(country) {
  const params = new URLSearchParams({
    q: `${country.query} when:7d`,
    hl: country.hl,
    gl: country.gl,
    ceid: country.ceid
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

async function fetchText(url, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': userAgent,
          accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function rawTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

function tag(block, name) {
  return decodeXml(rawTag(block, name)).trim();
}

function sourceUrl(block) {
  const match = block.match(/<source\s+[^>]*url=["']([^"']+)["'][^>]*>/i);
  return match ? decodeXml(match[1]) : '';
}

function stripHtml(value = '') {
  return decodeXml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function imageFromDescription(value = '') {
  const match = value.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? decodeXml(match[1]) : null;
}

function normalizeTitle(title, source) {
  if (!source) return title;
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

function parseFeed(xml, country) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 36).map((block, index) => {
    const source = tag(block, 'source') || 'Google News';
    const title = normalizeTitle(tag(block, 'title'), source);
    const link = tag(block, 'link');
    const guid = tag(block, 'guid') || link || `${country.code}-${index}`;
    const pubDate = tag(block, 'pubDate');
    const descriptionRaw = rawTag(block, 'description');
    const summaryText = stripHtml(descriptionRaw);
    const summary = summaryText && summaryText !== title ? summaryText.slice(0, 280) : '';
    const parsed = Date.parse(pubDate);

    return {
      id: `${country.code}-${Buffer.from(guid).toString('base64url').slice(0, 24)}`,
      country: country.code,
      topic: 'tech-code',
      source,
      sourceUrl: sourceUrl(block) || null,
      title,
      summary,
      url: link,
      author: source,
      publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : nowIso(),
      image: imageFromDescription(descriptionRaw),
      tags: ['tech', 'programming', 'open-source', 'ai', 'developer'],
      rank: index + 1
    };
  }).filter(item => item.title && item.url);
}

async function fetchCountry(country) {
  const xml = await fetchText(techFeed(country));
  const items = parseFeed(xml, country);
  if (!items.length) throw new Error('Tech feed returned no usable items');
  return items;
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(output, 'utf8'));
  } catch {
    return null;
  }
}

function previousForCountry(previous, code) {
  return Array.isArray(previous?.items)
    ? previous.items.filter(item => item.country === code && item.topic === 'tech-code')
    : [];
}

const previous = await readPrevious();
const attemptAt = nowIso();
const settled = await Promise.allSettled(COUNTRIES.map(fetchCountry));

const items = [];
const countries = [];
let freshCountryCount = 0;
let usedStaleCountry = false;

settled.forEach((result, index) => {
  const country = COUNTRIES[index];

  if (result.status === 'fulfilled' && result.value.length > 0) {
    freshCountryCount += 1;
    items.push(...result.value);
    countries.push({
      code: country.code,
      name: country.name,
      topic: 'tech-code',
      ok: true,
      stale: false,
      count: result.value.length,
      updatedAt: attemptAt
    });
    return;
  }

  const fallback = previousForCountry(previous, country.code);
  if (fallback.length) {
    usedStaleCountry = true;
    items.push(...fallback);
  }

  countries.push({
    code: country.code,
    name: country.name,
    topic: 'tech-code',
    ok: false,
    stale: fallback.length > 0,
    count: fallback.length,
    updatedAt:
      previous?.meta?.countries?.find(item => item.code === country.code)?.updatedAt ||
      previous?.meta?.updatedAt ||
      null,
    error: result.status === 'rejected'
      ? String(result.reason?.message || result.reason)
      : 'Tech feed returned no usable items'
  });
});

const payload = {
  meta: {
    schemaVersion: 3,
    topic: 'tech-code',
    updatedAt: freshCountryCount > 0 ? attemptAt : previous?.meta?.updatedAt || attemptAt,
    lastAttemptAt: attemptAt,
    servedStale: usedStaleCountry || freshCountryCount < COUNTRIES.length,
    refreshIntervalHours: 24,
    countryCount: COUNTRIES.length,
    freshCountryCount,
    countries
  },
  items
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(
  `Wrote ${payload.items.length} developer/tech items for ${freshCountryCount}/${COUNTRIES.length} fresh countries`
);
