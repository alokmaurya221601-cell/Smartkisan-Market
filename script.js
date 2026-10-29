'use strict';
/* ---------- Storage helpers ---------- */
const KEYS = { listings: 'sk_listings', orders: 'sk_orders', user: 'sk_user', accounts: 'sk_accounts' };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Storage full or unavailable. Try a smaller image.', true); return false; } };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');

/* ---------- Demo data ---------- */
const EMOJI = { Wheat: '🌾', Rice: '🍚', Maize: '🌽', Mustard: '🌼', Potato: '🥔', Tomato: '🍅' };
const COLORS = { Cereal: ['#f6e7a8', '#d9b84a'], Vegetable: ['#c8e6c9', '#66bb6a'], Oilseed: ['#fff3b0', '#f2c230'] };
function art(emoji, cat) {
  const c = COLORS[cat] || COLORS.Cereal;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c[0]}'/><stop offset='1' stop-color='${c[1]}'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/><text x='200' y='185' font-size='120' text-anchor='middle'>${emoji}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const SEED = [
  ['Wheat', 'Cereal', 'Ramesh Singh', 120, 2300, 'Karnal, Haryana', 'Golden sharbati wheat, low moisture.'],
  ['Basmati Rice', 'Cereal', 'Gurpreet Kaur', 80, 3150, 'Amritsar, Punjab', 'Long-grain aromatic rice, aged 1 year.'],
  ['Maize', 'Cereal', 'Suresh Patil', 150, 2100, 'Nashik, Maharashtra', 'Dry yellow maize suitable for feed and flour.'],
  ['Mustard', 'Oilseed', 'Mohan Lal', 60, 5700, 'Alwar, Rajasthan', 'High oil content mustard seeds.'],
  ['Potato', 'Vegetable', 'Anita Devi', 200, 1250, 'Agra, Uttar Pradesh', 'Fresh table potatoes, cold-stored.'],
  ['Tomato', 'Vegetable', 'Venkat Reddy', 40, 1900, 'Kolar, Karnataka', 'Firm red hybrid tomatoes.'],
  ['Sharbati Wheat', 'Cereal', 'Harish Verma', 90, 2400, 'Sehore, Madhya Pradesh', 'Premium grade, machine cleaned.'],
  ['Yellow Mustard', 'Oilseed', 'Pooja Chauhan', 45, 5850, 'Bharatpur, Rajasthan', 'Fresh harvest, sun dried.']
].map((s, i) => ({ id: 'C' + (i + 1), name: s[0], cat: s[1], seller: s[2], qty: s[3], price: s[4], loc: s[5], desc: s[6], img: art(EMOJI[s[0].split(' ').pop()] || '🌾', s[1]), mine: false }));

const MARKETS = ['Azadpur Mandi (Demo)', 'Kisan Bazaar (Demo)', 'Agri Hub North (Demo)', 'Green Valley Mandi (Demo)'];
const PRICES = {
  Wheat: [2275, 2310, 2250, 2340], Rice: [3100, 3050, 3200, 3150], Maize: [2090, 2150, 2060, 2120],
  Mustard: [5650, 5720, 5600, 5800], Potato: [1250, 1180, 1320, 1210], Tomato: [1850, 2100, 1700, 1950]
};
const HIST_FACTORS = [0.94, 0.97, 1.0, 1.04, 1.01, 1.05]; // fixed sample pattern
const SEASON = [1.01, 1.02, 1.015];                        // fixed demo seasonal factor

let listings = load(KEYS.listings, null);
if (!Array.isArray(listings) || !listings.length) { listings = SEED; save(KEYS.listings, listings); }
let orders = load(KEYS.orders, []);
let user = load(KEYS.user, null);
let chart = null;

/* ---------- Toast & navigation ---------- */
let tt;
function toast(msg, isErr) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200);
}
function show(id) {
  if (!$(id)) id = 'home';
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('#navLinks a').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
  $('navLinks').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refresh();
  if (id === 'predict') drawChart();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-nav]');
  if (a) { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.nav); show(a.dataset.nav); }
});
$('navToggle').addEventListener('click', () => $('navLinks').classList.toggle('open'));
window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'home'));

