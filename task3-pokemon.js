/* Task 3 – Pokémon blog · https://www.thisisgain.com/blog/
 * Inject task3-pokemon.css into <head>, then paste this file into the console.
 *
 * The blog list is rendered by React, which redraws it on every page or filter change.
 * So instead of editing React's elements we layer on top of them:
 *   - each card gets one extra child (.gx-poke); CSS hides the rest of the card,
 *     so article content never flashes;
 *   - a MutationObserver re-applies our cards whenever React redraws;
 *   - one click listener on window flips any card, including cards React adds later.
 *
 *  1. Setup        run-twice safety
 *  2. PokeAPI      fetch each Pokémon once
 *  3. Cards        loading skeleton, front and back
 *  4. Type filter  replaces "Filter by Capability" (current page only)
 *  5. Update       give every card its Pokémon; runs on every React redraw
 *  6. Events       flip on click or keyboard; watch React and the URL
 */
(() => {
  'use strict';
  /* ---------- 1. Setup: safe to run more than once ---------- */
  window.__gxPoke?.destroy();
  const listeners = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };

  const PER_PAGE = 12;
  const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
  const COLORS = {
    normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#e5c11a', grass: '#7ac74c', ice: '#71c8c3',
    fighting: '#c22e28', poison: '#a33ea1', ground: '#d4b25a', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
    rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746', steel: '#9fa0b7', fairy: '#d685ad'
  };
  const capitalise = s => s[0].toUpperCase() + s.slice(1);
  let selectedType = '';

  /* ---------- 2. PokeAPI: each Pokémon is fetched once, then cached ---------- */
  const cache = new Map();
  function getPokemon(id) {
    if (!cache.has(id)) {
      cache.set(id, fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
        .then(response => response.json())
        .then(p => ({
          id,
          name: capitalise(p.name),
          image: p.sprites.other['official-artwork'].front_default,
          types: p.types.map(t => t.type.name),
          height: p.height / 10,                               // decimetres -> metres
          weight: p.weight / 10,                               // hectograms -> kilograms
          abilities: p.abilities.map(a => a.ability.name.replace('-', ' ')),
          stats: p.stats.map(s => ({ name: s.stat.name.replace('special-', 'sp. '), value: s.base_stat }))
        })));
    }
    return cache.get(id);
  }

  /* ---------- 3. Cards ---------- */
  const number = id => `#${String(id).padStart(3, '0')}`;

  const skeletonHTML = id => `
    <div class="gx-inner"><div class="gx-face gx-front">
      <span class="gx-number">${number(id)}</span><span class="gx-skeleton gx-skeleton--image"></span><span class="gx-skeleton"></span>
    </div></div>`;

  const cardHTML = p => `
    <div class="gx-inner">
      <div class="gx-face gx-front">
        <span class="gx-number">${number(p.id)}</span>
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <div class="gx-types">${p.types.map(t => `<span style="--color:${COLORS[t]}">${capitalise(t)}</span>`).join('')}</div>
        <small>Click to flip</small>
      </div>
      <div class="gx-face gx-back">
        <h3>${p.name} <small>${number(p.id)}</small></h3>
        <dl>
          <div><dt>Height</dt><dd>${p.height} m</dd></div>
          <div><dt>Weight</dt><dd>${p.weight} kg</dd></div>
          <div class="gx-wide"><dt>Abilities</dt><dd>${p.abilities.join(', ')}</dd></div>
        </dl>
        <ul>${p.stats.map(s => `<li><span>${s.name}</span><b>${s.value}</b><i style="--value:${Math.min(100, s.value / 1.6)}%"></i></li>`).join('')}</ul>
      </div>
    </div>`;

  // Show the skeleton straight away, then the card when PokeAPI answers. If React reused
  // this card for another Pokémon in the meantime, the old answer is ignored.
  function showPokemon(poke, id) {
    poke.dataset.id = id;
    delete poke.dataset.types;
    poke.classList.remove('is-flipped');
    poke.innerHTML = skeletonHTML(id);
    getPokemon(id).then(p => {
      if (poke.dataset.id !== String(id)) return;
      poke.dataset.types = p.types.join(' ');
      poke.style.setProperty('--color', COLORS[p.types[0]]);
      poke.innerHTML = cardHTML(p);
      applyFilter();
    });
  }

  /* ---------- 4. Type filter ----------
   * The site's filters are <select>s. "Filter by Tags" and "Filter by Capability" are
   * hidden by the CSS (by their form names); ours takes Capability's place, so it gets
   * the same styling. It only filters the cards on the current page. */
  const filter = document.createElement('select');
  filter.id = 'gx-type-filter';
  filter.setAttribute('aria-label', 'Filter by type');
  filter.innerHTML = `<option value="">Filter by type</option>${TYPES.map(t => `<option value="${t}">${capitalise(t)}</option>`).join('')}`;
  on(filter, 'change', e => {
    e.stopPropagation();                                      // React must not see this change
    selectedType = filter.value;
    applyFilter();
  });

  function applyFilter() {
    const list = document.querySelector('[data-gx-list]');
    if (!list) return;
    const pokes = [...list.querySelectorAll('.gx-poke')];
    pokes.forEach(poke => {
      const match = !selectedType || (poke.dataset.types || '').split(' ').includes(selectedType);
      poke.parentElement.toggleAttribute('data-gx-hidden', !match);    // an attribute: React leaves it alone
    });
    let empty = document.getElementById('gx-empty');
    if (!empty) {
      empty = document.createElement('p');
      empty.id = 'gx-empty';
    }
    if (empty.previousElementSibling !== list) list.after(empty);
    const allLoaded = pokes.every(poke => poke.dataset.types);
    empty.hidden = !(selectedType && allLoaded && pokes.every(poke => poke.parentElement.hasAttribute('data-gx-hidden')));
    empty.textContent = `No ${capitalise(selectedType || 'x')}-type Pokémon on this page. Try another page or type.`;
  }

  /* ---------- 5. Update: runs on start, on every React redraw and on every URL change ----------
   * Card position + page number decide the Pokémon: card 1 on /blog/page/2/ is #13.
   * Cards that already show the right Pokémon are left alone. */
  function update() {
    const capability = document.querySelector('select[name="capability"]');
    if (capability && capability.nextElementSibling !== filter) capability.after(filter);
    filter.value = selectedType;

    let list = document.querySelector('[data-gx-list]');
    if (!list) {
      list = [...document.querySelectorAll('main a[href*="/post/"]')][0]?.closest('li')?.parentElement;
      if (!list) return;
      list.dataset.gxList = '';                                // the CSS now hides article content in it
    }
    const page = Number(location.pathname.match(/\/page\/(\d+)/)?.[1] || 1);
    [...list.children].forEach((card, i) => {
      const id = (page - 1) * PER_PAGE + i + 1;
      let poke = card.querySelector('.gx-poke');
      if (poke?.dataset.id === String(id)) return;
      if (!poke) {
        poke = document.createElement('div');
        poke.className = 'gx-poke';
        poke.tabIndex = 0;
        poke.setAttribute('role', 'button');
        card.append(poke);
      }
      showPokemon(poke, id);
    });
    applyFilter();
  }

  /* ---------- 6. Events ---------- */
  // Capture phase on window: runs before React and before the browser follows the link
  on(window, 'click', e => {
    const card = e.target.closest?.('[data-gx-list] > *');
    if (!card) return;
    e.preventDefault();
    e.stopPropagation();
    const poke = card.querySelector('.gx-poke');
    if (poke?.dataset.types) poke.classList.toggle('is-flipped');           // once loaded
  }, true);
  on(window, 'keydown', e => {
    if (e.target.matches?.('.gx-poke') && e.target.dataset.types && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.classList.toggle('is-flipped');
    }
  }, true);

  // React redraws: the observer's callback runs before the browser paints, so new cards
  // already have their Pokémon when they first appear. Our own changes are ignored.
  const observer = new MutationObserver(mutations => {
    const fromReact = mutations.some(m => !m.target.closest?.('.gx-poke, #gx-empty'));
    if (fromReact) update();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // React changes the URL without reloading the page, so we compare it regularly
  let lastUrl = location.href;
  const urlCheck = setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; update(); }
  }, 100);

  window.__gxPoke = {
    destroy() {
      observer.disconnect();
      clearInterval(urlCheck);
      listeners.forEach(off => off());
      document.querySelectorAll('.gx-poke, #gx-type-filter, #gx-empty').forEach(el => el.remove());
      document.querySelectorAll('[data-gx-list]').forEach(el => delete el.dataset.gxList);
      document.querySelectorAll('[data-gx-hidden]').forEach(el => el.removeAttribute('data-gx-hidden'));
    }
  };

  update();
})();
