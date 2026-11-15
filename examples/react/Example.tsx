"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { connectGsap } from "@plusguard/gsap-connector";

/*
 * Next (App Router). GSAP is the site's own — npm install gsap @gsap/react —
 * registered once, here. Import gsap from this file everywhere else, so the
 * page has one copy: the one connected below.
 */
gsap.registerPlugin(ScrollTrigger, useGSAP);
export { gsap, ScrollTrigger, useGSAP };

/*
 * Mount once, in the root layout:
 *
 *   <body>
 *       <GsapConnector />
 *       {children}
 *   </body>
 *
 * useLenis finds the root Lenis (<ReactLenis root>) from outside its
 * provider too, and is undefined on a page without one: the same component
 * serves both, and follows Lenis as routes come and go. With Lenis, keep
 * its own loop as it is (autoRaf) — the connector switches it to GSAP's
 * ticker, and back when it lets go.
 */
export function GsapConnector() {
    const lenis = useLenis();
    useEffect(() => connectGsap({ gsap, ScrollTrigger, lenis }), [lenis]);
    return null;
}

/*
 * Animations: useGSAP, scoped to a section — selectors find only what is
 * inside it, and everything it made is reverted when it unmounts.
 */
export function WidenOnScroll() {
    const section = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            gsap.fromTo(
                ".card",
                { width: "6rem" },
                {
                    width: "100%",
                    ease: "none",
                    scrollTrigger: { trigger: ".card", start: "top 85%", end: "top 25%", scrub: true },
                },
            );
        },
        { scope: section },
    );

    return (
        <div ref={section}>
            <div className="card" style={{ height: "10rem", borderRadius: 12, background: "currentColor" }} />
        </div>
    );
}

/* Pinned: the section stands still while its strip slides across. */
export function PinnedStrip() {
    const section = useRef<HTMLElement>(null);
    const strip = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const width = () => (strip.current?.scrollWidth ?? 0) - innerWidth;
            gsap.to(strip.current, {
                x: () => -width(),
                ease: "none",
                scrollTrigger: {
                    trigger: section.current,
                    start: "top top",
                    end: () => `+=${width()}`,
                    scrub: true,
                    pin: true,
                    invalidateOnRefresh: true,
                },
            });
        },
        { scope: section },
    );

    return (
        <section ref={section} style={{ height: "100vh", overflow: "hidden", display: "flex", alignItems: "center" }}>
            <div ref={strip} style={{ display: "flex", gap: 24, paddingInline: 24 }}>
                {[1, 2, 3, 4].map((n) => (
                    <div key={n} style={{ flex: "0 0 32rem", height: "50vh", borderRadius: 12, border: "1px solid" }}>
                        {n}
                    </div>
                ))}
            </div>
        </section>
    );
}

/*
 * Recipe — a word that opens onto a picture (see the README; its CSS goes in
 * the site's stylesheet, the classes below are the README's). The section
 * is 325svh tall from the server's HTML and its stage sticks: CSS sticky,
 * not pin, so a reload lands where it should. Over the photo, a black cover
 * with the word in white, blended "darken": the photo shows through the
 * letters. The word grows from its --pg-gsap-connector-reveal-origin until
 * its stroke covers the screen; at the end the cover fades, for a word whose
 * point sits on a gap; the moment the picture is whole, the section scrolls
 * on.
 *
 * origin: the point the word grows from, as fractions of the word. Put it
 * in the middle of a stroke near the centre — that stroke grows over the
 * screen and the picture opens out of the letter; for AUDI in this font,
 * the right leg of the U: "54% 50%". Another word or font, another value.
 * It is passed on as --pg-gsap-connector-reveal-origin, so a stylesheet
 * may set its own per breakpoint instead.
 *
 * once: only the first time — once the picture is whole the scene lets go
 * of the scroll, stays open and shrinks to one screen, remembered for the
 * tab. Off (the default): every time, both ways.
 */
const PLAYED = "data-pg-gsap-connector-reveal-played";

export function WordReveal({
    src,
    word = "AUDI",
    origin = "54% 50%",
    once = false,
    label,
}: {
    src: string;
    word?: string;
    origin?: string;
    once?: boolean;
    label: string;
}) {
    const section = useRef<HTMLElement>(null);
    const lenis = useLenis();
    const id = `pg-gsap-connector-reveal-${useId().replace(/[^\w-]/g, "")}`; // one key per scene

    useGSAP(
        () => {
            const scene = section.current;
            if (!scene) return;
            const playedKey = `pg-gsap-connector-reveal:${location.pathname}#${scene.id}`;
            let played = false;
            try {
                played = once && !!sessionStorage.getItem(playedKey);
            } catch {}
            scene.toggleAttribute(PLAYED, played); // a client-side visit: the early script did not run
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                gsap.set(".pg-gsap-connector-reveal-cover", { autoAlpha: 0 });
                return;
            }
            if (played) return; // one screen, the picture open — the CSS does it

            // Whole: the trigger goes, the timeline stays — finished; the
            // section is one screen from now on, the scroll kept on what it
            // showed.
            const stayOpen = (st: ScrollTrigger) => {
                if (st.progress < 0.99) return;
                const timeline = st.animation;
                st.kill(false, true);
                gsap.to(timeline!, { progress: 1, duration: 0.4, ease: "power1.out" });
                try {
                    sessionStorage.setItem(playedKey, "1");
                } catch {}
                const stage = scene.firstElementChild!;
                const before = stage.getBoundingClientRect().top;
                scene.setAttribute(PLAYED, "");
                const shift = stage.getBoundingClientRect().top - before;
                if (shift) {
                    const top = scrollY + shift;
                    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
                    else scrollTo({ top, behavior: "instant" });
                }
                requestAnimationFrame(() => ScrollTrigger.refresh()); // the page below moved
            };
            gsap.timeline({
                scrollTrigger: {
                    trigger: scene,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: lenis ? true : 1, // one smoothing
                    onUpdate: once ? stayOpen : undefined,
                    onRefresh: once ? stayOpen : undefined, // a load below it
                },
            })
                .fromTo(".pg-gsap-connector-reveal-word", { scale: 1 }, { scale: 60, ease: "power3.in", duration: 1 }, 0)
                .fromTo(".pg-gsap-connector-reveal-cover", { autoAlpha: 1 }, { autoAlpha: 0, ease: "power1.inOut", duration: 0.15 }, 0.85);
        },
        { scope: section, dependencies: [lenis, word, origin, once], revertOnUpdate: true },
    );

    return (
        <>
            <section
                ref={section}
                id={id}
                className="pg-gsap-connector-reveal"
                data-pg-gsap-connector-reveal={once ? "once" : undefined}
                suppressHydrationWarning // the early script may mark it played
            >
                <div className="pg-gsap-connector-reveal-stage">
                    <img src={src} alt={label} />
                    <div className="pg-gsap-connector-reveal-cover" aria-hidden="true">
                        <span
                            className="pg-gsap-connector-reveal-word"
                            style={{ "--pg-gsap-connector-reveal-origin": origin } as CSSProperties}
                        >
                            {word}
                        </span>
                    </div>
                </div>
            </section>
            {/* Played already in this tab: one screen tall before the page is
                drawn, so a reload lands where it was. */}
            {once && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(s){try{if(sessionStorage.getItem("pg-gsap-connector-reveal:"+location.pathname+"#"+s.id))s.setAttribute("${PLAYED}","")}catch(e){}})(document.getElementById(${JSON.stringify(id)}))`,
                    }}
                />
            )}
        </>
    );
}
