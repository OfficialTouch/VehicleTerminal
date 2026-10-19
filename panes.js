// Collapsible panels: every card with a blue title strip gets a fold button; each tab gets Collapse all / Expand all.
(function () {
  var cards = [].slice.call(document.querySelectorAll('.i8-card')).filter(function (c) {
    var h = c.firstElementChild; return h && h.tagName === 'H2';
  });
  function set(card, open) {
    card.classList.toggle('vt-folded', !open);
    card.querySelector('.vt-fold').setAttribute('aria-expanded', String(open));
    // charts size themselves when drawn; redraw once a folded chart is opened again
    if (open && card.querySelector('.i8-chart') && window.dash) window.dash.setParams({});
  }
  cards.forEach(function (card, i) {
    var h = card.firstElementChild;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vt-fold'; b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-label', 'Collapse or expand this panel');
    if (!h.id) h.id = 'vt-panel-h' + i;
    b.setAttribute('aria-describedby', h.id);
    card.insertBefore(b, h.nextSibling); // a sibling, so page code that rewrites the title text can't remove it
    b.addEventListener('click', function () { set(card, card.classList.contains('vt-folded')); });
    h.addEventListener('click', function () { b.click(); }); // the whole strip works too
  });
  // one icon-only pair in the function-key row; acts on whichever tab is showing
  var bar = document.createElement('div');
  bar.className = 'vt-folds';
  bar.innerHTML = '<button type="button" data-open="0" aria-label="Collapse all panels" title="Collapse all">'
    + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M7 4l5 5 5-5M7 20l5-5 5 5"/></svg></button>'
    + '<button type="button" data-open="1" aria-label="Expand all panels" title="Expand all">'
    + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg></button>';
  bar.addEventListener('click', function (e) {
    var btn = e.target.closest('button'); if (!btn) return;
    var open = btn.getAttribute('data-open') === '1';
    var tab = ['prices', 'news', 'guide', 'alts'].map(function (t) { return document.getElementById('tab-' + t); })
      .filter(function (el) { return el && getComputedStyle(el).display !== 'none'; })[0];
    cards.forEach(function (c) { if (tab && tab.contains(c)) { c.classList.toggle('vt-folded', !open); c.querySelector('.vt-fold').setAttribute('aria-expanded', String(open)); } });
    if (open && window.dash) window.dash.setParams({});
  });
  (document.querySelector('.vt-keyrow') || document.body).appendChild(bar);
})();
