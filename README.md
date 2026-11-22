# gsap-connector

GSAP's ScrollTrigger and the page, with or without Lenis — in one line. It
refreshes the triggers when the page changes height, brings a reload back
to where the page was left and a `#` link to its element, pins and all,
and, on a page with Lenis, runs Lenis on GSAP's ticker so the two never
part. No dependencies.

> **GSAP is not in this package — install it yourself.** The connector
> takes the GSAP your site already has: one copy on the page, the version
> you chose.

```sh
npm install gsap
npm install @plusguard/gsap-connector
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@plusguard/gsap-connector@1.1.2/index.css" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js"></script>
<script type="module">
    import { connectGsap } from "https://cdn.jsdelivr.net/npm/@plusguard/gsap-connector@1.1.2/dist/index.js";

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

A link to a `#id` below a pin goes wrong the same way: the browser goes
to the element before the pin is in, and the pin then pushes it down.

The connector keeps the scroll for this tab, saved as the page goes. On a
reload, or back and forward — `#` or not, as the browser does itself — it
puts it back after the triggers are refreshed. On a first visit to an
address with a `#`, it puts that element back at the top of the screen,
where the browser meant it to be (its `scroll-margin-top` and the page's
`scroll-padding-top` kept). Either way, after each refresh until the page
has loaded, then it lets go.

It leaves the scroll alone when the visitor scrolls first, on a first
visit with no `#`, and with a Lenis that scrolls a box of its own rather
than the page. A `#` element that is hidden — in a closed tab — or one
Lenis is already gliding to is left to the page's own anchor code.

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
across, a reload and a `#` link that land in the right place below it,
and the two recipes — a word that opens onto a picture, and a video that
grows as it passes. The photo and the video are in
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
/* --pg-gsap-connector-reveal-length: the scene — how far the page scrolls while
   the word grows and leaves. Shorter is faster. Not set: 225svh. */
