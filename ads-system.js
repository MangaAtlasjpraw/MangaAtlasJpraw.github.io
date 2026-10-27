/* MangaAtlas Ads System — isolated ad documents so provider scripts using document.write can render. */
(function () {
  'use strict';
  if (window.__mangaAtlasAdsSystemLoaded || location.pathname.indexOf('/admin') === 0) return;
  window.__mangaAtlasAdsSystemLoaded = true;

  var configUrl = '/data/ads-config.json?v=' + Date.now();
  var sections = [];
  var attempts = 0;
  var observer;

  function root() {
    return document.querySelector('.reader') ||
      document.querySelector('#reader') ||
      document.querySelector('.pages') ||
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.body;
  }

  function exists(id) {
    return Array.prototype.some.call(
      document.querySelectorAll('[data-ma-ad-section]'),
      function (node) { return node.getAttribute('data-ma-ad-section') === String(id); }
    );
  }

  function createSlot(section) {
    var slot = document.createElement('div');
    slot.className = 'manga-atlas-ad-slot';
    slot.setAttribute('data-ma-ad-section', String(section.id));
    slot.style.cssText = 'width:100%;min-height:90px;margin:20px auto;padding:8px 0;display:flex;justify-content:center;align-items:center;clear:both;overflow:visible;position:relative;z-index:1;box-sizing:border-box;';

    var label = document.createElement('div');
    label.textContent = 'Advertisement';
    label.setAttribute('aria-label', 'Advertisement');
    label.style.cssText = 'position:absolute;top:0;left:0;font:10px Arial,sans-serif;color:#8b8b8b;line-height:12px;';
    slot.appendChild(label);

    var frame = document.createElement('iframe');
    frame.title = 'Advertisement';
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.style.cssText = 'display:block;width:100%;max-width:100%;height:320px;border:0;margin:0 auto;overflow:hidden;background:transparent;';
    frame.setAttribute('scrolling', 'no');
    slot.appendChild(frame);

    var code = String(section.code || '');
    var doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>html,body{margin:0;padding:0;width:100%;min-height:90px;background:transparent;overflow-x:hidden}body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start}img,iframe{max-width:100%}</style>' +
      '</head><body>' + code + '</body></html>';
    frame.srcdoc = doc;

    frame.addEventListener('load', function () {
      try {
        var doc = frame.contentDocument;
        if (!doc) return;
        var h = Math.max(90, Math.min(700, Math.ceil(doc.documentElement.scrollHeight || doc.body.scrollHeight || 320)));
        frame.style.height = h + 'px';
      } catch (e) {}
    });
    return slot;
  }

  function place(section) {
    var id = String(section.id || '');
    if (!id || exists(id)) return true;
    var placement = String(section.placement || 'start').toLowerCase();
    var box, r = root();

    if (placement === 'between') {
      var pages = document.querySelector('.pages') || document.querySelector('.reader') || document.querySelector('#reader');
      if (!pages) return false;
      var imgs = Array.prototype.slice.call(pages.querySelectorAll('img.page'));
      var n = parseInt(section.afterImage != null ? section.afterImage : section.between, 10);
      if (!Number.isFinite(n) || n < 1) n = 5;
      if (imgs.length < n || !imgs[n - 1].parentNode) return false;
      box = createSlot(section);
      imgs[n - 1].parentNode.insertBefore(box, imgs[n - 1].nextSibling);
      return true;
    }

    if (!r || !r.parentNode) return false;
    box = createSlot(section);
    var reader = document.querySelector('.reader') || document.querySelector('#reader');
    if (reader && r === reader) {
      if (placement === 'end') {
        var related = reader.querySelector('.related');
        if (related) reader.insertBefore(box, related);
        else reader.appendChild(box);
      } else {
        var copy = reader.querySelector('.chapter-copy');
        if (copy && copy.nextSibling) reader.insertBefore(box, copy.nextSibling);
        else if (copy) reader.appendChild(box);
        else reader.insertBefore(box, reader.firstChild);
      }
    } else if (placement === 'end') {
      r.parentNode.insertBefore(box, r.nextSibling);
    } else {
      r.parentNode.insertBefore(box, r);
    }
    return true;
  }

  function install() {
    sections.forEach(place);
    attempts++;
    if (attempts >= 80 && observer) observer.disconnect();
  }

  fetch(configUrl, { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Ads config HTTP ' + response.status);
      return response.json();
    })
    .then(function (config) {
      sections = Array.isArray(config && config.sections)
        ? config.sections.filter(function (s) { return s && s.enabled && String(s.code || '').trim(); })
        : [];
      if (!sections.length) return;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
      } else {
        install();
      }
      observer = new MutationObserver(install);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      var tries = 0;
      var timer = setInterval(function () {
        install();
        if (++tries >= 50) clearInterval(timer);
      }, 400);
    })
    .catch(function (error) {
      console.error('[MangaAtlas Ads] Could not load ads config:', error);
    });
})();