# Run: python3 tools/test_free_refresh.py  (fakes NHTSA and Google News; no network)
import json, os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import free_refresh as fr

tmp = tempfile.mkdtemp()
fr.PROFILES = os.path.join(tmp, 'car_profiles.json')
_P = json.load(open(os.path.join(fr.ROOT, 'data', 'car_profiles.json')))
for _p in _P:  # start from researched content only, so the test doesn't depend on earlier daily runs
    _p['headlines'] = [h for h in _p['headlines'] if not h.get('auto')]
    _p['recalls'] = [r for r in _p['recalls'] if not r.get('auto')]
json.dump(_P, open(fr.PROFILES, 'w'))

RSS = '''<rss><channel>
<item><title>BMW i8 values hit a new low - Hagerty</title><link>https://news.google.com/a1</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate><source url="https://hagerty.com">Hagerty</source></item>
<item><title>Jordan rips golf game, races new BMW i8 - Golf Digest</title><link>https://news.google.com/a4</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate><source url="https://golfdigest.com">Golf Digest</source></item>
<item><title>2016 BMW i8 For Sale in Carrollton, TX - duPont REGISTRY</title><link>https://news.google.com/a5</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate><source url="https://dupontregistry.com">duPont REGISTRY</source></item>
<item><title>Unrelated BMW X5 story - Motor1</title><link>https://news.google.com/a2</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate><source url="https://motor1.com">Motor1</source></item>
<item><title>Corvette C8 recall announced - Car and Driver</title><link>https://news.google.com/a3</link><pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate><source url="https://caranddriver.com">Car and Driver</source></item>
</channel></rss>'''

def fake(url):
    if 'nhtsa' in url:
        if 'model=I8' in url and 'modelYear=2019' in url:
            return json.dumps({'results': [
                {'NHTSACampaignNumber': '14V674000', 'ModelYear': '2019'},  # already in the profile
                {'NHTSACampaignNumber': '26V999000', 'ModelYear': '2019', 'ReportReceivedDate': '02/10/2026', 'Component': 'ELECTRICAL SYSTEM', 'Consequence': 'A short circuit can increase the risk of a fire.'}]})
        if 'model=EVORA' in url:
            raise OSError('NHTSA down')  # must be skipped, not crash
        return json.dumps({'results': []})
    return RSS

fr.fetch = fake
notes = fr.main()
P = {p['id']: p for p in json.load(open(fr.PROFILES))}
i8 = P['i8']
assert i8['recalls'][0]['campaign'] == '26V999000' and i8['recalls'][0]['filed'] == 'Oct 2026', i8['recalls'][0]
assert sum(r['campaign'] == '14V674000' for r in i8['recalls']) == 1, 'existing recall duplicated'
assert 'Updated' in i8['recall_note'] and '1 new recall' in i8['recall_note']
assert i8['headlines'][0]['title'] == 'BMW i8 values hit a new low' and i8['headlines'][0]['outlet'] == 'Hagerty'
assert not any('X5' in h['title'] or 'golf' in h['title'] or 'For Sale' in h['title'] for h in i8['headlines']), 'off-topic headline kept'
assert sum(1 for h in i8['headlines'] if not h.get('auto')) >= fr.MAX_HEADLINES - fr.MAX_AUTO or all(not h.get('auto') for h in i8['headlines'][1:]), 'researched headlines pushed out'
assert len(i8['headlines']) <= fr.MAX_HEADLINES
assert P['corvette-c8']['headlines'][0]['title'].startswith('Corvette C8 recall')
assert not any('Corvette' in h['title'] for h in P['audi-r8-v8']['headlines'] if h.get('auto')), 'R8 got a Corvette headline'
before = json.load(open(fr.PROFILES))
fr.main()
assert json.load(open(fr.PROFILES)) == before, 'second run should add nothing'
print('ok', notes)
