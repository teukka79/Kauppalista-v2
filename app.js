/* ============================================================
   KAUPPALISTA — app.js v5
   Two tabs: Ruoka & Tavarat — each with own items, library, cats
   ============================================================ */

'use strict';

const DEFAULT_CATS_RUOKA = [
  "Hedelmät & vihannekset","Leivät","Liha, Kana, Kala","Maitotuotteet",
  "Juustot","Munat","Rasvat","Pastat, Riisit, Nuudelit","Valmisruoka",
  "Mausteet","Hiutaleet, Murot & Myslit","Pähkinät & Siemenet","Pakasteet",
  "Kahvi & Tee","Hillot & Säilykkeet"
];

const DEFAULT_CATS_TAVARAT = [
  "Kodinhoito & Taloustarvikkeet","Kosmetiikka & Hygienia",
  "Urheiluravinteet & Terveys","Elektroniikka","Vaatteet & Tekstiilit",
  "Kodin sisustus","Työkalut & Tarvikkeet","Lemmikkitarvikkeet","Muut tavarat"
];

const CAT_COLORS = [
  '#5C7A5F','#C4A24A','#B85C38','#7A6BA8','#5C8AA8',
  '#A86B5C','#6BA87A','#A8965C','#5C9CA8','#A85C7A',
  '#8AA85C','#A85C5C','#5CA8A8','#A8845C','#5C6BA8',
  '#A87A5C','#6B5CA8','#5CA86B','#7A5C8A','#5C8A7A'
];

/* ─── Tab state ─────────────────────────────────────────── */
/* Each tab has independent: items, library, cats, filterCat */
const TABS = {
  ruoka: {
    label:     'Ruoka',
    addLabel:  'Lisää ruokalistalle',
    items:     [],
    library:   {},
    cats:      [],
    filterCat: 'Kaikki'
  },
  tavarat: {
    label:     'Tavarat',
    addLabel:  'Lisää tavaroihin',
    items:     [],
    library:   {},
    cats:      [],
    filterCat: 'Kaikki'
  }
};

let activeTab = 'ruoka';   // 'ruoka' | 'tavarat'
let unit      = 'kpl';
let libUnit   = 'kpl';
let libTab    = 'ruoka';   // which tab the library popup targets
let lmTab     = 'ruoka';   // which tab the library manager shows

/* ─── Convenience getters ───────────────────────────────── */
function T()       { return TABS[activeTab]; }
function LT()      { return TABS[libTab]; }

/* ─── Init ──────────────────────────────────────────────── */

(function init() {
  loadFromStorage();

  refreshFormSelects();
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
  document.getElementById('btn-tavarat-lib').addEventListener('click', () => {
    const picker = document.getElementById('tavarat-lib-picker');
    if (picker.style.display === 'none' || picker.style.display === '') {
      openTavaratLibPicker();
    } else {
      closeTavaratLibPicker();
    }
  });
  document.getElementById('inp-tavarat-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addItem();
  });
  // Hide lib picker when clicking outside
  document.addEventListener('click', e => {
    const picker = document.getElementById('tavarat-lib-picker');
    if (picker.style.display !== 'none') {
      const btn = document.getElementById('btn-tavarat-lib');
      if (!picker.contains(e.target) && !btn.contains(e.target)) closeTavaratLibPicker();
    }
  });
})();

/* ─── Tab switching ─────────────────────────────────────── */

