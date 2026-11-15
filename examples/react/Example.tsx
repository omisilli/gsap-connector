"use client";

import { useEffect, useRef, type CSSProperties } from "react";
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
 * Recipe — a word that opens onto a picture (see the README). The section
 * is 325svh tall from the server's HTML and its stage sticks: CSS
 * sticky, not pin, so a reload lands where it should. Over the photo, a
 * dark cover with the word in white, blended "darken": the photo shows
 * through the letters. The word grows from its
 * --pg-gsap-connector-reveal-origin until its stroke covers the screen;
 * at the end the cover fades, for a word whose point sits on a gap; the
 * moment the picture is whole, the section scrolls on.
 *
 * origin: the point the word grows from, as fractions of the word. Put it
 * in the middle of a stroke near the centre — that stroke grows over the
 * screen and the picture opens out of the letter; for AUDI in this font,
 * the right leg of the U: "54% 50%". Another word or font, another value.
 * It is passed on as --pg-gsap-connector-reveal-origin, so a stylesheet
 * may set its own per breakpoint instead.
 *
 * once: only the first time — once the picture is whole the scene lets go
 * of the scroll and stays open. Off (the default): every time, both ways.
 */
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

    useGSAP(
        () => {
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                gsap.set(".reveal-cover", { autoAlpha: 0 });
                return;
            }
            // Whole: the trigger goes, the timeline stays — finished.
            const stayOpen = (st: ScrollTrigger) => {
                if (st.progress < 0.99) return;
                const timeline = st.animation;
                st.kill(false, true);
                gsap.to(timeline!, { progress: 1, duration: 0.4, ease: "power1.out" });
            };
            gsap.timeline({
                scrollTrigger: {
                    trigger: section.current,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: lenis ? true : 1, // one smoothing
                    onUpdate: once ? stayOpen : undefined,
                    onRefresh: once ? stayOpen : undefined, // a reload below it
                },
            })
                .fromTo(".reveal-word", { scale: 1 }, { scale: 60, ease: "power3.in", duration: 1 }, 0)
                .fromTo(".reveal-cover", { autoAlpha: 1 }, { autoAlpha: 0, ease: "power1.inOut", duration: 0.15 }, 0.85);
        },
        { scope: section, dependencies: [lenis, word, origin, once], revertOnUpdate: true },
    );

    const layer: CSSProperties = { gridArea: "1 / 1" };
    return (
        <section ref={section} style={{ height: "325svh", background: "#0d0d0f" }}>
            <div style={{ position: "sticky", top: 0, height: "100svh", overflow: "clip", display: "grid", isolation: "isolate" }}>
                <img src={src} alt={label} style={{ ...layer, display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                <div
                    className="reveal-cover"
                    aria-hidden="true"
                    style={{ ...layer, display: "grid", placeItems: "center", background: "#0d0d0f", mixBlendMode: "darken" }}
                >
                    <span
                        className="reveal-word"
                        style={
                            {
                                "--pg-gsap-connector-reveal-origin": origin,
                                font: "900 min(28vw, 45svh) / 1 system-ui, sans-serif",
                                letterSpacing: "-0.03em",
                                whiteSpace: "nowrap",
                                color: "#fff",
                                transformOrigin: "var(--pg-gsap-connector-reveal-origin, 50% 50%)",
                            } as CSSProperties
                        }
                    >
                        {word}
                    </span>
                </div>
            </div>
        </section>
    );
}
