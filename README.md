# gsap-connector

GSAP's ScrollTrigger and the page, with or without Lenis — in one line. It
refreshes the triggers when the page changes height, brings a reload back
to where the page was left, pins and all, and, on a page with Lenis, runs
Lenis on GSAP's ticker so the two never part. No dependencies.

> **GSAP is not in this package — install it yourself.** The connector
> takes the GSAP your site already has: one copy on the page, the version
> you chose.

```sh
npm install gsap
npm install github:omisilli/gsap-connector#v1.1.0
```

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { connectGsap } from "@plusguard/gsap-connector";

gsap.registerPlugin(ScrollTrigger);

connectGsap({ gsap, ScrollTrigger });          // without Lenis
connectGsap({ gsap, ScrollTrigger, lenis });   // with Lenis
```

It returns its own cleanup.

`index.css` is empty — connecting needs no CSS. Import it anyway
(`@plusguard/gsap-connector/index.css`, or in your theme's CSS): a rule
added in a later release then reaches you with no new import line.

### Without a build step

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/gsap-connector@v1.1.0/index.css" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js"></script>
<script type="module">
    import { connectGsap } from "https://cdn.jsdelivr.net/gh/omisilli/gsap-connector@v1.1.0/dist/index.js";

    gsap.registerPlugin(ScrollTrigger);
    connectGsap({ gsap, ScrollTrigger });
</script>
```

Pin the versions on a live site. A pinned URL never changes; `@1` follows
the newest 1.x release.

## Which do I need?

| Your site uses       | You need                         | What the connector does                           |
| -------------------- | -------------------------------- | ------------------------------------------------- |
| GSAP, no Lenis       | `gsap` + `gsap-connector`        | Refreshes the triggers when the page changes height |
| GSAP and Lenis       | `gsap` + `lenis` + `gsap-connector` | The same, and runs Lenis on GSAP's ticker        |
| Lenis, no GSAP       | `lenis` only                     | Nothing — leave the connector out; no GSAP is loaded |

## What it does

### The page changes height — the triggers move with it

ScrollTrigger measures where each animation starts and ends on load and
on resize, and nowhere else. Content that arrives later — a list fetched
after the page, a skeleton replaced by cards, an image, an accordion that
opens — moves everything below it, and an animation down there would fire
at the old place. The connector watches the page's height and refreshes
ScrollTrigger when it changes, once a frame at most.

With or without Lenis: ScrollTrigger reads the page's own scroll, which
Lenis moves.

### A reload lands where the page was left

The browser puts the scroll back as the page loads. A pin adds its
spacing only once its trigger is made — and a trigger made after the page
has loaded (behind an `await`, in a React effect, in a chunk that comes
later) adds it to a page the browser has already measured. The scroll
comes back short by that spacing: below a pinned section, a reload lands
higher than you were.

The connector keeps the scroll for this tab, saved as the page goes. On a
reload, or back and forward, it puts it back after the triggers are
refreshed — until the page has loaded, then it lets go. It leaves the
scroll alone when the visitor scrolls first, when the address has a `#`
(the page goes there instead), on a first visit, and with a Lenis that
scrolls a box of its own rather than the page.

A site that keeps the scroll itself turns it off:

```js
connectGsap({ gsap, ScrollTrigger, lenis, restoreScroll: false });
```

### Lenis on GSAP's clock

Lenis and GSAP each want to run once a frame; two separate loops drift a
frame apart, and a scrubbed animation trembles behind the scroll. With
Lenis, the connector:

- **runs Lenis on GSAP's ticker** — and switches Lenis's own loop
  (`autoRaf`) off meanwhile, so it is not run twice a frame. Create Lenis
  as you would anyway; the connector takes the loop over;
- **updates ScrollTrigger on every Lenis scroll**;
- **turns GSAP's lag smoothing off** (`lagSmoothing(0)`), so a slow frame
  does not make them part.

When it lets go — its cleanup, or a new `connectGsap` — Lenis gets its own
loop back and GSAP its lag smoothing. A Lenis that was destroyed meanwhile
is left alone: no loop is started on it again.

This is what Lenis's own documentation asks for, with one change: Lenis is
given `performance.now()`, the clock its own loop uses, rather than the
ticker's `time * 1000`, which starts elsewhere. Lenis measures each frame
from the one before; switching between two clocks would throw it by the
difference once.

