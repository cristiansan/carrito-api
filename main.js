/* Configuración de API */
const API_BASE = '/api';
const AUTH_URL = `${API_BASE}/authenticate`;
const STOCK_URL = `${API_BASE}/stock`;

/* Credenciales provistas */
const CREDENTIALS = {
  username: 'Api',
  md5password: 'e10adc3949ba59abbe56e057f20f883e'
};

/* Estado en memoria */
let authToken = null;
let tokenExpiresAt = 0;
let currentSegment = 'all';
let autoIntervalId = null;
let lastFetchAt = 0;
let allStockData = [];
let mappedStockData = []; // Store the mapped data for cart lookups
let currentSort = {
  column: 'description',
  direction: 'asc'
};
let searchQuery = '';
let selectedItems = new Map();
let pricesData = new Map(); // Store prices from Firebase (articulo -> precio1)
let isUserLoggedIn = false; // Track if user is logged in

// Expose selectedItems globally for cart functionality
window.selectedItems = selectedItems;

// Expose mappedStockData globally for cart loading functionality
window.mappedStockData = mappedStockData;

// Version control for column visibility defaults
const COLUMN_VISIBILITY_VERSION = 4; // Increment this when changing defaults

// Default column visibility
const defaultColumnVisibility = {
  articulo: true, // Artículo - enabled by default
  description: true, // Descripción - enabled by default
  grupo: false,
  stock: false,
  disponible: false,
  fechaActualizacion: false,
  ordenVenta: false, // En Orden de Venta - disabled by default
  ordenCompra: false,
  stockTeorico: false, // Stock Teórico - disabled
  teorico: true, // Stock Teorico de Stock - enabled by default
  transito: true, // Stock Teorico Transito - enabled by default (Tránsito)
  costoContable: false,
  totalCostoContable: false,
  monedaCostoContable: false,
  costoContableUnidadAlternativa: false,
  price: true, // Precio - enabled by default
  quantity: true, // Cantidad - enabled by default
  add: true,
  addToCart: true
};

// Load column visibility from localStorage or use defaults
let columnVisibility = loadColumnVisibility();

// Functions to persist column visibility
function saveColumnVisibility() {
  const dataToSave = {
    version: COLUMN_VISIBILITY_VERSION,
    visibility: columnVisibility
  };
  localStorage.setItem('columnVisibility', JSON.stringify(dataToSave));
}

function loadColumnVisibility() {
  try {
    const saved = localStorage.getItem('columnVisibility');
    if (saved) {
      const parsed = JSON.parse(saved);

      // Check if it's the old format (just the visibility object) or has a version
      if (parsed.version === undefined || parsed.version < COLUMN_VISIBILITY_VERSION) {
        // Reset to defaults if version is old or missing
        console.log('Column visibility version outdated, resetting to defaults');
        return { ...defaultColumnVisibility };
      }

      // Merge with defaults to ensure all columns are defined
      return { ...defaultColumnVisibility, ...parsed.visibility };
    }
  } catch (e) {
    console.error('Error loading column visibility:', e);
  }
  return { ...defaultColumnVisibility };
}

/* Utilidades */
function normalizeKey(key) {
  return String(key)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9]/g, '');
}

function getFirstExisting(row, candidateKeys) {
  const normalizedMap = new Map();
  for (const k of Object.keys(row || {})) {
    normalizedMap.set(normalizeKey(k), k);
  }
  for (const c of candidateKeys) {
    const nk = normalizeKey(c);
    if (normalizedMap.has(nk)) {
      const originalKey = normalizedMap.get(nk);
      return row[originalKey];
    }
  }
  return undefined;
}
function setStatus(text) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = text;
}

function showError(message) {
  const box = document.getElementById('errorBox');
  box.textContent = message || '';
  box.classList.toggle('hidden', !message);
}

async function authenticateIfNeeded() {
  const now = Date.now();
  if (authToken && tokenExpiresAt - now > 60_000) return authToken;
  const resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  if (!resp.ok) {
    throw new Error(`Authentication failed (${resp.status})`);
  }
  const data = await resp.json();
  if (!data.ok || !data.token) {
    throw new Error('Invalid authentication response');
  }
  authToken = data.token;
  tokenExpiresAt = Date.now() + (data.expires ? data.expires * 1000 : 55 * 60 * 1000);
  return authToken;
}

function segmentFilterPredicate(segment) {
  if (segment === 'all') return () => true;
  if (segment === 'iphone') return r => /iphone/i.test(r.description || r.articulo || '');
  if (segment === 'macbooks') return r => /macbook/i.test(r.description || r.articulo || '');
  if (segment === 'samsung') return r => /samsung/i.test(r.description || r.articulo || '');
  return () => true;
}

function formatNumber(n) {
  if (typeof n !== 'number') n = Number(n ?? 0);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

function parseLocaleNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  // Quitar separadores de miles y unificar decimal
  // Casos: "1.234,56" (es), "1,234.56" (en), "1234,56", "1234.56"
  const normalized = trimmed
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // quitar puntos de miles
    .replace(/,(?=\d{3}(\D|$))/g, '')   // quitar comas de miles
    .replace(/,/, '.');                   // usar punto como decimal
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.append(k, String(v));
  });
  return usp.toString();
}

