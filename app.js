const feed = document.querySelector('#feed');
const refreshBtn = document.querySelector('#refreshBtn');
const statusText = document.querySelector('#statusText');
const updatedAt = document.querySelector('#updatedAt');
const statusDot = document.querySelector('#statusDot');
const chips = [...document.querySelectorAll('.chip')];

let data = null;
let selectedSource = 'all';

function escapeHtml(text = '') {
  return String(text).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[c]);
}

function relativeTime(value) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function render() {
  if (!data) return;
  const allItems = Array.isArray(data.items) ? data.items : [];
  const items = selectedSource === 'all'
    ? allItems
    : allItems.filter(x => x.source === selectedSource);

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
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>
          ${item.discussionUrl && item.discussionUrl !== item.url ? `<a href="${escapeHtml(item.discussionUrl)}" target="_blank" rel="noopener noreferrer">讨论</a>` : ''}
        </div>
      </div>
      ${item.image ? `<img class="thumb" loading="lazy" src="${escapeHtml(item.image)}" alt="" referrerpolicy="no-referrer" />` : ''}
    </article>
  `).join('') || '<div class="empty">当前缓存里没有内容。</div>';
}

function updateStatus(meta = {}) {
  const stale = Boolean(meta.servedStale);
  statusDot.classList.toggle('stale', stale);
  statusText.textContent = stale ? '本次抓取失败，正在展示上次成功缓存' : '正在展示每日缓存';
  updatedAt.textContent = meta.updatedAt
    ? `缓存更新时间：${new Date(meta.updatedAt).toLocaleString()}`
    : '尚未生成缓存';
}

async function load() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = '读取中…';
  try {
    const res = await fetch(`./data/hotspots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    updateStatus(data.meta || {});
    render();
  } catch (error) {
    statusDot.classList.add('stale');
    statusText.textContent = `缓存加载失败：${error.message}`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '重新读取缓存';
  }
}

refreshBtn.addEventListener('click', load);
chips.forEach(chip => chip.addEventListener('click', () => {
  selectedSource = chip.dataset.source;
  chips.forEach(x => x.classList.toggle('active', x === chip));
  render();
}));

load();
