const $ = selector => document.querySelector(selector);
const feed = $('#feed');
const refreshBtn = $('#refreshBtn');
const statusText = $('#statusText');
const updatedAt = $('#updatedAt');
const resultCount = $('#resultCount');
const statusDot = $('#statusDot');
const pageTitle = $('#pageTitle');
const pageDescription = $('#pageDescription');
const metaDescription = $('#metaDescription');
const allSourceBtn = $('#allSourceBtn');
const searchInput = $('#searchInput');
const searchLabel = $('#searchLabel');
const chips = [...document.querySelectorAll('.chip')];
const langButtons = [...document.querySelectorAll('.lang-btn')];

const translations = {
  zh: {
    htmlLang: 'zh-CN', locale: 'zh-CN',
    title: '最新热点',
    description: '每 24 小时生成一次缓存；抓取失败时继续展示上次成功缓存。',
    metaDescription: '每天更新一次缓存的热点聚合页',
    refresh: '重新读取缓存', loading: '读取中…', reading: '正在读取缓存…',
    all: '全部', source: '查看来源 ↗', discussion: '讨论',
    empty: '没有找到匹配的内容。', dailyCache: '正在展示每日缓存',
    staleCache: '部分来源获取失败，正在使用上次成功缓存',
    updatedAt: '缓存更新时间', noCache: '尚未生成缓存', loadFailed: '缓存加载失败',
    search: '搜索标题、作者或来源…', searchLabel: '搜索热点',
    results: n => `${n} 条内容`
  },
  en: {
    htmlLang: 'en', locale: 'en-US',
    title: 'Latest Hot Topics',
    description: 'Cache refreshes every 24 hours; if fetching fails, the last successful cache stays visible.',
    metaDescription: 'A hot-topic aggregator refreshed from cache once per day',
    refresh: 'Reload cache', loading: 'Loading…', reading: 'Reading cache…',
    all: 'All', source: 'View source ↗', discussion: 'Discussion',
    empty: 'No matching items found.', dailyCache: 'Showing daily cache',
    staleCache: 'Some sources failed; using the last successful cache',
    updatedAt: 'Cache updated', noCache: 'No cache has been generated yet', loadFailed: 'Failed to load cache',
    search: 'Search title, author or source…', searchLabel: 'Search hot topics',
    results: n => `${n} item${n === 1 ? '' : 's'}`
  },
  ja: {
    htmlLang: 'ja', locale: 'ja-JP',
    title: '最新トピック',
    description: 'キャッシュは24時間ごとに更新され、取得に失敗した場合は前回成功したキャッシュを表示します。',
    metaDescription: '1日1回キャッシュ更新する最新トピック集約ページ',
    refresh: 'キャッシュを再読込', loading: '読込中…', reading: 'キャッシュを読込中…',
    all: 'すべて', source: '出典を見る ↗', discussion: '議論',
    empty: '一致するコンテンツがありません。', dailyCache: '日次キャッシュを表示中',
    staleCache: '一部の取得に失敗したため、前回のキャッシュを使用中',
    updatedAt: 'キャッシュ更新日時', noCache: 'まだキャッシュが生成されていません', loadFailed: 'キャッシュの読込に失敗しました',
    search: 'タイトル・作者・出典を検索…', searchLabel: 'トピックを検索',
    results: n => `${n}件`
  },
  ko: {
    htmlLang: 'ko', locale: 'ko-KR',
    title: '최신 인기 주제',
    description: '캐시는 24시간마다 갱신되며, 가져오기에 실패하면 마지막으로 성공한 캐시를 계속 표시합니다.',
    metaDescription: '하루에 한 번 캐시를 갱신하는 인기 주제 모음 페이지',
    refresh: '캐시 다시 읽기', loading: '불러오는 중…', reading: '캐시를 읽는 중…',
    all: '전체', source: '출처 보기 ↗', discussion: '토론',
    empty: '일치하는 콘텐츠가 없습니다.', dailyCache: '일일 캐시 표시 중',
    staleCache: '일부 출처를 가져오지 못해 마지막 성공 캐시를 사용 중',
    updatedAt: '캐시 업데이트', noCache: '아직 생성된 캐시가 없습니다', loadFailed: '캐시를 불러오지 못했습니다',
    search: '제목, 작성자 또는 출처 검색…', searchLabel: '인기 주제 검색',
    results: n => `${n}개`
  }
};

function detectLanguage() {
  const saved = localStorage.getItem('hot-cache-language');
  if (saved && translations[saved]) return saved;
  const browser = (navigator.language || '').toLowerCase();
  if (browser.startsWith('ja')) return 'ja';
  if (browser.startsWith('ko')) return 'ko';
  if (browser.startsWith('en')) return 'en';
  return 'zh';
}

let currentLanguage = detectLanguage();
let data = null;
let selectedSource = 'all';
let searchQuery = '';

const t = () => translations[currentLanguage];

function escapeHtml(text = '') {
  return String(text).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[c]);
}

