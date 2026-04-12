/* ============================================================
   KAUPPALISTA — app.js v4
   + qty stepper on list items
   + custom / editable categories
   + "Kaikki kategoriat" shows all products
   ============================================================ */

'use strict';

/* Default categories — user can add/remove custom ones */
const DEFAULT_CATS = [
  "Hedelmät & vihannekset","Leivät","Liha, Kana, Kala","Maitotuotteet",
  "Juustot","Munat","Rasvat","Pastat, Riisit, Nuudelit","Valmisruoka",
  "Mausteet","Hiutaleet, Murot & Myslit","Pähkinät & Siemenet","Pakasteet",
  "Kahvi & Tee","Hillot & Säilykkeet","Kodinhoito & Taloustarvikkeet",
  "Kosmetiikka & Hygienia","Urheiluravinteet & Terveys"
];

const CAT_COLORS = [
  '#5C7A5F','#C4A24A','#B85C38','#7A6BA8','#5C8AA8',
  '#A86B5C','#6BA87A','#A8965C','#5C9CA8','#A85C7A',
  '#8AA85C','#A85C5C','#5CA8A8','#A8845C','#5C6BA8',
  '#A87A5C','#6B5CA8','#5CA86B','#7A5C8A','#5C8A7A'
];

/* ─── State ─────────────────────────────────────────────── */
let items     = [];
let library   = {};   // { catName: [{id, name, unit, price}] }
let cats      = [];   // ordered list of category names (user-editable)
let filterCat = 'Kaikki';
let unit      = 'kpl';
let libUnit   = 'kpl';

/* ─── Init ──────────────────────────────────────────────── */

(function init() {
  loadFromStorage();

  populateCatSelect('inp-cat', true);   // with "Kaikki kategoriat" option
  populateCatSelect('lib-cat', false);  // without it

  render();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('popup-overlay').classList.remove('open');
      document.getElementById('lib-manager-overlay').classList.remove('open');
    }
  });

  document.getElementById('btn-open-lib').addEventListener('click', openLibPopup);
  document.getElementById('lib-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveToLibrary();
  });
  document.getElementById('new-cat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCustomCategory();
  });
})();

/* ─── Category helpers ──────────────────────────────────── */

function getCatColor(catName) {
  const idx = cats.indexOf(catName);
  return CAT_COLORS[(idx >= 0 ? idx : cats.length) % CAT_COLORS.length];
}

function populateCatSelect(id, includeAll) {
  const sel = document.getElementById(id);
  sel.innerHTML = '';

  if (includeAll) {
    const all = document.createElement('option');
    all.value = '__all__';
    all.textContent = 'Kaikki kategoriat';
    sel.appendChild(all);
    const sep = document.createElement('option'); sep.disabled = true; sep.textContent = '──────────────';
    sel.appendChild(sep);
  } else {
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = '— valitse kategoria —';
    ph.disabled = true; ph.selected = true;
    sel.appendChild(ph);
  }

  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c;
    sel.appendChild(o);
  });
}

/* ─── Category editor (in popup) ────────────────────────── */

function toggleCatEditor() {
  const ed  = document.getElementById('cat-editor');
  const btn = document.getElementById('btn-edit-cat');
  const open = ed.style.display === 'none' || ed.style.display === '';
  ed.style.display  = open ? 'block' : 'none';
  btn.classList.toggle('active', open);
  if (open) renderCatEditorList();
}