/* ---------- Stats ---------- */
const statBox = (icon, val, label) => `<div class="stat"><i class="fa-solid ${icon}"></i><b>${val}</b><span>${label}</span></div>`;
function renderStats() {
  const totalQty = listings.reduce((s, l) => s + l.qty, 0);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  $('homeStats').innerHTML = statBox('fa-people-group', '12,450+', 'Farmers (demo)') + statBox('fa-store', '3,200+', 'Buyers (demo)') +
    statBox('fa-wheat-awn', listings.length, 'Live Listings') + statBox('fa-handshake', orders.length, 'Orders Placed');
  $('farmerStats').innerHTML = statBox('fa-list', listings.length, 'Total Crop Listings') + statBox('fa-receipt', orders.length, 'Total Orders') +
    statBox('fa-weight-hanging', totalQty + ' q', 'Stock Available') + statBox('fa-indian-rupee-sign', inr(revenue), 'Order Value');
  $('buyerStats').innerHTML = statBox('fa-seedling', listings.length, 'Crops Available') + statBox('fa-box', orders.length, 'My Orders') +
    statBox('fa-indian-rupee-sign', inr(revenue), 'Total Spent');
}

/* ---------- Product cards ---------- */
function card(l, featured) {
  return `<article class="product"><div class="imgbox"><img src="${l.img}" alt="${esc(l.name)}" loading="lazy"></div>
  <div class="pbody"><span class="tag">${esc(l.cat)}</span><h3>${esc(l.name)}</h3>
  <small><i class="fa-solid fa-user"></i> ${esc(l.seller)}</small>
  <small><i class="fa-solid fa-location-dot"></i> ${esc(l.loc)}</small>
  <small><i class="fa-solid fa-weight-hanging"></i> ${l.qty} quintals available</small>
  <div class="price">${inr(l.price)}<small> / quintal</small></div>
  <div class="pbtns"><button class="btn btn-outline" data-detail="${l.id}">Details</button>
  <button class="btn" data-buy="${l.id}" ${l.qty < 1 ? 'disabled' : ''}>${l.qty < 1 ? 'Sold Out' : 'Buy Now'}</button></div></div></article>`;
}
function renderFeatured() { $('featuredGrid').innerHTML = listings.slice(0, 4).map(card).join(''); }

/* ---------- Marketplace filters ---------- */
function fillFilters() {
  const cur = { c: $('catFilter').value, l: $('locFilter').value };
  const cats = [...new Set(listings.map(l => l.cat))], locs = [...new Set(listings.map(l => l.loc))];
  $('catFilter').innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  $('locFilter').innerHTML = '<option value="all">All Locations</option>' + locs.map(c => `<option>${esc(c)}</option>`).join('');
  if (cats.includes(cur.c)) $('catFilter').value = cur.c;
  if (locs.includes(cur.l)) $('locFilter').value = cur.l;
}
function renderMarket() {
  const q = $('searchInput').value.trim().toLowerCase(), c = $('catFilter').value, loc = $('locFilter').value, s = $('sortSelect').value;
  let list = listings.filter(l => l.name.toLowerCase().includes(q) && (c === 'all' || l.cat === c) && (loc === 'all' || l.loc === loc));
  if (s === 'asc') list.sort((a, b) => a.price - b.price);
  if (s === 'desc') list.sort((a, b) => b.price - a.price);
  $('marketGrid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty" style="grid-column:1/-1">😕 No crops match your search. Try different filters.</div>';
}
['searchInput', 'catFilter', 'locFilter', 'sortSelect'].forEach(id => $(id).addEventListener('input', renderMarket));
$('resetFilters').addEventListener('click', () => { $('searchInput').value = ''; $('catFilter').value = 'all'; $('locFilter').value = 'all'; $('sortSelect').value = 'none'; renderMarket(); });

/* ---------- Modal: details / buy ---------- */
function openModal(id, buyFocus) {
  const l = listings.find(x => x.id === id); if (!l) return;
  $('modalBox').innerHTML = `<button class="close" id="closeModal" aria-label="Close">&times;</button>
  <img src="${l.img}" alt="${esc(l.name)}"><h2>${esc(l.name)}</h2><span class="tag">${esc(l.cat)}</span>
  <p style="margin:8px 0">${esc(l.desc || 'No description provided.')}</p>
  <p><b>Seller:</b> ${esc(l.seller)}<br><b>Location:</b> ${esc(l.loc)}<br><b>Available:</b> ${l.qty} quintals<br><b>Price:</b> ${inr(l.price)} / quintal</p><hr style="margin:14px 0;border:0;border-top:1px solid #eee">
  <label>Quantity (quintals)<input type="number" id="buyQty" min="1" max="${l.qty}" value="1"></label>
  <div class="total" id="buyTotal">Total: ${inr(l.price)}</div><p class="error" id="buyError"></p>
  <button class="btn" id="confirmBuy" ${l.qty < 1 ? 'disabled' : ''}>Place Demo Order</button>`;
  $('modal').classList.remove('hidden');
  const qty = $('buyQty');
  qty.addEventListener('input', () => { const n = parseInt(qty.value, 10); $('buyTotal').textContent = 'Total: ' + inr(isNaN(n) || n < 0 ? 0 : n * l.price); $('buyError').textContent = ''; });
  $('confirmBuy').addEventListener('click', () => placeOrder(l.id, qty.value));
  $('closeModal').addEventListener('click', closeModal);
  if (buyFocus) qty.focus();
}
function closeModal() { $('modal').classList.add('hidden'); }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', e => {
  const d = e.target.closest('[data-detail]'), b = e.target.closest('[data-buy]');
  if (d) openModal(d.dataset.detail, false);
  if (b) openModal(b.dataset.buy, true);
});

