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
let columnVisibility = {
  item: true,
  description: true,
  teorico: true,
  transito: false,
  price: true,
  add: true,
  addToCart: true
};

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
  if (segment === 'iphone') return r => /iphone/i.test(r.description || r.item || '');
  if (segment === 'macbooks') return r => /macbook/i.test(r.description || r.item || '');
  if (segment === 'samsung') return r => /samsung/i.test(r.description || r.item || '');
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

function mapRow(raw) {
  // item
  const item = getFirstExisting(raw, ['item', 'Item', 'Artículo', 'Articulo', 'Codigo', 'Código']) ?? '';
  // description
  const description = getFirstExisting(raw, ['Descripción', 'Descripcion', 'description', 'Description', 'Detalle']) ?? '';
  // theoretical stock (en depósito)
  let teorico = getFirstExisting(raw, [
    // claves vistas en respuesta
    'Stock Teorico de Stock',
    'Stock Teórico',
    'Stock',
    'Disponible',
    // variantes previas
    'TheoreticalStockStock',
    'Stock teórico',
    'Stock Teorico',
    'StockTeorico',
    'Cantidad'
  ]);
  // fallback heurístico: buscar primera clave que incluya 'stock' o 'cantidad'
  if (teorico === undefined) {
    for (const [k, v] of Object.entries(raw)) {
      const nk = normalizeKey(k);
      if ((/stock|cantidad|disponible/.test(nk))) { teorico = v; break; }
    }
  }
  teorico = Number.isFinite(Number(teorico)) ? Number(teorico) : parseLocaleNumber(String(teorico ?? ''));
  if (!Number.isFinite(teorico)) teorico = 0;
  // en transito
  let transito = getFirstExisting(raw, [
    'Stock Teorico Transito',
    'En tránsito',
    'En transito',
    'Transito',
    'TheoreticalStockTransito'
  ]);
  if (transito === undefined) {
    for (const [k, v] of Object.entries(raw)) {
      const nk = normalizeKey(k);
      if ((/transit|transito/.test(nk))) { transito = v; break; }
    }
  }
  transito = Number.isFinite(Number(transito)) ? Number(transito) : parseLocaleNumber(String(transito ?? ''));
  if (!Number.isFinite(transito)) transito = 0;
  let price = 1000; // Default price

  if (/iphone/i.test(description || item || '')) {
    price = 800;
  } else if (/macbook/i.test(description || item || '')) {
    price = 1200;
  } else if (/samsung/i.test(description || item || '')) {
    price = 500;
  }

  return { item: String(item), description: String(description), teorico, transito, price };
}