async function fetchStock() {
  const token = await authenticateIfNeeded();
  const query = buildQuery({ format: 'JSON', ViewOption: 0 });
  const url = `${STOCK_URL}?${query}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    if (resp.status === 401) {
      authToken = null; // forzar re-auth en próxima
    }
    throw new Error(`Error fetching stock (${resp.status})`);
  }
  const data = await resp.json();
  // Se asume que data es un array o un objeto con propiedad data/list
  const rows = Array.isArray(data) ? data : (data.data || data.list || []);
  return rows;
}

// === FUNCIONES PARA PRECIOS ===
async function loadPricesFromFirebase() {
  // Check if Firebase is available
  if (!window.firebase || !window.firebase.firestore) {
    console.log('⚠️ Firebase not available, cannot load prices');
    return;
  }

  // Determine if we're in marketplace (always load) or index (only if logged in)
  const isMarketplace = window.location.pathname.includes('marketplace.html');
  const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

  // For index.html, require login. For marketplace, always load.
  if (isIndex && !isUserLoggedIn) {
    console.log('⚠️ Not loading prices: user not logged in on index.html');
    return;
  }

  try {
    const { collection, getDocs } = window.firebase.firestoreHelpers;
    const db = window.firebase.firestore();

    const pricesCollection = collection(db, 'precios');
    const pricesSnapshot = await getDocs(pricesCollection);

    pricesData.clear();

    pricesSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('📦 Price document:', { id: doc.id, data }); // Debug: show full document
      if (data.articulo && data.precio1 !== undefined) {
        pricesData.set(data.articulo, data.precio1);
        console.log(`✅ Mapped price: ${data.articulo} -> $${data.precio1}`);
      } else {
        console.log(`⚠️ Skipping document (missing articulo or precio1):`, { articulo: data.articulo, precio1: data.precio1, allFields: Object.keys(data) });
      }
    });

    console.log(`✅ Loaded ${pricesData.size} prices from Firebase (marketplace: ${isMarketplace}, index: ${isIndex}, logged: ${isUserLoggedIn})`);

    // Log first 5 prices for debugging
    const firstPrices = Array.from(pricesData.entries()).slice(0, 5);
    console.log('📋 First 5 prices loaded:', firstPrices.map(([articulo, precio]) => `${articulo}: $${precio}`).join(', '));

    // Show all available fields in first document for debugging
    if (pricesSnapshot.docs.length > 0) {
      const firstDoc = pricesSnapshot.docs[0].data();
      console.log('🔍 Available fields in first price document:', Object.keys(firstDoc));
      console.log('🔍 First document full data:', firstDoc);
    }
  } catch (error) {
    console.error('❌ Error loading prices from Firebase:', error);
  }
}

// Function to get price for an articulo
function getPriceForArticulo(articulo) {
  // In marketplace, allow getting prices even without login
  const isMarketplace = window.location.pathname.includes('marketplace.html');

  if (!isUserLoggedIn && !isMarketplace) return null;

  // Try exact match first
  let price = pricesData.get(articulo);

  // If not found, try trimmed version (in case of whitespace differences)
  if (price === undefined && articulo) {
    const trimmedArticulo = String(articulo).trim();
    price = pricesData.get(trimmedArticulo);

    // If still not found, try case-insensitive search
    if (price === undefined) {
      for (const [key, value] of pricesData.entries()) {
        if (String(key).trim().toUpperCase() === trimmedArticulo.toUpperCase()) {
          price = value;
          console.log(`🔍 Price found with case-insensitive match: "${articulo}" -> "${key}": $${price}`);
          break;
        }
      }
    }
  }

  return price !== undefined ? price : null;
}

function mapRow(raw) {
  // articulo/item
  const articulo = getFirstExisting(raw, ['Artículo', 'Articulo', 'item', 'Item', 'Codigo', 'Código']) ?? '';
  
  // descripción
  const description = getFirstExisting(raw, ['Descripción', 'Descripcion', 'description', 'Description', 'Detalle']) ?? '';
  
  // grupo
  const grupo = getFirstExisting(raw, ['Grupo', 'Group', 'Categoria', 'Categoría']) ?? '';
  
  // stock
  const stock = getFirstExisting(raw, ['Stock']) ?? '';
  
  // disponible
  let disponible = getFirstExisting(raw, ['Disponible']);
  disponible = Number.isFinite(Number(disponible)) ? Number(disponible) : parseLocaleNumber(String(disponible ?? ''));
  if (!Number.isFinite(disponible)) disponible = 0;
  
  // fecha última actualización
  const fechaActualizacion = getFirstExisting(raw, ['Fecha Ult. Actualización', 'FechaUltActualizacion', 'LastUpdate']) ?? '';
  
  // en orden de venta
  let ordenVenta = getFirstExisting(raw, ['En Orden de Venta', 'EnOrdenDeVenta']);
  ordenVenta = Number.isFinite(Number(ordenVenta)) ? Number(ordenVenta) : parseLocaleNumber(String(ordenVenta ?? ''));
  if (!Number.isFinite(ordenVenta)) ordenVenta = 0;
  
  // en orden de compra
  let ordenCompra = getFirstExisting(raw, ['En Orden de Compra', 'EnOrdenDeCompra']);
  ordenCompra = Number.isFinite(Number(ordenCompra)) ? Number(ordenCompra) : parseLocaleNumber(String(ordenCompra ?? ''));
  if (!Number.isFinite(ordenCompra)) ordenCompra = 0;
  
  // stock teórico
  let stockTeorico = getFirstExisting(raw, ['Stock Teórico', 'Stock Teorico', 'StockTeorico']);
  stockTeorico = Number.isFinite(Number(stockTeorico)) ? Number(stockTeorico) : parseLocaleNumber(String(stockTeorico ?? ''));
  if (!Number.isFinite(stockTeorico)) stockTeorico = 0;
  
  // stock teorico de stock (teorico - for backward compatibility)
  let teorico = getFirstExisting(raw, [
    'Stock Teorico de Stock',
    'Stock Teórico',
    'TheoreticalStockStock',
    'Stock teórico'
  ]);
  // fallback heurístico: buscar primera clave que incluya 'stock teorico de stock'
  if (teorico === undefined) {
    for (const [k, v] of Object.entries(raw)) {
      const nk = normalizeKey(k);
      if ((/stockteoricostock/.test(nk))) { teorico = v; break; }
    }
  }
  teorico = Number.isFinite(Number(teorico)) ? Number(teorico) : parseLocaleNumber(String(teorico ?? ''));
  if (!Number.isFinite(teorico)) teorico = 0;
  // Si el stock es menor a 0, mostrarlo como 0
  if (teorico < 0) teorico = 0;
  
  // stock teorico transito (transito - for backward compatibility)
  let transito = getFirstExisting(raw, [
    'Stock Teorico Transito',
    'Stock Teórico Transito',
    'Stock Teorico de Transito',
    'Stock Teórico de Tránsito',
    'TheoreticalStockTransito',
    'Transito',
    'Tránsito',
    'En Transito',
    'En Tránsito'
  ]);
  if (transito === undefined) {
    for (const [k, v] of Object.entries(raw)) {
      const nk = normalizeKey(k);
      if ((/stockte[o|ó]ricotransito/.test(nk) ||
           /stockte[o|ó]ricodetransito/.test(nk) ||
           /stockte[o|ó]ricodetransito/.test(nk) ||
           /transito/.test(nk) ||
           /transit/.test(nk) ||
           /entransito/.test(nk))) {
        transito = v;
        console.log(`Found transito field: "${k}" = ${v}`);
        break;
      }
    }
  }
  transito = Number.isFinite(Number(transito)) ? Number(transito) : parseLocaleNumber(String(transito ?? ''));
  if (!Number.isFinite(transito)) transito = 0;
  
  // costo contable
  let costoContable = getFirstExisting(raw, ['Costo Contable', 'CostoContable']);
  costoContable = Number.isFinite(Number(costoContable)) ? Number(costoContable) : parseLocaleNumber(String(costoContable ?? ''));
  if (!Number.isFinite(costoContable)) costoContable = 0;
  
  // total costo contable
  let totalCostoContable = getFirstExisting(raw, ['Total Costo Contable', 'TotalCostoContable']);
  totalCostoContable = Number.isFinite(Number(totalCostoContable)) ? Number(totalCostoContable) : parseLocaleNumber(String(totalCostoContable ?? ''));
  if (!Number.isFinite(totalCostoContable)) totalCostoContable = 0;
  
  // moneda de costo contable
  const monedaCostoContable = getFirstExisting(raw, ['Moneda de Costo Contable', 'MonedaDeCostoContable']) ?? '';
  
  // costo contable unidad alternativa
  let costoContableUnidadAlternativa = getFirstExisting(raw, ['Costo Contable Unidad Alternativa', 'CostoContableUnidadAlternativa']);
  costoContableUnidadAlternativa = Number.isFinite(Number(costoContableUnidadAlternativa)) ? Number(costoContableUnidadAlternativa) : parseLocaleNumber(String(costoContableUnidadAlternativa ?? ''));
  if (!Number.isFinite(costoContableUnidadAlternativa)) costoContableUnidadAlternativa = 0;

  // Determine if we're in marketplace
  const isMarketplace = window.location.pathname.includes('marketplace.html');
  const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

  // Get price from Firebase if user is logged in OR in marketplace
  let price = null;
  if (isUserLoggedIn || isMarketplace) {
    price = getPriceForArticulo(articulo);
  }

  // For marketplace, always set a price (default if not found in Firebase)
  // For index with logged in user, only set price from Firebase (no defaults)
  if (isMarketplace) {
    if (price === null) {
      // Use default price logic for marketplace
      price = 1000; // Default price
      if (/iphone/i.test(description || articulo || '')) {
        price = 800;
      } else if (/macbook/i.test(description || articulo || '')) {
        price = 1200;
      } else if (/samsung/i.test(description || articulo || '')) {
        price = 500;
      }
    }
  }

  const baseData = {
    articulo: String(articulo),
    description: String(description),
    grupo: String(grupo),
    stock: String(stock),
    disponible,
    fechaActualizacion: String(fechaActualizacion),
    ordenVenta,
    ordenCompra,
    stockTeorico,
    teorico, // Stock Teorico de Stock
    transito, // Stock Teorico Transito
    costoContable,
    totalCostoContable,
    monedaCostoContable: String(monedaCostoContable),
    costoContableUnidadAlternativa
  };

  // Include price if:
  // - In marketplace (always)
  // - In index.html AND user is logged in AND price exists
  if (isMarketplace || (isIndex && isUserLoggedIn && price !== null)) {
    return { ...baseData, price };
  }

  return baseData;
}

function renderRows() {
  const isMarketplace = window.location.pathname.includes('marketplace.html');

  // Store the mapped data for cart lookups
  mappedStockData = allStockData.map(mapRow);

  // Update global window reference for cart loading
  window.mappedStockData = mappedStockData;
  
  // Apply zero values filter first
  let mapped = mappedStockData;

  // First apply default filter: only show products with stock > 0 OR transit > 0
  // This matches the behavior in comparar.txt, unless "Show all products" is checked
  const showAllProducts = document.getElementById('showAllProducts');
  const shouldShowOnlyAvailable = !(showAllProducts && showAllProducts.checked);

  if (shouldShowOnlyAvailable) {
    const beforeAvailableFilter = mapped.length;
    mapped = mapped.filter(p => p.teorico > 0 || p.transito > 0);
    console.log('Productos después del filtro de disponibilidad (teorico > 0 OR transito > 0):', mapped.length, 'de', beforeAvailableFilter);
  } else {
    console.log('Mostrando TODOS los productos (incluyendo stock cero):', mapped.length);
  }

  const hideZeroValues = document.getElementById('hideZeroValues');
  
  console.log('Total productos antes del filtro:', mapped.length);
  console.log('Checkbox encontrado:', !!hideZeroValues);
  console.log('Checkbox marcado:', hideZeroValues ? hideZeroValues.checked : 'N/A');
  
  // Mostrar algunos ejemplos de productos
  console.log('Primeros 3 productos:', mapped.slice(0, 3).map(p => ({
    articulo: p.articulo,
    teorico: p.teorico,
    transito: p.transito
  })));
  
  // Contar productos con stock 0
  const conStock = mapped.filter(p => p.teorico > 0).length;
  const sinStock = mapped.filter(p => p.teorico === 0).length;
  console.log('Productos CON stock teórico (>0):', conStock);
  console.log('Productos SIN stock teórico (=0):', sinStock);
  
  if (hideZeroValues && hideZeroValues.checked) {
    // Mostrar solo productos con stock teórico disponible
    mapped = mapped.filter(p => p.teorico > 0);
    console.log('Productos después del filtro (teorico > 0):', mapped.length);
  }

  // Apply stock and transit filter
  const hideZeroStockAndTransit = document.getElementById('hideZeroStockAndTransit');

  console.log('Stock/Transit filter encontrado:', !!hideZeroStockAndTransit);
  console.log('Stock/Transit filter marcado:', hideZeroStockAndTransit ? hideZeroStockAndTransit.checked : 'N/A');

  if (hideZeroStockAndTransit && hideZeroStockAndTransit.checked) {
    // Ocultar productos donde stock = 0 Y transito = 0
    // Mostrar solo productos donde stock > 0 OR transito > 0
    const beforeStockTransitFilter = mapped.length;
    mapped = mapped.filter(p => p.teorico > 0 || p.transito > 0);
    console.log('Productos después del filtro stock/tránsito (stock > 0 OR transito > 0):', mapped.length, 'de', beforeStockTransitFilter);
  }

  // Add search filter
  if (searchQuery) {
    const query = normalizeKey(searchQuery);
    mapped = mapped.filter(p => normalizeKey(p.description).includes(query) || normalizeKey(p.articulo).includes(query));
  }

  // Update tab counts
  const allCount = mapped.length;
  const iphoneCount = mapped.filter(segmentFilterPredicate('iphone')).length;
  const macbooksCount = mapped.filter(segmentFilterPredicate('macbooks')).length;
  const samsungCount = mapped.filter(segmentFilterPredicate('samsung')).length;

  // Update tab counts with Material Design structure
  const allTab = document.querySelector('.mdc-tab[data-segment="all"] .mdc-tab__text-label');
  const iphoneTab = document.querySelector('.mdc-tab[data-segment="iphone"] .mdc-tab__text-label');
  const macbooksTab = document.querySelector('.mdc-tab[data-segment="macbooks"] .mdc-tab__text-label');
  const samsungTab = document.querySelector('.mdc-tab[data-segment="samsung"] .mdc-tab__text-label');

  if (allTab) allTab.textContent = `All (${allCount})`;
  if (iphoneTab) iphoneTab.textContent = `iPhone (${iphoneCount})`;
  if (macbooksTab) macbooksTab.textContent = `MacBooks (${macbooksCount})`;
  if (samsungTab) samsungTab.textContent = `Samsung (${samsungCount})`;

  const table = document.querySelector('table');
  const thead = table.querySelector('thead');
  const tbody = document.getElementById('tbody');

  // Clear existing headers and body
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Build table headers dynamically
  const trHead = document.createElement('tr');
  
  // Define all columns
  let columns = [
    { id: 'articulo', label: 'Artículo', sortable: true, class: '', width: '15%' },
    { id: 'description', label: 'Descripción', sortable: true, class: '', width: '30%' },
    { id: 'grupo', label: 'Grupo', sortable: true, class: '', width: '12%' },
    { id: 'stock', label: 'Stock', sortable: true, class: '', width: '10%' },
    { id: 'disponible', label: 'Disponible', sortable: true, class: 'right', width: '10%' },
    { id: 'fechaActualizacion', label: 'Fecha Ult. Actualización', sortable: true, class: '', width: '12%' },
    { id: 'ordenVenta', label: 'En Orden de Venta', sortable: true, class: 'right', width: '10%' },
    { id: 'ordenCompra', label: 'En Orden de Compra', sortable: true, class: 'right', width: '10%' },
    { id: 'stockTeorico', label: 'Stock', sortable: true, class: 'right', width: '10%' },
    { id: 'teorico', label: 'Stock', sortable: true, class: 'right', width: '12%' },
    { id: 'transito', label: 'Tránsito', sortable: true, class: 'right', width: '12%' },
    { id: 'costoContable', label: 'Costo Contable', sortable: true, class: 'right', width: '10%' },
    { id: 'totalCostoContable', label: 'Total Costo Contable', sortable: true, class: 'right', width: '12%' },
    { id: 'monedaCostoContable', label: 'Moneda de Costo Contable', sortable: true, class: '', width: '10%' },
    { id: 'costoContableUnidadAlternativa', label: 'Costo Contable Unidad Alternativa', sortable: true, class: 'right', width: '15%' }
  ];

  // Filter columns based on page - remove certain columns from index.html
  const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
  if (isIndex) {
    const excludedColumnsForIndex = ['grupo', 'fechaActualizacion', 'costoContable', 'totalCostoContable', 'monedaCostoContable', 'costoContableUnidadAlternativa'];
    columns = columns.filter(col => !excludedColumnsForIndex.includes(col.id));

    // Add price column if user is logged in
    if (isUserLoggedIn) {
      columns.push({ id: 'price', label: 'Precio', sortable: true, class: 'right', width: '12%' });
    }
  }

  // En marketplace redefinimos las columnas con orden específico
  if (isMarketplace) {
    columns = [
      { id: 'articulo', label: 'Artículo', sortable: true, class: '', width: '15%' },
      { id: 'description', label: 'Descripción', sortable: true, class: '', width: '30%' },
      { id: 'quantity', label: 'Cantidad', sortable: false, class: '', width: '15%' },
      { id: 'price', label: 'Precio', sortable: true, class: 'right', width: '12%' },
      { id: 'teorico', label: 'Stock', sortable: true, class: 'right', width: '12%' },
      { id: 'transito', label: 'Tránsito', sortable: true, class: 'right', width: '12%' }
    ];
  }

  let columnsToRender = columns.filter(col => columnVisibility[col.id] !== false);

  columnsToRender.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.sortable) {
      th.classList.add('sortable');
      th.setAttribute('data-sort', col.id);

      // Add sort indicator based on current sort state
      if (currentSort.column === col.id) {
        th.classList.add('sorted');
        th.textContent += currentSort.direction === 'asc' ? ' ▲' : ' ▼';
      } else {
        th.textContent += ' ⇅';
      }
    }
    if (col.class) {
      th.classList.add(col.class);
    }
    if (col.width) {
      th.style.width = col.width;
    }
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const sortableHeaders = thead.querySelectorAll('th.sortable');
  if (sortableHeaders) {
    sortableHeaders.forEach(th => {
      th.addEventListener('click', handleSortClick);
    });
  }

  const pred = segmentFilterPredicate(currentSegment);
  const filtered = mapped.filter(pred);

  // Sort the data
  filtered.sort((a, b) => {
    const col = currentSort.column;
    const dir = currentSort.direction === 'asc' ? 1 : -1;
    let aVal = a[col];
    let bVal = b[col];

    // Handle null/undefined values - push them to the end
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal, 'es', { numeric: true, sensitivity: 'base' }) * dir;
    }

    // Numeric comparison
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    return (aNum - bNum) * dir;
  });

  // Initialize totals object for dynamic calculation
  const totals = {};
  const numericColumns = ['disponible', 'ordenVenta', 'ordenCompra', 'stockTeorico', 'teorico', 'transito', 'costoContable', 'totalCostoContable', 'costoContableUnidadAlternativa'];
  
  numericColumns.forEach(col => {
    totals[col] = 0;
  });

  for (const r of filtered) {
    // Calculate totals for numeric columns
    numericColumns.forEach(col => {
      const value = Number(r[col] ?? 0);
      totals[col] += value;
    });

    const tr = document.createElement('tr');
    columnsToRender.forEach(col => {
      const td = document.createElement('td');
      if (col.class) {
        td.classList.add(col.class);
      }
      if (col.id === 'quantity' && isMarketplace) {
        const itemId = r.articulo;
        const quantity = selectedItems.get(itemId)?.quantity || 0;
        td.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="qty-btn" data-action="decrease" data-item="${itemId}">-</button>
            <input type="number" class="qty-input" data-item="${itemId}" value="${quantity}" min="0" max="999" style="width: 60px; text-align: center; padding: 4px; border: 1px solid #3a3a44; border-radius: 4px; background: #1b1b1f; color: #f0f0f0;">
            <button class="qty-btn" data-action="increase" data-item="${itemId}">+</button>
          </div>
        `;
      } else {
        const value = r[col.id];

        // Special handling for price column
        if (col.id === 'price') {
          if (value === null || value === undefined) {
            td.textContent = '?';
            td.style.fontWeight = 'bold';
            td.style.color = '#ff9800'; // Orange color for unknown price
          } else {
            td.textContent = '$' + formatNumber(value);
          }
        } else {
          td.textContent = value;
          // Add red color class for zero values in numeric columns
          const numericColumns = ['disponible', 'ordenVenta', 'ordenCompra', 'stockTeorico', 'teorico', 'transito', 'costoContable', 'totalCostoContable', 'costoContableUnidadAlternativa'];
          if (numericColumns.includes(col.id) && Number(value) === 0) {
            td.classList.add('zero-value');
          }
        }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  // Fila de totales dinámica
  const trTotal = document.createElement('tr');
  columnsToRender.forEach((col, index) => {
    const td = document.createElement('td');
    if (col.class) {
      td.classList.add(col.class);
    }
    
    if (index === 0) {
      // Primera columna - vacía
      td.innerHTML = '';
    } else if (index === 1) {
      // Segunda columna - vacía (sin etiqueta "Totals")
      td.innerHTML = '';
    } else if (numericColumns.includes(col.id)) {
      // Columnas numéricas - mostrar total
      td.innerHTML = `<strong>${formatNumber(totals[col.id] || 0)}</strong>`;
    } else {
      // Columnas no numéricas - vacías
      td.innerHTML = '';
    }
    
    trTotal.appendChild(td);
  });
  tbody.appendChild(trTotal);
  
  // Actualizar estadísticas KPI - using fixed function
  updateStatsFixed(filtered, totals);

  // Update header KPIs
  updateHeaderStats(filtered.length, totals);
}

