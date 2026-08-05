'use strict';

const form      = document.getElementById('searchForm');
const ipInput   = document.getElementById('ipInput');
const searchBtn = document.getElementById('searchBtn');
const btnText   = searchBtn.querySelector('.btn-text');
const btnSpinner= searchBtn.querySelector('.btn-spinner');
const myIpBtn   = document.getElementById('myIpBtn');
const copyIpBtn = document.getElementById('copyIpBtn');
const themeToggle    = document.getElementById('themeToggle');
const recentSearches = document.getElementById('recentSearches');
const recentList     = document.getElementById('recentList');
const clearRecentBtn = document.getElementById('clearRecentBtn');

const resultsEl = document.getElementById('results');
const errorBox  = document.getElementById('errorBox');
const errorMsg  = document.getElementById('errorMsg');

const singleResultEl = document.getElementById('singleResult');
const resultIp    = document.getElementById('resultIp');
const locationBody= document.getElementById('locationBody');
const ispBody     = document.getElementById('ispBody');
const riskFlags   = document.getElementById('riskFlags');
const gaugeFill   = document.getElementById('gaugeFill');
const gaugeText   = document.getElementById('gaugeText');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn  = document.getElementById('exportCsvBtn');

const compareResultEl     = document.getElementById('compareResult');
const compareGrid         = document.getElementById('compareGrid');
const compareCountEl      = document.getElementById('compareCount');
const exportCompareCsvBtn = document.getElementById('exportCompareCsvBtn');

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;

const THEME_KEY  = 'ipInfoExtracter.theme';
const RECENT_KEY = 'ipInfoExtracter.recentSearches';
const RECENT_MAX = 8;
const MAX_COMPARE = 6;

let activeController = null;
let lastSingleData   = null;
let lastCompareData  = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidIp(value) {
  return IPV4_REGEX.test(value) || IPV6_REGEX.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setLoading(on) {
  searchBtn.disabled = on;
  myIpBtn.disabled   = on;
  btnText.hidden     = on;
  btnSpinner.hidden  = !on;
}

function showError(msg) {
  errorBox.hidden = false;
  errorMsg.textContent = msg;
  resultsEl.hidden = true;
}

function hideError() {
  errorBox.hidden = true;
}

function row(label, value, mono = false) {
  if (value === null || value === undefined || value === '') return '';
  const cls = mono ? ' data-value--mono' : '';
  return `<div class="data-row">
    <span class="data-label">${escapeHtml(label)}</span>
    <span class="data-value${cls}">${escapeHtml(value)}</span>
  </div>`;
}

function flag(label, active) {
  const cls = active ? 'flag-chip--warn' : 'flag-chip--safe';
  const dot = active ? '●' : '✓';
  return `<span class="flag-chip ${cls}">${dot} ${escapeHtml(label)}</span>`;
}

function animateGauge(score) {
  const arcLen  = 157; // half-circle arc length for r=50
  const target  = (Math.max(0, Math.min(100, score)) / 100) * arcLen;
  let current   = 0;
  const step    = target / 40 || 0;
  const timer   = setInterval(() => {
    current = Math.min(current + step, target);
    gaugeFill.setAttribute('stroke-dasharray', `${current} ${arcLen}`);
    gaugeText.textContent = Math.round((current / arcLen) * 100);
    if (current >= target) clearInterval(timer);
  }, 16);
}

function riskLevel(score) {
  if (score >= 67) return 'high';
  if (score >= 34) return 'medium';
  return 'low';
}

// ── Export ─────────────────────────────────────────────────────────────────

function flattenIpData(data) {
  const loc  = data.location || {};
  const isp  = data.isp || {};
  const risk = data.risk || {};
  return {
    ip: data.ip,
    country: loc.country || '',
    country_code: loc.country_code || '',
    state: loc.state || '',
    city: loc.city || '',
    zipcode: loc.zipcode || '',
    latitude: loc.latitude ?? '',
    longitude: loc.longitude ?? '',
    timezone: loc.timezone || '',
    localtime: loc.localtime || '',
    asn: isp.asn || '',
    org: isp.org || '',
    isp: isp.isp || '',
    risk_score: risk.risk_score ?? '',
    is_vpn: !!risk.is_vpn,
    is_proxy: !!risk.is_proxy,
    is_tor: !!risk.is_tor,
    is_datacenter: !!risk.is_datacenter,
    is_mobile: !!risk.is_mobile,
  };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => escapeCell(row[h])).join(',')));
  return lines.join('\n');
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

