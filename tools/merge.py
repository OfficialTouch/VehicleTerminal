# usage: python3 tools/merge.py data NEW  — CUR (data/) has the 6 dataset files, NEW has <car>/{sold_sales,sold_yearly,asking_listings,retail,events,profile,build,kbb}.json (any subset)
import json, os, re, sys, statistics as st
CUR, NEW = sys.argv[1], sys.argv[2]
F = {k: f'{CUR}/{k}.json' for k in ['sold_sales', 'sold_yearly', 'asking_listings', 'events', 'car_profiles', 'kbb_values']}
D = {k: json.load(open(p)) for k, p in F.items()}
VIN = re.compile(r'(?<![A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-Z0-9])', re.I)
def vin(r):
    m = r.get('vin') or (VIN.search(r.get('url', '')) or [None, ''])[1]
    return m.upper() if m and re.search(r'\d', m) and re.search(r'[A-Z]', m, re.I) else ''
def same(a, b):
    if a['car'] != b['car'] or a['status'] != b['status']: return False
    if vin(a) and vin(b): return vin(a) == vin(b)
    return a['year'] == b['year'] and abs(a['price'] - b['price']) <= max(300, .01 * a['price']) and a.get('miles') is not None and b.get('miles') is not None and abs(a['miles'] - b['miles']) <= 1000
SITE = {'classic.com': 'Classic.com', 'autotrader.com': 'Autotrader', 'truecar.com': 'TrueCar', 'carvana.com': 'Carvana', 'cars.com': 'Cars.com'}
def site(u): return next((v for k, v in SITE.items() if k in u), u.split('/')[2] if '//' in u else u)
for car in sorted(os.listdir(NEW)):
    d = f'{NEW}/{car}'
    if not os.path.isdir(d): continue
    load = lambda n: json.load(open(f'{d}/{n}.json')) if os.path.exists(f'{d}/{n}.json') else None
    if (p := load('profile')): D['car_profiles'] = [x for x in D['car_profiles'] if x['id'] != car] + [{**p, 'id': car}]
    if (b := load('build')): D['car_profiles'] = [{**x, 'build': b} if x['id'] == car else x for x in D['car_profiles']]
    if (k := load('kbb')): D['kbb_values'] = [x for x in D['kbb_values'] if x['car'] != car] + [{**r, 'car': car} for r in k]
    if (e := load('events')): D['events'] = [x for x in D['events'] if x['car'] != car] + [{**r, 'car': car, 'id': f"{car}:{r['id'].split(':')[-1]}", 'value': None} for r in e]
    if (s := load('sold_sales')):  # add new sales, skip exact repeats (same url+date+price)
        seen = {(x['car'], x['url'], x['date'], x['price']) for x in D['sold_sales']}
        D['sold_sales'] += [{**r, 'car': car} for r in s if (car, r['url'], r['date'], r['price']) not in seen]
    if (y := load('sold_yearly')): D['sold_yearly'] = [x for x in D['sold_yearly'] if x['car'] != car] + [{**r, 'car': car} for r in y]
    elif s:  # recompute yearly medians from sales (outliers out)
        rows = [x for x in D['sold_sales'] if x['car'] == car and not x.get('outlier')]
        out = []
        for yr in sorted({x['date'][:4] for x in rows}):
            p = sorted(x['price'] for x in rows if x['date'][:4] == yr)
            q = st.quantiles(p, n=4) if len(p) >= 2 else [p[0], p[0], p[0]]
            out.append({'year': int(yr), 'sales': len(p), 'median': round(st.median(p)), 'p25': round(q[0]), 'p75': round(q[2]), 'thin': len(p) < 4, 'car': car})
        D['sold_yearly'] = [x for x in D['sold_yearly'] if x['car'] != car] + out
    new = (load('retail') or []) + (load('asking_listings') or [])
    if new:  # a refresh replaces this car's 'For sale' rows; cars that vanished become 'Last asking'
        fresh = []
        for r in new:
            r = {**r, 'car': car, 'status': r.get('status', 'For sale')}
            r['vin'] = vin(r); src = r.pop('source', None) or site(r['url'])
            hit = next((x for x in fresh if same(x, r)), None)
            if hit:
                if src not in hit['sources']: hit['sources'] += ', ' + src
                for f in ('location', 'vin'): hit[f] = hit.get(f) or r.get(f, '')
            else: fresh.append({**r, 'sources': src})
        old = [x for x in D['asking_listings'] if x['car'] == car]
        gone = [{**x, 'status': 'Last asking'} for x in old if x['status'] == 'For sale' and not any(same({**x}, f) for f in fresh)]
        D['asking_listings'] = [x for x in D['asking_listings'] if x['car'] != car] + [x for x in old if x['status'] != 'For sale'] + gone + fresh
for k, p in F.items(): json.dump(D[k], open(p, 'w'), ensure_ascii=False)
print({k: len(v) for k, v in D.items()})