function renderCatEditorList() {
  const list = document.getElementById('cat-editor-list');
  list.innerHTML = '';
  cats.forEach(c => {
    const row = document.createElement('div');
    row.className = 'cat-editor-row';
    const inUse = library[c] && library[c].length > 0;
    row.innerHTML = `
      <span class="cat-editor-name">${escHtml(c)}</span>
      <button class="btn-cat-del" ${inUse ? 'disabled title="Kategoriassa on tuotteita"' : `title="Poista kategoria"`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    if (!inUse) {
      row.querySelector('.btn-cat-del').addEventListener('click', () => deleteCategory(c));
    }
    list.appendChild(row);
  });
}

function addCustomCategory() {
  const inp  = document.getElementById('new-cat-input');
  const name = inp.value.trim();
  if (!name) { toast('Anna kategorian nimi'); return; }
  if (cats.find(c => c.toLowerCase() === name.toLowerCase())) {
    toast('Kategoria on jo olemassa'); return;
  }
  cats.push(name);
  saveToStorage();
  populateCatSelect('inp-cat', true);
  populateCatSelect('lib-cat', false);
  renderCatEditorList();
  inp.value = '';
  toast('✓ Kategoria lisätty: ' + name);
}

function deleteCategory(name) {
  if (library[name] && library[name].length > 0) {
    toast('Poista ensin kategorian tuotteet kirjastosta'); return;
  }
  cats = cats.filter(c => c !== name);
  delete library[name];
  saveToStorage();
  populateCatSelect('inp-cat', true);
  populateCatSelect('lib-cat', false);
  renderCatEditorList();
  // Reset product select if deleted cat was selected
  const cur = document.getElementById('inp-cat').value;
  if (cur === name) {
    document.getElementById('inp-cat').value = '';
    renderProductSelect('');
  }
  toast('Kategoria poistettu: ' + name);
}

/* ─── Category & Product selects (form) ─────────────────── */

function onCatChange() {
  const cat = document.getElementById('inp-cat').value;
  renderProductSelect(cat);
}

function renderProductSelect(cat) {
  const sel = document.getElementById('inp-product');
  sel.innerHTML = '';

  if (!cat) {
    sel.innerHTML = '<option value="">— valitse ensin kategoria —</option>';
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  let products;
  if (cat === '__all__') {
    // All products from all categories, sorted alphabetically
    products = [];
    cats.forEach(c => {
      (library[c] || []).forEach(p => products.push({ ...p, _cat: c }));
    });
    products.sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  } else {
    products = (library[cat] || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }

  if (products.length === 0) {
    sel.innerHTML = '<option value="">— ei tuotteita, lisää kirjastoon —</option>';
    return;
  }

  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = '— valitse tuote —';
  sel.appendChild(ph);

  products.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    // Show category name when "all" is selected
    o.textContent = cat === '__all__' ? p.name + '  (' + (p._cat || '') + ')' : p.name;
    sel.appendChild(o);
  });
}

function onProductChange() {
  const cat = document.getElementById('inp-cat').value;
  const id  = document.getElementById('inp-product').value;
  if (!id) return;

  // Find product across all cats if "all" selected
  let product = null;
  if (cat === '__all__') {
    for (const c of cats) {
      product = (library[c] || []).find(p => String(p.id) === String(id));
      if (product) { product = { ...product, _cat: c }; break; }
    }
  } else {
    product = (library[cat] || []).find(p => String(p.id) === String(id));
  }
  if (!product) return;

  setUnit(product.unit || 'kpl');
  document.getElementById('inp-price').value = product.price ? product.price.toFixed(2) : '';
  document.getElementById('inp-qty').focus();
  document.getElementById('inp-qty').select();
}

/* ─── Unit toggle ───────────────────────────────────────── */

function setUnit(val) {
  unit = val;
  document.querySelectorAll('#unit-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
  document.getElementById('qty-label').textContent   = val === 'kg' ? 'Paino (kg)' : 'Määrä (kpl)';
  document.getElementById('price-label').textContent = val === 'kg' ? 'Hinta / kg (€)' : 'Hinta / kpl (€)';
  const qtyEl = document.getElementById('inp-qty');
  qtyEl.step  = val === 'kg' ? '0.1' : '1';
  if (parseFloat(qtyEl.value) === 1 && val === 'kg') qtyEl.value = '0.5';
  if (parseFloat(qtyEl.value) === 0.5 && val === 'kpl') qtyEl.value = '1';
}

function setLibUnit(val) {
  libUnit = val;
  document.querySelectorAll('#lib-unit-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
  document.getElementById('lib-price-label').textContent =
    val === 'kg' ? 'Hinta / kg (€) — valinnainen' : 'Hinta / kpl (€) — valinnainen';
}

/* ─── CRUD: shopping list ───────────────────────────────── */

function addItem() {
  const selCat    = document.getElementById('inp-cat').value;
  const productId = document.getElementById('inp-product').value;
  const qty       = parseFloat(document.getElementById('inp-qty').value)   || 1;
  const price     = parseFloat(document.getElementById('inp-price').value) || 0;

  if (!selCat)    { toast('Valitse ensin kategoria'); return; }
  if (!productId) { toast('Valitse tuote listasta'); return; }

  // Resolve actual category when "all" is selected
  let resolvedCat = selCat;
  let product     = null;
  if (selCat === '__all__') {
    for (const c of cats) {
      product = (library[c] || []).find(p => String(p.id) === String(productId));
      if (product) { resolvedCat = c; break; }
    }
  } else {
    product = (library[selCat] || []).find(p => String(p.id) === String(productId));
  }

  if (!product) { toast('Tuotetta ei löydy'); return; }

  // Update library price if user changed it
  if (price && price !== product.price) {
    product.price = price;
    saveToStorage();
  }

  items.push({
    id: Date.now(), name: product.name,
    cat: resolvedCat, unit: product.unit || unit,
    qty, price, done: false, libId: product.id
  });

  saveToStorage(); render();
  document.getElementById('inp-qty').value = unit === 'kg' ? '0.5' : '1';
  toast('✓ Lisätty: ' + product.name);
}

function changeQty(id, delta) {
  const it = items.find(x => x.id === id);
  if (!it) return;
  const step = (it.unit === 'kg') ? 0.1 : 1;
  it.qty = Math.max(step, parseFloat((it.qty + delta * step).toFixed(2)));
  saveToStorage(); render();
}

function toggleItem(id) {
  const it = items.find(x => x.id === id);
  if (it) { it.done = !it.done; saveToStorage(); render(); }
}

function removeItem(id) {
  const it = items.find(x => x.id === id);
  items = items.filter(x => x.id !== id);
  saveToStorage(); render();
  if (it) toast('Poistettu listalta: ' + it.name);
}

function clearAll() {
  if (items.length === 0) { toast('Lista on jo tyhjä'); return; }
  const n = items.length;
  items = []; saveToStorage(); render();
  toast('Poistettu ' + n + ' tuotetta listalta');
}

/* ─── Library popup ─────────────────────────────────────── */

function openLibPopup() {
  document.getElementById('popup-overlay').classList.add('open');
  document.getElementById('lib-name').value  = '';
  document.getElementById('lib-price').value = '';
  document.getElementById('cat-editor').style.display = 'none';
  document.getElementById('btn-edit-cat').classList.remove('active');
  libUnit = 'kpl';
  document.querySelectorAll('#lib-unit-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === 'kpl');
  });
  document.getElementById('lib-price-label').textContent = 'Hinta / kpl (€) — valinnainen';
  // reset lib-cat select
  populateCatSelect('lib-cat', false);
  setTimeout(() => document.getElementById('lib-cat').focus(), 150);
}

function closeLibPopup(e) {
  if (e && e.target !== document.getElementById('popup-overlay')) return;
  document.getElementById('popup-overlay').classList.remove('open');
}

function saveToLibrary() {
  const cat   = document.getElementById('lib-cat').value;
  const name  = document.getElementById('lib-name').value.trim();
  const price = parseFloat(document.getElementById('lib-price').value) || 0;

  if (!cat)  { toast('Valitse kategoria'); return; }
  if (!name) { toast('Anna tuotteen nimi'); return; }

  if (!library[cat]) library[cat] = [];

  const dupe = library[cat].find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dupe) { toast('Tuote on jo kirjastossa: ' + dupe.name); return; }

  library[cat].push({ id: Date.now(), name, unit: libUnit, price });
  library[cat].sort((a, b) => a.name.localeCompare(b.name, 'fi'));

  saveToStorage();

  const formCat = document.getElementById('inp-cat').value;
  if (formCat === cat || formCat === '__all__') renderProductSelect(formCat);

  toast('✓ Tallennettu kirjastoon: ' + name);
  document.getElementById('popup-overlay').classList.remove('open');
}

/* ─── Library manager ───────────────────────────────────── */

function openLibraryManager() {
  renderLibraryManager();
  document.getElementById('lib-manager-overlay').classList.add('open');
}

function closeLibManager(e) {
  if (e && e.target !== document.getElementById('lib-manager-overlay')) return;
  document.getElementById('lib-manager-overlay').classList.remove('open');
}

function renderLibraryManager() {
  const body     = document.getElementById('lib-manager-body');
  const usedCats = cats.filter(c => library[c] && library[c].length > 0);

  if (usedCats.length === 0) {
    body.innerHTML = '<div class="lib-empty">Kirjasto on tyhjä.<br>Lisää tuotteita + Uusi tuote -napista.</div>';
    return;
  }

  body.innerHTML = '';

  usedCats.forEach(cat => {
    const products = library[cat] || [];
    const color    = getCatColor(cat);

    const section = document.createElement('div');
    section.className = 'lib-cat-section';
    section.innerHTML = `
      <div class="lib-cat-heading">
        <span class="cat-dot" style="background:${color}"></span>
        ${escHtml(cat)}
        <span style="font-family:'DM Sans',sans-serif;font-size:12px;color:var(--ink-faint);font-style:normal">${products.length} tuotetta</span>
      </div>`;

    products.forEach(p => {
      const row = document.createElement('div');
      row.className = 'lib-product-row';
      row.innerHTML = `
        <span class="lib-product-name">${escHtml(p.name)}</span>
        <span class="lib-product-meta">${p.unit || 'kpl'}${p.price ? ' · ' + fmtPrice(p.price) : ''}</span>
        <button class="btn-lib-del" title="Poista kirjastosta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      row.querySelector('.btn-lib-del').addEventListener('click', () => deleteFromLibrary(cat, p.id));
      section.appendChild(row);
    });

    body.appendChild(section);
  });
}

