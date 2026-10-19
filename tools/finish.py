# Run by .github/workflows/terminal.yml after Claude's research: merge NEW/ into data/,
# refuse broken output, then bump data/manifest.json so phones load the new data.
import datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA, NEW = os.path.join(ROOT, 'data'), os.path.join(ROOT, 'NEW')
FILES = ['sold_sales', 'sold_yearly', 'asking_listings', 'events', 'kbb_values', 'car_profiles']

cars = [d for d in os.listdir(NEW) if os.path.isdir(os.path.join(NEW, d))] if os.path.isdir(NEW) else []
if not cars:
    sys.exit('Claude wrote no research output in NEW/')
for d in cars:  # a broken JSON file fails the job before anything is touched
    for f in os.listdir(os.path.join(NEW, d)):
        if f.endswith('.json'):
            json.load(open(os.path.join(NEW, d, f)))

# a refresh replaces a car's 'For sale' rows; if research came back far smaller than before
# (blocked site, failed agent), keep the old listings instead of marking them all sold
notes = []
old = json.load(open(os.path.join(DATA, 'asking_listings.json')))
for d in cars:
    rp = os.path.join(NEW, d, 'retail.json')
    if not os.path.exists(rp):
        continue
    before = sum(1 for r in old if r.get('car') == d and r.get('status') == 'For sale')
    after = len(json.load(open(rp)))
    if before >= 10 and after < max(3, 0.3 * before):
        os.rename(rp, rp + '.skipped')
        notes.append(f'{d}: kept old listings (found {after}, had {before})')

subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'merge.py'), DATA, NEW], check=True)

D = {f: json.load(open(os.path.join(DATA, f + '.json'))) for f in FILES}
for f, rows in D.items():
    assert isinstance(rows, list) and rows, f + ' is empty or not a list'
    key = 'id' if f == 'car_profiles' else 'car'
    assert all(isinstance(r, dict) and r.get(key) for r in rows), f + ' has rows without ' + key
assert all(p.get('name') for p in D['car_profiles']), 'a car profile has no name'

m_path = os.path.join(DATA, 'manifest.json')
m = json.load(open(m_path))
summary = '\n'.join(filter(None, [open(os.path.join(NEW, 'summary.txt')).read().strip()[:600] if os.path.exists(os.path.join(NEW, 'summary.txt')) else ''] + notes))
m.update(v=m.get('v', 0) + 1, updated=datetime.date.today().isoformat(),
         last_run={'cmd': os.environ.get('CMD', ''), 'car': os.environ.get('CAR', ''), 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'summary': summary})
json.dump(m, open(m_path, 'w'))
print('manifest', m)
