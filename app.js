const feed = document.querySelector('#feed');
const refreshBtn = document.querySelector('#refreshBtn');
const statusText = document.querySelector('#statusText');
const updatedAt = document.querySelector('#updatedAt');
const statusDot = document.querySelector('#statusDot');
const pageTitle = document.querySelector('#pageTitle');
const pageDescription = document.querySelector('#pageDescription');
const metaDescription = document.querySelector('#metaDescription');
const allSourceBtn = document.querySelector('#allSourceBtn');
const chips = [...document.querySelectorAll('.chip')];
const langButtons = [...document.querySelectorAll('.lang-btn')];

const translations = {
  zh: {
    htmlLang: 'zh-CN',
    locale: 'zh-CN',
    title: '最新热点',
    description: '每 24 小时生成一次缓存；抓取失败时继续展示上次成功缓存。',
    metaDescription: '每天更新一次缓存的热点聚合页',
    refresh: '重新读取缓存',
    loading: '读取中…',
    reading: '正在读取缓存…',
    all: '全部',
    source: '查看来源 ↗',
    discussion: '讨论',
    empty: '当前缓存里没有内容。',
    dailyCache: '正在展示每日缓存',
    staleCache: '本次抓取失败，正在展示上次成功缓存',
    updatedAt: '缓存更新时间',
    noCache: '尚未生成缓存',
    loadFailed: '缓存加载失败',
    justNow: '刚刚',
    minutesAgo: n => `${n} 分钟前`,
    hoursAgo: n => `${n} 小时前`,
    daysAgo: n => `${n} 天前`
  },
  en: {
    htmlLang: 'en',
    locale: 'en-US',
    title: 'Latest Hot Topics',
    description: 'Cache refreshes every 24 hours; if fetching fails, the last successful cache stays visible.',
    metaDescription: 'A hot-topic aggregator refreshed from cache once per day',
    refresh: 'Reload cache',
    loading: 'Loading…',
    reading: 'Reading cache…',
    all: 'All',
    source: 'View source ↗',
    discussion: 'Discussion',
    empty: 'No items are available in the current cache.',
    dailyCache: 'Showing daily cache',
    staleCache: 'Latest fetch failed; showing the last successful cache',
    updatedAt: 'Cache updated',
    noCache: 'No cache has been generated yet',
    loadFailed: 'Failed to load cache',
    justNow: 'just now',
    minutesAgo: n => `${n} min ago`,
    hoursAgo: n => `${n} hr ago`,
    daysAgo: n => `${n} day${n === 1 ? '' : 's'} ago`
  },
  ja: {
    htmlLang: 'ja',
    locale: 'ja-JP',
    title: '最新トピック',
    description: 'キャッシュは24時間ごとに更新され、取得に失敗した場合は前回成功したキャッシュを表示します。',
    metaDescription: '1日1回キャッシュ更新する最新トピック集約ページ',
    refresh: 'キャッシュを再読込',
    loading: '読込中…',
    reading: 'キャッシュを読込中…',
    all: 'すべて',
    source: '出典を見る ↗',
    discussion: '議論',
    empty: '現在のキャッシュにコンテンツがありません。',
    dailyCache: '日次キャッシュを表示中',
    staleCache: '最新の取得に失敗したため、前回成功したキャッシュを表示中',
    updatedAt: 'キャッシュ更新日時',
    noCache: 'まだキャッシュが生成されていません',
    loadFailed: 'キャッシュの読込に失敗しました',
    justNow: 'たった今',
    minutesAgo: n => `${n}分前`,
    hoursAgo: n => `${n}時間前`,
    daysAgo: n => `${n}日前`
  },
  ko: {
    htmlLang: 'ko',
    locale: 'ko-KR',
    title: '최신 인기 주제',
    description: '캐시는 24시간마다 갱신되며, 가져오기에 실패하면 마지막으로 성공한 캐시를 계속 표시합니다.',
    metaDescription: '하루에 한 번 캐시를 갱신하는 인기 주제 모음 페이지',
    refresh: '캐시 다시 읽기',
    loading: '불러오는 중…',
    reading: '캐시를 읽는 중…',
    all: '전체',
    source: '출처 보기 ↗',
    discussion: '토론',
    empty: '현재 캐시에 표시할 내용이 없습니다.',
    dailyCache: '일일 캐시 표시 중',
    staleCache: '최신 가져오기에 실패해 마지막 성공 캐시를 표시 중',
    updatedAt: '캐시 업데이트',
    noCache: '아직 생성된 캐시가 없습니다',
    loadFailed: '캐시를 불러오지 못했습니다',
    justNow: '방금',
    minutesAgo: n => `${n}분 전`,
    hoursAgo: n => `${n}시간 전`,
    daysAgo: n => `${n}일 전`
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

function t() {
  return translations[currentLanguage];
}

function escapeHtml(text = '') {
  return String(text).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[c]);
}

function relativeTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';

  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (seconds < 60) return t().justNow;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t().minutesAgo(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t().hoursAgo(hours);

  return t().daysAgo(Math.floor(hours / 24));
}

function render() {
  if (!data) return;

  const allItems = Array.isArray(data.items) ? data.items : [];
  const items = selectedSource === 'all'
    ? allItems
    : allItems.filter(item => item.source === selectedSource);

  feed.innerHTML = items.map((item, index) => `
    <article class="card">
      <div class="rank">${String(index + 1).padStart(2, '0')}</div>
      <div class="content">
        <div class="meta">
          <span class="source">${escapeHtml(item.source)}</span>
          <span>${escapeHtml(item.author)}</span>
          <span>${relativeTime(item.publishedAt)}</span>
        </div>
        <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h2>
        <p>${escapeHtml(item.summary || '')}</p>
        <div class="actions">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${t().source}</a>
          ${item.discussionUrl && item.discussionUrl !== item.url
            ? `<a href="${escapeHtml(item.discussionUrl)}" target="_blank" rel="noopener noreferrer">${t().discussion}</a>`
            : ''}
        </div>
      </div>
      ${item.image ? `<img class="thumb" loading="lazy" src="${escapeHtml(item.image)}" alt="" referrerpolicy="no-referrer" />` : ''}
    </article>
  `).join('') || `<div class="empty">${t().empty}</div>`;
}

function updateStatus(meta = {}) {
  const stale = Boolean(meta.servedStale);
  statusDot.classList.toggle('stale', stale);
  statusText.textContent = stale ? t().staleCache : t().dailyCache;
  updatedAt.textContent = meta.updatedAt
    ? `${t().updatedAt}：${new Date(meta.updatedAt).toLocaleString(t().locale)}`
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
  refreshBtn.textContent = lang.refresh;

  langButtons.forEach(button => {
    const active = button.dataset.lang === currentLanguage;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (data) {
    updateStatus(data.meta || {});
    render();
  } else {
    statusText.textContent = lang.reading;
    updatedAt.textContent = '';
  }
}

async function load() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = t().loading;

  try {
    const response = await fetch(`./data/hotspots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    data = await response.json();
    updateStatus(data.meta || {});
    render();
  } catch (error) {
    statusDot.classList.add('stale');
    statusText.textContent = `${t().loadFailed}：${error.message}`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = t().refresh;
  }
}

refreshBtn.addEventListener('click', load);

chips.forEach(chip => chip.addEventListener('click', () => {
  selectedSource = chip.dataset.source;
  chips.forEach(item => item.classList.toggle('active', item === chip));
  render();
}));

langButtons.forEach(button => button.addEventListener('click', () => {
  currentLanguage = button.dataset.lang;
  localStorage.setItem('hot-cache-language', currentLanguage);
  applyLanguage();
}));

applyLanguage();
load();
