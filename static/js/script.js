const COLORS_BG = [
  '#cce5ff', '#d4edda', '#f8d7da', '#e2d5f5',
  '#fff3cd', '#d1ecf1', '#fce4ec', '#e8f5e9'
];
const COLORS_BORDER = [
  '#0066cc', '#28a745', '#dc3545', '#7b2d8e',
  '#d39e00', '#17a2b8', '#e83e8c', '#2e7d32'
];

const ROWS = ['00', '01', '11', '10'];
const COLS = ['00', '01', '11', '10'];

let cellStates = Array(16).fill(0);

function getIndex(row, col) {
  return parseInt(row + col, 2);
}

function createKmapGrid() {
  const container = document.getElementById('kmap-grid');
  const table = document.createElement('table');
  table.className = 'kmap-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'corner';
  corner.textContent = 'AB\\CD';
  headerRow.appendChild(corner);
  COLS.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  ROWS.forEach(r => {
    const tr = document.createElement('tr');
    const rh = document.createElement('th');
    rh.textContent = r;
    tr.appendChild(rh);
    COLS.forEach(c => {
      const idx = getIndex(r, c);
      const td = document.createElement('td');
      td.className = 'kmap-cell val-0';
      td.dataset.index = idx;

      const idxSpan = document.createElement('span');
      idxSpan.className = 'cell-index';
      idxSpan.textContent = idx;

      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      valSpan.textContent = '0';

      td.appendChild(idxSpan);
      td.appendChild(valSpan);
      td.addEventListener('click', () => toggleCell(idx));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function toggleCell(idx) {
  cellStates[idx] = (cellStates[idx] + 1) % 3;
  updateCellDisplay(idx);
  syncTextInputs();
}

function updateCellDisplay(idx) {
  const cells = document.querySelectorAll('.kmap-cell');
  const td = Array.from(cells).find(c => parseInt(c.dataset.index) === idx);
  if (!td) return;

  const valSpan = td.querySelector('.cell-value');
  const val = cellStates[idx];
  td.className = `kmap-cell val-${val}`;
  valSpan.textContent = val === 0 ? '0' : val === 1 ? '1' : 'x';
}

function setCellValue(idx, val) {
  cellStates[idx] = val;
  updateCellDisplay(idx);
}

function syncTextInputs() {
  const minterms = [];
  const dontcares = [];
  cellStates.forEach((v, i) => {
    if (v === 1) minterms.push(i);
    else if (v === 2) dontcares.push(i);
  });
  document.getElementById('minterms-input').value = minterms.join(', ');
  document.getElementById('dontcares-input').value = dontcares.join(', ');
}

function syncFromText() {
  const mintermsStr = document.getElementById('minterms-input').value.trim();
  const dontcaresStr = document.getElementById('dontcares-input').value.trim();

  cellStates.fill(0);

  if (mintermsStr) {
    mintermsStr.split(/[,\s]+/).filter(s => s.length > 0).forEach(s => {
      const n = parseInt(s);
      if (!isNaN(n) && n >= 0 && n <= 15) cellStates[n] = 1;
    });
  }

  if (dontcaresStr) {
    dontcaresStr.split(/[,\s]+/).filter(s => s.length > 0).forEach(s => {
      const n = parseInt(s);
      if (!isNaN(n) && n >= 0 && n <= 15) cellStates[n] = 2;
    });
  }

  for (let i = 0; i < 16; i++) updateCellDisplay(i);
}

async function simplify() {
  const errorEl = document.getElementById('error-msg');
  errorEl.classList.add('hidden');

  const minterms = [];
  const dontcares = [];
  cellStates.forEach((v, i) => {
    if (v === 1) minterms.push(i);
    else if (v === 2) dontcares.push(i);
  });

  if (minterms.length === 0) {
    errorEl.textContent = 'Please select at least one minterm (click cells to set to 1).';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const resp = await fetch('/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minterms, dont_cares: dontcares })
    });
    const data = await resp.json();
    displayResult(data);
  } catch (err) {
    errorEl.textContent = 'Error connecting to server.';
    errorEl.classList.remove('hidden');
  }
}

function displayResult(data) {
  const panel = document.getElementById('output-panel');
  panel.classList.remove('hidden');

  document.getElementById('expression').textContent = data.expression;
  renderKmapResult(data.kmap, data.groups);
  renderLegend(data.groups);
  renderSteps(data.steps);
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderKmapResult(kmap, groups) {
  const container = document.getElementById('kmap-result');
  container.innerHTML = '';

  const cellGroups = {};
  groups.forEach((g, gi) => {
    g.covers.forEach(idx => {
      if (!cellGroups[idx]) cellGroups[idx] = [];
      cellGroups[idx].push(gi);
    });
  });

  const table = document.createElement('table');
  table.className = 'kmap-output';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'corner';
  corner.textContent = 'AB\\CD';
  hr.appendChild(corner);
  COLS.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  ROWS.forEach(r => {
    const tr = document.createElement('tr');
    const rh = document.createElement('th');
    rh.textContent = r;
    tr.appendChild(rh);
    COLS.forEach(c => {
      const idx = getIndex(r, c);
      const cell = kmap.find(k => k.index === idx);
      const td = document.createElement('td');
      td.className = 'k-cell';

      const ci = document.createElement('span');
      ci.className = 'ci';
      ci.textContent = idx;

      const cv = document.createElement('span');
      cv.className = 'cv';
      cv.textContent = cell.value === 'x' ? 'X' : cell.value;

      td.appendChild(ci);
      td.appendChild(cv);

      // Apply group styling
      if (cellGroups[idx]) {
        cellGroups[idx].forEach(gi => {
          td.classList.add(`group-${gi}`);
        });
        // Borders for the first group (distinct outlines)
        const primaryGroup = cellGroups[idx][0];
        td.classList.add(`group-border-${primaryGroup}`);
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderLegend(groups) {
  const container = document.getElementById('group-legend');
  container.innerHTML = '';
  if (groups.length === 0) return;

  groups.forEach((g, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = COLORS_BG[i % COLORS_BG.length];
    swatch.style.borderColor = COLORS_BORDER[i % COLORS_BORDER.length];

    const label = document.createElement('span');
    label.textContent = `${g.term} = ${g.pattern}  (m${g.covers.join(', m')})`;

    item.appendChild(swatch);
    item.appendChild(label);
    container.appendChild(item);
  });
}

function renderSteps(steps) {
  const container = document.getElementById('steps');
  container.innerHTML = '';

  steps.forEach(s => {
    const div = document.createElement('div');
    div.className = 'step';

    const title = document.createElement('div');
    title.className = 'step-title';
    title.textContent = s.title;
    div.appendChild(title);

    const text = document.createElement('div');
    text.className = 'step-text';
    text.textContent = s.text;
    div.appendChild(text);

    if (s.implicants) {
      const wrap = document.createElement('div');
      wrap.className = 'step-implicants';
      s.implicants.forEach(imp => {
        const span = document.createElement('span');
        span.className = 'step-implicant';
        span.textContent = `${imp.term} (${imp.pattern})`;
        span.title = `Covers m${imp.covers.join(', m')}`;
        wrap.appendChild(span);
      });
      div.appendChild(wrap);
    }

    if (s.selected) {
      const wrap = document.createElement('div');
      wrap.className = 'step-implicants';
      s.selected.forEach(sel => {
        const span = document.createElement('span');
        span.className = 'step-implicant';
        span.textContent = `${sel.term} (${sel.pattern})`;
        span.title = `Covers m${sel.covers.join(', m')}`;
        span.style.background = '#d4edda';
        span.style.fontWeight = '600';
        wrap.appendChild(span);
      });
      div.appendChild(wrap);
    }

    container.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createKmapGrid();

  document.getElementById('minterms-input').addEventListener('input', syncFromText);
  document.getElementById('dontcares-input').addEventListener('input', syncFromText);
  document.getElementById('simplify-btn').addEventListener('click', simplify);
});
