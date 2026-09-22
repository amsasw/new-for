import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../data/hotspots.json', import.meta.url);
const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 10000);
const userAgent = process.env.USER_AGENT || 'HotCacheHub/1.0 (+https://github.com/amsasw/new-for)';

function nowIso() {
  return new Date().toISOString();
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': userAgent, accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHackerNews() {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
  const stories = await Promise.all(
    ids.slice(0, 20).map(id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
  );

  return stories.filter(Boolean).filter(x => x.type === 'story' && x.title).map(item => ({
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
    rawScore: Number(article.public_reactions_count || article.positive_reactions_count || 0)
      + Number(article.comments_count || 0) * 2
  }));
}

function rankItems(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.source)) groups.set(item.source, []);
    groups.get(item.source).push(item);
  }

  const scored = [];
  for (const group of groups.values()) {
    const max = Math.max(1, ...group.map(x => x.rawScore || 0));
    for (const item of group) {
      const ageHours = Math.max(0, (Date.now() - Date.parse(item.publishedAt || nowIso())) / 3600000);
      const freshness = Math.max(0, 1 - ageHours / 72);
      const popularity = (item.rawScore || 0) / max;
      scored.push({ ...item, rankScore: popularity * 0.72 + freshness * 0.28 });
    }
  }

  return scored.sort((a, b) => b.rankScore - a.rankScore).slice(0, 40)
    .map(({ rawScore, rankScore, ...item }) => item);
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(output, 'utf8'));
  } catch {
    return null;
  }
}

const previous = await readPrevious();
const names = ['Hacker News', 'DEV Community'];
const results = await Promise.allSettled([fetchHackerNews(), fetchDev()]);
const sources = [];
const items = [];

results.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    items.push(...result.value);
    sources.push({ name: names[i], ok: true, count: result.value.length });
  } else {
    sources.push({ name: names[i], ok: false, error: String(result.reason?.message || result.reason) });
  }
});

let payload;
if (items.length === 0 && previous) {
  payload = {
    ...previous,
    meta: {
      ...previous.meta,
      servedStale: true,
      lastAttemptAt: nowIso(),
      sources
    }
  };
} else {
  payload = {
    meta: {
      updatedAt: nowIso(),
      servedStale: false,
      refreshIntervalHours: 24,
      sources
    },
    items: rankItems(items)
  };
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Wrote ${payload.items?.length || 0} items to data/hotspots.json`);
