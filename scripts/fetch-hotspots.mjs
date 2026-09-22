import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../data/hotspots.json', import.meta.url);
const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 10000);
const userAgent = process.env.USER_AGENT || 'HotCacheHub/1.1 (+https://github.com/amsasw/new-for)';

const SOURCES = [
  { name: 'Hacker News', load: fetchHackerNews },
  { name: 'DEV Community', load: fetchDev }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

async function fetchJson(url, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'user-agent': userAgent, accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchHackerNews() {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
  const results = await Promise.allSettled(
    ids.slice(0, 24).map(id =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 0)
    )
  );

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(item => item?.type === 'story' && item.title)
    .slice(0, 20)
    .map(item => ({
      id: `hn-${item.id}`,
      source: 'Hacker News',
      title: item.title,
      summary: `${item.score || 0} points · ${item.descendants || 0} comments`,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      discussionUrl: `https://news.ycombinator.com/item?id=${item.id}`,
      author: item.by || 'unknown',
      publishedAt: new Date((item.time || 0) * 1000).toISOString(),
      image: null,
      rawScore: Number(item.score || 0)
    }));
}

async function fetchDev() {
  const articles = await fetchJson('https://dev.to/api/articles?top=1&per_page=20');
  return articles.map(article => ({
    id: `dev-${article.id}`,
    source: 'DEV Community',
    title: article.title,
    summary: article.description || `${article.comments_count || 0} comments`,
    url: article.url,
    discussionUrl: article.url,
    author: article.user?.name || article.user?.username || 'unknown',
    publishedAt: article.published_timestamp || article.published_at || nowIso(),
    image: article.cover_image || article.social_image || null,
    rawScore:
      Number(article.public_reactions_count || article.positive_reactions_count || 0) +
      Number(article.comments_count || 0) * 2
  }));
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.url || `${item.source}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankItems(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.source)) groups.set(item.source, []);
    groups.get(item.source).push(item);
  }

  const scored = [];
  for (const group of groups.values()) {
    const max = Math.max(1, ...group.map(item => Number(item.rawScore || 0)));
    for (const item of group) {
      const published = Date.parse(item.publishedAt || '');
      const ageHours = Number.isFinite(published)
        ? Math.max(0, (Date.now() - published) / 3600000)
        : 72;
      const freshness = Math.max(0, 1 - ageHours / 72);
      const popularity = Number(item.rawScore || 0) / max;
      scored.push({ ...item, rankScore: popularity * 0.72 + freshness * 0.28 });
    }
  }

  return scored
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 40)
    .map(({ rawScore, rankScore, ...item }) => item);
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(output, 'utf8'));
  } catch {
    return null;
  }
}

function previousForSource(previous, source) {
  const items = Array.isArray(previous?.items)
    ? previous.items.filter(item => item.source === source)
    : [];

  return items.map((item, index) => ({
    ...item,
    rawScore: Math.max(1, items.length - index)
  }));
}

const previous = await readPrevious();
const attemptAt = nowIso();
const settled = await Promise.allSettled(SOURCES.map(source => source.load()));

const items = [];
const sources = [];
let freshSourceCount = 0;
let usedStaleSource = false;

settled.forEach((result, index) => {
  const source = SOURCES[index];

  if (result.status === 'fulfilled' && result.value.length > 0) {
    freshSourceCount += 1;
    items.push(...result.value);
    sources.push({
      name: source.name,
      ok: true,
      stale: false,
      count: result.value.length
    });
    return;
  }

  const fallback = previousForSource(previous, source.name);
  if (fallback.length) {
    usedStaleSource = true;
    items.push(...fallback);
  }

  sources.push({
    name: source.name,
    ok: false,
    stale: fallback.length > 0,
    count: fallback.length,
    error: result.status === 'rejected'
      ? String(result.reason?.message || result.reason)
      : 'Source returned no usable items'
  });
});

const ranked = rankItems(dedupe(items));
const allSourcesFailed = freshSourceCount === 0;
const updatedAt = allSourcesFailed && previous?.meta?.updatedAt
  ? previous.meta.updatedAt
  : attemptAt;

const payload = {
  meta: {
    updatedAt,
    lastAttemptAt: attemptAt,
    servedStale: usedStaleSource || allSourcesFailed,
    refreshIntervalHours: 24,
    sourceCount: SOURCES.length,
    freshSourceCount,
    sources
  },
  items: ranked
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(
  `Wrote ${payload.items.length} items (${freshSourceCount}/${SOURCES.length} fresh sources) to data/hotspots.json`
);
