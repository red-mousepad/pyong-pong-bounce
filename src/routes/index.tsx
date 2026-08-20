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
      { title: "뿅! 바운싱 스퀘어 — Corner Hit Game" },
      {
        name: "description",
        content:
          "노란 사각형을 눌러 시작하세요. 벽에 튕길 때마다 색이 바뀌고, 정확한 모서리를 맞히면 점수가 올라갑니다.",
      },
      { property: "og:title", content: "뿅! 바운싱 스퀘어 — Corner Hit Game" },
      {
        property: "og:description",
        content: "Web Audio 효과음과 함께 즐기는 미니멀 바운싱 스퀘어 게임.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SIZE = 64;
const SPEED = 330; // px per second
const CORNER_TOL = 6;

const COLORS = [
  "#ffe066",
  "#ff6b6b",
  "#4dd4ac",
  "#5aa9ff",
  "#c792ea",
  "#ff9f43",
  "#7bed9f",
  "#ff7ab6",
  "#00d2ff",
  "#f7f1e3",
];

function randomColor(prev: string) {
  let c = prev;
  while (c === prev) c = COLORS[Math.floor(Math.random() * COLORS.length)] ?? prev;
  return c;
}

function randomVector() {
  // avoid near-axis-aligned directions
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

  const state = useRef({ x: 0, y: 0, vx: 0, vy: 0, color: "#ffe066", gold: false });
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

  const center = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;
    const s = state.current;
    s.x = (f.clientWidth - SIZE) / 2;
    s.y = (f.clientHeight - SIZE) / 2;
    s.vx = 0;
    s.vy = 0;
    s.color = "#ffe066";
    s.gold = false;
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

      // near-corner detection when one axis bounces while the other is at the edge
      const nearX = s.x <= CORNER_TOL || s.x >= maxX - CORNER_TOL;
      const nearY = s.y <= CORNER_TOL || s.y >= maxY - CORNER_TOL;
      const corner = (hitX || hitY) && nearX && nearY;

      if (corner) {
        s.gold = true;
        s.color = randomColor(s.color);
        setScore((v) => v + 1);
        playPiyong();
      } else if (hitX || hitY) {
        s.gold = false;
        s.color = randomColor(s.color);
        playTong();
      }

      paint();
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, paint]);

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
      {/* Center HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
        <h1 className="sr-only">뿅! 바운싱 스퀘어 — 모서리 히트 게임</h1>
        <div className="score-digits text-[22vw] leading-none font-black sm:text-[16vw] md:text-[180px]">
          {score}
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
              광고 없애기 ($0.99)
            </Button>
          </div>
        )}

        {phase === "idle" && (
          <p className="text-sm text-white/35">노란 사각형을 눌러 시작하세요</p>
        )}
      </div>

      {/* Square */}
      <button
        ref={squareRef}
        type="button"
        aria-label={phase === "running" ? "일시정지" : "시작"}
        onPointerDown={onSquare}
        style={{ width: SIZE, height: SIZE }}
        className="absolute top-0 left-0 rounded-[6px] outline-none will-change-transform"
      />

      {/* Pause overlay */}
      {phase === "paused" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[min(90vw,320px)] rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-[var(--shadow-panel)]">
            <p className="text-lg font-semibold text-white">일시정지</p>
            <p className="mt-1 text-sm text-white/50">점수 {score}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => {
                  resumeAudio();
                  setPhase("running");
                }}
              >
                계속
              </Button>
              <Button variant="secondary" onClick={reset}>
                리셋
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IAP modal */}
      <Dialog open={payOpen} onOpenChange={(o) => !paying && setPayOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>광고 제거</DialogTitle>
            <DialogDescription>
              한 번 결제로 배너 광고가 영구히 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Remove Ads (일회성)</span>
              <span className="text-2xl font-bold">$0.99</span>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={buy} disabled={paying}>
              {paying ? "결제 처리 중…" : "$0.99 결제하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