async function forceReconnect() {
  authToken = null;
  tokenExpiresAt = 0;
  await refresh();
}

async function refresh() {
  try {
    showError('');
    setStatus('Updating...');
    allStockData = await fetchStock();
    
    if (Array.isArray(allStockData) && allStockData.length > 0) {
      console.log('Raw data received:', allStockData);
      
      // Process the first item for debugging
      const firstItem = allStockData[0];
      console.log('First item keys:', Object.keys(firstItem));
      console.log('First item values:', firstItem);
      
      // Find all available keys in the data
      const allKeys = new Set();
      allStockData.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key));
      });
      console.log('All available keys in data:', Array.from(allKeys));

      // Look specifically for transit-related keys
      const transitKeys = Array.from(allKeys).filter(key =>
        /transito|transit|tránsito/i.test(key)
      );
      console.log('Transit-related keys found:', transitKeys);

      // Check if we have the specific products mentioned by the user
      const iphoneFTZ = allStockData.filter(item =>
        Object.values(item).some(value =>
          String(value).includes('MLPF3LZ/A-FTZ') || String(value).includes('MLPG3LZ/A-FTZ')
        )
      );
      if (iphoneFTZ.length > 0) {
        console.log('Found iPhone FTZ products:', iphoneFTZ.length);
        console.log('Sample iPhone FTZ product:', iphoneFTZ[0]);
      }
      
      // Map the data for better debugging
      const sampleMapped = mapRow(firstItem);
      console.log('Sample mapped item:', sampleMapped);
    } else {
      console.warn('No data received from API or empty array');
    }
    
    renderRows();
    lastFetchAt = Date.now();
    const dt = new Date(lastFetchAt);
    setStatus(`Updated: ${dt.toLocaleTimeString()}`);
    
    // Log the first few mapped items for verification
    if (mappedStockData && mappedStockData.length > 0) {
      console.log('First 3 mapped items:', mappedStockData.slice(0, 3));

      // Check for products with transit > 0
      const withTransit = mappedStockData.filter(p => p.transito > 0);
      console.log('Products with transit > 0:', withTransit.length);
      if (withTransit.length > 0) {
        console.log('Sample products with transit:', withTransit.slice(0, 5));
      }

      // Check specifically for iPhone 13 FTZ products
      const iphoneFTZMapped = mappedStockData.filter(p =>
        /MLPF3LZ\/A-FTZ|MLPG3LZ\/A-FTZ/i.test(p.articulo) ||
        /MLPF3LZ\/A-FTZ|MLPG3LZ\/A-FTZ/i.test(p.description)
      );
      if (iphoneFTZMapped.length > 0) {
        console.log('iPhone 13 FTZ products mapped:', iphoneFTZMapped.length);
        console.log('Sample iPhone FTZ mapped products:', iphoneFTZMapped.slice(0, 3));
      } else {
        console.log('No iPhone 13 FTZ products found in mapped data');
      }
    }
  } catch (err) {
    console.error('Error in refresh:', err);
    setStatus('');
    showError(err && err.message ? err.message : 'Unknown error');
  }
}

