"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { mainInitial } from "@/lib/name";

/* -------------------------------------------------------------------------
   Reveal-on-load: elements fade/rise in with a stagger, computed once at
   mount via requestAnimationFrame (no IntersectionObserver — everything
   above the fold is already in view). Respects prefers-reduced-motion.
------------------------------------------------------------------------- */
function useReveal() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setReady(true);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}

/* Scroll progress of a section, 0 at its top entering viewport bottom, 1 when
   its bottom leaves the viewport top. Used for the hero parallax. */
function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setY(window.scrollY);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return y;
}

const STAGES = ["Draft", "Review", "Approval", "Completed"] as const;
const TOTAL_CYCLE_HOURS = 18;
const REDUCED = "prefers-reduced-motion: reduce";

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(${REDUCED})`).matches;
}

/* Own rAF-driven scroll tween — used instead of native
   scrollIntoView({behavior:"smooth"}) / window.scrollTo({behavior:"smooth"})
   because native smooth scroll can silently no-op under some automation /
   low-frame-rate conditions. Eased, duration-bound, always lands exactly. */
function smoothScrollTo(targetY: number, duration = 650) {
  if (reducedMotion()) {
    window.scrollTo(0, targetY);
    return;
  }
  const startY = window.scrollY;
  const delta = targetY - startY;
  if (Math.abs(delta) < 1) return;
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + delta * ease(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Generic scroll-into-view reveal: fades/rises any block once, first time it
   crosses into the viewport. Used for every section below the hero (the
   hero itself uses the load-time rAF reveal above, per spec). */
function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition: `opacity .6s cubic-bezier(.16,.8,.3,1) ${delay}s, transform .6s cubic-bezier(.16,.8,.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* Same reveal behaviour as <Reveal>, but for a <tr> — can't wrap a table
   row in a div without breaking table semantics, so this drives the ref
   directly on the row itself. */
function RevealRow({
  children,
  delay = 0,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { delay?: number }) {
  const ref = useRef<HTMLTableRowElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <tr
      ref={ref}
      {...props}
      style={{
        ...props.style,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(14px)",
        transition: `opacity .6s cubic-bezier(.16,.8,.3,1) ${delay}s, transform .6s cubic-bezier(.16,.8,.3,1) ${delay}s, background-color .3s ease`,
      }}
    >
      {children}
    </tr>
  );
}

/* Draws an SVG path's stroke on scroll-into-view via stroke-dasharray. */
function useDrawOnView<T extends SVGElement>() {
  const ref = useRef<T>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (reducedMotion()) {
      setDrawn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, drawn };
}

/* -------------------------------------------------------------------------
   Workflow subject: the cut-out diagram used in the hero and echoed, smaller,
   in the pinned study. Draft -> Review -> Approval -> Completed, nodes with
   checkmarks, connecting arrows, drop shadow to read as a physical cut-out.
------------------------------------------------------------------------- */
function WorkflowSubject({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 520"
      className={className}
      style={{ filter: "drop-shadow(0 24px 40px rgba(26,25,23,.22))" }}
      aria-hidden
    >
      <rect x="40" y="8" width="240" height="150" fill="#F4F1E9" stroke="#1A1917" strokeWidth="2" />
      <line x1="64" y1="46" x2="256" y2="46" stroke="#1A1917" strokeOpacity=".55" strokeWidth="1.5" />
      <line x1="64" y1="70" x2="256" y2="70" stroke="#1A1917" strokeOpacity=".3" strokeWidth="1.5" />
      <line x1="64" y1="88" x2="256" y2="88" stroke="#1A1917" strokeOpacity=".3" strokeWidth="1.5" />
      <line x1="64" y1="106" x2="200" y2="106" stroke="#1A1917" strokeOpacity=".3" strokeWidth="1.5" />
      <circle cx="64" cy="28" r="6" fill="#9B3418" />
      <text x="80" y="32" fontFamily="var(--font-landing-mono), monospace" fontSize="11" letterSpacing="1.5" fill="#1A1917">
        MEMO-0421
      </text>

      <line x1="160" y1="158" x2="160" y2="200" stroke="#1A1917" strokeWidth="2" markerEnd="url(#arrow)" />

      {[
        { y: 210, label: "DRAFT", active: false },
        { y: 300, label: "REVIEW", active: false },
        { y: 390, label: "APPROVAL", active: true },
      ].map((n, i) => (
        <g key={n.label}>
          <rect
            x="40"
            y={n.y}
            width="240"
            height="66"
            fill={n.active ? "#1A1917" : "#F4F1E9"}
            stroke="#1A1917"
            strokeWidth="2"
          />
          <circle cx="70" cy={n.y + 33} r="14" fill={n.active ? "#9B3418" : "none"} stroke={n.active ? "#9B3418" : "#1A1917"} strokeWidth="2" />
          {!n.active && <Check x={62} y={n.y + 25} width={16} height={16} color="#1A1917" strokeWidth={2.5} />}
          {n.active && <Check x={62} y={n.y + 25} width={16} height={16} color="#F4F1E9" strokeWidth={2.5} />}
          <text
            x="98"
            y={n.y + 38}
            fontFamily="var(--font-landing-mono), monospace"
            fontSize="13"
            letterSpacing="2"
            fill={n.active ? "#F4F1E9" : "#1A1917"}
          >
            {n.label}
          </text>
          {i < 2 && (
            <line x1="160" y1={n.y + 66} x2="160" y2={n.y + 100} stroke="#1A1917" strokeWidth="2" markerEnd="url(#arrow)" />
          )}
        </g>
      ))}

      <line x1="160" y1="456" x2="160" y2="480" stroke="#9B3418" strokeWidth="2" strokeDasharray="2 4" />
      <rect x="90" y="480" width="140" height="34" fill="none" stroke="#9B3418" strokeWidth="2" />
      <text x="160" y="502" fontFamily="var(--font-landing-mono), monospace" fontSize="11" letterSpacing="2" fill="#9B3418" textAnchor="middle">
        NEXT: DIRECTOR
      </text>

      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#1A1917" />
        </marker>
      </defs>
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Section 1: routing line drawing — a stylised path from a desk (author) to
   a stamp (approver), drawn to scale in real "units" with hairline
   construction geometry and pigment leader lines to labels.
------------------------------------------------------------------------- */
function RoutingDrawing() {
  const { ref, drawn } = useDrawOnView<SVGPathElement>();
  return (
    <svg viewBox="0 0 480 420" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="480" height="420" fill="none" stroke="rgba(26,25,23,.16)" strokeWidth="1" />
      {[80, 160, 240, 320, 400].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="420" stroke="rgba(26,25,23,.08)" strokeWidth="1" />
      ))}
      {[80, 160, 240, 320].map((y) => (
        <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="rgba(26,25,23,.08)" strokeWidth="1" />
      ))}

      <rect x="30" y="60" width="70" height="50" fill="none" stroke="#1A1917" strokeWidth="2" />
      <text x="65" y="130" textAnchor="middle" fontFamily="var(--font-landing-mono), monospace" fontSize="10" letterSpacing="1.5" fill="#4A4741">
        AUTHOR
      </text>

      <path
        ref={ref}
        d="M100,85 C 200,85 180,180 260,180 S 340,280 380,280"
        fill="none"
        stroke="#9B3418"
        strokeWidth="2.5"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 1.4s cubic-bezier(.16,.8,.3,1)",
        }}
      />
      <circle
        cx="180"
        cy="140"
        r="4"
        fill="#9B3418"
        style={{ opacity: drawn ? 1 : 0, transition: "opacity .3s ease .7s" }}
      />
      <circle
        cx="290"
        cy="230"
        r="4"
        fill="#9B3418"
        style={{ opacity: drawn ? 1 : 0, transition: "opacity .3s ease 1.1s" }}
      />

      <line x1="180" y1="140" x2="150" y2="200" stroke="rgba(26,25,23,.4)" strokeWidth="1" />
      <text x="120" y="214" fontFamily="var(--font-landing-mono), monospace" fontSize="10" letterSpacing="1.5" fill="#4A4741">
        DEPT HEAD
      </text>

      <line x1="290" y1="230" x2="320" y2="180" stroke="rgba(26,25,23,.4)" strokeWidth="1" />
      <text x="300" y="172" fontFamily="var(--font-landing-mono), monospace" fontSize="10" letterSpacing="1.5" fill="#4A4741">
        FINANCE
      </text>

      <rect x="380" y="255" width="70" height="50" fill="#1A1917" stroke="#1A1917" strokeWidth="2" />
      <text x="415" y="285" textAnchor="middle" fontFamily="var(--font-landing-mono), monospace" fontSize="16" fill="#E7E3DA">
        ✓
      </text>
      <text x="415" y="326" textAnchor="middle" fontFamily="var(--font-landing-mono), monospace" fontSize="10" letterSpacing="1.5" fill="#4A4741">
        DIRECTOR
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Section 2: pinned study. A tall (300vh) wrapper holds a sticky stage;
   progress is derived from how far the wrapper has scrolled past the
   viewport top, clamped 0..1 — not from raw viewport units, so it stays in
   bounds at any screen size.
------------------------------------------------------------------------- */
function PinnedStudy() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const scrollY = useScrollY();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    const p = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
    setProgress(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollY]);

  const stageIndex = Math.min(3, Math.floor(progress * 4));
  const stage = STAGES[stageIndex];
  const hoursIn = Math.round(progress * TOTAL_CYCLE_HOURS * 10) / 10;
  const hh = Math.floor(hoursIn);
  const mm = Math.round((hoursIn - hh) * 60);
  const nextAction =
    stage === "Draft" ? "Author submission" :
    stage === "Review" ? "Department Head sign-off" :
    stage === "Approval" ? "Finance Approval" :
    "None — cycle closed";

  // Arc path across the stage, in a fixed 0..1000 x 0..1 y coordinate space,
  // sampled at the current progress via SVG getPointAtLength.
  const pathRef = useRef<SVGPathElement>(null);
  const [marker, setMarker] = useState({ x: 60, y: 260 });
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * progress);
    setMarker({ x: pt.x, y: pt.y });
  }, [progress]);

  return (
    <div ref={wrapRef} className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden" style={{ background: "#DCD7CB" }}>
        <div className="mx-auto w-full max-w-[1100px] px-6">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
            02 — THE JOURNEY
          </p>
          <h2
            className="mt-3 max-w-2xl"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 3vw, 42px)",
              letterSpacing: "-0.015em",
              color: "#1A1917",
              lineHeight: 1.08,
            }}
          >
            One memo, <em style={{ color: "#9B3418", fontStyle: "italic" }}>one path</em>, every step accounted for.
          </h2>

          <div className="relative mt-10 h-[280px]">
            <svg viewBox="0 0 1000 280" className="w-full h-full" aria-hidden>
              <path
                ref={pathRef}
                d="M60,260 C 260,260 260,60 480,60 S 700,220 940,220"
                fill="none"
                stroke="rgba(26,25,23,.16)"
                strokeWidth="1.5"
              />
              {[
                { x: 60, y: 260, label: "AUTHOR" },
                { x: 480, y: 60, label: "REVIEWER" },
                { x: 720, y: 200, label: "APPROVER" },
                { x: 940, y: 220, label: "COMPLETED" },
              ].map((n) => (
                <g key={n.label}>
                  <circle cx={n.x} cy={n.y} r="4" fill="#1A1917" />
                  <text
                    x={n.x}
                    y={n.y - 14}
                    textAnchor="middle"
                    fontFamily="var(--font-landing-mono), monospace"
                    fontSize="10.5"
                    letterSpacing="1.5"
                    fill="#4A4741"
                  >
                    {n.label}
                  </text>
                </g>
              ))}
              <circle cx={marker.x} cy={marker.y} r="8" fill="#9B3418" />
              <circle cx={marker.x} cy={marker.y} r="14" fill="none" stroke="#9B3418" strokeWidth="1.5" opacity="0.5">
                <animate attributeName="r" values="12;20;12" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          <div
            className="mt-8 grid grid-cols-3 gap-6 border-t pt-4 font-mono text-[10.5px] uppercase tracking-[0.15em]"
            style={{ borderColor: "rgba(26,25,23,.16)", color: "#1A1917" }}
          >
            <div>
              <span style={{ color: "#9B3418" }}>STAGE</span>
              <div className="mt-1 normal-case tracking-normal text-[15px]" style={{ fontFamily: "var(--font-serif)" }}>
                {stage}
              </div>
            </div>
            <div>
              <span style={{ color: "#9B3418" }}>TIME IN QUEUE</span>
              <div className="mt-1 normal-case tracking-normal text-[15px]" style={{ fontFamily: "var(--font-serif)" }}>
                {hh}h {mm}m
              </div>
            </div>
            <div>
              <span style={{ color: "#9B3418" }}>NEXT ACTION</span>
              <div className="mt-1 normal-case tracking-normal text-[15px]" style={{ fontFamily: "var(--font-serif)" }}>
                {nextAction}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WORK_ROWS = [
  { project: "Purchase Request", status: "Pending Finance Approval", dept: "Finance", priority: "HIGH", owner: "Sarah Chen", elapsed: "2 days" },
  { project: "Leave Request", status: "Approved", dept: "HR", priority: "NORMAL", owner: "Mike Torres", elapsed: "✓" },
  { project: "Procurement Request", status: "Changes Requested", dept: "Ops", priority: "URGENT", owner: "Jennifer Wu", elapsed: "Awaiting revision" },
];