### With Lenis, smooth once

Lenis already smooths the scroll. Two settings keep it to that one
smoothing:

- **`scrub: true`, not a number.** `scrub: 1` makes an animation catch up
  with the scroll over a second — on top of Lenis's own glide it trails
  twice over and feels heavy. Without Lenis, a number is what smooths it:

  ```js
  scrollTrigger: { trigger: ".scene", pin: true, scrub: lenis ? true : 1 }
  ```

- **Lenis with `lerp`, not `duration`.** Its default, `lerp: 0.1`, closes a
  tenth of the gap each frame: a trackpad's stream of wheel events reads as
  one glide. Given `duration` and `easing`, Lenis starts that curve again on
  every wheel event — the speed jumps each time, and a scrubbed scene jumps
  with it. Leave both out; `scrollTo` can still take a duration of its own.

### One connection at a time

A new `connectGsap` ends the one before. The older cleanup, if it comes
late — React remounting in development — does nothing.

## React (Next)

```tsx
"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { connectGsap } from "@plusguard/gsap-connector";

gsap.registerPlugin(ScrollTrigger);

export function GsapConnector() {
    const lenis = useLenis();
    useEffect(() => connectGsap({ gsap, ScrollTrigger, lenis }), [lenis]);
    return null;
}
```

Mount it once, in the root layout. `useLenis` finds the root Lenis
(`<ReactLenis root>`) from outside its provider too, and is `undefined` on
a page without one — the same component serves both, and follows Lenis as
routes come and go.

Register the plugins once, in one file, and import `gsap` from there
everywhere: one copy on the page, the one that is connected. Animate with
`useGSAP` from `@gsap/react` — its cleanup reverts every trigger a section
made when it unmounts.

See [`examples/react/Example.tsx`](examples/react/Example.tsx).

## Alongside

- **Lenis** — any version with `autoRaf` (1.1 and later).
- **The PlusGuard scrollbar** — no clash. It watches the page's size, so
  the height a pinned section adds moves its grip too; dragging the grip
  scrolls the page, which ScrollTrigger sees — through Lenis on a Lenis
  page.
- **Panels that scroll on their own** — give ScrollTrigger the panel as its
  `scroller`. That is GSAP's own way, not a clash.
- **Not ScrollSmoother.** GSAP's own smooth scrolling does what Lenis does,
  differently: it moves the content with transforms instead of scrolling the
  page. Next to Lenis, or the PlusGuard scrollbar, it clashes. Use one smooth
  scroll — here, Lenis.

## Example

[`examples/static/index.html`](examples/static/index.html) — with Lenis, or
without it (`?nolenis`), and without the connector (`?off`), to see the
difference: grow the page above the card and watch ScrollTrigger's markers
follow it — or, without the connector, stay where they were. A card that
widens as it scrolls through, a pinned section whose strip slides
across, and the recipe — a word that opens onto a picture. Its photo is in
`examples/static/media/`.

## Recipes

Plain GSAP on the connected page — no package of their own, a few lines
each. The connector only keeps them in step with the scroll, Lenis or not.

### A word that opens onto a picture

The picture shows only through the letters of a word. As the page scrolls
the word comes at you — from inside one of its letters — and leaves the
screen, the picture opening out of that letter; the moment the picture is
whole, the page scrolls on. Every time, by default: scroll back and it
closes into the word again. Or only the first time:
`data-pg-gsap-connector-reveal="once"` on the section, and once open it
stays open — one screen tall, no stretch to wait through, up or down.

```html
<section class="pg-gsap-connector-reveal" id="reveal">  <!-- data-pg-gsap-connector-reveal="once": only the first time -->
    <div class="pg-gsap-connector-reveal-stage">
        <img src="car.avif" alt="AUDI — a car, seen through the letters" />
        <div class="pg-gsap-connector-reveal-cover" aria-hidden="true"><span class="pg-gsap-connector-reveal-word">AUDI</span></div>
    </div>
</section>
<!-- Only with "once": right after the section, a classic script. Played
     already in this tab, it is one screen tall before the page is drawn. -->
<script>
    (function (scene) {
        try {
            var key = "pg-gsap-connector-reveal:" + location.pathname + "#" + scene.id;
            if (scene.getAttribute("data-pg-gsap-connector-reveal") === "once" && sessionStorage.getItem(key)) {
                scene.setAttribute("data-pg-gsap-connector-reveal-played", "");
            }
        } catch (e) {}
    })(document.getElementById("reveal"));
</script>
```

