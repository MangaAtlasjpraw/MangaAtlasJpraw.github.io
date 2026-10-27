/* MangaAtlas Ads System — run provider scripts in the page context so floating/social-bar ads can stay viewport-fixed. */
(function () {
  'use strict';
  if (location.pathname.indexOf('/admin') === 0 || window.__mangaAtlasAdsSystemLoaded) return;
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
    return Array.prototype.some.call(document.querySelectorAll('[data-ma-ad-section]'), function (node) {
      return node.getAttribute('data-ma-ad-section') === String(id);
    });
  }

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
    var content = document.createElement('div');
    content.className = 'manga-atlas-ad-code';
    content.style.cssText = 'width:100%;min-height:90px;display:flex;justify-content:center;align-items:center;overflow:visible;position:relative;';
    content.innerHTML = String(section.code || '');
    slot.appendChild(content);
    return slot;
  }

  // Recreate script elements in the actual page, not in an iframe. Floating/social-bar
  // providers need the top-level document/window to position themselves during scrolling.
  function activateScripts(slot) {
    var list = Array.prototype.slice.call(slot.querySelectorAll('script'));
    function next(index) {
      if (index >= list.length) return;
      var oldScript = list[index];
      if (!oldScript.parentNode) { next(index + 1); return; }
      var script = document.createElement('script');
      Array.prototype.slice.call(oldScript.attributes).forEach(function (attribute) {
        script.setAttribute(attribute.name, attribute.value);
      });
      script.text = oldScript.textContent || '';
      if (script.src) {
        script.async = false;
        var advanced = false;
        var timer = setTimeout(advance, 5000);
        function advance() {
          if (advanced) return;
          advanced = true;
          clearTimeout(timer);
          script.onload = null;
          script.onerror = null;
          next(index + 1);
        }
        script.onload = advance;
        script.onerror = advance;
        oldScript.parentNode.replaceChild(script, oldScript);
      } else {
        oldScript.parentNode.replaceChild(script, oldScript);
        next(index + 1);
      }
    }
    next(0);
  }

  function place(section) {
    var id = String(section.id || '');
    if (!id || exists(id)) return true;
    var placement = String(section.placement || 'start').toLowerCase();
    var targetRoot = root();
    if (!targetRoot || !targetRoot.parentNode) return false;
    var slot;

    if (placement === 'between') {
      var pages = document.querySelector('.pages') || document.querySelector('.reader') || document.querySelector('#reader');
      if (!pages) return false;
      var images = Array.prototype.slice.call(pages.querySelectorAll('img.page'));
      var n = parseInt(section.afterImage != null ? section.afterImage : section.between, 10);
      if (!Number.isFinite(n) || n < 1) n = 5;
      if (images.length < n || !images[n - 1].parentNode) return false;
      slot = createSlot(section);
      images[n - 1].parentNode.insertBefore(slot, images[n - 1].nextSibling);
      activateScripts(slot);
      return true;
    }

    slot = createSlot(section);
    var reader = document.querySelector('.reader') || document.querySelector('#reader');
    if (reader && targetRoot === reader) {
      if (placement === 'end') {
        var related = reader.querySelector('.related');
        if (related) reader.insertBefore(slot, related);
        else reader.appendChild(slot);
      } else {
        var copy = reader.querySelector('.chapter-copy');
        if (copy && copy.nextSibling) reader.insertBefore(slot, copy.nextSibling);
        else if (copy) reader.appendChild(slot);
        else reader.insertBefore(slot, reader.firstChild);
      }
    } else if (placement === 'end') {
      targetRoot.parentNode.insertBefore(slot, targetRoot.nextSibling);
    } else {
      targetRoot.parentNode.insertBefore(slot, targetRoot);
    }
    activateScripts(slot);
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