function switchTab(tab) {
  activeTab = tab;
  unit = 'kpl';

  document.getElementById('tab-ruoka').classList.toggle('active',   tab === 'ruoka');
  document.getElementById('tab-tavarat').classList.toggle('active', tab === 'tavarat');
  document.getElementById('add-section-label').textContent = T().addLabel;

  // Show/hide tab-specific form elements
  const isRuoka = tab === 'ruoka';
  document.getElementById('row-ruoka-product').style.display  = isRuoka ? '' : 'none';
  document.getElementById('row-ruoka-unit').style.display     = isRuoka ? '' : 'none';
  document.getElementById('row-tavarat-product').style.display = isRuoka ? 'none' : '';
  document.getElementById('tavarat-lib-picker').style.display  = 'none';

  // Adjust grid positions for qty/price when tavarat (no unit col)
  const qtyField   = document.querySelector('.field-qty');
  const priceField = document.querySelector('.field-price');
  if (isRuoka) {
    qtyField.style.gridColumn   = '3';
    priceField.style.gridColumn = '4';
  } else {
    qtyField.style.gridColumn   = '3';
    priceField.style.gridColumn = '4';
  }

  // Update qty label (no kg on tavarat)
  document.getElementById('qty-label').textContent   = 'Määrä (kpl)';
  document.getElementById('price-label').textContent = 'Hinta / kpl (€)';

  // Reset form fields
  setUnit('kpl');
  document.getElementById('inp-price').value = '';
  document.getElementById('inp-qty').value   = '1';
  document.getElementById('inp-tavarat-name').value = '';

  refreshFormSelects();
  render();
}

/* ─── Category helpers ──────────────────────────────────── */

function getCatColor(catName, tabKey) {
  const t   = TABS[tabKey || activeTab];
  const idx = t.cats.indexOf(catName);
  return CAT_COLORS[(idx >= 0 ? idx : t.cats.length) % CAT_COLORS.length];
}

function populateCatSelect(selId, tabKey, includeAll) {
  const sel  = document.getElementById(selId);
  const cats = TABS[tabKey].cats;
  sel.innerHTML = '';

  if (includeAll) {
    const all = document.createElement('option');
    all.value = '__all__'; all.textContent = 'Kaikki kategoriat';
    sel.appendChild(all);
    const sep = document.createElement('option');
    sep.disabled = true; sep.textContent = '──────────────';
    sel.appendChild(sep);
  } else {
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = '— valitse kategoria —';
    ph.disabled = true; ph.selected = true;
    sel.appendChild(ph);
  }

  cats.slice().sort((a, b) => a.localeCompare(b, 'fi')).forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c;
    sel.appendChild(o);
  });
}

function refreshFormSelects() {
  populateCatSelect('inp-cat', activeTab, true);
  document.getElementById('inp-product').innerHTML =
    '<option value="">— valitse ensin kategoria —</option>';
  document.getElementById('inp-product').disabled = true;
}

/* ─── Category editor ───────────────────────────────────── */

function toggleCatEditor() {
  const ed  = document.getElementById('cat-editor');
  const btn = document.getElementById('btn-edit-cat');
  const open = ed.style.display === 'none' || ed.style.display === '';
  ed.style.display = open ? 'block' : 'none';
  btn.classList.toggle('active', open);
  if (open) renderCatEditorList();
}