exportJsonBtn.addEventListener('click', () => {
  if (!lastSingleData) return;
  downloadFile(`ip-info-${lastSingleData.ip}.json`, JSON.stringify(lastSingleData, null, 2), 'application/json');
});

exportCsvBtn.addEventListener('click', () => {
  if (!lastSingleData) return;
  downloadFile(`ip-info-${lastSingleData.ip}.csv`, toCsv([flattenIpData(lastSingleData)]), 'text/csv');
});

exportCompareCsvBtn.addEventListener('click', () => {
  if (!lastCompareData.length) return;
  downloadFile(`ip-info-compare-${Date.now()}.csv`, toCsv(lastCompareData.map(flattenIpData)), 'text/csv');
});

// ── Render ─────────────────────────────────────────────────────────────────

function renderResults(data) {
  lastSingleData = data;
  resultIp.textContent = data.ip;
  copyIpBtn.hidden = false;
  copyIpBtn.dataset.copyText = data.ip;

  // Location
  const loc = data.location || {};
  let locationHtml = [
    row('Country',     loc.country ? `${countryFlag(loc.country_code)} ${loc.country}` : null),
    row('Country Code',loc.country_code, true),
    row('State',       loc.state),
    row('City',        loc.city),
    row('Postal',      loc.zipcode, true),
    row('Latitude',    loc.latitude  != null ? loc.latitude  : null, true),
    row('Longitude',   loc.longitude != null ? loc.longitude : null, true),
    row('Timezone',    loc.timezone),
    row('Local Time',  loc.localtime),
  ].join('') || '<span class="data-label">No location data</span>';

  if (loc.latitude != null && loc.longitude != null) {
    const lat = encodeURIComponent(loc.latitude);
    const lon = encodeURIComponent(loc.longitude);
    locationHtml += `<a class="map-link" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}" target="_blank" rel="noopener noreferrer">View on map ↗</a>`;
  }
  locationBody.innerHTML = locationHtml;

  // ISP
  const isp = data.isp || {};
  ispBody.innerHTML = [
    row('ASN',    isp.asn,  true),
    row('Org',    isp.org),
    row('ISP',    isp.isp),
  ].join('') || '<span class="data-label">No ISP data</span>';

  // Risk
  const risk  = data.risk || {};
  const score = risk.risk_score ?? 0;

  riskFlags.innerHTML = [
    flag('VPN',        risk.is_vpn),
    flag('Proxy',      risk.is_proxy),
    flag('Tor',        risk.is_tor),
    flag('Datacenter', risk.is_datacenter),
    flag('Mobile',     risk.is_mobile),
  ].join('');

  gaugeFill.setAttribute('stroke-dasharray', '0 157');
  gaugeText.textContent = '0';
  animateGauge(score);

  singleResultEl.hidden = false;
  compareResultEl.hidden = true;
  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCompareCard(data) {
  if (data.error) {
    return `<div class="card compare-card compare-card--error">
      <div class="card-header"><span class="compare-ip">${escapeHtml(data.ip)}</span></div>
      <div class="card-body"><span class="data-label">${escapeHtml(data.error)}</span></div>
    </div>`;
  }

  const loc   = data.location || {};
  const isp   = data.isp || {};
  const risk  = data.risk || {};
  const score = risk.risk_score ?? 0;

  return `<div class="card compare-card">
    <div class="card-header">
      <span class="compare-ip">${escapeHtml(data.ip)}</span>
      <span class="compare-risk-badge compare-risk-badge--${riskLevel(score)}">${escapeHtml(score)}</span>
    </div>
    <div class="card-body">
      ${row('Location', [loc.city, loc.state, loc.country].filter(Boolean).join(', '))}
      ${row('ISP',      isp.isp || isp.org)}
      ${row('ASN',      isp.asn, true)}
      <div class="risk-flags">
        ${flag('VPN',   risk.is_vpn)}
        ${flag('Proxy', risk.is_proxy)}
        ${flag('Tor',   risk.is_tor)}
      </div>
    </div>
  </div>`;
}

function renderCompare(dataList) {
  compareCountEl.textContent = dataList.length;
  compareGrid.innerHTML = dataList.map(renderCompareCard).join('');
  lastCompareData = dataList.filter((d) => !d.error);

  singleResultEl.hidden = true;
  compareResultEl.hidden = false;
  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Theme ──────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme  = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(theme);
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ── Recent searches ─────────────────────────────────────────────────────────

function getRecentSearches() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY));
    if (!Array.isArray(list)) return [];
    return list.map((item) =>
      typeof item === 'string' ? { ip: item, note: '' } : { ip: item.ip, note: item.note || '' }
    );
  } catch {
    return [];
  }
}