/* ---------- Orders ---------- */
function placeOrder(id, qtyRaw) {
  const l = listings.find(x => x.id === id), qty = Number(qtyRaw), err = $('buyError');
  if (!l) return;
  if (!Number.isInteger(qty) || qty < 1) { err.textContent = 'Enter a whole quantity of at least 1.'; return; }
  if (qty > l.qty) { err.textContent = `Only ${l.qty} quintals are available.`; return; }
  const order = {
    id: 'ORD' + Date.now().toString().slice(-7), cropId: l.id, crop: l.name, qty, total: qty * l.price,
    date: new Date().toLocaleDateString('en-IN'), status: 'Confirmed', buyer: user ? user.name : 'Guest'
  };
  l.qty -= qty; orders.unshift(order);
  if (!save(KEYS.listings, listings) || !save(KEYS.orders, orders)) return;
  $('modalBox').innerHTML = `<div style="text-align:center"><div style="font-size:3.5rem">✅</div><h2>Order Confirmed!</h2>
  <p style="margin:10px 0">Order <b>${order.id}</b><br>${qty} quintals of ${esc(l.name)}<br><b>Total: ${inr(order.total)}</b></p>
  <p class="note">Demo order. No real payment or delivery.</p>
  <button class="btn" data-nav="orders" id="viewOrders">View Orders</button></div>`;
  $('viewOrders').addEventListener('click', closeModal);
  toast('Order placed successfully!'); refresh();
}
function renderOrders() {
  if (!orders.length) { $('orderTable').innerHTML = ''; $('orderEmpty').innerHTML = '📦 No orders yet. <a href="#market" data-nav="market" style="color:var(--g);font-weight:700">Browse the marketplace</a>.'; return; }
  $('orderEmpty').innerHTML = '';
  $('orderTable').innerHTML = '<thead><tr><th>Order ID</th><th>Crop</th><th>Qty (q)</th><th>Total</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
    orders.map(o => `<tr><td>${o.id}</td><td>${esc(o.crop)}</td><td>${o.qty}</td><td>${inr(o.total)}</td><td>${o.date}</td>
    <td><span class="status ${o.status}">${o.status}</span></td>
    <td>${o.status === 'Delivered' ? '—' : `<button class="btn btn-sm" data-adv="${o.id}">Mark ${o.status === 'Confirmed' ? 'Shipped' : 'Delivered'}</button>`}</td></tr>`).join('') + '</tbody>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-adv]'); if (!b) return;
  const o = orders.find(x => x.id === b.dataset.adv); if (!o) return;
  o.status = o.status === 'Confirmed' ? 'Shipped' : 'Delivered';
  save(KEYS.orders, orders); renderOrders(); toast('Order status updated (demo).');
});