```css
.pg-gsap-connector-reveal { height: 325svh; background: #000; }          /* the scene: 225svh of scroll */
.pg-gsap-connector-reveal-stage { position: sticky; top: 0; height: 100svh; overflow: clip; display: grid; isolation: isolate; }
.pg-gsap-connector-reveal-stage > * { grid-area: 1 / 1; }
.pg-gsap-connector-reveal-stage img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pg-gsap-connector-reveal-cover { display: grid; place-items: center; background: #000; mix-blend-mode: darken; }
/* --pg-gsap-connector-reveal-origin: the point the word grows from, as fractions of the word.
   The middle of a stroke near the centre — for AUDI in this font, the right
   leg of the U (49.7–58.1% across): 54%. Set it for your word and font;
   not set, the middle. */
.pg-gsap-connector-reveal-word {
    --pg-gsap-connector-reveal-origin: 54% 50%;
    font: 900 min(28vw, 45svh) / 1 system-ui, sans-serif;
    letter-spacing: -0.03em;
    white-space: nowrap;
    color: #fff;
    transform-origin: var(--pg-gsap-connector-reveal-origin, 50% 50%);
}
/* Played once already: one screen, the picture open — no scene left. */
.pg-gsap-connector-reveal[data-pg-gsap-connector-reveal-played] { height: 100svh; }
[data-pg-gsap-connector-reveal-played] .pg-gsap-connector-reveal-cover { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { .pg-gsap-connector-reveal { height: auto; } }
```

```js
const reveal = document.getElementById("reveal");
const PLAYED = "data-pg-gsap-connector-reveal-played";
const playedKey = `pg-gsap-connector-reveal:${location.pathname}#${reveal.id}`;
const once = reveal.getAttribute("data-pg-gsap-connector-reveal") === "once";

// Once: when the picture is whole the trigger goes, the timeline stays,
// finished — and the section is one screen from now on, the scroll kept on
// what it showed. st.animation: on a load below the section the first
// refresh comes while the timeline is still being made.
const stayOpen = (st) => {
    if (st.progress < 0.99) return;
    const timeline = st.animation;
    st.kill(false, true);
    gsap.to(timeline, { progress: 1, duration: 0.4, ease: "power1.out" });
    try { sessionStorage.setItem(playedKey, "1"); } catch {}
    const stage = reveal.firstElementChild;
    const before = stage.getBoundingClientRect().top;
    reveal.setAttribute(PLAYED, "");
    const shift = stage.getBoundingClientRect().top - before;
    if (shift) {
        const top = scrollY + shift;
        if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
        else scrollTo({ top, behavior: "instant" });
    }
    requestAnimationFrame(() => ScrollTrigger.refresh()); // the page below moved
};

if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.set(".pg-gsap-connector-reveal-cover", { autoAlpha: 0 }); // the picture, open
} else if (!reveal.hasAttribute(PLAYED)) {
    gsap.timeline({
        scrollTrigger: {
            trigger: reveal,
            start: "top top",
            end: "bottom bottom",
            scrub: lenis ? true : 1,
            onUpdate: once ? stayOpen : undefined,
            onRefresh: once ? stayOpen : undefined, // a load below it
        },
    })
        // the word grows from its point, out of the screen
        .fromTo(".pg-gsap-connector-reveal-word", { scale: 1 }, { scale: 60, ease: "power3.in", duration: 1 }, 0)
        // 0.85 – 1: the stroke covers the screen by now; the cover fades for
        // a word whose point sits on a gap — and the scene ends, whole
        .fromTo(".pg-gsap-connector-reveal-cover", { autoAlpha: 1 }, { autoAlpha: 0, ease: "power1.inOut", duration: 0.15 }, 0.85);
}
```

- **A dark cover blended `darken`, not an SVG mask.** The cover is the
  section's dark with the word in white; `darken` keeps the darker of the
  two — the dark around the letters, the photo inside them. The word is
  real text — any font the page has, any word, no image of it to make.
  An SVG `<mask>` looks like the obvious tool, but sixty times its size a
  word in a mask is drawn wrong by the GPU — dark bands across the screen,
  sooner on a Retina display — while a scaled element is drawn in tiles,
  only what is on screen. `isolation: isolate` keeps the blend to the stage.
  The dark is black, `#000`: `darken` keeps whichever is darker, so a
  dark grey would let the photo's own darkest pixels through — a faint
  ghost of the picture around the letters.
