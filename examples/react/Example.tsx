"use client";

import { useEffect, useRef } from "react";
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