function saveRecentSearch(ip) {
  const existing = getRecentSearches();
  const prevNote = existing.find((item) => item.ip === ip)?.note || '';
  const list = [{ ip, note: prevNote }, ...existing.filter((item) => item.ip !== ip)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  renderRecentSearches();
}

function setRecentNote(ip, note) {
  const list = getRecentSearches().map((item) =>
    item.ip === ip ? { ...item, note: note.trim().slice(0, 40) } : item
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  renderRecentSearches();
}

function renderRecentSearches() {
  const list = getRecentSearches();
  if (!list.length) {
    recentSearches.hidden = true;
    return;
  }
  recentSearches.hidden = false;
  recentList.innerHTML = list
    .map(({ ip, note }) => `
      <div class="recent-item" data-ip="${escapeHtml(ip)}">
        <button type="button" class="recent-chip" data-ip="${escapeHtml(ip)}" title="Look up ${escapeHtml(ip)}">
          ${escapeHtml(ip)}${note ? `<span class="recent-note">· ${escapeHtml(note)}</span>` : ''}
        </button>
        <button type="button" class="recent-tag-btn" data-ip="${escapeHtml(ip)}" aria-label="Edit note for ${escapeHtml(ip)}" title="Edit note">${note ? '✎' : '+'}</button>
      </div>
    `)
    .join('');
}

function startEditNote(itemEl, ip) {
  const current = getRecentSearches().find((item) => item.ip === ip)?.note || '';
  itemEl.innerHTML = `<input type="text" class="recent-note-input" maxlength="40" placeholder="Add a note…" />`;
  const input = itemEl.querySelector('input');
  input.value = current;
  input.focus();
  input.select();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    setRecentNote(ip, input.value);
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); committed = true; renderRecentSearches(); }
  });
  input.addEventListener('blur', commit);
}

recentList.addEventListener('click', (e) => {
  const tagBtn = e.target.closest('.recent-tag-btn');
  if (tagBtn) {
    startEditNote(tagBtn.closest('.recent-item'), tagBtn.dataset.ip);
    return;
  }
  const chip = e.target.closest('.recent-chip');
  if (!chip) return;
  const ip = chip.dataset.ip;
  ipInput.value = ip;
  lookupIp(ip);
});

clearRecentBtn.addEventListener('click', () => {
  localStorage.removeItem(RECENT_KEY);
  renderRecentSearches();
});

// Crude country code → emoji flag
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchIpData(ip, signal) {
  const url = `https://api.ipquery.io/${encodeURIComponent(ip)}`;
  const res = await fetch(url, { signal });

  if (!res.ok) throw new Error(`API returned ${res.status}`);

  const data = await res.json();
  if (!data || !data.ip) throw new Error('Invalid response from API.');
  return data;
}

