/* MangaAtlas Ads System — one isolated document per ad unit; preserves admin section controls. */
(function () {
  'use strict';
  if (window.__mangaAtlasAdsSystemLoaded || location.pathname.indexOf('/admin') === 0) return;
  window.__mangaAtlasAdsSystemLoaded = true;

  var sections = [];
  var observer = null;
  var tries = 0;

  function readConfig() {
    return fetch('/data/ads-config.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Ads config HTTP ' + response.status);
        return response.json();
      });
  }

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

  function attrEscape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function getUnits(code) {
    var template = document.createElement('template');
    template.innerHTML = String(code || '');
    var scripts = Array.prototype.slice.call(template.content.querySelectorAll('script'));
    var units = [];
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      var text = script.textContent || '';
      var src = script.getAttribute('src') || '';
      var markup = script.outerHTML;

      // The HighRevenueFormat invoke script reads the immediately preceding atOptions global.
      // Keep that inline config and its matching invoke.js together in the same iframe.
      if (!src && /\batOptions\s*=/.test(text) && i + 1 < scripts.length) {
        var next = scripts[i + 1];
        var nextSrc = next.getAttribute('src') || '';
        if (/highrevenueformat\.com\/.*\/invoke\.js/i.test(nextSrc)) {
          markup += next.outerHTML;
          var sizeText = text + ' ' + nextSrc;
          units.push({ markup: markup, height: readDimension(sizeText, 'height', 250), width: readDimension(sizeText, 'width', 300) });
          i++;
          continue;
        }
      }

      units.push({ markup: markup, height: readDimension(text, 'height', 250), width: readDimension(text, 'width', 300) });
    }
    // Keep non-script markup only when the config has no script tags.
    if (!scripts.length && template.innerHTML.trim()) {
      units.push({ markup: template.innerHTML, height: 250, width: 300 });
    }
    return units;
  }

  function readDimension(text, name, fallback) {
    var match = String(text).match(new RegExp(name + "[^0-9]{0,12}([0-9]+)", "i"));
    return match ? Math.max(50, Math.min(1000, parseInt(match[1], 10))) : fallback;
  }

  function makeFrame(unit, sectionId, index) {
    var frame = document.createElement('iframe');
    frame.title = 'Advertisement ' + sectionId + ' unit ' + (index + 1);
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.setAttribute('scrolling', 'no');
    frame.dataset.maAdUnit = String(sectionId) + '-' + index;
    frame.style.cssText = 'display:block;width:100%;max-width:' + unit.width + 'px;height:' + Math.max(90, unit.height) + 'px;border:0;margin:4px auto;overflow:hidden;background:transparent;flex:0 0 auto;';
    var observerScript = '<script>(function(){function send(){try{var h=Math.max(50,Math.min(1000,Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0))));parent.postMessage({type:"ma-ad-height",height:h},"*")}catch(e){}}if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement)}new MutationObserver(send).observe(document.documentElement,{childList:true,subtree:true,attributes:true});window.addEventListener("load",send);setTimeout(send,100);setTimeout(send,500);setTimeout(send,1500);setTimeout(send,3500);send()})();<\/script>';
    var html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;min-height:50px;background:transparent;overflow-x:hidden}body{display:flex;justify-content:center;align-items:flex-start}img,iframe,video{max-width:100%}</style></head><body>' +
      unit.markup + observerScript + '</body></html>';
    frame.srcdoc = html;
    return frame;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'ma-ad-height' || !event.source) return;
    var frames = document.querySelectorAll('iframe[data-ma-ad-unit]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        var height = Math.max(50, Math.min(1000, parseInt(data.height, 10) || 90));
        frames[i].style.height = height + 'px';
        break;
      }
    }
  });

  function createSlot(section) {
    var slot = document.createElement('div');
    slot.className = 'manga-atlas-ad-slot';
    slot.setAttribute('data-ma-ad-section', String(section.id));
    slot.style.cssText = 'width:100%;min-height:90px;margin:20px auto;padding:14px 0 8px;display:flex;flex-direction:column;justify-content:center;align-items:center;clear:both;overflow:visible;position:relative;z-index:1;box-sizing:border-box;';

    var label = document.createElement('div');
    label.textContent = 'Advertisement';
    label.setAttribute('aria-label', 'Advertisement');
    label.style.cssText = 'position:absolute;top:0;left:0;font:10px Arial,sans-serif;color:#8b8b8b;line-height:12px;';
    slot.appendChild(label);

    var units = getUnits(section.code);
    units.forEach(function (unit, index) {
      slot.appendChild(makeFrame(unit, section.id, index));
    });
    return slot;
  }

  function place(section) {
    var id = String(section.id || '');
    if (!id || exists(id)) return true;
    var placement = String(section.placement || 'start').toLowerCase();
    var targetRoot = root();
    var box;

    if (placement === 'between') {
      var pages = document.querySelector('.pages') || document.querySelector('.reader') || document.querySelector('#reader');
      if (!pages) return false;
      var images = Array.prototype.slice.call(pages.querySelectorAll('img.page'));
      var n = parseInt(section.afterImage != null ? section.afterImage : section.between, 10);
      if (!Number.isFinite(n) || n < 1) n = 5;
      if (images.length < n || !images[n - 1].parentNode) return false;
      box = createSlot(section);
      images[n - 1].parentNode.insertBefore(box, images[n - 1].nextSibling);
      return true;
    }

    if (!targetRoot || !targetRoot.parentNode) return false;
    box = createSlot(section);
    var reader = document.querySelector('.reader') || document.querySelector('#reader');
    if (reader && targetRoot === reader) {
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
      targetRoot.parentNode.insertBefore(box, targetRoot.nextSibling);
    } else {
      targetRoot.parentNode.insertBefore(box, targetRoot);
    }
    return true;
  }

  function install() {
    sections.forEach(place);
    tries++;
    if (tries >= 80 && observer) observer.disconnect();
  }

  readConfig().then(function (config) {
    sections = Array.isArray(config && config.sections)
      ? config.sections.filter(function (section) {
          return section && section.enabled && String(section.code || '').trim();
        })
      : [];
    if (!sections.length) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
    observer = new MutationObserver(install);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    var count = 0;
    var timer = setInterval(function () {
      install();
      if (++count >= 50) clearInterval(timer);
    }, 400);
  }).catch(function (error) {
    console.error('[MangaAtlas Ads] Could not load ads config:', error);
  });
})();
