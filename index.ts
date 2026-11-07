/*
 * gsap-connector — GSAP's ScrollTrigger and the page, with or without
 * Lenis.
 *
 *   import gsap from "gsap";
 *   import { ScrollTrigger } from "gsap/ScrollTrigger";
 *   import { connectGsap } from "@plusguard/gsap-connector";
 *
 *   gsap.registerPlugin(ScrollTrigger);
 *   connectGsap({ gsap, ScrollTrigger });          // no Lenis
 *   connectGsap({ gsap, ScrollTrigger, lenis });   // with Lenis
 *
 * GSAP is not in this package: it takes yours. One copy on the page, the
 * version you chose.
 *
 * Always: the triggers are refreshed when the page changes height —
 * content that arrives late, an image, an accordion — not only on load and
 * resize, as ScrollTrigger does by itself.
 *
 * With Lenis: Lenis runs on GSAP's ticker instead of its own loop, every
 * Lenis scroll updates ScrollTrigger, and lag smoothing is off, so the two
 * never part. Disconnected, Lenis gets its own loop back.
 *
 * No dependencies — not even on GSAP's or Lenis's types: what it needs of
 * them is written out below.
 */

/* What this package uses of GSAP, ScrollTrigger and Lenis. */
type Tick = (time: number, deltaTime: number, frame: number) => void;
export type GsapLike = {
    ticker: {
        add(callback: Tick): unknown;
        remove(callback: Tick): unknown;
        lagSmoothing(threshold: number, adjustedLag?: number): unknown;
    };
};
export type ScrollTriggerLike = {
    update(): unknown;
    refresh(): unknown;
};
export type LenisLike = {
    on(event: "scroll", callback: () => void): unknown;
    off(event: "scroll", callback: () => void): unknown;
    raf(time: number): void;
    destroy(): void;
    options: { autoRaf?: boolean };
};

export type GsapConnection = {
    gsap: GsapLike;
    ScrollTrigger: ScrollTriggerLike;
    /* The page's Lenis, if it has one. */
    lenis?: LenisLike | null;
};

/* GSAP's own lag smoothing, put back when Lenis lets go. */
const LAG_THRESHOLD = 500;
const LAG_ADJUSTED = 33;

/* One connection at a time: a new one ends the one before, whose cleanup
   then does nothing — a late cleanup (React remounting) cannot undo the
   newer one. Same rule as the other packages. */
let live: (() => void) | null = null;

/* Connect; returns the cleanup, for a React effect. */
export function connectGsap({ gsap, ScrollTrigger, lenis }: GsapConnection): () => void {
    if (typeof document === "undefined") return () => {};
    live?.();

    // The page changes height: the triggers move with it — once a frame at
    // most, however many changes came in.
    let frame = 0;
    const refresh = (): void => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);

    const unlinkLenis = lenis ? linkLenis(gsap, ScrollTrigger, lenis) : null;

    let ended = false;
    const end = (): void => {
        if (ended) return;
        ended = true;
        ro.disconnect();
        cancelAnimationFrame(frame);
        unlinkLenis?.();
        if (live === end) live = null;
    };
    live = end;
    return end;
}

/*
 * Lenis on GSAP's clock. Its own loop is switched off, not left running
 * beside the ticker: two loops would call it twice a frame.
 *
 * The time given to Lenis is performance.now(), the clock its own loop
 * used, not the ticker's time * 1000, which starts elsewhere: Lenis
 * measures each frame from the last, and a jump between two clocks would
 * throw it by that much once.
 */
function linkLenis(gsap: GsapLike, ScrollTrigger: ScrollTriggerLike, lenis: LenisLike): () => void {
    const ownLoop = lenis.options.autoRaf === true;
    lenis.options.autoRaf = false;

    const tick: Tick = () => lenis.raf(performance.now());
    // Not ScrollTrigger.update itself: Lenis hands its callback the Lenis
    // instance, and update's own argument means something else.
    const update = (): void => {
        ScrollTrigger.update();
    };
    lenis.on("scroll", update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Lenis says nothing when it is destroyed; listen in, so its own loop
    // is not started again on a Lenis that is gone.
    let destroyed = false;
    const destroy = lenis.destroy;
    const own = Object.prototype.hasOwnProperty.call(lenis, "destroy");
    const listen = function (this: LenisLike) {
        destroyed = true;
        return destroy.call(this);
    };
    lenis.destroy = listen;

    return () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(LAG_THRESHOLD, LAG_ADJUSTED);
        lenis.off("scroll", update);
        // Put destroy back as it was: from Lenis's class, or its own.
        if (lenis.destroy === listen) {
            if (own) lenis.destroy = destroy;
            else delete (lenis as Partial<LenisLike>).destroy;
        }
        if (destroyed || !ownLoop) return;
        // Its own loop again: raf schedules the next frame itself.
        lenis.options.autoRaf = true;
        lenis.raf(performance.now());
    };
}