function renderCatEditorList() {
  const list = document.getElementById('cat-editor-list');
  list.innerHTML = '';
  LT().cats.forEach(c => {
    const row = document.createElement('div');
    row.className = 'cat-editor-row';
    const inUse = LT().library[c] && LT().library[c].length > 0;
    row.innerHTML = `
      <span class="cat-editor-name">${escHtml(c)}</span>
      <button class="btn-cat-del" ${inUse ? 'disabled title="Kategoriassa on tuotteita"' : 'title="Poista"'}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    if (!inUse) {
      row.querySelector('.btn-cat-del').addEventListener('click', () => deleteCategoryLib(c));
    }
    list.appendChild(row);
  });
}

function addCustomCategory() {
  const inp  = document.getElementById('new-cat-input');
  const name = inp.value.trim();
  if (!name) { toast('Anna kategorian nimi'); return; }
  if (LT().cats.find(c => c.toLowerCase() === name.toLowerCase())) {
    toast('Kategoria on jo olemassa'); return;
  }
  LT().cats.push(name);
  saveToStorage();
  // Refresh lib-cat select (stays in libTab context)
  populateCatSelect('lib-cat', libTab, false);
  // If libTab === activeTab, refresh form too
  if (libTab === activeTab) refreshFormSelects();
  renderCatEditorList();
  inp.value = '';
  toast('✓ Kategoria lisätty: ' + name);
}

function deleteCategoryLib(name) {
  if (LT().library[name] && LT().library[name].length > 0) {
    toast('Poista ensin kategorian tuotteet kirjastosta'); return;
  }
  LT().cats = LT().cats.filter(c => c !== name);
  delete LT().library[name];
  saveToStorage();
  populateCatSelect('lib-cat', libTab, false);
  if (libTab === activeTab) refreshFormSelects();
  renderCatEditorList();
  toast('Kategoria poistettu: ' + name);
}

/* ─── Form: Category & Product selects ──────────────────── */

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
  const lib = T().library;
  const cats = T().cats;

  let products;
  if (cat === '__all__') {
    products = [];
    cats.forEach(c => (lib[c] || []).forEach(p => products.push({ ...p, _cat: c })));
    products.sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  } else {
    products = (lib[cat] || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fi'));
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
    o.textContent = cat === '__all__' ? p.name + '  (' + (p._cat || '') + ')' : p.name;
    sel.appendChild(o);
  });
}

function onProductChange() {
  const cat = document.getElementById('inp-cat').value;
  const id  = document.getElementById('inp-product').value;
  if (!id) return;

  let product = null;
  const lib = T().library;
  if (cat === '__all__') {
    for (const c of T().cats) {
      product = (lib[c] || []).find(p => String(p.id) === String(id));
      if (product) { product = { ...product, _cat: c }; break; }
    }
  } else {
    product = (lib[cat] || []).find(p => String(p.id) === String(id));
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
  if (parseFloat(qtyEl.value) === 1   && val === 'kg')  qtyEl.value = '0.5';
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

/* ─── Library popup tab ─────────────────────────────────── */

function setLibTab(val) {
  libTab = val;
  document.querySelectorAll('#lib-tab-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
  populateCatSelect('lib-cat', libTab, false);
  document.getElementById('cat-editor').style.display = 'none';
  document.getElementById('btn-edit-cat').classList.remove('active');
  // Hide kg unit option for tavarat (no weight-based products)
  document.getElementById('lib-unit-row').style.display = val === 'tavarat' ? 'none' : '';
  if (val === 'tavarat') { libUnit = 'kpl'; }
}

/* ─── Library manager tab ───────────────────────────────── */

function switchLibManagerTab(tab) {
  lmTab = tab;
  document.getElementById('lm-tab-ruoka').classList.toggle('active',   tab === 'ruoka');
  document.getElementById('lm-tab-tavarat').classList.toggle('active', tab === 'tavarat');
  renderLibraryManager();
}

/* ─── CRUD: shopping list ───────────────────────────────── */

function addItem() {
  const qty   = parseFloat(document.getElementById('inp-qty').value)   || 1;
  const price = parseFloat(document.getElementById('inp-price').value) || 0;

  if (activeTab === 'tavarat') {
    // ── Tavarat: free-text name, optional category, no unit ──
    const name   = document.getElementById('inp-tavarat-name').value.trim();
    const selCat = document.getElementById('inp-cat').value;
    if (!name) { toast('Kirjoita tuotteen nimi'); document.getElementById('inp-tavarat-name').focus(); return; }
    if (!selCat) { toast('Valitse ensin kategoria'); return; }

    const resolvedCat = selCat === '__all__' ? (T().cats[0] || 'Muut') : selCat;

    T().items.push({
      id: Date.now(), name, cat: resolvedCat,
      unit: 'kpl', qty, price, done: false
    });
    saveToStorage(); render();
    document.getElementById('inp-tavarat-name').value = '';
    document.getElementById('inp-qty').value = '1';
    closeTavaratLibPicker();
    toast('✓ Lisätty: ' + name);
    return;
  }

  // ── Ruoka: library-based select ──
  const selCat    = document.getElementById('inp-cat').value;
  const productId = document.getElementById('inp-product').value;

  if (!selCat)    { toast('Valitse ensin kategoria'); return; }
  if (!productId) { toast('Valitse tuote listasta');  return; }

  let resolvedCat = selCat;
  let product     = null;
  const lib = T().library;

  if (selCat === '__all__') {
    for (const c of T().cats) {
      product = (lib[c] || []).find(p => String(p.id) === String(productId));
      if (product) { resolvedCat = c; break; }
    }
  } else {
    product = (lib[selCat] || []).find(p => String(p.id) === String(productId));
  }

  if (!product) { toast('Tuotetta ei löydy'); return; }

  if (price && price !== product.price) {
    product.price = price;
    saveToStorage();
  }

  T().items.push({
    id: Date.now(), name: product.name,
    cat: resolvedCat, unit: product.unit || unit,
    qty, price, done: false, libId: product.id
  });

  saveToStorage(); render();
  document.getElementById('inp-qty').value = unit === 'kg' ? '0.5' : '1';
  toast('✓ Lisätty: ' + product.name);
}

function changeQty(id, delta) {
  const it = T().items.find(x => x.id === id);
  if (!it) return;
  const step = it.unit === 'kg' ? 0.1 : 1;
  it.qty = Math.max(step, parseFloat((it.qty + delta * step).toFixed(2)));
  saveToStorage(); render();
}

function toggleItem(id) {
  const it = T().items.find(x => x.id === id);
  if (it) { it.done = !it.done; saveToStorage(); render(); }
}

function removeItem(id) {
  const it = T().items.find(x => x.id === id);
  T().items = T().items.filter(x => x.id !== id);
  saveToStorage(); render();
  if (it) toast('Poistettu: ' + it.name);
}

function clearAll() {
  if (T().items.length === 0) { toast('Lista on jo tyhjä'); return; }
  const n = T().items.length;
  T().items = []; saveToStorage(); render();
  toast('Poistettu ' + n + ' tuotetta');
}

/* ─── Tavarat: inline library picker ────────────────────── */

function openTavaratLibPicker() {
  const picker = document.getElementById('tavarat-lib-picker');
  const btn    = document.getElementById('btn-tavarat-lib');
  const list   = document.getElementById('tlp-list');
  const lib    = T().library;
  const cats   = T().cats;

  // Build list grouped by category, alphabetical
  list.innerHTML = '';

  const sortedCats = cats.slice().sort((a, b) => a.localeCompare(b, 'fi'))
    .filter(c => lib[c] && lib[c].length > 0);

  if (sortedCats.length === 0) {
    list.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--ink-faint);text-align:center">Kirjasto on tyhjä</div>';
  } else {
    sortedCats.forEach(cat => {
      const label = document.createElement('div');
      label.className = 'tlp-cat-label';
      label.textContent = cat;
      list.appendChild(label);

      (lib[cat] || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fi')).forEach(p => {
        const item = document.createElement('button');
        item.className = 'tlp-item';
        item.innerHTML = `
          <span>${escHtml(p.name)}</span>
          ${p.price ? `<span class="tlp-item-price">${fmtPrice(p.price)}</span>` : ''}`;
        item.addEventListener('click', () => {
          document.getElementById('inp-tavarat-name').value = p.name;
          if (p.price) document.getElementById('inp-price').value = p.price.toFixed(2);
          closeTavaratLibPicker();
          document.getElementById('inp-qty').focus();
        });
        list.appendChild(item);
      });
    });
  }

  picker.style.display = 'flex';
  btn.classList.add('open');
}

function closeTavaratLibPicker() {
  document.getElementById('tavarat-lib-picker').style.display = 'none';
  document.getElementById('btn-tavarat-lib').classList.remove('open');
}

/* ─── Library popup ─────────────────────────────────────── */

function openLibPopup() {
  // Default popup tab to active tab
  libTab = activeTab;
  document.querySelectorAll('#lib-tab-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === libTab);
  });
  populateCatSelect('lib-cat', libTab, false);

  document.getElementById('lib-name').value  = '';
  document.getElementById('lib-price').value = '';
  document.getElementById('cat-editor').style.display = 'none';
  document.getElementById('btn-edit-cat').classList.remove('active');
  libUnit = 'kpl';
  document.querySelectorAll('#lib-unit-toggle .toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === 'kpl');
  });
  document.getElementById('lib-price-label').textContent = 'Hinta / kpl (€) — valinnainen';
  document.getElementById('lib-unit-row').style.display = libTab === 'tavarat' ? 'none' : '';
  if (libTab === 'tavarat') libUnit = 'kpl';
  document.getElementById('popup-overlay').classList.add('open');
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

  if (!LT().library[cat]) LT().library[cat] = [];

  const dupe = LT().library[cat].find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dupe) { toast('Tuote on jo kirjastossa: ' + dupe.name); return; }

  LT().library[cat].push({ id: Date.now(), name, unit: libUnit, price });
  LT().library[cat].sort((a, b) => a.name.localeCompare(b.name, 'fi'));

  saveToStorage();

  // Refresh form if lib tab matches active tab
  if (libTab === activeTab) {
    const formCat = document.getElementById('inp-cat').value;
    if (formCat === cat || formCat === '__all__') renderProductSelect(formCat);
  }

  toast('✓ Tallennettu: ' + name + ' → ' + LT().label);
  document.getElementById('popup-overlay').classList.remove('open');
}

/* ─── Library manager ───────────────────────────────────── */

function openLibraryManager() {
  lmTab = activeTab;
  document.getElementById('lm-tab-ruoka').classList.toggle('active',   lmTab === 'ruoka');
  document.getElementById('lm-tab-tavarat').classList.toggle('active', lmTab === 'tavarat');
  renderLibraryManager();
  document.getElementById('lib-manager-overlay').classList.add('open');
}

function closeLibManager(e) {
  if (e && e.target !== document.getElementById('lib-manager-overlay')) return;
  document.getElementById('lib-manager-overlay').classList.remove('open');
}

function renderLibraryManager() {
  const body    = document.getElementById('lib-manager-body');
  const t       = TABS[lmTab];
  const usedCats = t.cats.filter(c => t.library[c] && t.library[c].length > 0);

  if (usedCats.length === 0) {
    body.innerHTML = '<div class="lib-empty">Kirjasto on tyhjä.<br>Lisää tuotteita + Uusi tuote -napista.</div>';
    return;
  }

  body.innerHTML = '';

  usedCats.slice().sort((a, b) => a.localeCompare(b, 'fi')).forEach(cat => {
    const products = t.library[cat] || [];
    const color    = getCatColor(cat, lmTab);

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
      row.querySelector('.btn-lib-del').addEventListener('click', () => deleteFromLibrary(lmTab, cat, p.id));
      section.appendChild(row);
    });
    body.appendChild(section);
  });
}

function deleteFromLibrary(tabKey, cat, id) {
  const t = TABS[tabKey];
  if (!t.library[cat]) return;
  const product = t.library[cat].find(p => p.id === id);
  t.library[cat] = t.library[cat].filter(p => p.id !== id);
  if (t.library[cat].length === 0) delete t.library[cat];
  saveToStorage();
  renderLibraryManager();
  if (tabKey === activeTab) {
    const formCat = document.getElementById('inp-cat').value;
    if (formCat === cat || formCat === '__all__') renderProductSelect(formCat);
  }
  if (product) toast('Poistettu kirjastosta: ' + product.name);
}

/* ─── Render ─────────────────────────────────────────────── */

function render() {
  updateSummary();
  updateBadges();
  renderFilterBar();
  renderList();
  updateTotalBar();
}

function updateBadges() {
  const rCount = TABS.ruoka.items.filter(i => !i.done).length;
  const tCount = TABS.tavarat.items.filter(i => !i.done).length;
  document.getElementById('badge-ruoka').textContent   = rCount   || '';
  document.getElementById('badge-tavarat').textContent = tCount   || '';
}

function updateSummary() {
  const done = T().items.filter(i => i.done).length;
  document.getElementById('pill-count').textContent = T().items.length + ' tuotetta';
  document.getElementById('pill-done').textContent  = done + ' / ' + T().items.length + ' ostettu';
}

function updateTotalBar() {
  const bar    = document.getElementById('total-bar');
  const amount = document.getElementById('total-bar-amount');
  const sub    = document.getElementById('total-bar-sub');

  if (T().items.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = '';

  const total   = T().items.reduce((s, i) => s + i.qty * i.price, 0);
  const done    = T().items.filter(i => i.done).length;
  const doneAmt = T().items.filter(i => i.done).reduce((s, i) => s + i.qty * i.price, 0);

  amount.textContent = fmt(total);
  sub.textContent    = done > 0
    ? done + ' ostettu · ' + fmt(doneAmt) + ' käytetty'
    : T().items.length + ' tuotetta ostamatta';
}

function renderFilterBar() {
  const usedCats = [...new Set(T().items.map(i => i.cat))]
    .sort((a, b) => T().cats.indexOf(a) - T().cats.indexOf(b));

  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  appendFilterBtn(bar, 'Kaikki', 'Kaikki (' + T().items.length + ')');
  usedCats.forEach(c => {
    const count = T().items.filter(i => i.cat === c).length;
    appendFilterBtn(bar, c, c + ' (' + count + ')');
  });
}

function appendFilterBtn(container, value, label) {
  const btn = document.createElement('button');
  btn.className = 'filter-btn' + (T().filterCat === value ? ' active' : '');
  btn.textContent = label;
  btn.addEventListener('click', () => { T().filterCat = value; render(); });
  container.appendChild(btn);
}

function renderList() {
  const container = document.getElementById('list-container');
  const visible   = T().filterCat === 'Kaikki'
    ? T().items
    : T().items.filter(i => i.cat === T().filterCat);

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </div>
        <p>${T().items.length === 0 ? 'Lista on tyhjä' : 'Ei tuotteita tässä kategoriassa'}</p>
        <span>${T().items.length === 0 ? 'Valitse kategoria ja tuote ylhäältä' : 'Valitse toinen kategoria'}</span>
      </div>`;
    return;
  }

  const groups = {};
  T().cats.forEach(c => { groups[c] = []; });
  visible.forEach(i => {
    if (!groups[i.cat]) groups[i.cat] = [];
    groups[i.cat].push(i);
  });

  container.innerHTML = '';

  const orderedCats = [...T().cats, ...Object.keys(groups).filter(c => !T().cats.includes(c))];
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
  const qtyStr = u === 'kg'
    ? it.qty.toFixed(it.qty % 1 === 0 ? 0 : 1) + ' kg'
    : (it.qty % 1 === 0 ? it.qty : it.qty.toFixed(1)) + ' kpl';
  const unitSuffix = u === 'kg' ? '<span class="per-unit">/kg</span>' : '';

  row.innerHTML = `
    <div class="item-row1">
      <input type="checkbox" class="item-check" ${it.done ? 'checked' : ''} />
      <div class="item-name">${escHtml(it.name)}</div>
      <button class="btn-del" title="Poista listalta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="item-row2">
      <div class="qty-stepper">
        <button class="qty-btn btn-minus" title="Vähennä">−</button>
        <span class="qty-value">${qtyStr}</span>
        <button class="qty-btn btn-plus" title="Lisää">+</button>
      </div>
      <div class="item-price">${fmtPrice(it.price)}${unitSuffix}</div>
      <div class="item-total">${fmt(it.qty * it.price)}</div>
    </div>`;

  row.querySelector('.item-check').addEventListener('change', () => toggleItem(it.id));
  row.querySelector('.btn-minus').addEventListener('click',   () => changeQty(it.id, -1));
  row.querySelector('.btn-plus').addEventListener('click',    () => changeQty(it.id, +1));
  row.querySelector('.btn-del').addEventListener('click',     () => removeItem(it.id));
  return row;
}

/* ─── Storage ───────────────────────────────────────────── */

function saveToStorage() {
  try {
    localStorage.setItem('kl_ruoka_items',   JSON.stringify(TABS.ruoka.items));
    localStorage.setItem('kl_ruoka_lib',     JSON.stringify(TABS.ruoka.library));
    localStorage.setItem('kl_ruoka_cats',    JSON.stringify(TABS.ruoka.cats));
    localStorage.setItem('kl_tavarat_items', JSON.stringify(TABS.tavarat.items));
    localStorage.setItem('kl_tavarat_lib',   JSON.stringify(TABS.tavarat.library));
    localStorage.setItem('kl_tavarat_cats',  JSON.stringify(TABS.tavarat.cats));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    TABS.ruoka.items   = JSON.parse(localStorage.getItem('kl_ruoka_items')   || 'null') || [];
    TABS.ruoka.library = JSON.parse(localStorage.getItem('kl_ruoka_lib')     || 'null') || {};
    TABS.ruoka.cats    = JSON.parse(localStorage.getItem('kl_ruoka_cats')    || 'null') || DEFAULT_CATS_RUOKA.slice();

    TABS.tavarat.items   = JSON.parse(localStorage.getItem('kl_tavarat_items') || 'null') || [];
    TABS.tavarat.library = JSON.parse(localStorage.getItem('kl_tavarat_lib')   || 'null') || {};
    TABS.tavarat.cats    = JSON.parse(localStorage.getItem('kl_tavarat_cats')  || 'null') || DEFAULT_CATS_TAVARAT.slice();

    // Migrate from v4 (single list → ruoka tab)
    const v4Items = localStorage.getItem('kauppalista_items_v4');
    const v4Lib   = localStorage.getItem('kauppalista_library_v4');
    const v4Cats  = localStorage.getItem('kauppalista_cats_v4');
    if (v4Items && TABS.ruoka.items.length === 0) {
      TABS.ruoka.items   = JSON.parse(v4Items) || [];
      TABS.ruoka.library = JSON.parse(v4Lib)   || {};
      TABS.ruoka.cats    = JSON.parse(v4Cats)  || DEFAULT_CATS_RUOKA.slice();
      saveToStorage();
    }
  } catch(e) {
    TABS.ruoka.cats    = DEFAULT_CATS_RUOKA.slice();
    TABS.tavarat.cats  = DEFAULT_CATS_TAVARAT.slice();
  }
}

/* ─── Export / Import ───────────────────────────────────── */

function exportJSON() {
  const data = {
    tab: activeTab,
    items: T().items, library: T().library, cats: T().cats
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, 'kauppalista_' + activeTab + '_' + dateStamp() + '.json');
  toast('Viety JSON (' + T().label + ')');
}

function exportCSV() {
  const rows = [['Tuote','Kategoria','Yksikkö','Määrä','Hinta €','Yhteensä €','Ostettu']];
  T().items.forEach(i => rows.push([
    i.name, i.cat, i.unit || 'kpl',
    (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(1)),
    i.price.toFixed(2), (i.qty * i.price).toFixed(2),
    i.done ? 'Kyllä' : 'Ei'
  ]));
  const csv  = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, 'kauppalista_' + activeTab + '_' + dateStamp() + '.csv');
  toast('Viety CSV (' + T().label + ')');
}

function importList(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(ev.target.result);
        if (data.items !== undefined) {
          T().items   = data.items   || [];
          T().library = data.library || {};
          T().cats    = data.cats    || DEFAULT_CATS_RUOKA.slice();
        } else if (Array.isArray(data)) {
          T().items = data;
        } else throw new Error();
        saveToStorage(); refreshFormSelects(); render();
        toast('Tuotu ' + T().items.length + ' tuotetta');
      } else {
        const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
        const imported = [];
        lines.slice(1).forEach(line => {
          const cols = parseCSVLine(line);
          if (cols[0]) imported.push({
            id: Date.now() + Math.random(),
            name: cols[0], cat: T().cats.includes(cols[1]) ? cols[1] : T().cats[0],
            unit: cols[2] === 'kg' ? 'kg' : 'kpl',
            qty: parseFloat(cols[3]) || 1, price: parseFloat(cols[4]) || 0,
            done: cols[6] === 'Kyllä'
          });
        });
        T().items = imported; saveToStorage(); render();
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
