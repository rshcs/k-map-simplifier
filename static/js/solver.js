const KmapSolver = (function () {

  function getConfig(kmapType) {
    if (kmapType === '3var-ab-c') {
      return {
        variables: ['A', 'B', 'C'],
        nVars: 3,
        cellCount: 8,
        rows: ['00', '01', '11', '10'],
        cols: ['0', '1'],
        cornerLabel: 'AB\\C'
      };
    } else if (kmapType === '3var-a-bc') {
      return {
        variables: ['A', 'B', 'C'],
        nVars: 3,
        cellCount: 8,
        rows: ['0', '1'],
        cols: ['00', '01', '11', '10'],
        cornerLabel: 'A\\BC'
      };
    } else {
      return {
        variables: ['A', 'B', 'C', 'D'],
        nVars: 4,
        cellCount: 16,
        rows: ['00', '01', '11', '10'],
        cols: ['00', '01', '11', '10'],
        cornerLabel: 'AB\\CD'
      };
    }
  }

  function toBin(n, nVars) {
    return n.toString(2).padStart(nVars, '0');
  }

  function getTermName(pattern, variables) {
    const parts = [];
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '1') {
        parts.push(variables[i]);
      } else if (ch === '0') {
        parts.push(variables[i] + "'");
      }
    }
    return parts.length ? parts.join('') : '1';
  }

  function combineTerms(t1, t2, nVars) {
    let diffIdx = null;
    const result = [];
    for (let i = 0; i < nVars; i++) {
      const a = t1[i];
      const b = t2[i];
      if (a === '-' && b === '-') {
        result.push('-');
      } else if (a === '-' || b === '-') {
        return null;
      } else if (a === b) {
        result.push(a);
      } else {
        if (diffIdx !== null) return null;
        diffIdx = i;
        result.push('-');
      }
    }
    return diffIdx !== null ? result.join('') : null;
  }

  function setUnion(a, b) {
    return new Set([...a, ...b]);
  }

  function setIntersection(a, b) {
    return new Set([...a].filter(x => b.has(x)));
  }

  function setDifference(a, b) {
    return new Set([...a].filter(x => !b.has(x)));
  }

  function buildKmap(minterms, dontCares, kmapType) {
    const config = getConfig(kmapType);
    const kmap = [];
    for (const r of config.rows) {
      for (const c of config.cols) {
        const bits = r + c;
        const idx = parseInt(bits, 2);
        let val;
        if (dontCares.has(idx)) {
          val = 'x';
        } else {
          val = minterms.has(idx) ? 1 : 0;
        }
        kmap.push({ index: idx, binary: bits, value: val, row: r, col: c });
      }
    }
    return kmap;
  }

  function simplify(mintermsArr, dontCaresArr, kmapType) {
    const minterms = new Set(mintermsArr);
    const dontCares = new Set(dontCaresArr);
    const config = getConfig(kmapType);
    const nVars = config.nVars;
    const cellCount = config.cellCount;
    const variables = config.variables;

    const allTerms = [...new Set([...minterms, ...dontCares])].sort((a, b) => a - b);
    const actual = new Set(minterms);

    if (actual.size === 0) {
      return {
        expression: '0',
        kmap: buildKmap(minterms, dontCares, kmapType),
        steps: [{ title: 'No Minterms', text: 'No minterms selected — output is 0' }],
        groups: []
      };
    }

    if (actual.size === cellCount) {
      const pattern = '-'.repeat(nVars);
      return {
        expression: '1',
        kmap: buildKmap(minterms, dontCares, kmapType),
        steps: [{ title: 'All Minterms', text: 'All cells are 1 — output is 1' }],
        groups: [{ term: '1', pattern, covers: [...Array(cellCount).keys()] }]
      };
    }

    let current = new Map();
    for (const t of allTerms) {
      current.set(toBin(t, nVars), new Set([t]));
    }

    const primeImplicants = new Map();

    while (current.size > 0) {
      const nextLevel = new Map();
      const used = new Set();
      const items = [...current.entries()];

      for (let i = 0; i < items.length; i++) {
        const [p1, m1] = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const [p2, m2] = items[j];
          const combined = combineTerms(p1, p2, nVars);
          if (combined !== null) {
            const merged = setUnion(m1, m2);
            if (nextLevel.has(combined)) {
              nextLevel.set(combined, setUnion(nextLevel.get(combined), merged));
            } else {
              nextLevel.set(combined, merged);
            }
            used.add(p1);
            used.add(p2);
          }
        }
      }

      for (const [p, m] of current) {
        if (!used.has(p) && setIntersection(m, actual).size > 0) {
          primeImplicants.set(p, m);
        }
      }

      current = nextLevel;
    }

    if (primeImplicants.size === 0) {
      return {
        expression: '0',
        kmap: buildKmap(minterms, dontCares, kmapType),
        steps: [],
        groups: []
      };
    }

    let uncovered = new Set(actual);
    const selected = new Set();

    for (const mint of [...uncovered]) {
      const covering = [];
      for (const [p, m] of primeImplicants) {
        if (m.has(mint)) covering.push(p);
      }
      if (covering.length === 1) {
        const p = covering[0];
        selected.add(p);
        uncovered = setDifference(uncovered, primeImplicants.get(p));
      }
    }

    while (uncovered.size > 0) {
      let bestP = null;
      let bestCount = 0;
      for (const [p, m] of primeImplicants) {
        if (selected.has(p)) continue;
        const count = setIntersection(m, uncovered).size;
        if (count > bestCount) {
          bestCount = count;
          bestP = p;
        }
      }
      if (bestP === null) break;
      selected.add(bestP);
      uncovered = setDifference(uncovered, primeImplicants.get(bestP));
    }

    const patternSort = (a, b) => {
      const aD = (a.match(/-/g) || []).length;
      const bD = (b.match(/-/g) || []).length;
      return aD !== bD ? aD - bD : a.localeCompare(b);
    };

    const sortedSelected = [...selected].sort(patternSort);

    const terms = sortedSelected.map(p => getTermName(p, variables));
    const expression = terms.join(' + ');

    const groups = sortedSelected.map(p => ({
      term: getTermName(p, variables),
      pattern: p,
      covers: [...primeImplicants.get(p)].sort((a, b) => a - b)
    }));

    const steps = [];

    const mintermStrs = [...minterms].sort((a, b) => a - b).map(n => `m${n}(${toBin(n, nVars)})`);
    steps.push({ title: 'Minterms (1s)', text: `Cells set to 1: ${mintermStrs.join(', ')}` });

    if (dontCares.size > 0) {
      const dcStrs = [...dontCares].sort((a, b) => a - b).map(n => `m${n}`);
      steps.push({ title: "Don't Cares (Xs)", text: `Cells with don't care: ${dcStrs.join(', ')}` });
    }

    const sortedPis = [...primeImplicants.keys()].sort(patternSort);
    const piList = sortedPis.map(p => ({
      pattern: p,
      term: getTermName(p, variables),
      covers: [...primeImplicants.get(p)].sort((a, b) => a - b)
    }));
    steps.push({ title: 'Prime Implicants', text: `Found ${primeImplicants.size} prime implicant(s)`, implicants: piList });

    const selList = sortedSelected.map(p => ({
      pattern: p,
      term: getTermName(p, variables),
      covers: [...primeImplicants.get(p)].sort((a, b) => a - b)
    }));
    steps.push({ title: 'Minimal Cover', text: `Selected ${selected.size} term(s) for minimal expression`, selected: selList });

    return {
      expression,
      kmap: buildKmap(minterms, dontCares, kmapType),
      steps,
      groups
    };
  }

  return { simplify };
})();