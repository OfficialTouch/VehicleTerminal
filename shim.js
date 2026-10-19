// Stand-in for the Claude Dashboard runtime: the page was built against a `dash` object
// (data, calc, params, onData, colors). This file provides the same API from data/*.json.
(function () {
  const IDS = ['sold_sales', 'sold_yearly', 'asking_listings', 'events', 'kbb_values', 'car_profiles'];
  const store = {}, calcs = {}, cache = {}, listeners = [];
  let ready = false;
  let params = { car: 'i8', vs: '', body: 'all', years: 'all', dots: 'off' };
  // car / compare / filters live in the URL hash so a view can be bookmarked or shared
  const fromHash = new URLSearchParams(location.hash.slice(1));
  Object.keys(params).forEach((k) => { if (fromHash.has(k)) params[k] = fromHash.get(k); });

  const data = (id) => {
    if (calcs[id]) {
      if (!ready) return { status: 'loading', data: [] };
      if (!cache[id]) cache[id] = calcs[id].fn(...calcs[id].inputs.map((i) => data(i).data));
      return { status: 'ok', data: cache[id] };
    }
    return store[id] ? { status: 'ok', data: store[id] } : { status: 'loading', data: [] };
  };
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

  window.dash = {
    colors: ['#ffa028', '#4da3ff', '#3ddc84', '#ff6b6b', '#c792ea', '#ffd27a', '#5fd7d7', '#e8e8e8'],
    params: () => params,
    setParams(p) {
      params = { ...params, ...p };
      const q = new URLSearchParams(params); history.replaceState(null, '', '#' + q);
      fire();
    },
    onData(f) { listeners.push(f); if (ready) f(); },
    calc(id, o) { calcs[id] = o; },
    data,
  };

  // manifest.json is never cached; its version number busts the cache of the data files
  fetch('data/manifest.json', { cache: 'no-store' }).then((r) => r.json())
    .then((m) => Promise.all(IDS.map((id) => fetch(`data/${id}.json?v=${m.v}`).then((r) => { if (!r.ok) throw new Error(id + ' ' + r.status); return r.json(); }).then((d) => { store[id] = d; }))))
    .then(() => { ready = true; fire(); })
    .catch((e) => {
      const b = document.createElement('p');
      b.style.cssText = 'margin:16px;padding:12px;border:1px solid #ff6b6b;color:#ff6b6b;font:13px monospace';
      b.textContent = 'Could not load data: ' + e.message + '. Refresh the page.';
      document.body.prepend(b);
    });
})();
