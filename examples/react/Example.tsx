"use client";

import { useEffect, useId, useRef } from "react";
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
 * is four screens tall from the server's HTML and its stage sticks: CSS
 * sticky, not pin, so a reload lands where it should. The word grows from
 * the stroke nearest its middle until that stroke is wider than the screen:
 * the picture ends whole, with no fade.
 */
export function WordReveal({ src, word = "AUDI", label }: { src: string; word?: string; label: string }) {
    const section = useRef<HTMLElement>(null);
    const text = useRef<SVGTextElement>(null);
    const lenis = useLenis();
    const mask = `reveal-${useId().replace(/:/g, "")}`; // one mask per scene

    useGSAP(
        () => {
            const t = text.current;
            if (!t) return;
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                gsap.set(".reveal-open", { opacity: 1 });
                return;
            }
            const stroke = strokeNearMiddle(t);
            gsap.timeline({
                scrollTrigger: {
                    trigger: section.current,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: lenis ? true : 1, // one smoothing
                    invalidateOnRefresh: true,
                },
            }).fromTo(
                t,
                { scale: 1 },
                {
                    scale: () => {
                        const box = t.getBBox();
                        const at = box.x + stroke.at * box.width;
                        return (2.2 * Math.max(at, innerWidth - at)) / (stroke.width * box.width);
                    },
                    transformOrigin: `${stroke.at * 100}% 50%`,
                    ease: "power3.in",
                },
            );
        },
        { scope: section, dependencies: [lenis, word] },
    );

    return (
        <section ref={section} style={{ height: "400svh", background: "#0d0d0f" }}>
            <div style={{ position: "sticky", top: 0, height: "100svh", overflow: "clip" }}>
                <svg role="img" aria-label={label} style={{ display: "block", width: "100%", height: "100%" }}>
                    <defs>
                        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                            <rect className="reveal-open" width="100%" height="100%" fill="#fff" opacity={0} />
                            <text
                                ref={text}
                                x="50%"
                                y="50%"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#fff"
                                style={{ font: "900 min(28vw, 45svh) / 1 system-ui, sans-serif", letterSpacing: "-0.03em" }}
                            >
                                {word}
                            </text>
                        </mask>
                    </defs>
                    <image href={src} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" mask={`url(#${mask})`} />
                </svg>
            </div>
        </section>
    );
}

/* The stroke nearest a word's middle, as fractions of its width: where it is
   and how wide. Drawn once on a canvas in the word's own font, read across
   its middle row. */
function strokeNearMiddle(text: SVGTextElement): { at: number; width: number } {
    const style = getComputedStyle(text);
    const size = 200;
    const spacing = (parseFloat(style.letterSpacing) || 0) * (size / parseFloat(style.fontSize));
    const canvas = document.createElement("canvas");
    const pen = canvas.getContext("2d", { willReadFrequently: true })!;
    const set = () => {
        pen.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
        pen.letterSpacing = `${spacing}px`;
        pen.textBaseline = "middle";
    };
    set();
    const width = Math.ceil(pen.measureText(text.textContent).width);
    canvas.width = width;
    canvas.height = size * 1.4;
    set(); // a canvas resized forgets its pen
    pen.fillText(text.textContent, 0, canvas.height / 2);
    const row = pen.getImageData(0, canvas.height / 2, width, 1).data;
    let best: { at: number; width: number } | null = null;
    for (let x = 0, from = -1; x <= width; x++) {
        const ink = x < width && row[x * 4 + 3] > 128;
        if (ink && from < 0) from = x;
        if (!ink && from >= 0) {
            const stroke = { at: (from + x) / 2 / width, width: (x - from) / width };
            if (!best || Math.abs(stroke.at - 0.5) < Math.abs(best.at - 0.5)) best = stroke;
            from = -1;
        }
    }
    return best || { at: 0.5, width: 1 }; // no ink found: the middle
}
