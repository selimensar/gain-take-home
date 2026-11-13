# Gain take-home – vanilla JS + CSS

Three tasks, each one **CSS file** (injected into `<head>`) and one **JS file** (pasted into the DevTools console). No frameworks or libraries.

| Task | Page | Files |
|---|---|---|
| 1. Questionnaire modal | https://www.thisisgain.com/ | `task1-questionnaire.css` + `.js` |
| 2. Footer drawer | https://www.thisisgain.com/ | `task2-drawer.css` + `.js` |
| 3. Pokémon blog (React SPA) | https://www.thisisgain.com/blog/ | `task3-pokemon.css` + `.js` |

## How to run

1. Open the page and the DevTools console.
2. Inject the CSS:
   ```js
   const s = document.createElement('style');
   s.textContent = String.raw`/* paste the .css file here */`;
   document.head.append(s);
   ```
3. Paste the JS file and press Enter. Pasting it again replaces the first run; nothing is duplicated.

## Approach

- **Nothing hard-coded.** Sections are found by their visible text ("Solutions", "Our Sectors", "Work", "Insights") and items by their URLs (`/work/…`, `/post/…`), not by class names, which can change on any deploy.
- **Safe to run twice.** Each script keeps a `destroy()` on `window` that removes its elements and listeners; a new run calls it first.
- **Runs before the page has loaded (bonus).** `waitFor()` uses a `MutationObserver` to wait until the content it needs exists. In Task 1 the button stays in its Disabled state until then. Tested with Tampermonkey at `document-start`.
- **Task 1:** a native `<dialog>` (backdrop, Esc and focus trap built in). The modal is redrawn from one `state` object, so going back and changing an answer updates the results. The pixel button is pure CSS: `box-shadow` layers draw the stepped outline, strips and drop shadow, and each state only swaps CSS variables.
- **Task 2:** the drawer is moved with `transform`, so only its tab shows when closed. The slider is a scrolling row with CSS `scroll-snap` (touch swipe built in) plus a few lines for mouse dragging; the page count is measured from the layout. The tooltip lives in `<body>` and is placed so it always fits on screen.
- **Task 3:** React owns the article list, so the script never edits React's elements. Each card gets one extra child (the Pokémon), and CSS hides the rest, so article content never flashes. A `MutationObserver` re-applies the cards whenever React redraws, and one capture-phase click listener on `window` flips any card, including cards added later.

## Notes from testing on the live site

- Tested in Chrome on 12 Nov 2026; no "Just a moment…" page appeared.
- The hero is the headline plus the showreel video under it, so the new section goes after the video.
- Images are lazy-loaded by ShortPixel: until scrolled into view, an image's `src` is an SVG placeholder holding the real URL (`data-u`), which the scripts read.
- One card says "Tech & Telcoms" where Our Sectors says "Tech & Telco", so names are matched exactly or by "starts with".
- The Insights cards show no dates, so "latest" follows the slider order (the same order as /blog/).
- Blog filters are `<select>`s. "Filter by Tags" and "Filter by Capability" are hidden by CSS from the first paint, and "Filter by type" takes Capability's place, so it inherits the site's style.
- The "runs before the page has loaded" bonus was tested with Tampermonkey (`@run-at document-start`), using these CSS and JS files unchanged. The Task 1 button stays Disabled until the page data is ready, and the blog content never flashes before the Pokémon appear.

## Take-home checklist

### All tasks
- [x] Safe to run more than once on the same page (no duplicate sections, drawers or cards)

### 1. Dynamic Modal: Questionnaire (https://www.thisisgain.com/)
- [x] Uses Flex or Grid CSS
- [x] Works on desktop, tablet and mobile (down to 375px)
- [x] Nothing is hardcoded: options, case studies, articles and the email are read from the homepage
- [x] New section under the hero: header, paragraph and button
- [x] Button UI states match Figure 1 (CSS only)
- [x] Button opens a modal
- [x] 4 question steps + a results step
- [x] Service options match the "Solutions" menu and industry options match "Our Sectors"
- [x] Questions 1 and 2 allow more than one answer, questions 3 and 4 allow one
- [x] Results heading changes with question 4
- [x] Results content changes with question 3 (case studies, articles or email)
- [x] Exact matches first, topped up with labelled related ones (max 3, in slider order), plus the "none" message
- [x] "Right away" always shows the email at the top (only once with "Talk to someone")
- [x] "Talk to someone" + "Just exploring" also shows the 3 latest articles
- [x] Summary of the question 1 and 2 picks, with a way to go back and change them
- [x] Case studies and articles link to their real pages
- [x] Progress bar with active (blue, bold), completed (blue + green checkmark) and next (white) states
- [x] Can't go to the next step until the current one is answered
- [x] Can go back, change an answer, and the results update

### 2. Footer Drawer (https://www.thisisgain.com/)
- [x] Uses Flex or Grid CSS
- [x] Works on desktop, tablet and mobile (down to 375px)
- [x] Sticky drawer at the bottom of the page
- [x] Tab toggles the drawer on/off
- [x] Chevron rotates 180 degrees on toggle
- [x] Drawer slides in and out from the bottom
- [x] Page count and arrow buttons when the drawer is open
- [x] Overlay on the page, and clicking it closes the drawer
- [x] Drawer closes automatically at the bottom of the page
- [x] One slide per case study, read from the "Work" slider (nothing hardcoded or fetched)
- [x] Each slide has an image, header, industry tag with tooltip, service description and link
- [x] Slider is draggable and swipeable on smaller viewports
- [x] Tooltip matches Figure 5 and handles small screens or tight space
- [x] 4+ slides on desktop, 2+ on tablet, 1 on mobile

### 3. SPA DOM Manipulation (https://www.thisisgain.com/blog/)
- [x] Uses Flex or Grid CSS
- [x] Works on desktop, tablet and mobile (down to 375px)
- [x] Every article card shows a Pokémon (image, name, types) based on its position
- [x] No article content flashes before the Pokémon appear (paging and filtering too)
- [x] Pokémon numbers follow the page (page 2 starts at #13)
- [x] "Filter by Tags" hidden, and "Filter by type" lists the 18 regular types and filters the current page, with an empty message
- [x] The chosen type stays selected when changing pages
- [x] Clicking a Pokémon card flips it to show more details, and still works after paging or filtering
- [x] All changes persist through the type filter and paging

### Bonus
- [x] [Bonus] Animations where they improve the experience
- [x] [Bonus] Works when it runs before the page has finished loading
