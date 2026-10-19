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
  ['prices', 'news', 'guide', 'alts'].forEach(function (t) {
    var tab = document.getElementById('tab-' + t);
    if (!tab) return;
    var bar = document.createElement('div');
    bar.className = 'vt-folds';
    bar.innerHTML = '<button type="button" data-open="0">▸ COLLAPSE ALL</button><button type="button" data-open="1">▾ EXPAND ALL</button>';
    bar.addEventListener('click', function (e) {
      var o = e.target.getAttribute('data-open');
      if (o === null) return;
      cards.forEach(function (c) { if (tab.contains(c)) { c.classList.toggle('vt-folded', o === '0'); c.querySelector('.vt-fold').setAttribute('aria-expanded', String(o === '1')); } });
      if (o === '1' && window.dash) window.dash.setParams({});
    });
    tab.insertBefore(bar, tab.firstChild);
  });
})();
