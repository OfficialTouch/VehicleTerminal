# Free refresh (no Claude, no plan usage): new NHTSA recalls and recent news headlines for every car.
# Each car profile's `feeds` says what to look up: {nhtsa_make, nhtsa_model, news_query, news_terms}.
# Only adds: existing recalls and headlines (written by research) are kept. Prints one summary line per change.
import datetime, json, os, re, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILES = os.path.join(ROOT, 'data', 'car_profiles.json')
MAX_HEADLINES, MAX_AUTO = 8, 4  # at most 4 automatic headlines, so researched ones stay
# only real car-news outlets (Google News also returns gossip, games, dealer ads, foreign sites)
OUTLETS = ['car and driver', 'motortrend', 'road & track', 'road and track', 'hagerty', 'jalopnik', 'the drive', 'autoblog',
           'motor1', 'top gear', 'autocar', 'carbuzz', 'carscoops', 'edmunds', 'kelley blue book', 'kbb', 'autoweek',
           'automotive news', 'evo', 'pistonheads', 'bmwblog', 'corvette blogger', 'gm authority', 'gm inside news',
           'consumer reports', 'nhtsa', 'carexpert', 'car magazine', 'autoevolution', 'insideevs', 'electrek',
           'slashgear', 'topspeed', 'top speed', 'robb report', 'dupont registry', 'classic.com', 'bring a trailer',
           'carwow', 'whatcar', 'what car', 'autotrader', 'cars.com', 'cargurus', 'the autopian', 'rennlist', 'flatsixes',
           'corvetteforum', 'mbworld', 'gtrlife', 'carsales', 'drive.com.au']
SKIP = ['for sale in', 'for sale:', 'gran turismo', 'assetto', 'iracing', 'forza', ' gt3', 'lego', 'hot wheels', 'diecast']


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (VehicleTerminal; +https://officialtouch.github.io/VehicleTerminal/)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def years_of(text):
    ys = [int(y) for y in re.findall(r'(?:19|20)\d\d', str(text))]
    return list(range(min(ys), max(ys) + 1)) if ys else []


def parse_date(s):
    for f in ('%b %d, %Y', '%Y-%m-%d', '%b %Y'):
        try:
            return datetime.datetime.strptime(s.strip(), f)
        except (ValueError, AttributeError):
            pass
    return datetime.datetime.min


def new_recalls(p, feeds):
    have = {r.get('campaign') for r in p.get('recalls') or []}
    found = {}
    for y in years_of(p.get('years')):
        q = urllib.parse.urlencode({'make': feeds['nhtsa_make'], 'model': feeds['nhtsa_model'], 'modelYear': y})
        try:
            res = json.loads(fetch('https://api.nhtsa.gov/recalls/recallsByVehicle?' + q)).get('results') or []
        except Exception as e:  # NHTSA is flaky; skip this year rather than fail the job
            print(f"  {p['id']} {y}: NHTSA error {e}", file=sys.stderr)
            continue
        for r in res:
            c = r.get('NHTSACampaignNumber')
            if not c or c in have:
                continue
            e = found.setdefault(c, {'r': r, 'years': set()})
            e['years'].add(int(r.get('ModelYear') or y))
    out = []
    for c, e in found.items():
        r = e['r']
        try:
            filed = datetime.datetime.strptime(r.get('ReportReceivedDate', ''), '%d/%m/%Y').strftime('%b %Y')
        except ValueError:
            filed = r.get('ReportReceivedDate', '—')
        issue = (r.get('Component', '').title() + ': ' + (r.get('Consequence') or r.get('Summary') or '')).strip(': ')
        out.append({'campaign': c, 'filed': filed, 'years': ', '.join(map(str, sorted(e['years']))),
                    'issue': issue[:220] + ('…' if len(issue) > 220 else ''), 'url': 'https://www.nhtsa.gov/recalls?nhtsaId=' + c, 'auto': True})
    return out


def new_headlines(p, feeds):
    q = urllib.parse.quote(feeds['news_query'] + ' when:60d')
    try:
        root = ET.fromstring(fetch(f'https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en'))
    except Exception as e:
        print(f"  {p['id']}: news error {e}", file=sys.stderr)
        return []
    have = {re.sub(r'\W+', '', h.get('title', '').lower()) for h in p.get('headlines') or []}
    terms = [t.lower() for t in feeds.get('news_terms') or []]
    out = []
    for it in root.iter('item'):
        title, link = (it.findtext('title') or '').strip(), (it.findtext('link') or '').strip()
        outlet = (it.findtext('source') or '').strip()
        if outlet and title.endswith(' - ' + outlet):
            title = title[: -len(outlet) - 3]
        key = re.sub(r'\W+', '', title.lower())
        low = title.lower()
        if (not title or not link.startswith('https://') or key in have or (terms and not any(t in low for t in terms))
                or not any(o in outlet.lower() for o in OUTLETS) or any(w in low for w in SKIP)):
            continue
        try:
            d = datetime.datetime.strptime((it.findtext('pubDate') or '')[:16], '%a, %d %b %Y')
        except ValueError:
            continue
        have.add(key)
        out.append({'date': d.strftime('%b %d, %Y'), 'title': title, 'outlet': outlet or 'News', 'url': link, 'auto': True})
    out.sort(key=lambda h: parse_date(h['date']), reverse=True)
    return out[:MAX_AUTO]


def main():
    P = json.load(open(PROFILES))
    notes, today = [], datetime.date.today().isoformat()
    for p in P:
        feeds = p.get('feeds')
        if not feeds:
            notes.append(f"{p['id']}: no feeds set, skipped")
            continue
        rec = new_recalls(p, feeds)
        if rec:
            p['recalls'] = rec + (p.get('recalls') or [])
            note = re.sub(r' Updated \d{4}-\d\d-\d\d: .*$', '', p.get('recall_note') or '')
            p['recall_note'] = (note + f' Updated {today}: {len(rec)} new recall(s) added automatically; check them on nhtsa.gov.').strip()
        news = new_headlines(p, feeds)
        if news:
            by_date = lambda h: parse_date(h.get('date', ''))
            old = p.get('headlines') or []
            auto = sorted(news + [h for h in old if h.get('auto')], key=by_date, reverse=True)[:MAX_AUTO]
            kept = sorted([h for h in old if not h.get('auto')], key=by_date, reverse=True)[:MAX_HEADLINES - len(auto)]
            p['headlines'] = sorted(auto + kept, key=by_date, reverse=True)
        if rec or news:
            notes.append(f"{p['name']}: {len(rec)} new recall(s), {len(news)} new headline(s)")
    json.dump(P, open(PROFILES, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('\n'.join(notes) or 'No new recalls or headlines')
    return notes


if __name__ == '__main__':
    main()