function renderRows() {
  const isMarketplace = window.location.pathname.includes('marketplace.html');
  // Store the mapped data for cart lookups
  mappedStockData = allStockData.map(mapRow);
  let mapped = mappedStockData.filter(p => p.teorico > 0);

  // Add search filter
  if (searchQuery) {
    const query = normalizeKey(searchQuery);
    mapped = mapped.filter(p => normalizeKey(p.description).includes(query) || normalizeKey(p.item).includes(query));
  }

  // Update tab counts
  const allCount = mapped.length;
  const iphoneCount = mapped.filter(segmentFilterPredicate('iphone')).length;
  const macbooksCount = mapped.filter(segmentFilterPredicate('macbooks')).length;
  const samsungCount = mapped.filter(segmentFilterPredicate('samsung')).length;

  document.querySelector('.tab[data-segment="all"]').textContent = `All (${allCount})`;
  document.querySelector('.tab[data-segment="iphone"]').textContent = `Iphone (${iphoneCount})`;
  document.querySelector('.tab[data-segment="macbooks"]').textContent = `Macbooks (${macbooksCount})`;
  document.querySelector('.tab[data-segment="samsung"]').textContent = `Samsung (${samsungCount})`;

  const table = document.querySelector('table');
  const thead = table.querySelector('thead');
  const tbody = document.getElementById('tbody');

  // Clear existing headers and body
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // Build table headers dynamically
  const trHead = document.createElement('tr');
  const columns = [
    { id: 'item', label: 'Item', sortable: true, class: '' },
    { id: 'description', label: 'Description', sortable: true, class: '' },
    { id: 'teorico', label: 'Stock', sortable: true, class: 'right' },
    { id: 'transito', label: 'Transit', sortable: true, class: 'right' },
    { id: 'price', label: 'Price', sortable: true, class: 'right' }
  ];

  // Solo en marketplace agregamos la columna Quantity
  if (isMarketplace) {
    columns.push({ id: 'quantity', label: 'Quantity', sortable: false, class: '' });
  }

  let columnsToRender = columns.filter(col => columnVisibility[col.id] !== false);

  columnsToRender.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.sortable) {
      th.classList.add('sortable');
      th.setAttribute('data-sort', col.id);
      th.textContent += ' ▾';
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
    const aVal = a[col];
    const bVal = b[col];

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * dir;
    }
    return (aVal - bVal) * dir;
  });

  let totalTeorico = 0;
  let totalTransito = 0;

  for (const r of filtered) {
    const item = r.item ?? '';
    const desc = r.description ?? '';
    const teorico = Number(r.teorico ?? 0);
    const transito = Number(r.transito ?? 0);
    const total = teorico + transito;
    totalTeorico += teorico;
    totalTransito += transito;

    const tr = document.createElement('tr');
    columnsToRender.forEach(col => {
      const td = document.createElement('td');
      if (col.class) {
        td.classList.add(col.class);
      }
      if (col.id === 'quantity' && isMarketplace) {
        const quantity = selectedItems.get(item)?.quantity || 1;
        td.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="qty-btn" data-action="decrease" data-item="${item}">-</button>
            <span class="qty-value" data-item="${item}">${quantity}</span>
            <button class="qty-btn" data-action="increase" data-item="${item}">+</button>
            <button class="cart-btn" data-item="${item}" title="Add to cart"
              style="
                background:#d32f2f;
                color:#fff;
                border:none;
                border-radius:4px;
                padding:8px 20px;
                min-width:140px;
                display:flex;
                align-items:center;
                gap:10px;
                font-size:16px;
                font-weight:500;
                cursor:pointer;
              ">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24">
                <path d="M7 18c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2zm-12.016-2l1.72-8h13.296l1.72 8h-16.736zm15.016-10v2h-16v-2h2.016l1.72-8h8.528l1.72 8h2.016z"/>
              </svg>
              <span style="white-space:nowrap;">Add to Cart</span>
            </button>
          </div>
        `;
      } else {
        td.textContent = col.id === 'price' ? formatNumber(r.price) : r[col.id];
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  // Fila de totales
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `
    <td></td>
    <td><strong>Totals</strong></td>
    <td class="right"><strong>${formatNumber(totalTeorico)}</strong></td>
    <td class="right"><strong>${formatNumber(totalTransito)}</strong></td>
  `;
  tbody.appendChild(trTotal);
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
    }
  } catch (err) {
    console.error('Error in refresh:', err);
    setStatus('');
    showError(err && err.message ? err.message : 'Unknown error');
  }
}

function handleTabClick(e) {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentSegment = tab.getAttribute('data-segment') || 'all';
  renderRows();
}

function setupAutoRefresh() {
  const checkbox = document.getElementById('autoToggle');
  const apply = () => {
    if (autoIntervalId) {
      clearInterval(autoIntervalId);
      autoIntervalId = null;
    }
    if (checkbox.checked) {
      autoIntervalId = setInterval(refresh, 10_000);
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
     const headers = ['Item', 'Descripción', 'Stock', 'Transit'];
    
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
    const product = allStockData.find(p => p.item === itemId);
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
    const product = allStockData.find(p => p.item === itemId);
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
    const product = allStockData.find(p => p.item === itemId); // Find the full product object
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

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  const autoToggle = document.getElementById('autoToggle');
  if (autoToggle) {
    setupAutoRefresh();
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
    // Single event listener for cart button clicks
    tbody.addEventListener('click', function(e) {
      // Handle cart button click
      const cartBtn = e.target.closest('.cart-btn');
      if (cartBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const itemId = cartBtn.getAttribute('data-item');
        const qtyElement = document.querySelector(`.qty-value[data-item="${itemId}"]`);
        
        if (!itemId || !qtyElement) {
          console.error('Could not find item ID or quantity element');
          return;
        }
        
        const qty = parseInt(qtyElement.textContent, 10) || 1;
        // Find the product in the mapped data
        const product = mappedStockData.find(p => p.item === itemId);
        
        if (product) {
          // Update selected items
          selectedItems.set(itemId, { product, quantity: qty });
          
          // Save cart to localStorage
          const cartData = Array.from(selectedItems.entries()).map(([id, { product, quantity }]) => ({
            item: product.item,
            description: product.description,
            price: product.price,
            quantity
          }));
          
          localStorage.setItem('cart', JSON.stringify(cartData));
          console.log('Cart saved, redirecting to cart.html');
          
          // Redirect to cart page
          window.location.href = 'cart.html';
        } else {
          console.error('Product not found:', itemId);
        }
      } 
      // Handle quantity increase button
      else if (e.target.closest('.qty-btn[data-action="increase"]')) {
        e.preventDefault();
        e.stopPropagation();
        
        const btn = e.target.closest('.qty-btn');
        const itemId = btn.getAttribute('data-item');
        const qtyElement = document.querySelector(`.qty-value[data-item="${itemId}"]`);
        
        if (qtyElement) {
          let qty = parseInt(qtyElement.textContent, 10) || 1;
          qty = Math.min(99, qty + 1); // Don't go over 99
          qtyElement.textContent = qty;
          
          // Update selected items
          const product = mappedStockData.find(p => p.item === itemId);
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
        const qtyElement = document.querySelector(`.qty-value[data-item="${itemId}"]`);
        
        if (qtyElement) {
          let qty = parseInt(qtyElement.textContent, 10) || 1;
          qty = Math.max(1, qty - 1); // Don't go below 1
          qtyElement.textContent = qty;
          
          // Update selected items
          const product = mappedStockData.find(p => p.item === itemId);
          if (product) {
            selectedItems.set(itemId, { product, quantity: qty });
          }
        }
      }
      // Handle buy button click
      else if (e.target.closest('.buy-btn')) {
        handleBuyButtonClick(e);
      }
    });

    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('buy-input')) {
        handleBuyInputChange(e);
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
      checkbox.checked = columnVisibility[columnId]; // Set initial state

      checkbox.addEventListener('change', (e) => {
        columnVisibility[columnId] = e.target.checked;
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
}

window.addEventListener('DOMContentLoaded', () => {
  setupUI();  if (document.getElementById('tbody')) {
    refresh();
  }
});