function deleteFromLibrary(cat, id) {
  if (!library[cat]) return;
  const product = library[cat].find(p => p.id === id);
  library[cat]  = library[cat].filter(p => p.id !== id);
  if (library[cat].length === 0) delete library[cat];
  saveToStorage();
  renderLibraryManager();
  const formCat = document.getElementById('inp-cat').value;
  if (formCat === cat || formCat === '__all__') renderProductSelect(formCat);
  if (product) toast('Poistettu kirjastosta: ' + product.name);
}

/* ─── Render ─────────────────────────────────────────────── */

function render() {
  updateSummary();
  renderFilterBar();
  renderList();
  updateTotalBar();
}

function updateSummary() {
  const done = items.filter(i => i.done).length;
  document.getElementById('pill-count').textContent = items.length + ' tuotetta';
  document.getElementById('pill-done').textContent  = done + ' / ' + items.length + ' ostettu';
}

function updateTotalBar() {
  const bar    = document.getElementById('total-bar');
  const amount = document.getElementById('total-bar-amount');
  const sub    = document.getElementById('total-bar-sub');

  if (items.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = '';

  const total   = items.reduce((s, i) => s + i.qty * i.price, 0);
  const done    = items.filter(i => i.done).length;
  const doneAmt = items.filter(i => i.done).reduce((s, i) => s + i.qty * i.price, 0);

  amount.textContent = fmt(total);
  sub.textContent    = done > 0
    ? done + ' ostettu · ' + fmt(doneAmt) + ' käytetty'
    : items.length + ' tuotetta ostamatta';
}

function renderFilterBar() {
  const usedCats = [...new Set(items.map(i => i.cat))]
    .sort((a, b) => cats.indexOf(a) - cats.indexOf(b));

  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  appendFilterBtn(bar, 'Kaikki', 'Kaikki (' + items.length + ')');
  usedCats.forEach(c => {
    const count = items.filter(i => i.cat === c).length;
    appendFilterBtn(bar, c, c + ' (' + count + ')');
  });
}

function appendFilterBtn(container, value, label) {
  const btn = document.createElement('button');
  btn.className = 'filter-btn' + (filterCat === value ? ' active' : '');
  btn.textContent = label;
  btn.addEventListener('click', () => { filterCat = value; render(); });
  container.appendChild(btn);
}

function renderList() {
  const container = document.getElementById('list-container');
  const visible   = filterCat === 'Kaikki'
    ? items
    : items.filter(i => i.cat === filterCat);

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </div>
        <p>${items.length === 0 ? 'Lista on tyhjä' : 'Ei tuotteita tässä kategoriassa'}</p>
        <span>${items.length === 0 ? 'Valitse kategoria ja tuote ylhäältä' : 'Valitse toinen kategoria'}</span>
      </div>`;
    return;
  }

  const groups = {};
  cats.forEach(c => { groups[c] = []; });
  visible.forEach(i => {
    if (!groups[i.cat]) groups[i.cat] = [];
    groups[i.cat].push(i);
  });

  container.innerHTML = '';

  // Render in category order, plus any unknown cats at end
  const orderedCats = [...cats, ...Object.keys(groups).filter(c => !cats.includes(c))];

  orderedCats.forEach(cat => {
    if (!groups[cat] || groups[cat].length === 0) return;

    const catItems  = groups[cat];
    const catTotal  = catItems.reduce((s, i) => s + i.qty * i.price, 0);
    const colorDot  = getCatColor(cat);
    const doneCount = catItems.filter(i => i.done).length;

    const section = document.createElement('div');
    section.className = 'cat-group';
    section.innerHTML = `
      <div class="cat-header">
        <div class="cat-name">
          <span class="cat-dot" style="background:${colorDot}"></span>
          ${escHtml(cat)}
          ${doneCount > 0 && doneCount < catItems.length
            ? `<span style="font-size:12px;color:var(--ink-faint);font-family:'DM Sans',sans-serif;font-style:normal">${doneCount}/${catItems.length}</span>`
            : ''}
        </div>
        <div class="cat-subtotal">${fmt(catTotal)}</div>
      </div>`;

    catItems.forEach(it => section.appendChild(buildItemRow(it)));
    container.appendChild(section);
  });
}

function buildItemRow(it) {
  const row = document.createElement('div');
  row.className = 'item' + (it.done ? ' checked' : '');
  row.dataset.id = it.id;

  const u      = it.unit || 'kpl';
  const step   = u === 'kg' ? 0.1 : 1;
  const qtyStr = u === 'kg'
    ? it.qty.toFixed(it.qty % 1 === 0 ? 0 : 1) + ' kg'
    : (it.qty % 1 === 0 ? it.qty : it.qty.toFixed(1)) + ' kpl';

  row.innerHTML = `
    <input type="checkbox" class="item-check" ${it.done ? 'checked' : ''} />
    <div class="item-info">
      <div class="item-name">${escHtml(it.name)}</div>
    </div>
    <div class="qty-stepper">
      <button class="qty-btn btn-minus" title="Vähennä">−</button>
      <span class="qty-value">${qtyStr}</span>
      <button class="qty-btn btn-plus" title="Lisää">+</button>
    </div>
    <div class="item-price">${fmtPrice(it.price)}${u === 'kg' ? '<span style="font-size:10px;color:var(--ink-faint)">/kg</span>' : ''}</div>
    <div class="item-total">${fmt(it.qty * it.price)}</div>
    <button class="btn-del" title="Poista listalta">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;

  row.querySelector('.item-check').addEventListener('change', () => toggleItem(it.id));
  row.querySelector('.btn-minus').addEventListener('click',   () => changeQty(it.id, -1));
  row.querySelector('.btn-plus').addEventListener('click',    () => changeQty(it.id, +1));
  row.querySelector('.btn-del').addEventListener('click',     () => removeItem(it.id));
  return row;
}

/* ─── Storage ───────────────────────────────────────────── */

function saveToStorage() {
  try {
    localStorage.setItem('kauppalista_items_v4',   JSON.stringify(items));
    localStorage.setItem('kauppalista_library_v4', JSON.stringify(library));
    localStorage.setItem('kauppalista_cats_v4',    JSON.stringify(cats));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    const rawItems = localStorage.getItem('kauppalista_items_v4');
    const rawLib   = localStorage.getItem('kauppalista_library_v4');
    const rawCats  = localStorage.getItem('kauppalista_cats_v4');

    cats    = rawCats  ? JSON.parse(rawCats)  : DEFAULT_CATS.slice();
    library = rawLib   ? JSON.parse(rawLib)   : {};
    items   = rawItems ? JSON.parse(rawItems) : [];

    // Migrate from v3
    if (!rawItems) {
      const v3Items = localStorage.getItem('kauppalista_items_v3');
      const v3Lib   = localStorage.getItem('kauppalista_library_v3');
      if (v3Items) items   = JSON.parse(v3Items);
      if (v3Lib)   library = JSON.parse(v3Lib);
      // Ensure all library cats exist in cats list
      Object.keys(library).forEach(c => { if (!cats.includes(c)) cats.push(c); });
      saveToStorage();
    }
  } catch(e) { cats = DEFAULT_CATS.slice(); library = {}; items = []; }
}

/* ─── Export / Import ───────────────────────────────────── */

function exportJSON() {
  const data = { items, library, cats };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, 'kauppalista_' + dateStamp() + '.json');
  toast('Viety JSON-tiedostona');
}