.pg-gsap-connector-reveal { height: calc(100svh + var(--pg-gsap-connector-reveal-length, 225svh)); background: #000; }
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
  carries the picture away with the section. For a hold, an empty stretch
  at the end of the timeline (`.set({}, {}, 1.2)`) keeps it whole a while.
- **How fast: `--pg-gsap-connector-reveal-length`.** The scene is the
  scroll it takes — 225svh by default, a little over two screens. Shorter
  is faster: `100svh` and the word is gone in one screen's scroll. Set it
  on the section or any parent, in the CSS; a breakpoint can set its own.
  The script reads nothing: the trigger runs `top top` to `bottom bottom`,
  whatever the height.
- **Every time, or only the first time.** By default the scene is tied to
  the scroll both ways: scroll back up and the picture closes into the
  word again. `data-pg-gsap-connector-reveal="once"` plays it the first
  time only. When the picture is whole, `kill(false, true)` removes the
  trigger but keeps the timeline, and a short tween takes it to its end.
  Then the section gets `data-pg-gsap-connector-reveal-played` and is one
  screen tall: a picture that scrolls by like any block — no scene with
  nothing left in it, waited through on the way back up or on
  the way down again. The page above the viewport is shorter by that
  much, so the scroll moves with it — measured on the stage, before and
  after — and the screen shows just what it did.
- **"The first time" is the tab's.** The played scene is kept in
  `sessionStorage`, per page and section id. That is for the reload: a
  page that shrank while it was read would be a scene taller again when it
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
  height in the first HTML. A pin adds its height only when the script
  runs, after the browser has measured the page without it; the connector
  puts a reload back in place, but the scene needs no putting back at all.
- **One smoothing:** `scrub: true` with Lenis, `scrub: 1` without — see
  With Lenis, smooth once.
- **Reduced motion:** the cover hidden, the section one screen tall — the
  picture, open, at once.

### A video that grows as it passes

A 16:9 video in the page. As it comes to the middle of the screen it
grows, and as the page goes on it shrinks back to its place. Nothing is
pinned: the page scrolls on all the while. It plays while it is in sight
and stops when it is not; its buttons, at the bottom right: sound, play /
pause and full screen.

```html
<section class="pg-gsap-connector-grow" id="grow-video">  <!-- data-pg-gsap-connector-grow-autoplay="false": waits for play -->
    <div class="pg-gsap-connector-grow-to">
        <div class="pg-gsap-connector-grow-frame" data-pg-gsap-connector-grow-muted>
            <video muted loop playsinline preload="metadata" aria-label="…">  <!-- poster="cover.jpg": shown while it waits -->
                <source src="grow-phone.mp4" media="(max-width: 47.99rem)" type="video/mp4" />  <!-- a phone's own; leave out for one video -->
                <source src="grow.mp4" type="video/mp4" />
            </video>
            <div class="pg-gsap-connector-grow-buttons">
                <button type="button" data-pg-gsap-connector-grow-button="sound" aria-label="Sound on">
                    <svg class="is-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6" /></svg>
                    <svg class="is-sound" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" /></svg>
                </button>
                <button type="button" data-pg-gsap-connector-grow-button="play" aria-label="Play">
                    <svg class="is-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                    <svg class="is-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14" /></svg>
                </button>
                <button type="button" data-pg-gsap-connector-grow-button="fullscreen" aria-label="Full screen">
                    <svg class="is-expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                    <svg class="is-shrink" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
                </button>
            </div>
        </div>
    </div>
</section>
```

```css
/* The area kept for it: one screen, the video in its middle. */
.pg-gsap-connector-grow {
    height: 100svh;
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr); /* the area's size, not the video's */
    place-items: center;
}
/* What it grows to: --pg-gsap-connector-grow-to-width (100%) and -to-height
   (100%; auto: 16:9 of the width). */
.pg-gsap-connector-grow-to {
    width: var(--pg-gsap-connector-grow-to-width, 100%);
    height: var(--pg-gsap-connector-grow-to-height, 100%);
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    place-items: center;
}
/* At rest --pg-gsap-connector-grow-width (min(60vw, 64rem); vw, rem or px),
   16:9, corners --pg-gsap-connector-grow-radius (1.5rem). GSAP moves
   --pg-gsap-connector-grow-progress, 0 to 1; the size follows. */
.pg-gsap-connector-grow-frame {
    --rest: var(--pg-gsap-connector-grow-width, min(60vw, 64rem));
    --p: var(--pg-gsap-connector-grow-progress, 0);
    position: relative;
    width: calc(var(--rest) + (100% - var(--rest)) * var(--p));
    height: calc(var(--rest) * 9 / 16 + (100% - var(--rest) * 9 / 16) * var(--p));
    border-radius: calc(var(--pg-gsap-connector-grow-radius, 1.5rem) * (1 - var(--p)));
    overflow: clip;
    background: #000;
}
.pg-gsap-connector-grow-frame video { display: block; width: 100%; height: 100%; object-fit: cover; }
.pg-gsap-connector-grow-frame:fullscreen { border-radius: 0; }
.pg-gsap-connector-grow-frame:fullscreen video { object-fit: contain; }
.pg-gsap-connector-grow-buttons { position: absolute; right: 1.25rem; bottom: 1.25rem; display: flex; gap: 0.5rem; }
.pg-gsap-connector-grow-buttons button {
    display: grid; place-items: center; width: 3rem; height: 3rem; padding: 0;
    border: 2px solid rgb(255 255 255 / 0.5); border-radius: 50%; background: rgb(0 0 0 / 0.2); color: #fff; cursor: pointer;
}
.pg-gsap-connector-grow-buttons svg {
    width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor;
    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
/* Each button shows the icon of what it does now. */
.pg-gsap-connector-grow-frame:not([data-pg-gsap-connector-grow-playing]) .is-pause,
[data-pg-gsap-connector-grow-playing] .is-play,
.pg-gsap-connector-grow-frame:not([data-pg-gsap-connector-grow-muted]) .is-muted,
[data-pg-gsap-connector-grow-muted] .is-sound,
.pg-gsap-connector-grow-frame:not(:fullscreen) .is-shrink,
.pg-gsap-connector-grow-frame:fullscreen .is-expand { display: none; }
```

```js
const scene = document.getElementById("grow-video");
const frame = scene.querySelector(".pg-gsap-connector-grow-frame");
const video = frame.querySelector("video");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// The size: 0.2 – 0.45 grows, 0.55 – 0.8 shrinks, of a trigger that runs
// from the section coming in to it going out — grown as it fills the
// screen, held a moment.
if (!reduced) {
    gsap.timeline({
        scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: lenis ? true : 1 },
    })
        .fromTo(frame, { "--pg-gsap-connector-grow-progress": 0 }, { "--pg-gsap-connector-grow-progress": 1, ease: "power1.inOut", duration: 0.25 }, 0.2)
        .to(frame, { "--pg-gsap-connector-grow-progress": 0, ease: "power1.inOut", duration: 0.25 }, 0.55)
        .set({}, {}, 1);
}

// The video: plays in sight, stops out of it — unless the viewer stopped
// it, or it waits for play from the start.
const button = (name) => frame.querySelector(`[data-pg-gsap-connector-grow-button="${name}"]`);
const [play, sound, full] = ["play", "sound", "fullscreen"].map(button);
let stopped = reduced || scene.getAttribute("data-pg-gsap-connector-grow-autoplay") === "false";

const mark = (name, on) => (on ? frame.setAttribute(name, "") : frame.removeAttribute(name));
const show = () => {
    mark("data-pg-gsap-connector-grow-playing", !video.paused);
    mark("data-pg-gsap-connector-grow-muted", video.muted);
    play.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    sound.setAttribute("aria-label", video.muted ? "Sound on" : "Sound off");
    full.setAttribute("aria-label", document.fullscreenElement === frame ? "Leave full screen" : "Full screen");
};
["play", "pause", "volumechange"].forEach((type) => video.addEventListener(type, show));
document.addEventListener("fullscreenchange", show);

new IntersectionObserver(
    ([entry]) => {
        if (entry.isIntersecting && !stopped) video.play().catch(() => {});
        if (!entry.isIntersecting) video.pause();
    },
    { threshold: 0.25 },
).observe(scene);

play.addEventListener("click", () => {
    stopped = !video.paused;
    if (stopped) video.pause();
    else video.play().catch(() => {});
});
sound.addEventListener("click", () => (video.muted = !video.muted));
full.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
    else video.webkitEnterFullscreen?.(); // iPhone: the video alone
});

show();
```

- **The area is kept.** The section is one screen tall from the first
  HTML, the video in its middle: it grows inside room that is already
  there, so nothing around it moves or is covered, and a reload lands
  where it should. What it grows to is a box in the middle of that area —
  `--pg-gsap-connector-grow-to-width` and `-to-height`: the whole area
  (both `100%`, the video cropped to fill it), the page's width at 16:9
  (`-to-height: auto`), or less — `min(100%, 1200px)` wide, 16:9. Never
  bigger than the area.
- **Per screen size: a breakpoint.** The settings are CSS, so a media
  query sets its own — the whole area on a computer, 16:9 of the screen's
  width on a phone:

  ```css
  @media (max-width: 47.99rem) {
      .pg-gsap-connector-grow { --pg-gsap-connector-grow-to-height: auto; }
  }
  ```

  The size at rest the same way: `--pg-gsap-connector-grow-width: 80vw`
  on a phone, where 60vw is small.
- **A video per screen size: `<source media>`.** The phone's first — the
  browser takes the first `<source>` whose `media` fits, as the page
  loads; the last, without `media`, is everyone else's. A phone can have a
  smaller file, cut for its screen. Chosen once: turning a phone or
  resizing a window later keeps the video it has. One video for all:
  `src` on the `<video>`, no `<source>`.
- **100svh, not 100dvh — or vh.** On a phone the browser's bars hide as
  the page scrolls down and come back as it scrolls up. `svh` is the screen
  with the bars shown: it does not change as they come and go, so the area
  stays as it is — the grown video leaves a strip the bars' height when
  they are hidden, and that is all. `dvh` follows the bars: the area, and
  the video in it, would grow and shrink under the reader's finger, and
  every trigger below would be measured again. `vh` is the screen with
  the bars hidden on iOS: taller than what shows while they are there,
  so the grown video would run under them.
- **The size is CSS.** GSAP moves one number,
  `--pg-gsap-connector-grow-progress`, from 0 to 1 and back; the width,
  height and corners are worked out from it in the stylesheet, between
  the size at rest (`--pg-gsap-connector-grow-width`, 16:9) and the box.
  A resize or a turned phone needs nothing from the script, and the
  trigger has no sizes to measure again. The width at rest is in `vw`,
  `rem` or `px` — not `%`, as its height is worked out from it — and is
  meant to be less than the width grown.
- **One cell the area's size.** `grid-template: minmax(0, 1fr) /
  minmax(0, 1fr)`: in an `auto` row, a tall video would stretch the row to
  its own height before the frame's `100%` could take the area's.
- **When it moves.** The trigger runs from the section's top meeting the
  screen's bottom to its bottom leaving the screen's top: 0.2 – 0.45 it
  grows, 0.45 – 0.55 it is held grown — the section filling the screen —
  and 0.55 – 0.8 it shrinks. `.set({}, {}, 1)` makes the timeline one
  long, so the numbers are fractions of the trigger.
- **Plays in sight.** An `IntersectionObserver` on the section: a quarter
  of it in sight, it plays; out of sight, it stops. Stopped by the viewer,
  it waits for them — scrolled away and back, it is still stopped.
  `data-pg-gsap-connector-grow-autoplay="false"` on the section: it waits
  for play from the start; once played, it plays in sight like the other.
  A picture to show while it waits is the video's own `poster`. `muted` and
  `playsinline` let a browser play it without a press.
- **It starts muted** — a browser plays a video by itself only without
  sound; the sound button, leftmost, turns it on and off.
- **Full screen: the frame,** so the buttons come with it — the same
  button, or Esc, leaves. On an iPhone, which puts only a video in full
  screen, the video itself.
- **The buttons show what they do now:** the frame carries
  `data-pg-gsap-connector-grow-playing` and `-muted`, and the CSS shows
  the icon for each; the labels change with them.
- **One smoothing:** `scrub: true` with Lenis, `scrub: 1` without.
- **Reduced motion:** it does not grow, and it waits for play.

## From the old gsap folder

The old page created Lenis and ScrollTrigger side by side and never linked
them: no `lenis.on("scroll", ScrollTrigger.update)`, Lenis on its own
`requestAnimationFrame` loop, GSAP on its ticker. Scrubbed animations
lagged a frame behind the glide. `connectGsap({ gsap, ScrollTrigger, lenis })`
is the link.
