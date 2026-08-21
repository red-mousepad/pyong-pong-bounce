import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { playPiyong, playPurchase, playPyong, playTong, resumeAudio } from "@/lib/game-audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bouncing Square — Corner Hit Game" },
      {
        name: "description",
        content:
          "Tap the square to launch it. Every wall bounce flips its neon color, and an exact corner hit scores a point with a golden glow.",
      },
      { property: "og:title", content: "Bouncing Square — Corner Hit Game" },
      {
        property: "og:description",
        content: "A minimal bouncing square game with Web Audio sound effects and corner-hit scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SIZE = 64;
const SPEED = 210; // px per second — a touch faster than a classic DVD screensaver
const CORNER_TOL = 6;
const MIN_WAIT_MS = 30 * 1000; // rare "jackpot" fast corner
const MAX_WAIT_MS = 7 * 60 * 1000; // hard guarantee — a corner always lands by here
const PITY_AFTER_MS = 4 * 60 * 1000; // invisible micro-steering kicks in
const NEAR_MISS_CHANCE = 0.35;

// Skewed draw: most targets land around 3–4 minutes, rarely near 30s or 7min.
function nextCornerWait() {
  const t = Math.pow(Math.random(), 1.35);
  return MIN_WAIT_MS + (MAX_WAIT_MS - MIN_WAIT_MS) * t;
}


// Vivid, high-luminance / high-saturation neon palette
const COLORS = [
  "#ffe93d",
  "#ff3b6b",
  "#00ffc6",
  "#3da5ff",
  "#c66bff",
  "#ff9a1f",
  "#5cff5c",
  "#ff5ce0",
  "#00e5ff",
  "#faff00",
];

function randomColor(prev: string) {
  let c = prev;
  while (c === prev) c = COLORS[Math.floor(Math.random() * COLORS.length)] ?? prev;
  return c;
}

function randomVector() {
  const base = Math.random() * Math.PI * 2;
  const a = base + (Math.abs(Math.cos(base)) < 0.25 || Math.abs(Math.sin(base)) < 0.25 ? 0.6 : 0);
  return { vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED };
}

type Phase = "idle" | "running" | "paused";

function Index() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const state = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    color: "#ffe93d",
    gold: false,
    lastCorner: 0,
    cornerLock: false,
    targetWait: nextCornerWait(),
    nearMissArmed: false,
  });

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (localStorage.getItem("ads-removed") === "1") setAdsRemoved(true);
  }, []);

  const paint = useCallback(() => {
    const el = squareRef.current;
    if (!el) return;
    const s = state.current;
    el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
    el.style.backgroundColor = s.color;
    el.classList.toggle("square-gold", s.gold);
  }, []);

  const flashNearMiss = useCallback(() => {
    const el = squareRef.current;
    if (!el) return;
    el.classList.remove("square-near");
    void el.offsetWidth;
    el.classList.add("square-near");
    window.setTimeout(() => el.classList.remove("square-near"), 500);
  }, []);



  const center = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;
    const s = state.current;
    s.x = (f.clientWidth - SIZE) / 2;
    s.y = f.clientHeight * 0.28 - SIZE / 2;
    s.vx = 0;
    s.vy = 0;
    s.color = "#ffe93d";
    s.gold = false;
    s.cornerLock = false;
    paint();
  }, [paint]);

  useEffect(() => {
    center();
    const onResize = () => {
      const f = fieldRef.current;
      if (!f) return;
      const s = state.current;
      s.x = Math.min(s.x, Math.max(0, f.clientWidth - SIZE));
      s.y = Math.min(s.y, Math.max(0, f.clientHeight - SIZE));
      paint();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [center, paint]);

  // Animation loop
  useEffect(() => {
    if (phase !== "running") return;
    lastRef.current = performance.now();

    const step = (now: number) => {
      const f = fieldRef.current;
      if (!f) return;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const s = state.current;
      const maxX = f.clientWidth - SIZE;
      const maxY = f.clientHeight - SIZE;

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      let hitX = false;
      let hitY = false;
      if (s.x <= 0) {
        s.x = 0;
        s.vx = Math.abs(s.vx);
        hitX = true;
      } else if (s.x >= maxX) {
        s.x = maxX;
        s.vx = -Math.abs(s.vx);
        hitX = true;
      }
      if (s.y <= 0) {
        s.y = 0;
        s.vy = Math.abs(s.vy);
        hitY = true;
      } else if (s.y >= maxY) {
        s.y = maxY;
        s.vy = -Math.abs(s.vy);
        hitY = true;
      }

      const nearX = s.x <= CORNER_TOL || s.x >= maxX - CORNER_TOL;
      const nearY = s.y <= CORNER_TOL || s.y >= maxY - CORNER_TOL;
      const corner = (hitX || hitY) && nearX && nearY;

      if (corner && !s.cornerLock) {
        s.cornerLock = true;
        s.gold = true;
        s.color = randomColor(s.color);
        s.lastCorner = now;
        s.targetWait = nextCornerWait();
        s.nearMissArmed = false;
        setScore((v) => v + 1);
        playPiyong();
      } else if ((hitX || hitY) && !corner) {
        s.cornerLock = false;
        s.gold = false;
        s.color = randomColor(s.color);
        playTong();

        const elapsed = now - s.lastCorner;
        const wasNearMiss = s.nearMissArmed && (nearX || nearY);
        s.nearMissArmed = false;
        if (wasNearMiss) flashNearMiss();

        // Invisible trajectory assist: steer toward the nearest reachable corner
        // once the pity timer or this round's randomized target is reached.
        const due = elapsed > Math.min(s.targetWait, PITY_AFTER_MS);
        if (due && maxX > 0 && maxY > 0) {
          const tx = s.vx >= 0 ? maxX : 0;
          const ty = s.vy >= 0 ? maxY : 0;

          // Hard guarantee: past the max wait, aim dead-on. Past the round's
          // target, aim dead-on too. Before that, nudge gently (pity phase).
          const forced = elapsed > MAX_WAIT_MS || elapsed > s.targetWait;
          const nearMiss = !forced && Math.random() < NEAR_MISS_CHANCE;

          let aimX = tx;
          let aimY = ty;
          if (nearMiss) {
            // Aim a few pixels off the corner for an "almost!" moment.
            const off = CORNER_TOL + 4 + Math.random() * 10;
            if (Math.random() < 0.5) aimY += ty === 0 ? off : -off;
            else aimX += tx === 0 ? off : -off;
            s.nearMissArmed = true;
          }

          const dx = aimX - s.x;
          const dy = aimY - s.y;
          const len = Math.hypot(dx, dy);
          if (len > 1) {
            const ux = (dx / len) * SPEED;
            const uy = (dy / len) * SPEED;
            // Micro-angle adjustment: blend gently unless forced.
            const k = forced ? 1 : nearMiss ? 0.85 : 0.35;
            const bx = s.vx + (ux - s.vx) * k;
            const by = s.vy + (uy - s.vy) * k;
            const bl = Math.hypot(bx, by) || 1;
            s.vx = (bx / bl) * SPEED;
            s.vy = (by / bl) * SPEED;
          }
        }
      }

      paint();
      rafRef.current = requestAnimationFrame(step);
    };

    // Pausing shouldn't burn the corner timer.
    if (pausedAtRef.current) {
      state.current.lastCorner += performance.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      pausedAtRef.current = performance.now();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, paint, flashNearMiss]);


  // Screen wake lock while playing
  useEffect(() => {
    if (phase !== "running") return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        sentinel = (await navigator.wakeLock?.request("screen")) ?? null;
        if (cancelled) void sentinel?.release();
      } catch {
        /* wake lock unsupported or denied */
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => {});
    };
  }, [phase]);

  const onSquare = () => {
    resumeAudio();
    if (phase === "idle") {
      const v = randomVector();
      state.current.vx = v.vx;
      state.current.vy = v.vy;
      state.current.lastCorner = performance.now();
      state.current.targetWait = nextCornerWait();
      state.current.nearMissArmed = false;
      playPyong();
      setPhase("running");
    } else if (phase === "running") {
      setPhase("paused");
    }
  };

  const reset = () => {
    setScore(0);
    center();
    setPhase("idle");
  };

  const buy = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1200));
    localStorage.setItem("ads-removed", "1");
    setAdsRemoved(true);
    setPaying(false);
    setPayOpen(false);
    playPurchase();
  };

  return (
    <main
      ref={fieldRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-game-bg select-none touch-none"
    >
      {/* Stacked HUD below the square */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[56%] flex flex-col items-center gap-6 px-6">
        <h1 className="sr-only">Bouncing Square — Corner Hit Game</h1>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] tracking-[0.35em] text-white/35 uppercase">Corner Hits</span>
          <div className="score-digits text-[18vw] leading-none font-black sm:text-[12vw] md:text-[120px]">
            {score}
          </div>
        </div>

        {!adsRemoved && (
          <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3">
            <div className="flex h-16 w-full items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-xs tracking-[0.3em] text-white/40 uppercase">
              Ad Banner 320 × 50
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-gold/50 bg-transparent text-gold hover:bg-gold/10 hover:text-gold"
              onClick={() => setPayOpen(true)}
            >
              Remove Ads
            </Button>
          </div>
        )}
      </div>

      {/* Square */}
      <button
        ref={squareRef}
        type="button"
        aria-label={phase === "running" ? "Pause" : "Start"}
        onPointerDown={onSquare}
        style={{ width: SIZE, height: SIZE }}
        className="absolute top-0 left-0 z-20 rounded-[6px] outline-none will-change-transform"
      />

      {/* Pause overlay */}
      {phase === "paused" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[min(90vw,320px)] rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-[var(--shadow-panel)]">
            <p className="text-lg font-semibold text-white">PAUSE</p>
            <p className="mt-1 text-sm text-white/50">Score {score}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => {
                  resumeAudio();
                  setPhase("running");
                }}
              >
                Resume
              </Button>
              <Button variant="secondary" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IAP modal */}
      <Dialog open={payOpen} onOpenChange={(o) => !paying && setPayOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Ads</DialogTitle>
            <DialogDescription>
              A one-time purchase that permanently removes the banner ad.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Remove Ads (one-time)</span>
              <span className="text-2xl font-bold">$0.99</span>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={buy} disabled={paying}>
              {paying ? "Processing…" : "Pay $0.99"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
