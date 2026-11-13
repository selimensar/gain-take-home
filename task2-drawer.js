/* Task 2 – Footer drawer · https://www.thisisgain.com/
 * Inject task2-drawer.css into <head>, then paste this file into the console.
 *
 *  1. Setup       run-twice safety
 *  2. Page data   case studies and service descriptions read from the homepage
 *  3. Markup      overlay, drawer (tab + slider) and tooltip
 *  4. Open/close  tab, overlay, Esc, bottom of the page
 *  5. Slider      pages, arrows, mouse dragging (touch swipes natively with scroll-snap)
 *  6. Tooltip     placed so it always fits on screen
 */
(() => {
  'use strict';
  /* ---------- 1. Setup: safe to run more than once ---------- */
  window.__gxDrawer?.destroy();
  const listeners = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  let alive = true;
  window.__gxDrawer = {
    destroy() {
      alive = false;
      listeners.forEach(off => off());
      document.querySelectorAll('#gx-drawer, #gx-overlay, #gx-tooltip').forEach(el => el.remove());
    }
  };

  /* ---------- 2. Page data ----------
   * Nothing is hard-coded: every service, sector and case study is read from the page.
   * Sections are found by their visible text ("Solutions", "Our Sectors", "Work") and
   * items by their URLs (/work/…), not by class names, which can change on any deploy. */
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pathOf = a => new URL(a.href, location.href).pathname;           // "/work/tredz/"
  const isCase = path => /^\/work\/[^/]+\/$/.test(path);

  // The text pieces inside an element, e.g. a card -> ["Experience", "Retail", "Redesigning Tredz…"]
  const textsOf = el => [...el.querySelectorAll('*')]
    .filter(child => !child.children.length)
    .map(child => norm(child.textContent))
    .filter(Boolean);

  // A label such as "Our Sectors" or "Work", outside the header and footer
  const findLabel = text => [...document.querySelectorAll('h2, p')]
    .find(el => norm(el.textContent) === text && !el.closest('header, footer'));

  // Walk up from el until test(ancestor) is true
  const climb = (el, test) => {
    while (el && !test(el)) el = el.parentElement;
    return el;
  };

  // Match card text to a known name. "Food & Drink" = "food and drink", and the site
  // writes "Tech & Telcoms" on a card where Our Sectors says "Tech & Telco".
  const simple = s => norm(s).toLowerCase().replace(/&/g, 'and');
  const matchName = (text, names) => text.length < 40 && names.find(name =>
    simple(text) === simple(name) || (simple(name).length > 3 && simple(text).startsWith(simple(name))));

  // The site lazy-loads images: until one is scrolled into view its src is an SVG
  // placeholder that stores the real image URL in a data-u attribute.
  function imageOf(card) {
    const img = card.querySelector('img');
    const src = img?.getAttribute('src') || '';
    if (!src.startsWith('data:')) return img ? img.src : '';
    try {
      const url = atob(src.split(',')[1]).match(/data-u="([^"]+)"/);
      return url ? decodeURIComponent(url[1]) : '';
    } catch { return ''; }
  }

  // The links of one kind inside box, one per page, in slider order, each with its card
  // (the card = the biggest box around the link that holds no other item)
  function itemsIn(box, isWanted) {
    const links = [...box.querySelectorAll('a[href]')].filter(a => isWanted(pathOf(a)));
    const unique = [...new Map(links.map(a => [pathOf(a), a])).values()];
    return unique.map(link => ({
      link,
      card: climb(link, el => [...new Set([...el.parentElement.querySelectorAll('a[href]')]
        .map(pathOf).filter(isWanted))].length > 1)
    }));
  }

  // Services: the links in the "Solutions" menu, e.g. { name: "Conversion", desc: "Optimising…" }
  function readServices() {
    const trigger = [...document.querySelectorAll('header a')].find(a => norm(a.textContent) === 'Solutions');
    if (!trigger) return [];
    return [...trigger.parentElement.querySelectorAll('a')]
      .filter(a => a !== trigger)
      .map(a => { const [name, ...desc] = textsOf(a); return { name, desc: desc.join(' ') }; });
  }

  // Industries: the links in the "Our Sectors" section
  function readIndustries() {
    const label = findLabel('Our Sectors');
    const box = label && climb(label, el => el.querySelectorAll('a').length >= 3);
    return box ? [...box.querySelectorAll('a')].map(a => norm(a.textContent)) : [];
  }

  // Case studies: the cards of the "Work" slider, with their service and industry tags
  function readCases(services, industries) {
    const label = findLabel('Work');
    const box = label && climb(label, el => el.querySelectorAll('a[href*="/work/"]').length >= 2);
    if (!box) return [];
    const serviceNames = services.map(s => s.name);
    return itemsIn(box, isCase).map(({ link, card }) => {
      const texts = textsOf(card);
      return {
        href: link.href,
        title: norm(card.querySelector('h3')?.textContent),
        image: imageOf(card),
        services: [...new Set(texts.map(t => matchName(t, serviceNames)).filter(Boolean))],
        industries: [...new Set(texts.map(t => matchName(t, industries)).filter(Boolean))]
      };
    });
  }

  /* ---------- Waiting for the page (bonus: runs before the page has loaded) ----------
   * waitFor(check) re-runs check() whenever the page changes, until it returns a value
   * (or gives up after 15 s and returns null). */
  function waitFor(check, timeout = 15000) {
    return new Promise(resolve => {
      const done = value => { observer.disconnect(); clearTimeout(timer); resolve(value); };
      const test = () => { const value = check(); if (value) done(value); };
      const observer = new MutationObserver(test);
      const timer = setTimeout(() => done(null), timeout);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      test();
    });
  }

  (async () => {
    const data = await waitFor(() => {
      const services = readServices();
      const cases = readCases(services, readIndustries());
      return document.readyState !== 'loading' && services.length && cases.length ? { services, cases } : null;
    });
    if (alive && data) build(data);
  })();

  function build({ services, cases }) {
    /* ---------- 3. Markup ----------
     * One slide per case study: image, title, industry tag (tooltip: service + industry),
     * the service's description from the Solutions menu, and a link. */
    const describe = name => services.find(s => s.name === name)?.desc || '';
    const slides = cases.map((c, i) => `
      <article class="gx-slide" aria-label="${i + 1} of ${cases.length}">
        <img src="${esc(c.image)}" alt="" draggable="false">
        <div class="gx-slide-body">
          <button type="button" class="gx-tag" data-tip="${esc(`<b>Service:</b> ${c.services.map(esc).join(', ')}<br><b>Industry:</b> ${c.industries.map(esc).join(', ')}`)}">${esc(c.industries[0])}</button>
          <h3>${esc(c.title)}</h3>
          <p>${esc(describe(c.services[0]))}</p>
          <a href="${esc(c.href)}" draggable="false">View case study →</a>
        </div>
      </article>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'gx-overlay';
    const drawer = document.createElement('aside');
    drawer.id = 'gx-drawer';
    drawer.innerHTML = `
      <div class="gx-tab">
        <button type="button" class="gx-toggle" aria-expanded="false">Our work</button>
        <div class="gx-pager">
          <button type="button" data-dir="-1" aria-label="Previous page">‹</button>
          <span class="gx-count">1/1</span>
          <button type="button" data-dir="1" aria-label="Next page">›</button>
        </div>
        <button type="button" class="gx-toggle" aria-expanded="false" aria-label="Show or hide case studies"><span class="gx-chevron"></span></button>
      </div>
      <div class="gx-panel" inert><div class="gx-track">${slides}</div></div>`;
    // The tooltip goes in <body>: the drawer is moved with `transform`, and position: fixed
    // inside a transformed element is fixed to that element instead of the screen.
    const tooltip = document.createElement('div');
    tooltip.id = 'gx-tooltip';
    document.body.append(overlay, drawer, tooltip);

    const toggles = drawer.querySelectorAll('.gx-toggle');           // the label and the chevron
    const panel = drawer.querySelector('.gx-panel');
    const track = drawer.querySelector('.gx-track');
    const count = drawer.querySelector('.gx-count');
    const [prev, next] = drawer.querySelectorAll('[data-dir]');

    /* ---------- 4. Open / close ----------
     * JavaScript only switches the is-open class; CSS slides the drawer, rotates the
     * chevron and fades the overlay. */
    let isOpen = false;
    function setOpen(open) {
      isOpen = open;
      drawer.classList.toggle('is-open', open);
      overlay.classList.toggle('is-open', open);
      toggles.forEach(t => t.setAttribute('aria-expanded', open));
      panel.inert = !open;                                    // hidden slides can't be tabbed into
      hideTooltip();
      updatePager();
    }
    toggles.forEach(t => on(t, 'click', () => setOpen(!isOpen)));
    on(overlay, 'click', () => setOpen(false));
    on(document, 'keydown', e => { if (e.key === 'Escape') setOpen(false); });
    on(window, 'scroll', () => {                              // close at the bottom of the page
      if (isOpen && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) setOpen(false);
    }, { passive: true });

    /* ---------- 5. Slider ----------
     * The CSS decides how many slides fit (4 / 2 / 1); the code measures it, so the
     * page count always matches the layout. */
    const slideStep = () => track.children[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap);
    const perPage = () => Math.max(1, Math.round((track.clientWidth + 1) / slideStep()));
    const pageCount = () => Math.ceil(cases.length / perPage());
    const currentPage = () => track.scrollLeft >= track.scrollWidth - track.clientWidth - 2
      ? pageCount()                                           // the last page may not be full
      : Math.round(track.scrollLeft / (perPage() * slideStep())) + 1;
    const goToPage = page => track.scrollTo({ left: (page - 1) * perPage() * slideStep(), behavior: 'smooth' });

    function updatePager() {
      const page = currentPage();
      count.textContent = `${page}/${pageCount()}`;
      prev.disabled = page === 1;
      next.disabled = page === pageCount();
    }
    on(prev, 'click', () => goToPage(currentPage() - 1));
    on(next, 'click', () => goToPage(currentPage() + 1));
    on(track, 'scroll', () => { updatePager(); hideTooltip(); }, { passive: true });
    on(window, 'resize', updatePager);

    // Mouse dragging. A drag of more than 5 px is not a click, so it can't open a link.
    let drag = null;
    on(track, 'pointerdown', e => {
      if (e.pointerType === 'mouse') drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    on(window, 'pointermove', e => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) > 5) { drag.moved = true; track.classList.add('is-dragging'); }
      if (drag.moved) track.scrollLeft = drag.left - (e.clientX - drag.x);
    });
    on(window, 'pointerup', () => {
      if (!drag) return;
      track.classList.remove('is-dragging');                  // scroll-snap settles on the nearest slide
      setTimeout(() => { drag = null; });
    });
    on(track, 'click', e => { if (drag?.moved) e.preventDefault(); }, true);

    /* ---------- 6. Tooltip ----------
     * Shown on hover, keyboard focus, or tap on touch screens. Placed above the tag, or
     * below it if there's no room, kept 8 px inside the screen, with the arrow still
     * pointing at the tag. */
    function showTooltip(tag) {
      tooltip.innerHTML = tag.dataset.tip;
      tooltip.classList.add('is-visible');
      const t = tag.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      const above = t.top - box.height - 10 > 8;
      const left = Math.min(Math.max(8, t.left + t.width / 2 - box.width / 2), innerWidth - box.width - 8);
      tooltip.style.top = `${above ? t.top - box.height - 10 : t.bottom + 10}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.setProperty('--arrow', `${t.left + t.width / 2 - left}px`);
      tooltip.classList.toggle('is-below', !above);
    }
    function hideTooltip() { tooltip.classList.remove('is-visible'); }

    on(track, 'mouseover', e => { const tag = e.target.closest('.gx-tag'); if (tag) showTooltip(tag); });
    on(track, 'mouseout', e => { if (e.target.closest('.gx-tag')) hideTooltip(); });
    on(track, 'focusin', e => { if (e.target.matches('.gx-tag')) showTooltip(e.target); });
    on(track, 'focusout', hideTooltip);
    on(document, 'touchstart', e => {
      const tag = e.target.closest('.gx-tag');
      tag ? showTooltip(tag) : hideTooltip();
    }, { passive: true });
  }
})();