async function lookupIp(ip, { updateUrl = true } = {}) {
  hideError();

  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  setLoading(true);

  try {
    const data = await fetchIpData(ip, controller.signal);

    renderResults(data);
    saveRecentSearch(data.ip);
    if (updateUrl) {
      const params = new URLSearchParams(location.search);
      params.delete('ips');
      params.set('ip', ip);
      history.replaceState(null, '', `?${params.toString()}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    if (activeController === controller) {
      activeController = null;
      setLoading(false);
    }
  }
}

async function lookupMultiple(ips, { updateUrl = true } = {}) {
  hideError();

  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  setLoading(true);

  try {
    const settled = await Promise.allSettled(ips.map((ip) => fetchIpData(ip, controller.signal)));
    if (controller.signal.aborted) return;

    const dataList = settled.map((result, i) =>
      result.status === 'fulfilled' ? result.value : { ip: ips[i], error: result.reason?.message || 'Lookup failed' }
    );

    renderCompare(dataList);
    dataList.forEach((d) => { if (!d.error) saveRecentSearch(d.ip); });

    if (updateUrl) {
      const params = new URLSearchParams(location.search);
      params.delete('ip');
      params.set('ips', ips.join(','));
      history.replaceState(null, '', `?${params.toString()}`);
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      setLoading(false);
    }
  }
}

// ── Events ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = ipInput.value.trim();
  if (!raw) { showError('Please enter an IP address.'); return; }

  const parts = [...new Set(raw.split(/[,\s]+/).filter(Boolean))];

  if (parts.length === 1) {
    if (!isValidIp(parts[0])) { showError('That doesn\'t look like a valid IP address.'); return; }
    lookupIp(parts[0]);
    return;
  }

  if (parts.length > MAX_COMPARE) {
    showError(`You can compare up to ${MAX_COMPARE} IP addresses at once.`);
    return;
  }

  const invalid = parts.filter((p) => !isValidIp(p));
  if (invalid.length) {
    showError(`Invalid IP address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}`);
    return;
  }

  lookupMultiple(parts);
});

myIpBtn.addEventListener('click', async () => {
  hideError();
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;
  setLoading(true);
  try {
    const res  = await fetch('https://api.ipquery.io/', { signal: controller.signal });
    const text = (await res.text()).trim();
    if (text) {
      ipInput.value = text;
      activeController = null;
      await lookupIp(text);
    }
  } catch (err) {
    if (err.name !== 'AbortError') showError('Could not detect your IP address.');
  } finally {
    if (activeController === controller) {
      activeController = null;
      setLoading(false);
    }
  }
});

copyIpBtn.addEventListener('click', async () => {
  const text = copyIpBtn.dataset.copyText;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyIpBtn.classList.add('copy-btn--copied');
    copyIpBtn.setAttribute('aria-label', 'Copied!');
    setTimeout(() => {
      copyIpBtn.classList.remove('copy-btn--copied');
      copyIpBtn.setAttribute('aria-label', 'Copy IP address');
    }, 1500);
  } catch {
    // Clipboard API unavailable (e.g. insecure context) — silently ignore.
  }
});

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    ipInput.focus();
  } else if (e.key === 'Escape' && document.activeElement === ipInput) {
    ipInput.blur();
  }
});

// ── Init ───────────────────────────────────────────────────────────────────

(function init() {
  initTheme();
  renderRecentSearches();

  const params   = new URLSearchParams(location.search);
  const ipsParam = params.get('ips');
  const ipParam  = params.get('ip');

  if (ipsParam) {
    const parts = [...new Set(ipsParam.split(',').map((s) => s.trim()).filter(Boolean))];
    if (parts.length > 1 && parts.length <= MAX_COMPARE && parts.every(isValidIp)) {
      ipInput.value = parts.join(', ');
      lookupMultiple(parts, { updateUrl: false });
    }
  } else if (ipParam && isValidIp(ipParam.trim())) {
    ipInput.value = ipParam.trim();
    lookupIp(ipParam.trim(), { updateUrl: false });
  }
})();