function safeUrl(value = '') {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function relativeTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';
  const seconds = Math.round((parsed - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  let unit = 'second';
  let amount = seconds;
  if (abs >= 86400) { unit = 'day'; amount = Math.round(seconds / 86400); }
  else if (abs >= 3600) { unit = 'hour'; amount = Math.round(seconds / 3600); }
  else if (abs >= 60) { unit = 'minute'; amount = Math.round(seconds / 60); }
  return new Intl.RelativeTimeFormat(t().locale, { numeric: 'auto' }).format(amount, unit);
}

function getVisibleItems() {
  const allItems = Array.isArray(data?.items) ? data.items : [];
  const query = searchQuery.trim().toLocaleLowerCase(t().locale);
  return allItems.filter(item => {
    if (selectedSource !== 'all' && item.source !== selectedSource) return false;
    if (!query) return true;
    const haystack = [item.title, item.summary, item.author, item.source]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(t().locale);
    return haystack.includes(query);
  });
}

function attachImageFallbacks() {
  feed.querySelectorAll('img.thumb').forEach(img => {
    img.addEventListener('error', () => {
      img.closest('.card')?.classList.add('no-image');
      img.remove();
    }, { once: true });
  });
}

function render() {
  if (!data) return;
  const items = getVisibleItems();
  resultCount.textContent = t().results(items.length);

  feed.innerHTML = items.map((item, index) => {
    const url = safeUrl(item.url);
    const discussionUrl = safeUrl(item.discussionUrl || '');
    const image = item.image ? safeUrl(item.image) : '';
    return `
      <article class="card ${image ? '' : 'no-image'}">
        <div class="rank">${String(index + 1).padStart(2, '0')}</div>
        <div class="content">
          <div class="meta">
            <span class="source">${escapeHtml(item.source)}</span>
            <span>${escapeHtml(item.author)}</span>
            <time datetime="${escapeHtml(item.publishedAt || '')}">${relativeTime(item.publishedAt)}</time>
          </div>
          <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h2>
          ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}
          <div class="actions">
            <a href="${url}" target="_blank" rel="noopener noreferrer">${t().source}</a>
            ${discussionUrl !== '#' && discussionUrl !== url
              ? `<a href="${discussionUrl}" target="_blank" rel="noopener noreferrer">${t().discussion}</a>`
              : ''}
          </div>
        </div>
        ${image && image !== '#'
          ? `<img class="thumb" loading="lazy" decoding="async" src="${image}" alt="" referrerpolicy="no-referrer" />`
          : ''}
      </article>
    `;
  }).join('') || `<div class="empty"><strong>∅</strong><span>${t().empty}</span></div>`;

  feed.setAttribute('aria-busy', 'false');
  attachImageFallbacks();
}

function updateStatus(meta = {}) {
  const stale = Boolean(meta.servedStale);
  statusDot.classList.toggle('stale', stale);
  statusText.textContent = stale ? t().staleCache : t().dailyCache;
  updatedAt.textContent = meta.updatedAt
    ? `${t().updatedAt}：${new Intl.DateTimeFormat(t().locale, {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(meta.updatedAt))}`
    : t().noCache;
}

function applyLanguage() {
  const lang = t();
  document.documentElement.lang = lang.htmlLang;
  document.title = `Hot Cache Hub · ${lang.title}`;
  metaDescription.setAttribute('content', lang.metaDescription);
  pageTitle.textContent = lang.title;
  pageDescription.textContent = lang.description;
  allSourceBtn.textContent = lang.all;
  searchInput.placeholder = lang.search;
  searchLabel.textContent = lang.searchLabel;

  langButtons.forEach(button => {
    const active = button.dataset.lang === currentLanguage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (data) {
    updateStatus(data.meta || {});
    render();
    refreshBtn.textContent = lang.refresh;
  } else {
    statusText.textContent = lang.reading;
    updatedAt.textContent = '';
    resultCount.textContent = '';
    refreshBtn.textContent = lang.refresh;
  }
}

function showSkeletons() {
  feed.setAttribute('aria-busy', 'true');
  feed.innerHTML = Array.from({ length: 5 }, (_, i) => `
    <article class="card skeleton-card" aria-hidden="true">
      <div class="rank">${String(i + 1).padStart(2, '0')}</div>
      <div class="content">
        <div class="skeleton short"></div>
        <div class="skeleton title"></div>
        <div class="skeleton body"></div>
      </div>
    </article>
  `).join('');
}

async function load() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = t().loading;
  if (!data) showSkeletons();

  try {
    const response = await fetch(`./data/hotspots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    updateStatus(data.meta || {});
    render();
  } catch (error) {
    statusDot.classList.add('stale');
    statusText.textContent = `${t().loadFailed}：${error.message}`;
    feed.setAttribute('aria-busy', 'false');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = t().refresh;
  }
}

refreshBtn.addEventListener('click', load);

chips.forEach(chip => chip.addEventListener('click', () => {
  selectedSource = chip.dataset.source;
  chips.forEach(item => {
    const active = item === chip;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  render();
}));

searchInput.addEventListener('input', event => {
  searchQuery = event.target.value;
  render();
});

document.addEventListener('keydown', event => {
  if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
    searchInput.value = '';
    searchQuery = '';
    render();
  }
});

langButtons.forEach(button => button.addEventListener('click', () => {
  currentLanguage = button.dataset.lang;
  localStorage.setItem('hot-cache-language', currentLanguage);
  applyLanguage();
}));

applyLanguage();
load();