/* ---------- Price comparison ---------- */
function renderPrices() {
  const crop = $('priceCrop').value, arr = PRICES[crop], min = Math.min(...arr);
  $('priceCards').innerHTML = arr.map((p, i) => `<div class="pc ${p === min ? 'low' : ''}"><i class="fa-solid fa-shop"></i><h4>${MARKETS[i]}</h4>
    <span class="price">${inr(p)}</span><small>per quintal · demo data</small>${p === min ? '<br><span class="lowtag">Lowest price</span>' : ''}</div>`).join('');
  $('priceTable').innerHTML = '<thead><tr><th>Crop</th>' + MARKETS.map(m => `<th>${m}</th>`).join('') + '</tr></thead><tbody>' +
    Object.keys(PRICES).map(c => { const m = Math.min(...PRICES[c]); return `<tr><td><b>${c}</b></td>${PRICES[c].map(p => `<td class="${p === m ? 'lowest' : ''}">${inr(p)}</td>`).join('')}</tr>`; }).join('') + '</tbody>';
}
$('priceCrop').addEventListener('change', renderPrices);

/* ---------- Demo prediction ---------- */
function predictData(crop) {
  const base = PRICES[crop].reduce((a, b) => a + b, 0) / PRICES[crop].length;
  const hist = HIST_FACTORS.map(f => Math.round(base * f));
  const n = hist.length, xs = hist.map((_, i) => i), mx = (n - 1) / 2, my = hist.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (hist[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const fut = [0, 1, 2].map(k => Math.round((hist[n - 1] + slope * (k + 1)) * SEASON[k]));
  return { hist, fut, slope };
}
function monthLabels() {
  const out = [], d = new Date();
  for (let i = -5; i <= 3; i++) out.push(new Date(d.getFullYear(), d.getMonth() + i, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' }));
  return out;
}
function drawChart() {
  const crop = $('predictCrop').value, { hist, fut, slope } = predictData(crop);
  const labels = monthLabels();
  const histSeries = [...hist, null, null, null];
  const futSeries = [...Array(5).fill(null), hist[5], ...fut];
  if (chart) chart.destroy();
  if (typeof Chart === 'undefined') { $('predictInfo').innerHTML = '<p class="error">Chart.js failed to load. Check your internet connection.</p>'; return; }
  chart = new Chart($('priceChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Historical (sample)', data: histSeries, borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,.15)', fill: true, tension: .35, pointRadius: 5 },
      { label: 'Estimated (demo)', data: futSeries, borderColor: '#c9a227', borderDash: [8, 5], tension: .35, pointRadius: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { title: { display: true, text: crop + ' – ₹ per quintal (demo data & estimates)' }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + inr(c.parsed.y) } } },
      scales: { y: { title: { display: true, text: '₹ / quintal' } } } }
  });
  const dir = slope > 5 ? 'upward 📈' : slope < -5 ? 'downward 📉' : 'stable ➡️';
  const adv = slope > 5 ? 'Waiting a little may fetch a slightly better price (demo suggestion).' : 'Selling soon looks reasonable under this demo estimate.';
  $('predictInfo').innerHTML = `<h3>Estimated trend: ${dir}</h3><p style="margin:8px 0">Next 3 months (demo): <b>${fut.map(inr).join(' → ')}</b></p>
  <p>Method: a simple straight-line trend fitted to 6 months of sample prices (about ${slope >= 0 ? '+' : ''}${Math.round(slope)} ₹/month), multiplied by a fixed seasonal factor. ${adv}</p>
  <p class="note warn" style="margin-top:12px">Demo estimate only. No real AI or machine-learning model is used, and these numbers are not financial advice.</p>`;
}
$('predictCrop').addEventListener('change', drawChart);

/* ---------- Farmer: add / delete listings ---------- */
let imgData = '';
$('fImg').addEventListener('change', e => {
  const f = e.target.files[0]; imgData = ''; if (!f) return;
  if (!f.type.startsWith('image/')) { $('formError').textContent = 'Please choose an image file.'; e.target.value = ''; return; }
  if (f.size > 300 * 1024) { $('formError').textContent = 'Image must be under 300 KB.'; e.target.value = ''; return; }
  const r = new FileReader(); r.onload = () => { imgData = r.result; $('formError').textContent = ''; }; r.readAsDataURL(f);
});
$('cropForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('fName').value.trim(), cat = $('fCat').value, qty = Number($('fQty').value), price = Number($('fPrice').value),
    loc = $('fLoc').value.trim(), desc = $('fDesc').value.trim(), err = $('formError');
  if (name.length < 2) { err.textContent = 'Enter a valid crop name.'; return; }
  if (!Number.isInteger(qty) || qty < 1) { err.textContent = 'Quantity must be a whole number of at least 1.'; return; }
  if (!(price > 0)) { err.textContent = 'Enter a valid price per quintal.'; return; }
  if (loc.length < 2) { err.textContent = 'Enter the crop location.'; return; }
  const key = Object.keys(EMOJI).find(k => name.toLowerCase().includes(k.toLowerCase()));
  listings.unshift({ id: 'C' + Date.now(), name, cat, seller: user ? user.name : 'Demo Farmer', qty, price, loc,
    desc: desc || 'No description provided.', img: imgData || art(EMOJI[key] || '🌱', cat), mine: true });
  if (!save(KEYS.listings, listings)) { listings.shift(); return; }
  err.textContent = ''; imgData = ''; e.target.reset(); toast('Crop listed successfully!'); refresh();
});
function renderMine() {
  const mine = listings.filter(l => l.mine);
  $('myListings').innerHTML = mine.length ? mine.map(l => `<div class="listing-item"><img src="${l.img}" alt=""><div><b>${esc(l.name)}</b><br><small>${l.qty} q · ${inr(l.price)} · ${esc(l.loc)}</small></div>
    <button class="btn btn-red btn-sm" data-del="${l.id}">Delete</button></div>`).join('') : '<div class="empty">🌱 You have not added any crops yet.</div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  listings = listings.filter(l => l.id !== b.dataset.del); save(KEYS.listings, listings); toast('Listing removed.'); refresh();
});

