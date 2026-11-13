/* Task 1 – Questionnaire modal · https://www.thisisgain.com/
 * Inject task1-questionnaire.css into <head>, then paste this file into the console.
 *
 *  1. Setup        run-twice safety
 *  2. Page data    services, sectors, case studies, articles and email read from the homepage
 *  3. Quiz         the 5 steps and the state they're drawn from
 *  4. Markup       the section under the hero and the <dialog>
 *  5. Rendering    progress bar, question, results
 *  6. Events       answers, Next / Back / Change / Close
 *  7. Start        place the section, read the data, enable the button
 */
(() => {
  'use strict';
  /* ---------- 1. Setup: safe to run more than once ----------
   * Each run leaves window.__gxQuiz.destroy(). A new run calls it first, which removes
   * our elements and listeners, so nothing is ever duplicated. */
  window.__gxQuiz?.destroy();
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
  let alive = true;   // false once a newer run has replaced this one
  window.__gxQuiz = {
    destroy() {
      alive = false;
      listeners.forEach(off => off());
      document.querySelectorAll('#gx-quiz-section, #gx-quiz-modal').forEach(el => el.remove());
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

  // Articles: the first 3 cards of the "Insights" slider (newest first, as on /blog/)
  function readArticles() {
    const label = findLabel('Insights');
    const box = label && climb(label, el => el.querySelectorAll('a[href*="/post/"]').length >= 2);
    if (!box) return [];
    return itemsIn(box, path => /^\/post\/[^/]+\/$/.test(path)).slice(0, 3).map(({ link, card }) => ({
      href: link.href,
      title: norm(card.querySelector('h3')?.textContent),
      image: imageOf(card)
    }));
  }

  // Email: the mailto: link in the footer
  function readEmail() {
    const link = document.querySelector('footer a[href^="mailto:"]');
    return link ? link.getAttribute('href').slice(7).split('?')[0] : '';
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

  /* ---------- 3. Quiz: steps and state ----------
   * Questions 1–2 come from the page; questions 3–4 and the headings from the brief.
   * The whole modal is redrawn from `state`, so going back and changing an answer
   * updates the results with no extra code. */
  let data = { services: [], industries: [], cases: [], articles: [], email: '' };

  const STEPS = [
    { id: 'services', label: 'Services', icon: '🛠️', question: 'What do you need help with?', multi: true,
      options: () => data.services.map(s => s.name) },
    { id: 'industries', label: 'Industry', icon: '🏢', question: 'Which industry are you in?', multi: true,
      options: () => data.industries },
    { id: 'need', label: 'Goal', icon: '💡', question: 'What would be most useful right now?',
      options: () => ['Case studies like mine', 'Articles to read', 'Talk to someone'] },
    { id: 'when', label: 'Timing', icon: '📅', question: 'When are you looking to start?',
      options: () => ['Right away', 'In the next 3 months', 'Just exploring'] },
    { id: 'results', label: 'Results', icon: '🎯' }
  ];
  const HEADINGS = { 'Right away': 'Let’s talk this week', 'In the next 3 months': 'Here’s where to start', 'Just exploring': 'Take your time' };

  const newState = () => ({ step: 0, answers: { services: [], industries: [], need: '', when: '' } });
  let state = newState();
  const answered = () => {
    const value = state.answers[STEPS[state.step].id];
    return value === undefined || value.length > 0;                       // the results step has no answer
  };

  /* ---------- 4. Markup ----------
   * The button starts disabled and is enabled once the page data has been read.
   * <dialog> + showModal() gives a backdrop, Esc to close and a focus trap for free. */
  const section = document.createElement('section');
  section.id = 'gx-quiz-section';
  section.innerHTML = `
    <h2>Not sure where to start?</h2>
    <p>Answer four quick questions and we’ll point you to the work, reading or people most relevant to you.</p>
    <button type="button" class="gx-btn" disabled>Find your fit</button>`;
  const openButton = section.querySelector('button');

  const dialog = document.createElement('dialog');
  dialog.id = 'gx-quiz-modal';
  dialog.setAttribute('aria-label', 'Find your fit');
  dialog.innerHTML = `
    <button type="button" class="gx-close" data-action="close" aria-label="Close">&times;</button>
    <ol class="gx-progress"></ol>
    <div class="gx-body"></div>
    <div class="gx-footer"></div>`;
  const [progress, body, footer] = ['.gx-progress', '.gx-body', '.gx-footer'].map(s => dialog.querySelector(s));

  /* ---------- 5. Rendering ---------- */
  function render() {
    // Progress bar: done (blue + green check), active (blue, bold), next (white)
    progress.innerHTML = STEPS.map((step, i) => {
      const status = i < state.step ? 'done' : i === state.step ? 'active' : 'next';
      return `<li class="is-${status}"><span class="gx-icon">${step.icon}</span>${step.label}</li>`;
    }).join('');

    const step = STEPS[state.step];
    body.innerHTML = step.options ? questionHTML(step) : resultsHTML();

    const last = state.step === STEPS.length - 1;
    footer.innerHTML = `
      ${state.step > 0 ? '<button type="button" class="gx-back" data-action="back">← Back</button>' : '<span></span>'}
      <button type="button" class="gx-btn gx-btn--small" data-action="${last ? 'restart' : 'next'}" ${answered() ? '' : 'disabled'}>
        ${last ? 'Start again' : state.step === STEPS.length - 2 ? 'See results' : 'Next'}</button>`;
  }

  // Checkboxes for questions 1–2 (many answers), radio buttons for 3–4 (one answer)
  function questionHTML(step) {
    const value = state.answers[step.id];
    const type = step.multi ? 'checkbox' : 'radio';
    return `
      <fieldset class="gx-question">
        <legend>${step.question}</legend>
        <p>${step.multi ? 'Choose one or more' : 'Choose one'}</p>
        <div class="gx-options">
          ${step.options().map(option => `
            <label><input type="${type}" name="${step.id}" value="${esc(option)}"
              ${(step.multi ? value.includes(option) : value === option) ? 'checked' : ''}><span>${esc(option)}</span></label>`).join('')}
        </div>
      </fieldset>`;
  }

  function resultsHTML() {
    const { services, industries, need, when } = state.answers;
    const blocks = [];
    if (when === 'Right away') blocks.push(emailHTML());                    // always at the top
    if (need === 'Case studies like mine') blocks.push(casesHTML());
    if (need === 'Articles to read') blocks.push(articlesHTML());
    if (need === 'Talk to someone') {
      if (when !== 'Right away') blocks.push(emailHTML());                  // never twice
      if (when === 'Just exploring') blocks.push(articlesHTML());
    }
    return `
      <h3 class="gx-heading">${HEADINGS[when]}</h3>
      <dl class="gx-summary">
        <div><dt>You need help with</dt><dd>${services.map(esc).join(', ')}</dd><dd><button type="button" data-step="0">Change</button></dd></div>
        <div><dt>Your industry</dt><dd>${industries.map(esc).join(', ')}</dd><dd><button type="button" data-step="1">Change</button></dd></div>
      </dl>
      ${blocks.join('')}`;
  }

  // Exact matches (service AND industry) first, then related ones (service only), max 3.
  // filter() keeps the Work slider order.
  function casesHTML() {
    const { services, industries } = state.answers;
    const hasService = c => c.services.some(s => services.includes(s));
    const hasIndustry = c => c.industries.some(i => industries.includes(i));
    const picks = [
      ...data.cases.filter(c => hasService(c) && hasIndustry(c)).map(c => ({ ...c, badge: 'Exact match' })),
      ...data.cases.filter(c => hasService(c) && !hasIndustry(c)).map(c => ({ ...c, badge: 'Related' }))
    ].slice(0, 3);
    if (!picks.length) {
      return `<section class="gx-block"><h4>Case studies like yours</h4>
        <p>We don’t have a case study for that combination yet. <a href="https://www.thisisgain.com/work/">Browse all our work</a>.</p></section>`;
    }
    return `<section class="gx-block"><h4>Case studies like yours</h4><div class="gx-cards">
      ${picks.map(c => cardHTML(c, `<span class="gx-badge${c.badge === 'Related' ? ' gx-badge--related' : ''}">${c.badge}</span>`,
        [...c.services, ...c.industries].join(' · '))).join('')}</div></section>`;
  }

  const articlesHTML = () => `<section class="gx-block"><h4>Latest articles</h4>
    <div class="gx-cards">${data.articles.map(a => cardHTML(a)).join('')}</div></section>`;

  const emailHTML = () => `<section class="gx-block gx-email"><h4>Talk to our team</h4>
    <p>Drop us a line at <a href="mailto:${esc(data.email)}">${esc(data.email)}</a></p></section>`;

  const cardHTML = (item, badge = '', meta = '') => `
    <a class="gx-card" href="${esc(item.href)}">
      <img src="${esc(item.image)}" alt="" loading="lazy">
      <span class="gx-card-body">${badge}<strong>${esc(item.title)}</strong>${meta ? `<small>${esc(meta)}</small>` : ''}</span>
    </a>`;

  /* ---------- 6. Events ----------
   * The buttons inside the dialog are recreated on every render, so one listener on the
   * dialog handles them all (event delegation). */
  const goTo = step => { state.step = step; render(); };

  on(dialog, 'click', event => {
    if (event.target === dialog) return dialog.close();                    // click on the backdrop
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.step) return goTo(+button.dataset.step);            // "Change"
    const action = button.dataset.action;
    if (action === 'next') goTo(state.step + 1);
    if (action === 'back') goTo(state.step - 1);
    if (action === 'restart') { state = newState(); goTo(0); }
    if (action === 'close') dialog.close();
  });

  on(body, 'change', () => {                                               // an answer was picked
    const step = STEPS[state.step];
    const checked = [...body.querySelectorAll('input:checked')].map(input => input.value);
    state.answers[step.id] = step.multi ? checked : checked[0];
    footer.querySelector('[data-action="next"]').disabled = !answered();  // Next only once answered
  });

  on(openButton, 'click', () => { render(); dialog.showModal(); });

  function readPage() {
    const services = readServices();
    const industries = readIndustries();
    return { services, industries, cases: readCases(services, industries), articles: readArticles(), email: readEmail() };
  }

  /* ---------- 7. Start ----------
   * The hero is the headline block plus the showreel video under it, so the section goes
   * after the video. waitFor() makes this work even before the page has finished loading. */
  (async () => {
    const hero = await waitFor(() => document.querySelector('main h1')?.closest('main > *'));
    if (!alive || !hero) return;
    const video = hero.nextElementSibling;
    (video?.querySelector('video') ? video : hero).after(section);
    document.body.append(dialog);

    data = await waitFor(() => {
      const page = readPage();
      const complete = document.readyState !== 'loading' && Object.values(page).every(value => value.length);
      return complete ? page : null;
    }) || readPage();
    if (!alive) return;
    console.log('[gx-quiz] Read from the homepage:', data);
    openButton.disabled = false;
  })();
})();
