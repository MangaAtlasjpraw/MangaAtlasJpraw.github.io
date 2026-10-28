/* MangaAtlas Ads System — page-context social bars plus bounded script waits to prevent one provider stalling the rest. */
(function () {
  'use strict';
  if (location.pathname.indexOf('/admin') === 0 || window.__mangaAtlasAdsSystemLoaded) return;
  window.__mangaAtlasAdsSystemLoaded = true;

  var sections = [];
  var observer = null;
  var tries = 0;
  var globalProviderScripts = Object.create(null);

  // Floating/social-bar provider scripts must execute in the top-level page,
  // not inside a chapter ad slot. Load each distinct zone script once globally.
  function loadGlobalProviderScript(src) {
    if (!src || globalProviderScripts[src]) return;
    globalProviderScripts[src] = true;
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-ma-global-provider', 'true');
    (document.head || document.documentElement).appendChild(script);
  }

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
  // Bound each script wait so one provider that never fires load/error does not stall
  // all later placements in the same section for several seconds.
  function activateScripts(slot) {
    var list = Array.prototype.slice.call(slot.querySelectorAll('script'));

    function makeBannerFrame(configScript, invokeScript) {
      var source = invokeScript.src;
      var config = configScript.textContent || '';
      var widthMatch = config.match(/['"]width['"]\s*:\s*(\d+)/i);
      var heightMatch = config.match(/['"]height['"]\s*:\s*(\d+)/i);
      var width = widthMatch ? parseInt(widthMatch[1], 10) : 300;
      var height = heightMatch ? parseInt(heightMatch[1], 10) : 250;
      var frame = document.createElement('iframe');
      frame.title = 'Advertisement';
      frame.loading = 'lazy';
      frame.width = String(width);
      frame.height = String(height);
      frame.setAttribute('aria-label', 'Advertisement');
      frame.style.cssText = 'display:block;border:0;max-width:100%;margin:0 auto;overflow:hidden;';
      // Adsterra-style invoke.js uses the global atOptions object and may rely on
      // parser-time document.write. Run each banner pair in its own document so
      // multiple banners cannot overwrite one another's atOptions configuration.
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow:hidden;background:transparent}body{display:flex;justify-content:center;align-items:flex-start}</style></head><body><script>' +
        config +
        '</scr' + 'ipt><script src="' + source.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></scr' + 'ipt></body></html>'
      return frame;
    }

    function next(index) {
      if (index >= list.length) return;
      var oldScript = list[index];
      if (!oldScript.parentNode) { next(index + 1); return; }

      var following = list[index + 1];
      var configText = oldScript.textContent || '';
      if (!oldScript.src && /\batOptions\s*=/.test(configText) &&
          following && following.parentNode === oldScript.parentNode &&
          following.src && /highrevenueformat\.com\/[^/]+\/invoke\.js/i.test(following.src)) {
        var frame = makeBannerFrame(oldScript, following);
        oldScript.parentNode.replaceChild(frame, oldScript);
        if (following.parentNode) following.parentNode.removeChild(following);
        next(index + 2);
        return;
      }

      var script = document.createElement('script');
      Array.prototype.slice.call(oldScript.attributes).forEach(function (attribute) {
        script.setAttribute(attribute.name, attribute.value);
      });
      script.text = configText;

      if (script.src) {
        // Social bars use the page viewport and should not be initialized as
        // children of a reader slot. Repeated zone URLs are loaded only once.
        if (/^https?:\/\/bauval\.org\//i.test(script.src)) {
          loadGlobalProviderScript(script.src);
          oldScript.parentNode.removeChild(oldScript);
        } else {
          oldScript.parentNode.replaceChild(script, oldScript);
        }
        next(index + 1);
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
      // If a chapter has fewer images than the configured target (e.g. a
      // single-image chapter), do not silently drop the placement. Attach it
      // after the last available image so every enabled section can render.
      if (!images.length) return false;
      var anchorIndex = Math.min(n, images.length);
      var anchorImage = images[anchorIndex - 1];
      if (!anchorImage || !anchorImage.parentNode) return false;
      slot = createSlot(section);
      anchorImage.parentNode.insertBefore(slot, anchorImage.nextSibling);
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