function exportCSV() {
  const rows = [['Tuote','Kategoria','Yksikkö','Määrä','Hinta €','Yhteensä €','Ostettu']];
  items.forEach(i => rows.push([
    i.name, i.cat, i.unit || 'kpl',
    (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(1)),
    i.price.toFixed(2), (i.qty * i.price).toFixed(2),
    i.done ? 'Kyllä' : 'Ei'
  ]));
  const csv  = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, 'kauppalista_' + dateStamp() + '.csv');
  toast('Viety CSV-tiedostona');
}

function importList(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(ev.target.result);
        if (data.items && data.library) {
          items   = data.items;
          library = data.library;
          cats    = data.cats || DEFAULT_CATS.slice();
        } else if (Array.isArray(data)) {
          items = data;
        } else throw new Error();
        saveToStorage();
        populateCatSelect('inp-cat', true);
        populateCatSelect('lib-cat', false);
        render();
        toast('Tuotu ' + items.length + ' tuotetta');
      } else {
        const lines    = ev.target.result.split(/\r?\n/).filter(Boolean);
        const imported = [];
        lines.slice(1).forEach(line => {
          const cols = parseCSVLine(line);
          if (cols[0]) imported.push({
            id: Date.now() + Math.random(),
            name: cols[0], cat: cats.includes(cols[1]) ? cols[1] : cats[0],
            unit: cols[2] === 'kg' ? 'kg' : 'kpl',
            qty: parseFloat(cols[3]) || 1, price: parseFloat(cols[4]) || 0,
            done: cols[6] === 'Kyllä'
          });
        });
        items = imported; saveToStorage(); render();
        toast('Tuotu ' + imported.length + ' tuotetta');
      }
    } catch(err) { toast('Virhe: tiedostoa ei voitu lukea'); }
  };
  reader.readAsText(file, 'utf-8');
  e.target.value = '';
}

/* ─── Helpers ───────────────────────────────────────────── */

function fmt(n) {
  return n.toLocaleString('fi-FI', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}
function fmtPrice(n) {
  if (!n || n === 0) return '—';
  return n.toLocaleString('fi-FI', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dateStamp() { return new Date().toISOString().slice(0,10); }
function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function parseCSVLine(line) {
  const result = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if      (ch === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
    else if (ch === '"')                              { inQ = !inQ; }
    else if (ch === ',' && !inQ)                     { result.push(cur); cur = ''; }
    else                                              { cur += ch; }
  }
  result.push(cur); return result;
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
