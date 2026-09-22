const $ = selector => document.querySelector(selector);
const feed = $('#feed');
const refreshBtn = $('#refreshBtn');
const statusText = $('#statusText');
const updatedAt = $('#updatedAt');
const resultCount = $('#resultCount');
const statusDot = $('#statusDot');
const pageTitle = $('#pageTitle');
const pageDescription = $('#pageDescription');
const eyebrow = $('#eyebrow');
const metaDescription = $('#metaDescription');
const searchInput = $('#searchInput');
const searchLabel = $('#searchLabel');
const countryBadge = $('#countryBadge');
const countryButtons = [...document.querySelectorAll('.country-btn')];

const countries = {
  CN: {
    htmlLang: 'zh-CN',
    locale: 'zh-CN',
    label: '🇨🇳 中国 · Tech',
    title: '中国技术资讯',
    eyebrow: 'CHINA · TECH & CODE',
    description: '聚合中国科技、编程、开源、AI、云计算和开发者工具相关内容，每 24 小时更新一次缓存。',
    metaDescription: '中国科技、编程、开源、AI 与开发者资讯聚合',
    refresh: '重新读取缓存',
    loading: '读取中…',
    reading: '正在读取中国技术资讯缓存…',
    source: '查看原文 ↗',
    empty: '没有找到中国技术资讯。',
    fresh: '正在展示中国技术资讯缓存',
    stale: '中国技术资讯本次更新失败，正在展示上次成功缓存',
    updatedAt: '缓存更新时间',
    noCache: '尚未生成缓存',
    loadFailed: '缓存加载失败',
    search: '搜索编程、AI、开源或媒体来源…',
    searchLabel: '搜索中国技术资讯',
    results: n => `${n} 条技术资讯`
  },
  US: {
    htmlLang: 'en',
    locale: 'en-US',
    label: '🇺🇸 USA · Tech',
    title: 'U.S. Tech & Code',
    eyebrow: 'UNITED STATES · TECH & CODE',
    description: 'Developer-focused U.S. technology coverage: programming, open source, AI, cloud, software engineering and developer tools.',
    metaDescription: 'U.S. programming, open-source, AI and developer news',
    refresh: 'Reload cache',
    loading: 'Loading…',
    reading: 'Reading U.S. tech cache…',
    source: 'Read source ↗',
    empty: 'No U.S. developer or tech stories found.',
    fresh: 'Showing the U.S. tech & code cache',
    stale: 'U.S. tech refresh failed; showing the last successful cache',
    updatedAt: 'Cache updated',
    noCache: 'No cache has been generated yet',
    loadFailed: 'Failed to load cache',
    search: 'Search programming, AI, open source or publishers…',
    searchLabel: 'Search U.S. tech stories',
    results: n => `${n} tech stor${n === 1 ? 'y' : 'ies'}`
  },
  JP: {
    htmlLang: 'ja',
    locale: 'ja-JP',
    label: '🇯🇵 日本 · Tech',
    title: '日本の技術情報',
    eyebrow: 'JAPAN · TECH & CODE',
    description: '日本のプログラミング、オープンソース、AI、クラウド、ソフトウェア開発、開発者ツールの情報を集約します。',
    metaDescription: '日本のプログラミング・OSS・AI・開発者向け技術情報',
    refresh: 'キャッシュを再読込',
    loading: '読込中…',
    reading: '日本の技術情報キャッシュを読込中…',
    source: '記事を読む ↗',
    empty: '日本の技術情報が見つかりません。',
    fresh: '日本の技術情報キャッシュを表示中',
    stale: '日本の技術情報更新に失敗したため、前回のキャッシュを表示中',
    updatedAt: 'キャッシュ更新日時',
    noCache: 'まだキャッシュが生成されていません',
    loadFailed: 'キャッシュの読込に失敗しました',
    search: 'プログラミング・AI・OSS・媒体を検索…',
    searchLabel: '日本の技術情報を検索',
    results: n => `${n}件の技術情報`
  },
  KR: {
    htmlLang: 'ko',
    locale: 'ko-KR',
    label: '🇰🇷 한국 · Tech',
    title: '한국 기술 소식',
    eyebrow: 'SOUTH KOREA · TECH & CODE',
    description: '한국의 프로그래밍, 오픈소스, AI, 클라우드, 소프트웨어 개발 및 개발자 도구 관련 정보를 모읍니다.',
    metaDescription: '한국 프로그래밍·오픈소스·AI·개발자 기술 정보 모음',
    refresh: '캐시 다시 읽기',
    loading: '불러오는 중…',
    reading: '한국 기술 정보 캐시를 읽는 중…',
    source: '원문 보기 ↗',
    empty: '한국 개발자 기술 정보를 찾을 수 없습니다.',
    fresh: '한국 기술 정보 캐시 표시 중',
    stale: '한국 기술 정보 업데이트에 실패해 마지막 성공 캐시를 표시 중',
    updatedAt: '캐시 업데이트',
    noCache: '아직 생성된 캐시가 없습니다',
    loadFailed: '캐시를 불러오지 못했습니다',
    search: '프로그래밍, AI, 오픈소스 또는 매체 검색…',
    searchLabel: '한국 기술 정보 검색',
    results: n => `${n}개 기술 소식`
  }
};

