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
    options: {
        autoRaf?: boolean;
    };
};
export type GsapConnection = {
    gsap: GsapLike;
    ScrollTrigger: ScrollTriggerLike;
    lenis?: LenisLike | null;
};
export declare function connectGsap({ gsap, ScrollTrigger, lenis }: GsapConnection): () => void;
export {};
