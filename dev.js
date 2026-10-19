// Developer tools: log in (Cloudflare Worker checks the password), then REFRESH ALL or ADD CAR.
// The worker starts .github/workflows/terminal.yml; this file shows the job's status.
(function () {
  var API = 'https://vehicle-terminal-api.abtouch01.workers.dev';
  var KEY = 'vt-dev-token';
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function () { try { var t = localStorage.getItem(KEY); return t && Number(t.split('.')[0]) > Date.now() ? t : null; } catch (e) { return null; } },
    set: function (t) { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) { /* private mode: stays logged in for this visit only */ } },
  };
  var token = store.get(), poll = null;

  function api(path, body) {
    return fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== '/login') { logout(); }
        if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
        return d;
      });
    });
  }
  function say(msg, kind) { var s = $('dev-status'); s.textContent = msg; s.className = 'dev-status ' + (kind || ''); }
  function busy(on) { $('dev-refresh').disabled = on; $('dev-add').disabled = on; $('dev-car').disabled = on; }

  function show() {
    var on = !!token;
    $('dev-btn').textContent = on ? 'DEV ✓' : 'DEV LOGIN';
    $('dev-btn').setAttribute('aria-expanded', String(on));
    $('dev-bar').hidden = !on;
    if (on) { lastUpdate(); status(); }
  }
  function logout() { token = null; store.set(null); clearInterval(poll); poll = null; show(); }

  function lastUpdate() {
    fetch('data/manifest.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
      var l = m.last_run;
      $('dev-last').textContent = 'Data updated ' + (m.updated || '—') + (l ? ' · last job: ' + l.cmd + (l.car ? ' ' + l.car : '') + (l.summary ? ' — ' + l.summary.replace(/\n/g, ' · ') : '') : '');
    }).catch(function () {});
  }

  function status() {
    api('/status').then(function (d) {
      var r = d.run;
      if (!r) { say('No jobs yet.'); busy(false); return; }
      if (r.status !== 'completed') {
        say('Running: ' + r.title + ' (started ' + new Date(r.started).toLocaleTimeString() + '). This can take 10–60 minutes; you can close the page.', 'run');
        busy(true);
        if (!poll) poll = setInterval(status, 30000);
        return;
      }
      clearInterval(poll); poll = null; busy(false);
      if (r.conclusion === 'success') say('Last job finished: ' + r.title + '. New data shows about a minute after it ends; reload the page.', 'ok');
      else say('Last job ' + (r.conclusion || 'stopped') + ': ' + r.title + '. Nothing was changed. ', 'bad');
      var a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Job details ↗';
      $('dev-status').append(' ', a);
      lastUpdate();
    }).catch(function (e) { say(e.message, 'bad'); });
  }

  function run(cmd, car) {
    busy(true); say('Starting…', 'run');
    api('/run', { cmd: cmd, car: car }).then(function () {
      say('Started. Checking status…', 'run');
      setTimeout(status, 5000);
    }).catch(function (e) { say(e.message, 'bad'); status(); });
  }

  $('dev-btn').addEventListener('click', function () {
    if (token) { $('dev-bar').hidden = !$('dev-bar').hidden; return; }
    $('dev-login-err').textContent = '';
    $('dev-login').showModal();
    $('dev-user').focus();
  });
  $('dev-cancel').addEventListener('click', function () { $('dev-login').close(); });
  $('dev-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('dev-login-go'); btn.disabled = true; $('dev-login-err').textContent = '';
    api('/login', { user: $('dev-user').value.trim(), pass: $('dev-pass').value }).then(function (d) {
      token = d.token; store.set(token); $('dev-pass').value = ''; $('dev-login').close(); show();
    }).catch(function (err) { $('dev-login-err').textContent = err.message; }).then(function () { btn.disabled = false; });
  });
  $('dev-refresh').addEventListener('click', function () {
    if (confirm('Refresh listings, sales, KBB values and news for every car? This uses your Claude plan and can take up to an hour.')) run('refresh');
  });
  $('dev-add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var car = $('dev-car').value.trim();
    if (!/^[A-Za-z0-9 .,()\/&'+\-]{2,80}$/.test(car)) { say('Type the car like: Porsche 718 Cayman GTS 4.0 2020-2023', 'bad'); return; }
    if (confirm('Research and add "' + car + '"? This uses your Claude plan and takes about 15–30 minutes.')) { run('add', car); $('dev-car').value = ''; }
  });
  $('dev-logout').addEventListener('click', logout);
  show();
})();
