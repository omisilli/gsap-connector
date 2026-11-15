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
 * Always: a reload lands where the page was left. The browser puts the
 * scroll back on load; triggers made after that — behind an await, in a
 * React effect — add their pin spacing to a page the browser has already
 * measured, and the scroll comes up short. The connector puts it back
 * once the triggers are refreshed.
 *
 * With Lenis: Lenis runs on GSAP's ticker instead of its own loop, every
 * Lenis scroll updates ScrollTrigger, and lag smoothing is off, so the two
 * never part. Disconnected, Lenis gets its own loop back.
 *
 * No dependencies — not even on GSAP's or Lenis's types: what it needs of
 * them is written out below.
 */
/* GSAP's own lag smoothing, put back when Lenis lets go. */
const LAG_THRESHOLD = 500;
const LAG_ADJUSTED = 33;
/* One connection at a time: a new one ends the one before, whose cleanup
   then does nothing — a late cleanup (React remounting) cannot undo the
   newer one. Same rule as the other packages. */
let live = null;
/* Connect; returns the cleanup, for a React effect. */
export function connectGsap({ gsap, ScrollTrigger, lenis, restoreScroll = true }) {
    if (typeof document === "undefined")
        return () => { };
    live?.();
    // The page changes height: the triggers move with it — once a frame at
    // most, however many changes came in.
    let frame = 0;
    const refresh = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    const unlinkLenis = lenis ? linkLenis(gsap, ScrollTrigger, lenis) : null;
    const stopMemory = restoreScroll ? rememberScroll(ScrollTrigger, lenis ?? null) : null;
    let ended = false;
    const end = () => {
        if (ended)
            return;
        ended = true;
        ro.disconnect();
        cancelAnimationFrame(frame);
        stopMemory?.();
        unlinkLenis?.();
        if (live === end)
            live = null;
    };
    live = end;
    return end;
}
/*
 * The scroll, kept across a reload — for this tab and this address. It is
 * saved as the page goes, and read back once per page load: a second
 * connection (React remounting, Lenis arriving later) does not put it back
 * a second time.
 *
 * Put back after each full refresh until the page has loaded — that is
 * when the pin spacers are in, and ScrollTrigger refreshes on load itself,
 * after images have taken their height. It stops once the page has loaded,
 * or as soon as the visitor scrolls: theirs wins.
 */
const SCROLL_KEY = "pg-gsap-connector-scroll:";
const USER_SCROLLS = ["wheel", "touchstart", "keydown", "pointerdown"];
let wanted; // undefined: not read yet
function readScroll(key) {
    const nav = performance.getEntriesByType?.("navigation")[0];
    if (nav?.type !== "reload" && nav?.type !== "back_forward")
        return null;
    // An address with a #: the browser, or the page, goes there instead.
    if (location.hash)
        return null;
    try {
        const value = Number(sessionStorage.getItem(key));
        return value > 0 ? value : null;
    }
    catch {
        return null; // storage blocked: the browser's own restore only
    }
}
function rememberScroll(ScrollTrigger, lenis) {
    // Lenis inside a box of its own: the page's scroll is not its scroll.
    if (lenis && lenis.options.wrapper !== undefined && lenis.options.wrapper !== window)
        return null;
    const key = SCROLL_KEY + location.pathname + location.search;
    const save = () => {
        try {
            sessionStorage.setItem(key, String(Math.round(window.scrollY)));
        }
        catch { }
    };
    addEventListener("pagehide", save);
    if (wanted === undefined)
        wanted = readScroll(key);
    // Done for this page load: put back, or given up.
    const settle = () => {
        wanted = null;
        detach();
    };
    const put = () => {
        if (wanted == null)
            return detach();
        if (Math.abs(window.scrollY - wanted) > 1) {
            if (lenis) {
                // Lenis still holds the page's height from before the pins.
                lenis.resize();
                lenis.scrollTo(wanted, { immediate: true, force: true });
            }
            else {
                window.scrollTo({ top: wanted, behavior: "instant" });
            }
        }
        if (document.readyState === "complete")
            settle();
    };
    // Listeners only: a connection that ends early leaves the wanted scroll
    // to the next one.
    const detach = () => {
        ScrollTrigger.removeEventListener("refresh", put);
        for (const type of USER_SCROLLS)
            removeEventListener(type, settle, true);
    };
    if (wanted != null) {
        ScrollTrigger.addEventListener("refresh", put);
        for (const type of USER_SCROLLS)
            addEventListener(type, settle, { capture: true, passive: true });
    }
    return () => {
        detach();
        removeEventListener("pagehide", save);
    };
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
function linkLenis(gsap, ScrollTrigger, lenis) {
    const ownLoop = lenis.options.autoRaf === true;
    lenis.options.autoRaf = false;
    const tick = () => lenis.raf(performance.now());
    // Not ScrollTrigger.update itself: Lenis hands its callback the Lenis
    // instance, and update's own argument means something else.
    const update = () => {
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
    const listen = function () {
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
            if (own)
                lenis.destroy = destroy;
            else
                delete lenis.destroy;
        }
        if (destroyed || !ownLoop)
            return;
        // Its own loop again: raf schedules the next frame itself.
        lenis.options.autoRaf = true;
        lenis.raf(performance.now());
    };
}