- **Where it grows from: `--pg-gsap-connector-reveal-origin`, set for the word.** Grown from
  its exact middle, a word ends wherever its middle happens to fall — on
  the edge of a letter, and that edge, a pixel off the centre, slides
  aside sixty times over; or in a gap, and the screen goes dark. So the
  point is a design choice, made in the CSS beside the word's font: the
  middle of a stroke near the centre. That stroke grows over the whole
  screen from where it stands — the picture opens out of the letter,
  nothing slides. To find it, look at the word across its middle: in AUDI
  (this font, `-0.03em`), the right leg of the U runs from 49.7% to 58.1%
  of the word — `54% 50%`. A different word, font, weight or
  letter-spacing moves the strokes: set it again. It is plain
  `transform-origin`, so a breakpoint that changes the font sets its own,
  and the script needs to know nothing. Leaning it — like a brand that
  grows from one letter on purpose — is the same setting.
- **First the stroke, then the fade.** Grown sixty times, a stroke a
  twelfth of the word wide covers the screen by about 0.75 of the scene
  on a 16:10 screen, 0.85 on a very wide one. Only then, 0.85 – 1, does
  the cover fade — with the point set well there is nothing left to fade,
  and nothing half-dark slides across while the word still grows. It is
  there for the word whose point sits on a gap, or is not set: whatever is
  still dark opens onto the picture, and at the end of the scene the
  picture is whole, on any word and any screen. `autoAlpha` ends it
  `visibility: hidden` — nothing drawn over the picture.
- **Whole, then it scrolls on — no hold.** The timeline ends as the
  picture is whole, at the section's `bottom bottom`: the very next scroll
  carries the picture away with the section. For a slower scene make the
  section taller; for a hold, an empty stretch at the end of the timeline
  (`.set({}, {}, 1.2)`) keeps it whole a while.
- **Every time, or only the first time.** By default the scene is tied to
  the scroll both ways: scroll back up and the picture closes into the
  word again. `data-pg-gsap-connector-reveal="once"` plays it the first
  time only. When the picture is whole, `kill(false, true)` removes the
  trigger but keeps the timeline, and a short tween takes it to its end.
  Then the section gets `data-pg-gsap-connector-reveal-played` and is one
  screen tall: a picture that scrolls by like any block — no 225svh of a
  scene with nothing left in it, waited through on the way back up or on
  the way down again. The page above the viewport is shorter by that
  much, so the scroll moves with it — measured on the stage, before and
  after — and the screen shows just what it did.
- **"The first time" is the tab's.** The played scene is kept in
  `sessionStorage`, per page and section id. That is for the reload: a
  page that shrank while it was read would be 225svh taller again when it
  reloads, and the browser would put the scroll a scene's height away
  from where the reader was. So the little classic script right after the
  section marks it played as the HTML is read — before anything is drawn,
  before the browser restores the scroll — and the page comes back just as
  it was left. A new tab plays it again. `onRefresh` covers the first load
  below the section — a link to something further down: the scene is
  played and folded there and then.
- **`power3.in`:** slow at first, so the word answers the first scroll
  without rushing at you; fast as it leaves.
- **Held by CSS `sticky`, not `pin: true`.** The section is its full
  height in the first HTML. A pin adds its height only when the script runs —
  on a reload the browser restores the scroll to the shorter page, then the
  pin pushes everything down, and the scene flashes by.
- **One smoothing:** `scrub: true` with Lenis, `scrub: 1` without — see
  With Lenis, smooth once.
- **Reduced motion:** the cover hidden, the section one screen tall — the
  picture, open, at once.

## From the old gsap folder

The old page created Lenis and ScrollTrigger side by side and never linked
them: no `lenis.on("scroll", ScrollTrigger.update)`, Lenis on its own
`requestAnimationFrame` loop, GSAP on its ticker. Scrubbed animations
lagged a frame behind the glide. `connectGsap({ gsap, ScrollTrigger, lenis })`
is the link.
