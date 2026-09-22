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
    language: 'zh',
    htmlLang: 'zh-CN',
    locale: 'zh-CN',
    label: '🇨🇳 中国',
    title: '中国热点',
    eyebrow: 'CHINA · DAILY NEWS',
    description: '每天生成一次新闻缓存；切换国家即可查看对应地区的本地化热点。',
    metaDescription: '中国每日热点新闻聚合',
    refresh: '重新读取缓存',
    loading: '读取中…',
    reading: '正在读取中国新闻缓存…',
    source: '查看原文 ↗',
    empty: '没有找到中国新闻。',
    fresh: '正在展示中国每日新闻缓存',
    stale: '中国新闻本次更新失败，正在展示上次成功缓存',
    updatedAt: '缓存更新时间',
    noCache: '尚未生成缓存',
    loadFailed: '缓存加载失败',
    search: '搜索标题或媒体来源…',
    searchLabel: '搜索中国新闻',
    results: n => `${n} 条新闻`
  },
  US: {
    language: 'en',
    htmlLang: 'en',
    locale: 'en-US',
    label: '🇺🇸 USA',
    title: 'U.S. News',
    eyebrow: 'UNITED STATES · DAILY NEWS',
    description: 'A daily cached view of U.S. headlines. Switch countries to browse their localized news feeds.',
    metaDescription: 'Daily U.S. headline aggregator',
    refresh: 'Reload cache',
    loading: 'Loading…',
    reading: 'Reading U.S. news cache…',
    source: 'Read source ↗',
    empty: 'No U.S. news found.',
    fresh: 'Showing the daily U.S. news cache',
    stale: 'U.S. refresh failed; showing the last successful cache',
    updatedAt: 'Cache updated',
    noCache: 'No cache has been generated yet',
    loadFailed: 'Failed to load cache',
    search: 'Search headlines or publishers…',
    searchLabel: 'Search U.S. news',
    results: n => `${n} stor${n === 1 ? 'y' : 'ies'}`
  },
  JP: {
    language: 'ja',
    htmlLang: 'ja',
    locale: 'ja-JP',
    label: '🇯🇵 日本',
    title: '日本ニュース',
    eyebrow: 'JAPAN · DAILY NEWS',
    description: 'ニュースキャッシュを1日1回生成します。国を切り替えると、その地域のニュースを表示します。',
    metaDescription: '日本のデイリーニュース集約',
    refresh: 'キャッシュを再読込',
    loading: '読込中…',
    reading: '日本ニュースのキャッシュを読込中…',
    source: '記事を読む ↗',
    empty: '日本のニュースが見つかりません。',
    fresh: '日本の日次ニュースキャッシュを表示中',
    stale: '日本ニュースの更新に失敗したため、前回のキャッシュを表示中',
    updatedAt: 'キャッシュ更新日時',
    noCache: 'まだキャッシュが生成されていません',
    loadFailed: 'キャッシュの読込に失敗しました',
    search: '見出し・メディアを検索…',
    searchLabel: '日本ニュースを検索',
    results: n => `${n}件のニュース`
  },
  KR: {
    language: 'ko',
    htmlLang: 'ko',
    locale: 'ko-KR',
    label: '🇰🇷 한국',
    title: '한국 뉴스',
    eyebrow: 'SOUTH KOREA · DAILY NEWS',
    description: '하루에 한 번 뉴스 캐시를 생성합니다. 국가를 전환하면 해당 지역의 뉴스를 볼 수 있습니다.',
    metaDescription: '한국 일일 뉴스 모음',
    refresh: '캐시 다시 읽기',
    loading: '불러오는 중…',
    reading: '한국 뉴스 캐시를 읽는 중…',
    source: '원문 보기 ↗',
    empty: '한국 뉴스를 찾을 수 없습니다.',
    fresh: '한국 일일 뉴스 캐시 표시 중',
    stale: '한국 뉴스 업데이트에 실패해 마지막 성공 캐시를 표시 중',
    updatedAt: '캐시 업데이트',
    noCache: '아직 생성된 캐시가 없습니다',
    loadFailed: '캐시를 불러오지 못했습니다',
    search: '제목 또는 언론사 검색…',
    searchLabel: '한국 뉴스 검색',
    results: n => `${n}개 뉴스`
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
      const haystack = [item.title, item.summary, item.source, item.author]
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
            <span class="source">${escapeHtml(item.source || 'News')}</span>
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
