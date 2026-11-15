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
    addEventListener(type: "refresh", callback: () => void): unknown;
    removeEventListener(type: "refresh", callback: () => void): unknown;
};
export type LenisLike = {
    on(event: "scroll", callback: () => void): unknown;
    off(event: "scroll", callback: () => void): unknown;
    raf(time: number): void;
    resize(): void;
    scrollTo(target: number, options?: {
        immediate?: boolean;
        force?: boolean;
    }): void;
    isScrolling?: boolean | string;
    destroy(): void;
    options: {
        autoRaf?: boolean;
        wrapper?: unknown;
    };
};
export type GsapConnection = {
    gsap: GsapLike;
    ScrollTrigger: ScrollTriggerLike;
    lenis?: LenisLike | null;
    restoreScroll?: boolean;
};
export declare function connectGsap({ gsap, ScrollTrigger, lenis, restoreScroll }: GsapConnection): () => void;
export {};
