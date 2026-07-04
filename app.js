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

const resultIp    = document.getElementById('resultIp');
const locationBody= document.getElementById('locationBody');
const ispBody     = document.getElementById('ispBody');
const riskFlags   = document.getElementById('riskFlags');
const gaugeFill   = document.getElementById('gaugeFill');
const gaugeText   = document.getElementById('gaugeText');

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;

const THEME_KEY  = 'ipInfoExtracter.theme';
const RECENT_KEY = 'ipInfoExtracter.recentSearches';
const RECENT_MAX = 8;

let activeController = null;

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

// ── Render ─────────────────────────────────────────────────────────────────

function renderResults(data) {
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
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(ip) {
  const list = [ip, ...getRecentSearches().filter((item) => item !== ip)].slice(0, RECENT_MAX);
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
    .map((ip) => `<button type="button" class="recent-chip" data-ip="${escapeHtml(ip)}">${escapeHtml(ip)}</button>`)
    .join('');
}

recentList.addEventListener('click', (e) => {
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

async function lookupIp(ip, { updateUrl = true } = {}) {
  hideError();

  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  setLoading(true);

  try {
    const url = `https://api.ipquery.io/${encodeURIComponent(ip)}`;
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const data = await res.json();

    if (!data || !data.ip) throw new Error('Invalid response from API.');

    renderResults(data);
    saveRecentSearch(data.ip);
    if (updateUrl) {
      const params = new URLSearchParams(location.search);
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

// ── Events ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = ipInput.value.trim();
  if (!val) { showError('Please enter an IP address.'); return; }
  if (!isValidIp(val)) { showError('That doesn\'t look like a valid IP address.'); return; }
  lookupIp(val);
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

  const params  = new URLSearchParams(location.search);
  const ipParam = params.get('ip');
  if (ipParam && isValidIp(ipParam.trim())) {
    ipInput.value = ipParam.trim();
    lookupIp(ipParam.trim(), { updateUrl: false });
  }
})();