function handleTabClick(segmentOrEvent) {
  let segment;
  
  // Check if it's called with a segment string (from Material Design) or an event (legacy)
  if (typeof segmentOrEvent === 'string') {
    segment = segmentOrEvent;
  } else {
    // Legacy event handling for backward compatibility
    const tab = segmentOrEvent.target.closest('.tab, .mdc-tab');
    if (!tab) return;
    segment = tab.getAttribute('data-segment') || 'all';
    
    // Handle legacy tab activation
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  }
  
  currentSegment = segment;
  renderRows();
}

// Make handleTabClick available globally for Material Design tabs
window.handleTabClick = handleTabClick;

function setupAutoRefresh() {
  const checkbox = document.getElementById('autoToggle');
  const apply = () => {
    if (autoIntervalId) {
      clearInterval(autoIntervalId);
      autoIntervalId = null;
    }
    if (checkbox.checked) {
      autoIntervalId = setInterval(refresh, 90_000);
    }
  };
  checkbox.addEventListener('change', apply);
  apply();
}

function exportToExcel() {
  try {
    const tbody = document.getElementById('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) {
      alert('No data to export');
      return;
    }

         // Obtener datos de la tabla actual (sin la fila de totales)
     const dataRows = rows.slice(0, -1);
     // Get headers dynamically from visible columns
     const headerElements = document.querySelectorAll('thead th');
     const headers = Array.from(headerElements).map(th => th.textContent.replace(' ▾', ''));
    
    const excelData = [headers];
    
    for (const row of dataRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      const rowData = cells.map(cell => cell.textContent.trim());
      excelData.push(rowData);
    }

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
         // Ajustar ancho de columnas
     const colWidths = [20, 50, 15, 15];
     ws['!cols'] = colWidths.map(w => ({ width: w }));

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, `Stock_${currentSegment}_${new Date().toISOString().split('T')[0]}`);

    // Descargar archivo
    XLSX.writeFile(wb, `stock_${currentSegment}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    setStatus(`Exported: ${excelData.length - 1} products`);
  } catch (err) {
    console.error('Error al exportar:', err);
    alert('Error al exportar a Excel');
  }
}



function handleBuyButtonClick(e) {
  const button = e.target;
  const isCartBtn = button.classList.contains('cart-btn');
  const input = button.parentNode.querySelector('.buy-input');
  const itemId = (input && input.getAttribute('data-item')) || button.getAttribute('data-item');
  let value = input ? parseInt(input.value) : 0;

  if (button.classList.contains('minus-btn')) {
    value--;
  } else if (button.classList.contains('plus-btn')) {
    value++;
  }

  if (value < 0) value = 0;
  if (value > 99) value = 99;

  if (input) input.value = value;
  // Update selectedItems map
  if (value > 0) {
    const product = allStockData.find(p => p.articulo === itemId || p.item === itemId);
    if (product) {
      selectedItems.set(itemId, { product, quantity: value });
    }
  } else {
    selectedItems.delete(itemId);
  }

  if (isCartBtn) {
    const badge = document.querySelector(`[data-item-badge="${itemId}"]`);
    const existing = selectedItems.get(itemId);
    const nextQty = existing ? existing.quantity + 1 : 1;
    const product = allStockData.find(p => p.articulo === itemId || p.item === itemId);
    if (product) {
      selectedItems.set(itemId, { product, quantity: nextQty });
      if (badge) badge.textContent = String(nextQty);
    }
  }
}

function handleBuyInputChange(e) {
  const input = e.target;
  const itemId = input.getAttribute('data-item'); // Get item ID
  let value = parseInt(input.value);
  if (isNaN(value)) value = 0;
  if (value < 0) value = 0;
  if (value > 99) value = 99;
  e.target.value = value;
  // Update selectedItems map
  if (value > 0) {
    const product = allStockData.find(p => p.articulo === itemId || p.item === itemId); // Find the full product object
    if (product) {
      selectedItems.set(itemId, { product: product, quantity: value }); // Store product object and quantity
    }
  } else {
    selectedItems.delete(itemId);
  }
}

function handleBuyNowClick() {
  const buyModal = document.getElementById('buyModal');
  const modalSummaryContent = document.getElementById('modalSummaryContent');
  const modalTotalPrice = document.getElementById('modalTotalPrice');

  if (selectedItems.size === 0) {
    alert('Please select at least one product to buy.');
    return;
  }

  let summaryText = '';
  let totalPrice = 0;

  selectedItems.forEach((itemData, itemId) => { // itemData will be { product: ..., quantity: ... }
    const product = itemData.product;
    const quantity = itemData.quantity;
    if (product) {
      const itemPrice = product.price;
      const itemTotal = itemPrice * quantity;
      summaryText += `${product.description} (x${quantity}) - ${formatNumber(itemPrice)} each - Total: ${formatNumber(itemTotal)}\n`;
      totalPrice += itemTotal;
    }
  });

  modalSummaryContent.textContent = summaryText;
  modalTotalPrice.textContent = formatNumber(totalPrice);
  buyModal.classList.remove('hidden'); // Show the modal
}

function handleSortClick(e) {
  const th = e.target.closest('th.sortable');
  if (!th) return;

  const column = th.getAttribute('data-sort');
  if (currentSort.column === column) {
    // Toggle direction if same column clicked
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    // Set new column and default to ascending
    currentSort.column = column;
    currentSort.direction = 'asc';
  }
  renderRows();
}

function setupUI() {
  const tabs = document.getElementById('tabs');
  if (tabs) {
    tabs.addEventListener('click', handleTabClick);
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refresh());
  }

  const reconnectBtn = document.getElementById('reconnectBtn');
  if (reconnectBtn) {
    reconnectBtn.addEventListener('click', () => forceReconnect());
  }

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  const autoToggle = document.getElementById('autoToggle');
  if (autoToggle) {
    setupAutoRefresh();
  }

  const hideZeroValues = document.getElementById('hideZeroValues');

  if (hideZeroValues) {
    hideZeroValues.addEventListener('change', () => {
      renderRows();
    });
  }

  const hideZeroStockAndTransit = document.getElementById('hideZeroStockAndTransit');

  if (hideZeroStockAndTransit) {
    hideZeroStockAndTransit.addEventListener('change', () => {
      renderRows();
    });
  }

  const showAllProducts = document.getElementById('showAllProducts');

  if (showAllProducts) {
    showAllProducts.addEventListener('change', () => {
      renderRows();
    });
  }

  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderRows();
    });
  }

  const maximizeBtn = document.getElementById('maximizeBtn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
        document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
        document.documentElement.msRequestFullscreen();
      }
    });
  }

  const buyNowBtn = document.getElementById('buyNowBtn');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', handleBuyNowClick);
  }

  const tbody = document.getElementById('tbody');
  if (tbody) {
    // Event listener for quantity increase/decrease buttons
    tbody.addEventListener('click', function(e) {
      // Handle quantity increase button
      if (e.target.closest('.qty-btn[data-action="increase"]')) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.target.closest('.qty-btn');
        const itemId = btn.getAttribute('data-item');
        const qtyElement = document.querySelector(`.qty-input[data-item="${itemId}"]`);

        if (qtyElement) {
          let qty = parseInt(qtyElement.value, 10) || 0;
          qty = Math.min(999, qty + 1); // Don't go over 999
          qtyElement.value = qty;

          // Update selected items
          const product = mappedStockData.find(p => p.articulo === itemId);
          if (product) {
            selectedItems.set(itemId, { product, quantity: qty });
          }
        }
      }
      // Handle quantity decrease button
      else if (e.target.closest('.qty-btn[data-action="decrease"]')) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.target.closest('.qty-btn');
        const itemId = btn.getAttribute('data-item');
        const qtyElement = document.querySelector(`.qty-input[data-item="${itemId}"]`);

        if (qtyElement) {
          let qty = parseInt(qtyElement.value, 10) || 0;
          qty = Math.max(0, qty - 1); // Don't go below 0
          qtyElement.value = qty;

          // Update selected items
          const product = mappedStockData.find(p => p.articulo === itemId);
          if (product) {
            selectedItems.set(itemId, { product, quantity: qty });
          }
        }
      }
    });

    // Add input event listener for quantity inputs
    tbody.addEventListener('input', (e) => {
      if (e.target.classList.contains('qty-input')) {
        const itemId = e.target.getAttribute('data-item');
        let qty = parseInt(e.target.value, 10) || 0;

        // Ensure quantity stays within bounds
        qty = Math.max(0, Math.min(999, qty));
        e.target.value = qty;

        // Update selected items
        const product = mappedStockData.find(p => p.articulo === itemId);
        if (product && qty > 0) {
          selectedItems.set(itemId, { product, quantity: qty });
        } else if (qty === 0) {
          selectedItems.delete(itemId);
        }
      }
    });
  }

  const filterBtn = document.getElementById('filterBtn');
  if (filterBtn) {
    const columnFilterDropdown = document.getElementById('columnFilterDropdown');
    filterBtn.addEventListener('click', () => {
      columnFilterDropdown.classList.toggle('hidden');
    });

    columnFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const columnId = checkbox.getAttribute('data-column');
      // Skip non-column checkboxes (like hideZeroValues)
      if (!columnId) return;
      
      checkbox.checked = columnVisibility[columnId]; // Set initial state from saved preferences

      checkbox.addEventListener('change', (e) => {
        columnVisibility[columnId] = e.target.checked;
        saveColumnVisibility(); // Save to localStorage
        renderRows();
      });
    });
  }

  const buyModal = document.getElementById('buyModal');
  if (buyModal) {
    const closeButton = buyModal.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        buyModal.classList.add('hidden');
      });
    }
  }

  const versionBtn = document.getElementById('versionBtn');
  if (versionBtn) {
    versionBtn.addEventListener('click', () => {
      const changelogModal = document.getElementById('changelogModal');
      if (changelogModal) {
        changelogModal.classList.remove('hidden');
      }
    });
  }

  const changelogModal = document.getElementById('changelogModal');
  if (changelogModal) {
    const closeButton = changelogModal.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        changelogModal.classList.add('hidden');
      });
    }
  }
}

// Función para actualizar estadísticas KPI - totalmente dinámica basada en columnas visibles
function updateStats(filteredData, totals) {
  const statsContainer = document.getElementById('statsContainer');
  const isMarketplace = window.location.pathname.includes('marketplace.html');
  
  console.log('updateStats called:', {
    isMarketplace,
    statsContainer: !!statsContainer,
    filteredDataLength: filteredData.length,
    totals: totals,
    pathname: window.location.pathname
  });
  
  if (!statsContainer) {
    console.error('statsContainer not found');
    return;
  }

  const totalProducts = filteredData.length;
  
  // Clear existing stats
  statsContainer.innerHTML = '';
  
  // Always show total products
  const productCard = document.createElement('div');
  productCard.className = 'stat-card';
  productCard.innerHTML = `
    <div class="stat-number">${totalProducts.toLocaleString()}</div>
    <div class="stat-label">Total Productos</div>
  `;
  statsContainer.appendChild(productCard);
  
  // Show stats for visible numeric columns only
  let availableNumericColumns = [
    { id: 'disponible', label: 'Suma Disponible' },
    { id: 'ordenVenta', label: 'Suma En Orden de Venta' },
    { id: 'ordenCompra', label: 'Suma En Orden de Compra' },
    { id: 'stockTeorico', label: 'Suma Stock Teórico' },
    { id: 'teorico', label: 'Suma Stock Teorico de Stock' },
    { id: 'transito', label: 'Suma Stock Teorico Transito' },
    { id: 'costoContable', label: 'Suma Costo Contable' },
    { id: 'totalCostoContable', label: 'Suma Total Costo Contable' },
    { id: 'costoContableUnidadAlternativa', label: 'Suma Costo Contable Unidad Alt.' }
  ];
  
  // Filter out certain KPIs from index.html
  const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
  if (isIndex) {
    const excludedKPIsForIndex = ['costoContable', 'totalCostoContable', 'costoContableUnidadAlternativa'];
    availableNumericColumns = availableNumericColumns.filter(col => !excludedKPIsForIndex.includes(col.id));
  }
  
  const visibleNumericColumns = availableNumericColumns.filter(col => columnVisibility[col.id]);

  visibleNumericColumns.forEach(col => {
    const value = totals[col.id] || 0;
    const statCard = document.createElement('div');
    statCard.className = 'stat-card';
    statCard.innerHTML = `
      <div class="stat-number">${value.toLocaleString()}</div>
      <div class="stat-label">${col.label}</div>
    `;
    statsContainer.appendChild(statCard);
  });

  // Always show container if there are products
  statsContainer.style.display = totalProducts > 0 ? 'grid' : 'none';
  
  console.log('updateStats final state:', {
    totalProducts,
    statsContainerDisplay: statsContainer.style.display,
    statsContainerHTML: statsContainer.innerHTML.length
  });
}


// Update header KPIs (desktop and mobile)
function updateHeaderStats(totalProducts, totals) {
  // Update desktop header KPIs
  const headerTotalProducts = document.getElementById('headerTotalProducts');
  const headerStockTeorico = document.getElementById('headerStockTeorico');
  const headerStockTransito = document.getElementById('headerStockTransito');

  if (headerTotalProducts) {
    const numberEl = headerTotalProducts.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = totalProducts.toLocaleString();
  }

  if (headerStockTeorico) {
    const numberEl = headerStockTeorico.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = (totals.teorico || 0).toLocaleString();
  }

  if (headerStockTransito) {
    const numberEl = headerStockTransito.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = (totals.transito || 0).toLocaleString();
  }

  // Update mobile KPIs
  const mobileHeaderTotalProducts = document.getElementById('mobileHeaderTotalProducts');
  const mobileHeaderStockTeorico = document.getElementById('mobileHeaderStockTeorico');
  const mobileHeaderStockTransito = document.getElementById('mobileHeaderStockTransito');

  if (mobileHeaderTotalProducts) {
    const numberEl = mobileHeaderTotalProducts.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = totalProducts.toLocaleString();
  }

  if (mobileHeaderStockTeorico) {
    const numberEl = mobileHeaderStockTeorico.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = (totals.teorico || 0).toLocaleString();
  }

  if (mobileHeaderStockTransito) {
    const numberEl = mobileHeaderStockTransito.querySelector('.header-stat-number');
    if (numberEl) numberEl.textContent = (totals.transito || 0).toLocaleString();
  }
}

// Fixed updateStats function using compatible syntax
function updateStatsFixed(filteredData, totals) {
  var statsContainer = document.getElementById('statsContainer');
  
  if (!statsContainer) {
    console.error('statsContainer not found');
    return;
  }

  var totalProducts = filteredData.length;
  
  if (totalProducts === 0) {
    statsContainer.style.display = 'none';
    return;
  }
  
  // Clear existing stats
  statsContainer.innerHTML = '';
  statsContainer.style.display = 'grid';
  
  // Always show total products
  var productCard = document.createElement('div');
  productCard.className = 'stat-card';
  productCard.innerHTML = '' +
    '<div class="stat-number">' + totalProducts.toLocaleString() + '</div>' +
    '<div class="stat-label">Total Productos</div>';
  statsContainer.appendChild(productCard);
  
  // Show stats for visible numeric columns only
  var visibleColumns = [];
  if (columnVisibility.disponible) {
    visibleColumns.push({ id: 'disponible', label: 'Disponible' });
  }
  if (columnVisibility.ordenVenta) {
    visibleColumns.push({ id: 'ordenVenta', label: 'Orden de Venta' });
  }
  if (columnVisibility.ordenCompra) {
    visibleColumns.push({ id: 'ordenCompra', label: 'Orden de Compra' });
  }
  if (columnVisibility.stockTeorico) {
    visibleColumns.push({ id: 'stockTeorico', label: 'Stock Teórico' });
  }
  if (columnVisibility.teorico) {
    visibleColumns.push({ id: 'teorico', label: 'Stock Teorico de Stock' });
  }
  if (columnVisibility.transito) {
    visibleColumns.push({ id: 'transito', label: 'Stock Teorico Transito' });
  }
  if (columnVisibility.costoContable) {
    visibleColumns.push({ id: 'costoContable', label: 'Costo Contable' });
  }
  if (columnVisibility.totalCostoContable) {
    visibleColumns.push({ id: 'totalCostoContable', label: 'Total Costo Contable' });
  }
  if (columnVisibility.costoContableUnidadAlternativa) {
    visibleColumns.push({ id: 'costoContableUnidadAlternativa', label: 'Costo Contable Unidad Alternativa' });
  }

  for (var i = 0; i < visibleColumns.length; i++) {
    var col = visibleColumns[i];
    var value = totals[col.id] || 0;
    var statCard = document.createElement('div');
    statCard.className = 'stat-card';
    statCard.innerHTML = '' +
      '<div class="stat-number">' + value.toLocaleString() + '</div>' +
      '<div class="stat-label">' + col.label + '</div>';
    statsContainer.appendChild(statCard);
  }
}


window.addEventListener('DOMContentLoaded', () => {
  setupUI();
  
  if (document.getElementById('tbody')) {
    refresh();
  }
});

// === UTILIDADES AGREGADAS DE PNG_UTILS.JS ===

function $form_get_args(f) {
  var c = "";
  var b = ["input", "select", "textarea"];
  for (var g = 0; g < 3; g++) {
    var a = f.getElementsByTagName(b[g]);
    for (var d = 0; d < a.length; d++) {
      var h = a[d];
      if ((!h.name) || h.disabled || ((h.type === "checkbox" || h.type === "radio") && !h.checked)) {
        continue;
      }
      c += (c ? "&" : "") + h.name + "=" + encodeURIComponent(h.value);
    }
  }
  return c;
}

function copy_element_to_clipboard(d, f) {
  if (!d) { return; }
  var j = document.body, i, c;
  if (document.createRange && window.getSelection) {
    i = document.createRange();
    c = window.getSelection();
    c.removeAllRanges();
    try {
      i.selectNodeContents(d);
      c.addRange(i);
    } catch (k) {
      i.selectNode(d);
      c.addRange(i);
    }
  } else {
    if (j.createTextRange) {
      i = j.createTextRange();
      i.moveToElementText(d);
      i.select();
    }
  }
  document.execCommand("Copy");
  c.removeAllRanges();
  if (f) {
    var a = f.disabled;
    f.disabled = true;
    var b = f.querySelector("span") || f;
    var g = b.innerHTML;
    b.innerHTML = "¡Copiado!";
    setTimeout(function() {
      b.innerHTML = g;
      f.disabled = a;
    }, 2000);
  }
}

function $http_get(url, onready) {
  var http = new XMLHttpRequest();
  http.open("GET", url);
  http.onreadystatechange = function() {
    if (onready && http.readyState === 4) onready(http.response);
  };
  http.send();
}

function curr_to_html(d) {
  return d.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",").replace(".", "<span class=\"dp\">.</span><sup>").replace(",", ".") + "</sup>";
}

function curr_to_html2(d) {
  return Math.abs(d) < 0.0001 ? "" : curr_to_html(d);
}

function qty_to_html(c) {
  return "" + c;
}

function qty_to_html2(c) {
  return c === 0 ? "" : ("" + c);
}

