# gsap-connector

GSAP's ScrollTrigger and the page, with or without Lenis — in one line. It
refreshes the triggers when the page changes height, and, on a page with
Lenis, runs Lenis on GSAP's ticker so the two never part. No dependencies.

> **GSAP is not in this package — install it yourself.** The connector
> takes the GSAP your site already has: one copy on the page, the version
> you chose.

```sh
npm install gsap
npm install github:omisilli/gsap-connector#v1.0.1
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/gsap-connector@v1.0.1/index.css" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js"></script>
<script type="module">
    import { connectGsap } from "https://cdn.jsdelivr.net/gh/omisilli/gsap-connector@v1.0.1/dist/index.js";

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

[`examples/static/index.html`](examples/static/index.html) — with or without
Lenis (`?lenis`), and without the connector (`?off`), to see the
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
the word comes at you from its middle and leaves the screen, the picture
opening as it goes; then the picture stays whole a while, and the page
scrolls on. Scroll back and it closes into the word again.

```html
<section class="reveal">
    <div class="reveal-stage">
        <svg role="img" aria-label="…">
            <defs>
                <mask id="reveal-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                    <rect id="reveal-open" width="100%" height="100%" fill="#fff" opacity="0" />
                    <text id="reveal-word" x="50%" y="50%" text-anchor="middle" dominant-baseline="central">AUDI</text>
                </mask>
            </defs>
            <image href="car.avif" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" mask="url(#reveal-mask)" />
        </svg>
    </div>
</section>
```

```css
.reveal { height: 400svh; background: #0d0d0f; }          /* four screens */
.reveal-stage { position: sticky; top: 0; height: 100svh; overflow: clip; }
.reveal svg { display: block; width: 100%; height: 100%; }
#reveal-word { font: 900 min(28vw, 45svh) / 1 system-ui, sans-serif; fill: #fff; }
@media (prefers-reduced-motion: reduce) { .reveal { height: auto; } }
```

```js
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.set("#reveal-open", { opacity: 1 }); // the picture, open
} else {
    gsap.timeline({
        scrollTrigger: { trigger: ".reveal", start: "top top", end: "bottom bottom", scrub: lenis ? true : 1 },
    })
        // 0 – 0.75: the word grows from its middle, out of the screen
        .fromTo("#reveal-word", { scale: 1 }, { scale: 30, transformOrigin: "50% 50%", ease: "power2.in", duration: 0.75 }, 0)
        // 0.45 – 0.75: the mask's white comes in — the gaps open too
        .fromTo("#reveal-open", { opacity: 0 }, { opacity: 1, ease: "power1.inOut", duration: 0.3 }, 0.45)
        // 0.75 – 1: the picture, whole
        .set({}, {}, 1);
}
```

- **An SVG mask, not CSS `mask-image`.** White in the mask shows the
  picture, black hides it. The word is real text in the SVG — any font the
  page has, any word, no image of it to make — and it needs no `-webkit-`
  prefix anywhere.
- **From the middle, whatever the word.** `transformOrigin: "50% 50%"`
  needs nothing measured: change the word, the font or the language and it
  still grows from its centre.
- **The gaps open too.** Grown from its middle, a word may well end on the
  space between two letters — a dark screen. So, as the word leaves, the
  mask's white rectangle fades in: whatever is still dark opens onto the
  picture, and by three quarters of the way the picture is whole, on any
  word and any screen.
- **It holds, then scrolls on.** The last quarter of the timeline is empty
  (`.set({}, {}, 1)`): the picture stays whole, sticky, while the scroll
  goes on — then the section ends and the page carries it away. Change the
  `0.75`s to give the hold more or less of the scroll; make the section
  taller for a longer scene.
- **Leaning one way (optional).** `"40% 50%"` grows the word more to the
  right, `"60% 50%"` more to the left — for a design that wants it. Leave it
  at `"50% 50%"` otherwise.
- **`power2.in`:** slow at first, so the word answers the first scroll
  without rushing at you; fast as it leaves.
- **Held by CSS `sticky`, not `pin: true`.** The section is four screens
  tall in the first HTML. A pin adds its height only when the script runs —
  on a reload the browser restores the scroll to the shorter page, then the
  pin pushes everything down, and the scene flashes by.
- **One smoothing:** `scrub: true` with Lenis, `scrub: 1` without — see
  With Lenis, smooth once.
- **Reduced motion:** the mask's white rectangle on, the section one screen
  tall — the picture, open, at once.

## From the old gsap folder

The old page created Lenis and ScrollTrigger side by side and never linked
them: no `lenis.on("scroll", ScrollTrigger.update)`, Lenis on its own
`requestAnimationFrame` loop, GSAP on its ticker. Scrubbed animations
lagged a frame behind the glide. `connectGsap({ gsap, ScrollTrigger, lenis })`
is the link.
