function termToHtml(term) {
  if (term === '1' || term === '0') return term;
  let result = '';
  for (let i = 0; i < term.length; i++) {
    if (term[i] === "'") continue;
    if (i + 1 < term.length && term[i + 1] === "'") {
      result += `<span class="overline overline-var">${term[i]}</span>`;
    } else {
      result += term[i];
    }
  }
  return result;
}

function expressionToHtml(expr) {
  return expr.split(/\s*\+\s*/).map(term => termToHtml(term)).join(' <span class="plus">+</span> ');
}

const COLORS_BG = [
  '#1a0033', '#001a33', '#33001a', '#003300',
  '#333300', '#003333', '#330033', '#1a1a00'
];
const COLORS_BORDER = [
  '#ff00ff', '#00ffff', '#ff0066', '#00ff66',
  '#ffff00', '#00ffff', '#ff00aa', '#ccff00'
];

let config = window.KMAP_CONFIG || {
  type: '4var',
  rows: ['00', '01', '11', '10'],
  cols: ['00', '01', '11', '10'],
  cornerLabel: 'AB\\CD',
  variables: ['A', 'B', 'C', 'D'],
  cellCount: 16
};

let cellStates = Array(config.cellCount).fill(0);

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
  corner.textContent = config.cornerLabel;
  headerRow.appendChild(corner);
  config.cols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  config.rows.forEach(r => {
    const tr = document.createElement('tr');
    const rh = document.createElement('th');
    rh.textContent = r;
    tr.appendChild(rh);
    config.cols.forEach(c => {
      const idx = getIndex(r, c);
      const td = document.createElement('td');
      td.className = 'kmap-cell val-0';
      td.dataset.index = idx;

      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      valSpan.textContent = '0';

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
  clearGroups();
  hideResult();
}

function hideResult() {
  document.getElementById('expression').classList.add('hidden');
}

function clearGroups() {
  document.querySelectorAll('#kmap-grid .kmap-cell').forEach(td => {
    td.classList.remove('group-0', 'group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6', 'group-7');
    td.style.boxShadow = '';
  });
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

function resetAll() {
  cellStates.fill(0);
  for (let i = 0; i < config.cellCount; i++) updateCellDisplay(i);
  clearGroups();
  hideResult();
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
      body: JSON.stringify({ minterms, dont_cares: dontcares, kmap_type: config.type })
    });
    const data = await resp.json();
    displayResult(data);
  } catch (err) {
    errorEl.textContent = 'Error connecting to server.';
    errorEl.classList.remove('hidden');
  }
}

function displayResult(data) {
  const exprEl = document.getElementById('expression');
  exprEl.innerHTML = 'Q = ' + expressionToHtml(data.expression);
  exprEl.classList.remove('hidden');

  applyGroupsToInputGrid(data.groups);
}

function applyGroupsToInputGrid(groups) {
  const cellGroups = {};
  groups.forEach((g, gi) => {
    g.covers.forEach(idx => {
      if (!cellGroups[idx]) cellGroups[idx] = [];
      cellGroups[idx].push(gi);
    });
  });

  const cells = document.querySelectorAll('#kmap-grid .kmap-cell');
  cells.forEach(td => {
    const idx = parseInt(td.dataset.index);

    td.classList.remove('group-0', 'group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6', 'group-7');
    td.style.boxShadow = '';

    if (cellGroups[idx]) {
      cellGroups[idx].forEach(gi => {
        td.classList.add(`group-${gi}`);
      });
      const shadows = cellGroups[idx].map((gi, gii) => {
        return `inset 0 0 0 ${(gii + 1) * 2}px ${COLORS_BORDER[gi % COLORS_BORDER.length]}`;
      }).join(', ');
      td.style.boxShadow = shadows;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createKmapGrid();

  document.getElementById('simplify-btn').addEventListener('click', simplify);
  document.getElementById('reset-btn').addEventListener('click', resetAll);
});