/* ---------- Simulated auth (no passwords stored) ---------- */
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('loginForm').classList.toggle('hidden', t.dataset.tab !== 'login');
  $('registerForm').classList.toggle('hidden', t.dataset.tab !== 'register');
}));
$('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('rName').value.trim(), email = $('rEmail').value.trim().toLowerCase(), pass = $('rPass').value, role = $('rRole').value, err = $('registerError');
  if (name.length < 2) { err.textContent = 'Enter your name.'; return; }
  if (!validEmail(email)) { err.textContent = 'Enter a valid email.'; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  const acc = load(KEYS.accounts, []);
  if (acc.some(a => a.email === email)) { err.textContent = 'Email already registered.'; return; }
  acc.push({ name, email, role }); save(KEYS.accounts, acc);   // password intentionally discarded
  user = { name, email, role }; save(KEYS.user, user);
  e.target.reset(); err.textContent = ''; toast('Registered (simulated). Welcome, ' + name + '!'); refresh();
});
$('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('lEmail').value.trim().toLowerCase(), pass = $('lPass').value, err = $('loginError');
  if (!validEmail(email) || pass.length < 6) { err.textContent = 'Enter a valid email and a password of 6+ characters.'; return; }
  const acc = load(KEYS.accounts, []).find(a => a.email === email);
  if (!acc) { err.textContent = 'No demo account found. Please register first.'; return; }
  user = acc; save(KEYS.user, user); e.target.reset(); err.textContent = ''; toast('Logged in (simulated) as ' + acc.role); refresh();
});
function renderAuth() {
  $('authLink').textContent = user ? '👤 ' + user.name.split(' ')[0] : 'Login';
  $('loginForm').classList.toggle('hidden', !!user || document.querySelector('.tab.active').dataset.tab !== 'login');
  $('registerForm').classList.toggle('hidden', !!user || document.querySelector('.tab.active').dataset.tab !== 'register');
  document.querySelector('.tabs').classList.toggle('hidden', !!user);
  $('userBox').classList.toggle('hidden', !user);
  if (user) $('userBox').innerHTML = `<h3>Welcome, ${esc(user.name)}</h3><p>${esc(user.email)} · Role: <b>${esc(user.role)}</b></p>
    <p class="note" style="margin-top:12px">Simulated session stored in LocalStorage.</p><button class="btn btn-red" id="logoutBtn">Logout</button>`;
  const lb = $('logoutBtn'); if (lb) lb.addEventListener('click', () => { user = null; try { localStorage.removeItem(KEYS.user); } catch (x) {} toast('Logged out.'); refresh(); });
}

/* ---------- Refresh & init ---------- */
function refresh() { renderStats(); renderFeatured(); fillFilters(); renderMarket(); renderOrders(); renderMine(); renderAuth(); }
(function init() {
  const crops = Object.keys(PRICES).map(c => `<option>${c}</option>`).join('');
  $('priceCrop').innerHTML = crops; $('predictCrop').innerHTML = crops;
  renderPrices();
  show(location.hash.slice(1) || 'home');
})();