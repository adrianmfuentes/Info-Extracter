'use strict';

const form      = document.getElementById('searchForm');
const ipInput   = document.getElementById('ipInput');
const searchBtn = document.getElementById('searchBtn');
const btnText   = searchBtn.querySelector('.btn-text');
const btnSpinner= searchBtn.querySelector('.btn-spinner');
const myIpBtn   = document.getElementById('myIpBtn');

const resultsEl = document.getElementById('results');
const errorBox  = document.getElementById('errorBox');
const errorMsg  = document.getElementById('errorMsg');

const resultIp    = document.getElementById('resultIp');
const locationBody= document.getElementById('locationBody');
const ispBody     = document.getElementById('ispBody');
const riskFlags   = document.getElementById('riskFlags');
const gaugeFill   = document.getElementById('gaugeFill');
const gaugeText   = document.getElementById('gaugeText');

// ── Helpers ────────────────────────────────────────────────────────────────

function setLoading(on) {
  searchBtn.disabled = on;
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
    <span class="data-label">${label}</span>
    <span class="data-value${cls}">${value}</span>
  </div>`;
}

function flag(label, active, trueIsBad = true) {
  const isBad = trueIsBad ? active : !active;
  const cls   = isBad ? 'flag-chip--warn' : 'flag-chip--safe';
  const dot   = isBad ? '●' : '✓';
  return `<span class="flag-chip ${cls}">${dot} ${label}</span>`;
}

function animateGauge(score) {
  const arcLen  = 157; // half-circle arc length for r=50
  const target  = (score / 100) * arcLen;
  let current   = 0;
  const step    = target / 40;
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

  // Location
  const loc = data.location || {};
  locationBody.innerHTML = [
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
    flag('Mobile',     risk.is_mobile, false),
  ].join('');

  gaugeFill.setAttribute('stroke-dasharray', '0 157');
  gaugeText.textContent = '0';
  animateGauge(score);

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Crude country code → emoji flag
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function lookupIp(ip) {
  hideError();
  setLoading(true);

  try {
    const url = `https://api.ipquery.io/${encodeURIComponent(ip)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const data = await res.json();

    if (!data || !data.ip) throw new Error('Invalid response from API.');

    renderResults(data);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

// ── Events ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = ipInput.value.trim();
  if (!val) { showError('Please enter an IP address.'); return; }
  lookupIp(val);
});

myIpBtn.addEventListener('click', async () => {
  hideError();
  myIpBtn.disabled = true;
  try {
    const res  = await fetch('https://api.ipquery.io/');
    const text = (await res.text()).trim();
    if (text) {
      ipInput.value = text;
      lookupIp(text);
    }
  } catch {
    showError('Could not detect your IP address.');
  } finally {
    myIpBtn.disabled = false;
  }
});