function detectCountry() {
  const saved = localStorage.getItem('hot-cache-country');
  if (saved && countries[saved]) return saved;
  const browser = (navigator.language || '').toLowerCase();
  if (browser.startsWith('ja')) return 'JP';
  if (browser.startsWith('ko')) return 'KR';
  if (browser.startsWith('en')) return 'US';
  return 'CN';
}

let selectedCountry = detectCountry();
let data = null;
let searchQuery = '';

const c = () => countries[selectedCountry];

function escapeHtml(text = '') {
  return String(text).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
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
  return new Intl.RelativeTimeFormat(c().locale, { numeric: 'auto' }).format(amount, unit);
}

function currentCountryMeta() {
  return data?.meta?.countries?.find(item => item.code === selectedCountry) || null;
}

function getVisibleItems() {
  const allItems = Array.isArray(data?.items) ? data.items : [];
  const query = searchQuery.trim().toLocaleLowerCase(c().locale);
  return allItems
    .filter(item => item.country === selectedCountry)
    .filter(item => {
      if (!query) return true;
      const haystack = [item.title, item.summary, item.source, item.author, ...(item.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(c().locale);
      return haystack.includes(query);
    })
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
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
  resultCount.textContent = c().results(items.length);

  feed.innerHTML = items.map((item, index) => {
    const url = safeUrl(item.url);
    const image = item.image ? safeUrl(item.image) : '';
    return `
      <article class="card ${image && image !== '#' ? '' : 'no-image'}">
        <div class="rank">${String(index + 1).padStart(2, '0')}</div>
        <div class="content">
          <div class="meta">
            <span class="source">${escapeHtml(item.source || 'Tech')}</span>
            <time datetime="${escapeHtml(item.publishedAt || '')}">${relativeTime(item.publishedAt)}</time>
          </div>
          <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h2>
          ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}
          <div class="actions">
            <a href="${url}" target="_blank" rel="noopener noreferrer">${c().source}</a>
          </div>
        </div>
        ${image && image !== '#'
          ? `<img class="thumb" loading="lazy" decoding="async" src="${image}" alt="" referrerpolicy="no-referrer" />`
          : ''}
      </article>
    `;
  }).join('') || `<div class="empty"><strong>∅</strong><span>${c().empty}</span></div>`;

  feed.setAttribute('aria-busy', 'false');
  attachImageFallbacks();
}

function updateStatus() {
  const countryMeta = currentCountryMeta();
  const stale = Boolean(countryMeta?.stale || (!countryMeta?.ok && countryMeta));
  statusDot.classList.toggle('stale', stale);
  statusText.textContent = stale ? c().stale : c().fresh;

  const value = countryMeta?.updatedAt || data?.meta?.updatedAt;
  updatedAt.textContent = value
    ? `${c().updatedAt}：${new Intl.DateTimeFormat(c().locale, {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(value))}`
    : c().noCache;
}

function applyCountry() {
  const country = c();
  document.documentElement.lang = country.htmlLang;
  document.title = `Hot Cache Hub · ${country.title}`;
  metaDescription.setAttribute('content', country.metaDescription);
  pageTitle.textContent = country.title;
  pageDescription.textContent = country.description;
  eyebrow.textContent = country.eyebrow;
  countryBadge.textContent = country.label;
  searchInput.placeholder = country.search;
  searchLabel.textContent = country.searchLabel;

  countryButtons.forEach(button => {
    const active = button.dataset.country === selectedCountry;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  searchInput.value = '';
  searchQuery = '';

  if (data) {
    updateStatus();
    render();
  } else {
    statusText.textContent = country.reading;
    updatedAt.textContent = '';
    resultCount.textContent = '';
  }

  refreshBtn.textContent = country.refresh;
}

function showSkeletons() {
  feed.setAttribute('aria-busy', 'true');
  feed.innerHTML = Array.from({ length: 5 }, (_, index) => `
    <article class="card skeleton-card no-image" aria-hidden="true">
      <div class="rank">${String(index + 1).padStart(2, '0')}</div>
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
  refreshBtn.textContent = c().loading;
  if (!data) showSkeletons();

  try {
    const response = await fetch(`./data/hotspots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    updateStatus();
    render();
  } catch (error) {
    statusDot.classList.add('stale');
    statusText.textContent = `${c().loadFailed}：${error.message}`;
    feed.setAttribute('aria-busy', 'false');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = c().refresh;
  }
}

refreshBtn.addEventListener('click', load);

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

countryButtons.forEach(button => button.addEventListener('click', () => {
  selectedCountry = button.dataset.country;
  localStorage.setItem('hot-cache-country', selectedCountry);
  applyCountry();
}));

applyCountry();
load();
