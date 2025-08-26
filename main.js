/* Configuración de API */
const API_BASE = 'https://carrito-api-proxy-jyl85q9qp-cristiansans-projects.vercel.app/api';
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
    throw new Error(`Fallo autenticación (${resp.status})`);
  }
  const data = await resp.json();
  if (!data.ok || !data.token) {
    throw new Error('Respuesta de autenticación inválida');
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
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n);
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
    throw new Error(`Error al consultar stock (${resp.status})`);
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
  return { item: String(item), description: String(description), teorico, transito };
}

function renderRows(rawRows) {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  const mapped = rawRows.map(mapRow);
  const pred = segmentFilterPredicate(currentSegment);
  const filtered = mapped.filter(pred);

  // Orden simple por descripción
  filtered.sort((a, b) => String(a.description || a.item || '').localeCompare(String(b.description || b.item || '')));

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
     tr.innerHTML = `
       <td>${item}</td>
       <td>${desc}</td>
       <td class="right">${formatNumber(teorico)}</td>
       <td class="right">${formatNumber(transito)}</td>
     `;
     tbody.appendChild(tr);
   }

   // Fila de totales
   const trTotal = document.createElement('tr');
   trTotal.innerHTML = `
     <td></td>
     <td><strong>Totales</strong></td>
     <td class="right"><strong>${formatNumber(totalTeorico)}</strong></td>
     <td class="right"><strong>${formatNumber(totalTransito)}</strong></td>
   `;
  tbody.appendChild(trTotal);
}

async function refresh() {
  try {
    showError('');
    setStatus('Actualizando...');
    const rows = await fetchStock();
    if (Array.isArray(rows) && rows.length > 0) {
      // Depuración: inspeccionar el primer registro para confirmar nombres de campos
      // eslint-disable-next-line no-console
      console.log('Ejemplo de fila recibida:', rows[0]);
      try {
        const first = rows[0];
        const numericEntries = Object.entries(first).filter(([, v]) => typeof v === 'number');
        // eslint-disable-next-line no-console
        console.log('Claves de la fila:', Object.keys(first));
        // eslint-disable-next-line no-console
        console.log('Campos numéricos detectados:', numericEntries);
      } catch (e) { /* no-op */ }
    }
    renderRows(rows);
    lastFetchAt = Date.now();
    const dt = new Date(lastFetchAt);
    setStatus(`Actualizado: ${dt.toLocaleTimeString()}`);
  } catch (err) {
    setStatus('');
    showError(err && err.message ? err.message : 'Error desconocido');
  }
}

function handleTabClick(e) {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentSegment = tab.getAttribute('data-segment') || 'all';
  refresh();
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
      alert('No hay datos para exportar');
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
    
    setStatus(`Exportado: ${excelData.length - 1} productos`);
  } catch (err) {
    console.error('Error al exportar:', err);
    alert('Error al exportar a Excel');
  }
}

function setupUI() {
  document.getElementById('tabs').addEventListener('click', handleTabClick);
  document.getElementById('refreshBtn').addEventListener('click', () => refresh());
  document.getElementById('exportBtn').addEventListener('click', exportToExcel);
  setupAutoRefresh();
}

window.addEventListener('DOMContentLoaded', () => {
  setupUI();
  refresh();
});