const MATERIAL_ROWS = [
  { label: "APPROVAL SPEED", desc: "Sequential routing removes the guesswork of who acts next.", value: "AUTOMATED" },
  { label: "AUDIT TRAIL", desc: "Every status change, comment, and signature kept in order.", value: "IMMUTABLE" },
  { label: "WORKFLOW TEMPLATES", desc: "Org-defined step sequences, reused across every memo.", value: "PER ORG" },
  { label: "COMMENT THREADS", desc: "Reviewers ask, authors answer, right on the memo.", value: "THREADED" },
];

const DEFINITION_ROWS = [
  { label: "ROUTE TIME", desc: "Automatically send to the right person", value: "2 min" },
  { label: "STEP COUNT", desc: "Configured once per organisation", value: "1–8" },
  { label: "VISIBILITY", desc: "Only the current step's assignee is notified", value: "Scoped" },
];

export function LandingPage({
  viewer,
}: {
  viewer?: { fullName: string; photoUrl: string | null } | null;
}) {
  const revealed = useReveal();
  const scrollY = useScrollY();
  const [heroH, setHeroH] = useState(900);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (heroRef.current) setHeroH(heroRef.current.offsetHeight);
  }, []);

  const heroProgress = Math.min(1, scrollY / Math.max(1, heroH));
  const rm = typeof window !== "undefined" && reducedMotion();
  const subjectRise = rm ? 0 : heroProgress * 24; // vh

  return (
    <div
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--font-serif" as any]: "var(--font-landing-serif), ui-serif, Georgia, serif",
        ["--font-azeret" as any]: "var(--font-landing-mono), ui-monospace, monospace",
        // Scopes Tailwind's `font-mono` utility (which reads --font-mono) to
        // Azeret Mono for this subtree only, leaving the app's IBM Plex Mono
        // untouched everywhere else.
        ["--font-mono" as any]: "var(--font-landing-mono), ui-monospace, monospace",
        background: "#E7E3DA",
        color: "#1A1917",
        fontFamily: "var(--font-landing-mono), ui-monospace, monospace",
      }}
      className="min-h-screen"
    >
      {/* -------------------------------------------------- NAV */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-[60px] flex items-center"
        style={{
          background: "rgba(231,227,218,.72)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(26,25,23,.16)",
        }}
      >
        <div className="mx-auto w-full max-w-[1240px] px-6 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo(0);
            }}
            style={{ fontFamily: "var(--font-serif)", fontSize: 19, cursor: "pointer" }}
          >
            Memo<span style={{ color: "#9B3418" }}>&apos;</span>d<span style={{ color: "#9B3418" }}>.</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 font-mono text-[10.5px] uppercase tracking-[0.15em]">
            {["Section", "Sun", "Material", "Work", "Practice"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(l.toLowerCase());
                  if (el) smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - 60);
                }}
                className="relative pb-1 hover:opacity-70 transition-opacity"
                style={{
                  borderBottom: "1px solid transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "#9B3418")}
                onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
              >
                {l}
              </a>
            ))}
          </nav>
          {viewer ? (
            <Link
              href="/dashboard"
              aria-label={`Go to dashboard — signed in as ${viewer.fullName}`}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border font-mono text-[11px] uppercase"
              style={{ borderColor: "#9B3418", color: "#9B3418" }}
            >
              {viewer.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                mainInitial(viewer.fullName || "?")
              )}
            </Link>
          ) : (
            <Link
              href="/login"
              className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-4 py-2 border"
              style={{ borderColor: "#9B3418", color: "#9B3418", ["--sweep" as never]: "#9B3418", ["--sweep-text" as never]: "#E7E3DA" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* -------------------------------------------------- HERO */}
      <section
        ref={heroRef}
        id="section"
        className="relative pt-[60px] overflow-hidden"
        style={{ background: "#DCD7CB", isolation: "isolate", minHeight: "100vh" }}
      >
        <div className="mx-auto w-full max-w-[1240px] px-6 relative" style={{ minHeight: "calc(100vh - 60px)" }}>
          {/* left column copy */}
          <div
            className="relative z-20 pt-16 md:pt-24 max-w-full md:max-w-[44vw] md:min-w-[320px]"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(20px)",
              transition: "opacity .5s ease .0s, transform .5s ease .0s",
            }}
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#4A4741" }}>
              Memo&apos;d · Inter-Office Memo Management · Est 2026
            </p>
            <h1
              className="mt-4"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(30px, 4vw, 56px)",
                letterSpacing: "-0.015em",
                lineHeight: 1.04,
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(20px)",
                transition: "opacity .5s ease .07s, transform .5s ease .07s",
              }}
            >
              A memo moves through the org{" "}
              <em style={{ color: "#9B3418", fontStyle: "italic" }}>without the back-and-forth</em>.
            </h1>
            <p
              className="mt-5 font-mono text-[12.5px] normal-case tracking-[0.03em] leading-relaxed max-w-md"
              style={{
                color: "#4A4741",
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(20px)",
                transition: "opacity .5s ease .14s, transform .5s ease .14s",
              }}
            >
              Draft, route, and approve inter-office memos on a workflow your organisation
              defines once. Every step logged, every signature kept.
            </p>
            <div
              className="mt-8 flex flex-wrap gap-3"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(20px)",
                transition: "opacity .5s ease .21s, transform .5s ease .21s",
              }}
            >
              {viewer ? (
                <>
                  <Link
                    href="/memos/new"
                    className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border inline-flex items-center gap-2"
                    style={{ borderColor: "#9B3418", color: "#9B3418", ["--sweep" as never]: "#9B3418", ["--sweep-text" as never]: "#E7E3DA" }}
                  >
                    <span>■</span> Write a memo
                  </Link>
                  <Link
                    href="/dashboard"
                    className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border"
                    style={{ borderColor: "#1A1917", color: "#1A1917", ["--sweep" as never]: "#1A1917", ["--sweep-text" as never]: "#E7E3DA" }}
                  >
                    Go to dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border inline-flex items-center gap-2"
                    style={{ borderColor: "#9B3418", color: "#9B3418", ["--sweep" as never]: "#9B3418", ["--sweep-text" as never]: "#E7E3DA" }}
                  >
                    <span>■</span> Start an organisation
                  </Link>
                  <Link
                    href="/signup?mode=join"
                    className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border"
                    style={{ borderColor: "#1A1917", color: "#1A1917", ["--sweep" as never]: "#1A1917", ["--sweep-text" as never]: "#E7E3DA" }}
                  >
                    Request access
                  </Link>
                </>
              )}
            </div>
            <p
              className="mt-16 font-mono text-[10.5px] uppercase tracking-[0.15em]"
              style={{
                color: "#6E6A61",
                opacity: revealed ? 1 : 0,
                transition: "opacity .5s ease .28s",
              }}
            >
              Model 01 · Sequential Approval · Multi-Tenant
            </p>
          </div>

          {/* right column: subject only — bounded to the right ~54% of the
              container and clipped so it can never overlap the left copy. */}
          <div
            className="absolute pointer-events-none overflow-hidden hidden md:block"
            style={{ top: 0, bottom: 0, left: "46%", right: 0 }}
          >
            <div
              className="absolute right-[6%]"
              style={{
                top: "50%",
                zIndex: 15,
                width: "min(30vw, 340px)",
                transform: `translate(0, calc(-50% - ${subjectRise}vh)) scale(${1 + heroProgress * 0.08})`,
                opacity: revealed ? 1 : 0,
                transition: "opacity .6s ease .2s, transform .1s linear",
              }}
            >
              <WorkflowSubject className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- SECTION 1: WORKFLOW */}
      <section id="sun" className="py-24 md:py-32" style={{ background: "#E7E3DA", scrollMarginTop: 60 }}>
        <div className="mx-auto w-full max-w-[1240px] px-6 grid md:grid-cols-2 gap-16 items-start">
          <Reveal>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
              01 — ROUTING
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px, 2.5vw, 36px)",
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              The plan is a consequence. The <em style={{ color: "#9B3418", fontStyle: "italic" }}>step</em> is the argument.
            </h2>
            <p className="mt-4 font-mono text-[12.5px] normal-case leading-relaxed max-w-md" style={{ color: "#4A4741" }}>
              A workflow tells you where the memo goes next. We draw the route until
              it works, then let the org chart fall out of it.
            </p>
            <dl className="mt-10 divide-y" style={{ borderColor: "rgba(26,25,23,.16)" }}>
              {DEFINITION_ROWS.map((r, i) => (
                <Reveal key={r.label} delay={0.08 * i} y={12}>
                  <div
                    className="group grid grid-cols-[auto,1fr,auto] gap-4 items-baseline py-4 border-t transition-[padding] duration-300 hover:pl-2"
                    style={{ borderColor: "rgba(26,25,23,.16)" }}
                  >
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.15em] transition-colors group-hover:text-current" style={{ color: "#9B3418" }}>
                      {r.label}
                    </dt>
                    <dd style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>{r.desc}</dd>
                    <dd className="font-mono text-[12.5px] tabular-nums text-right" style={{ color: "#1A1917" }}>
                      {r.value}
                    </dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.15}>
            <RoutingDrawing />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------- SECTION 2: PINNED STUDY */}
      <div id="material-anchor" />
      <PinnedStudy />

      {/* -------------------------------------------------- SECTION 3: MATERIAL */}
      <section id="material" className="py-24 md:py-32" style={{ background: "#E7E3DA", scrollMarginTop: 60 }}>
        <div className="mx-auto w-full max-w-[1240px] px-6 grid md:grid-cols-2 gap-16">
          <Reveal>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
              03 — PRACTICE
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px, 2.5vw, 36px)",
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              Four things, and none of them are a courtesy.
            </h2>
            <p className="mt-4 font-mono text-[12.5px] normal-case leading-relaxed max-w-md" style={{ color: "#4A4741" }}>
              Everything on the record is structural or it is not there. The audit
              trail is the memo, kept whole.
            </p>
          </Reveal>
          <dl className="divide-y" style={{ borderColor: "rgba(26,25,23,.16)" }}>
            {MATERIAL_ROWS.map((r, i) => (
              <Reveal key={r.label} delay={0.08 * i} y={12}>
                <div
                  className="group grid grid-cols-[auto,1fr,auto] gap-4 items-baseline py-4 border-t transition-[padding] duration-300 hover:pl-2"
                  style={{ borderColor: "rgba(26,25,23,.16)" }}
                >
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
                    {r.label}
                  </dt>
                  <dd style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>{r.desc}</dd>
                  <dd className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-right whitespace-nowrap" style={{ color: "#1A1917" }}>
                    {r.value}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* -------------------------------------------------- SECTION 4: WORK TABLE */}
      <section id="work" className="py-24 md:py-32" style={{ background: "#DCD7CB", scrollMarginTop: 60 }}>
        <div className="mx-auto w-full max-w-[1240px] px-6">
          <Reveal>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
              04 — WORK
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px, 2.5vw, 36px)",
                letterSpacing: "-0.015em",
              }}
            >
              On the desk right now.
            </h2>
          </Reveal>

          {/* desktop table */}
          <div className="mt-10 hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(26,25,23,.16)" }}>
                  {["Project", "Status", "Department", "Priority", "Owner", "Elapsed"].map((h) => (
                    <th
                      key={h}
                      className="text-left font-mono text-[10.5px] uppercase tracking-[0.15em] font-medium pb-3"
                      style={{ color: "#4A4741" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WORK_ROWS.map((r, i) => (
                  <RevealRow
                    key={r.project}
                    delay={0.08 * i}
                    className="border-b"
                    style={{ borderColor: "rgba(26,25,23,.16)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(155,52,24,.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="py-4" style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(15px,1.5vw,21px)" }}>
                      {r.project}
                    </td>
                    <td className="py-4 font-mono text-[10.5px] uppercase tracking-[0.1em]">{r.status}</td>
                    <td className="py-4 font-mono text-[10.5px] uppercase tracking-[0.1em]">{r.dept}</td>
                    <td className="py-4 font-mono text-[10.5px] uppercase tracking-[0.1em]" style={{ color: r.priority === "URGENT" || r.priority === "HIGH" ? "#9B3418" : "#1A1917" }}>
                      {r.priority}
                    </td>
                    <td className="py-4 font-mono text-[10.5px] uppercase tracking-[0.1em]">{r.owner}</td>
                    <td className="py-4 font-mono text-[10.5px] uppercase tracking-[0.1em]">{r.elapsed}</td>
                  </RevealRow>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile grid */}
          <div className="mt-10 md:hidden space-y-6">
            {WORK_ROWS.map((r, i) => (
              <Reveal key={r.project} delay={0.08 * i} y={14}>
                <div className="border-t pt-4" style={{ borderColor: "rgba(26,25,23,.16)" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 18 }}>{r.project}</div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-4 font-mono text-[10.5px] uppercase tracking-[0.1em]" style={{ color: "#4A4741" }}>
                    <span>Status</span><span style={{ color: "#1A1917" }}>{r.status}</span>
                    <span>Department</span><span style={{ color: "#1A1917" }}>{r.dept}</span>
                    <span>Priority</span><span style={{ color: r.priority === "URGENT" || r.priority === "HIGH" ? "#9B3418" : "#1A1917" }}>{r.priority}</span>
                    <span>Owner</span><span style={{ color: "#1A1917" }}>{r.owner}</span>
                    <span>Elapsed</span><span style={{ color: "#1A1917" }}>{r.elapsed}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- SECTION 5: PRACTICE / CLOSE */}
      <section id="practice" className="pt-24 md:pt-32" style={{ background: "#E7E3DA", scrollMarginTop: 60 }}>
        <div className="mx-auto w-full max-w-[1240px] px-6 grid md:grid-cols-2 gap-16 items-baseline pb-16">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>
              05 — PRACTICE
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px, 2.5vw, 36px)",
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
              }}
            >
              One organisation, its own workflow.
            </h2>
            <p className="mt-4 font-mono text-[12.5px] normal-case leading-relaxed max-w-md" style={{ color: "#4A4741" }}>
              Departments, designations, and templates are yours to define at
              set-up — Memo&apos;d only enforces the order you choose.
            </p>
          </div>
          <dl className="divide-y" style={{ borderColor: "rgba(26,25,23,.16)" }}>
            {[
              { label: "DEPARTMENTS", value: "Unlimited" },
              { label: "WORKFLOW STEPS", value: "1–12 per template" },
              { label: "MEMBERS", value: "Unlimited" },
            ].map((r) => (
              <div key={r.label} className="flex items-baseline justify-between py-4 border-t" style={{ borderColor: "rgba(26,25,23,.16)" }}>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B3418" }}>{r.label}</dt>
                <dd className="font-mono text-[12.5px] tabular-nums">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* close */}
        <div style={{ background: "#1A1917", color: "#E7E3DA" }} className="pt-16">
          <div className="mx-auto w-full max-w-[1240px] px-6">
            <Reveal>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(28px, 3.5vw, 46px)",
                  letterSpacing: "-0.015em",
                  lineHeight: 1.06,
                }}
              >
                Send us a <em style={{ color: "#C9744F", fontStyle: "italic" }}>memo</em>, not a support ticket.
              </h2>
              <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "#9B9186" }}>
                We answer every request · First step is a workflow sketch
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-10 flex items-center justify-between border-t pt-6" style={{ borderColor: "rgba(231,227,218,.16)" }}>
                {viewer ? (
                  <>
                    <Link
                      href="/memos/new"
                      className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border inline-flex items-center gap-2"
                      style={{ borderColor: "#C9744F", color: "#C9744F", ["--sweep" as never]: "#C9744F", ["--sweep-text" as never]: "#1A1917" }}
                    >
                      Write a memo{" "}
                      <ArrowRight size={13} style={{ display: "inline" }} />
                    </Link>
                    <Link
                      href="/dashboard"
                      className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border"
                      style={{ borderColor: "#E7E3DA", ["--sweep" as never]: "#E7E3DA" }}
                    >
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border inline-flex items-center gap-2"
                      style={{ borderColor: "#C9744F", color: "#C9744F", ["--sweep" as never]: "#C9744F", ["--sweep-text" as never]: "#1A1917" }}
                    >
                      Start an organisation{" "}
                      <ArrowRight size={13} style={{ display: "inline" }} />
                    </Link>
                    <Link
                      href="/login"
                      className="sweep-btn font-mono text-[10.5px] uppercase tracking-[0.15em] px-5 py-3 border"
                      style={{ borderColor: "#E7E3DA", ["--sweep" as never]: "#E7E3DA" }}
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </Reveal>
          </div>
          <div className="mt-10 border-t pt-2 overflow-hidden" style={{ borderColor: "rgba(231,227,218,.16)" }}>
            <div
              className="mx-auto w-full max-w-[1240px] px-6 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.15em] pb-2"
              style={{ color: "#6E6A61" }}
            >
              <span>Memo&apos;d · Inter-Office Memo Management</span>
              <span>© 2026</span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(80px, 20vw, 300px)",
                lineHeight: 0.82,
                letterSpacing: "-0.015em",
                color: "#E7E3DA",
                transform: "translateY(0.17em)",
                whiteSpace: "nowrap",
                animation: rm ? undefined : "footerFloat 7s ease-in-out infinite",
              }}
              className="w-full text-center select-none"
            >
              Memo&apos;d
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes footerFloat {
          0%, 100% { transform: translateY(0.17em); }
          50% { transform: translateY(calc(0.17em - 10px)); }
        }
        .sweep-btn {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transition: color 0.35s ease;
        }
        .sweep-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--sweep, #1a1917);
          transform: translateX(-101%);
          transition: transform 0.35s cubic-bezier(.16,.8,.3,1);
          z-index: -1;
        }
        .sweep-btn:hover {
          color: var(--sweep-text, #1a1917) !important;
        }
        .sweep-btn:hover::before {
          transform: translateX(0);
        }
      `}</style>
    </div>
  );
}
