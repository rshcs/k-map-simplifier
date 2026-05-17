def get_config(kmap_type):
    if kmap_type == '3var-ab-c':
        return {
            'variables': ['A', 'B', 'C'],
            'n_vars': 3,
            'cell_count': 8,
            'rows': ['00', '01', '11', '10'],
            'cols': ['0', '1'],
            'corner_label': 'AB\\C'
        }
    elif kmap_type == '3var-a-bc':
        return {
            'variables': ['A', 'B', 'C'],
            'n_vars': 3,
            'cell_count': 8,
            'rows': ['0', '1'],
            'cols': ['00', '01', '11', '10'],
            'corner_label': 'A\\BC'
        }
    else:
        return {
            'variables': ['A', 'B', 'C', 'D'],
            'n_vars': 4,
            'cell_count': 16,
            'rows': ['00', '01', '11', '10'],
            'cols': ['00', '01', '11', '10'],
            'corner_label': 'AB\\CD'
        }


def to_bin(n, n_vars):
    return format(n, f'0{n_vars}b')


def get_term_name(pattern, variables):
    parts = []
    for i, ch in enumerate(pattern):
        if ch == '1':
            parts.append(variables[i])
        elif ch == '0':
            parts.append(variables[i] + "'")
    return ''.join(parts) if parts else '1'


def combine_terms(t1, t2, n_vars):
    diff_idx = None
    result = []
    for i in range(n_vars):
        a, b = t1[i], t2[i]
        if a == '-' and b == '-':
            result.append('-')
        elif a == '-' or b == '-':
            return None
        elif a == b:
            result.append(a)
        else:
            if diff_idx is not None:
                return None
            diff_idx = i
            result.append('-')
    if diff_idx is not None:
        return ''.join(result)
    return None


def build_kmap(minterms, dont_cares, kmap_type):
    config = get_config(kmap_type)
    kmap = []

    for r in config['rows']:
        for c in config['cols']:
            if kmap_type == '3var-ab-c':
                bits = r + c
            elif kmap_type == '3var-a-bc':
                bits = r + c
            else:
                bits = r + c
            idx = int(bits, 2)
            if idx in dont_cares:
                val = 'x'
            else:
                val = 1 if idx in minterms else 0
            kmap.append({'index': idx, 'binary': bits, 'value': val, 'row': r, 'col': c})
    return kmap


def simplify(minterms, dont_cares=None, kmap_type='4var'):
    if dont_cares is None:
        dont_cares = []

    config = get_config(kmap_type)
    n_vars = config['n_vars']
    cell_count = config['cell_count']
    variables = config['variables']

    all_terms = sorted(set(minterms + dont_cares))
    actual = set(minterms)

    if not actual:
        return {
            'expression': '0',
            'kmap': build_kmap(minterms, dont_cares, kmap_type),
            'steps': [{'title': 'No Minterms', 'text': 'No minterms selected — output is 0'}],
            'groups': []
        }

    if len(actual) == cell_count:
        pattern = '-' * n_vars
        return {
            'expression': '1',
            'kmap': build_kmap(minterms, dont_cares, kmap_type),
            'steps': [{'title': 'All Minterms', 'text': 'All cells are 1 — output is 1'}],
            'groups': [{'term': '1', 'pattern': pattern, 'covers': list(range(cell_count))}]
        }

    current = {to_bin(t, n_vars): {t} for t in all_terms}
    prime_implicants = {}

    while current:
        next_level = {}
        used = set()
        items = list(current.items())

        for i in range(len(items)):
            p1, m1 = items[i]
            for j in range(i + 1, len(items)):
                p2, m2 = items[j]
                combined = combine_terms(p1, p2, n_vars)
                if combined:
                    merged = m1 | m2
                    if combined in next_level:
                        next_level[combined] |= merged
                    else:
                        next_level[combined] = merged
                    used.add(p1)
                    used.add(p2)

        for p, m in current.items():
            if p not in used and (m & actual):
                prime_implicants[p] = m

        current = next_level

    if not prime_implicants:
        return {
            'expression': '0',
            'kmap': build_kmap(minterms, dont_cares, kmap_type),
            'steps': [],
            'groups': []
        }

    uncovered = set(actual)
    selected = set()

    for mint in list(uncovered):
        covering = [p for p, m in prime_implicants.items() if mint in m]
        if len(covering) == 1:
            p = covering[0]
            selected.add(p)
            uncovered -= prime_implicants[p]

    while uncovered:
        best_p = None
        best_count = 0
        for p, m in prime_implicants.items():
            if p in selected:
                continue
            count = len(m & uncovered)
            if count > best_count:
                best_count = count
                best_p = p
        if best_p is None:
            break
        selected.add(best_p)
        uncovered -= prime_implicants[best_p]

    terms = []
    for p in sorted(selected, key=lambda x: (x.count('-'), x)):
        terms.append(get_term_name(p, variables))
    expression = ' + '.join(terms)

    groups = []
    for p in sorted(selected, key=lambda x: (x.count('-'), x)):
        groups.append({
            'term': get_term_name(p, variables),
            'pattern': p,
            'covers': sorted(prime_implicants[p])
        })

    steps = []

    minterm_str = ', '.join(f'm{n}({to_bin(n, n_vars)})' for n in sorted(minterms))
    steps.append({'title': 'Minterms (1s)', 'text': f'Cells set to 1: {minterm_str}'})

    if dont_cares:
        dc_str = ', '.join(f'm{n}' for n in sorted(dont_cares))
        steps.append({'title': "Don't Cares (Xs)", 'text': f'Cells with don\'t care: {dc_str}'})

    pi_list = []
    for p in sorted(prime_implicants, key=lambda x: (x.count('-'), x)):
        pi_list.append({
            'pattern': p,
            'term': get_term_name(p, variables),
            'covers': sorted(prime_implicants[p])
        })
    steps.append({'title': 'Prime Implicants', 'text': f'Found {len(prime_implicants)} prime implicant(s)', 'implicants': pi_list})

    sel_list = []
    for p in sorted(selected, key=lambda x: (x.count('-'), x)):
        sel_list.append({
            'pattern': p,
            'term': get_term_name(p, variables),
            'covers': sorted(prime_implicants[p])
        })
    steps.append({'title': 'Minimal Cover', 'text': f'Selected {len(selected)} term(s) for minimal expression', 'selected': sel_list})

    return {
        'expression': expression,
        'kmap': build_kmap(minterms, dont_cares, kmap_type),
        'steps': steps,
        'groups': groups
    }
