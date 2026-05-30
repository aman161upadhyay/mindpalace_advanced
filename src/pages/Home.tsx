import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Menu, Moon, Settings, Sun, X as XIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ScrambledOnce,
  ScrambledCycling,
  RainingLettersBackground,
} from "@/components/ui/modern-animated-hero-section";


// ── Spark types ──────────────────────────────────────────────────────────────
type BookSpark = {
  type: "book";
  quote: string;
  author: string;
  source: string;
  label: string;
};
type AiSpark = {
  type: "ai";
  quote: string;
  model: string;
  date: string;
  label: string;
};
type TweetSpark = {
  type: "tweet";
  handle: string;
  name: string;
  quote: string;
  likes: string;
  retweets: string;
  date: string;
  label: string;
};
type Spark = BookSpark | AiSpark | TweetSpark;

const SPARKS_PREVIEW = [
  { text: "The MCP is an open protocol designed specifically to bridge the critical gap between isolated AI models and highly dynamic, real-world data environments...", source: "Planhat" },
  { text: "It is true that intrinsic valuation, at least in its discounted cash flow avatar, is much easier to do at companies that have many years of historical data...", source: "Damodaran" },
  { text: "Success brings an asymmetry — you now have more to lose than to gain. You are hence fragile.", source: "Taleb" },
  { text: "Existential nihilism asserts that life has no objective meaning or purpose...", source: "" },
  { text: "Before World War I, Europe had a naturally integrated capital market. An investor in London could easily finance a railway in the Balkans...", source: "" },
];

const SPARKS: Spark[] = [
  {
    type: "book",
    quote:
      "Success brings an asymmetry, you now have more to lose than to gain. You are hence fragile.",
    author: "Nassim N. Taleb",
    source: "Antifragile",
    label: "book quote",
  },
  {
    type: "ai",
    quote:
      'LLMs are structurally biased toward action. Due to RLHF, they are "eager to please" and will rush to generate artifacts before mapping the full design tree.',
    model: "Gemini 1.5 Pro",
    date: "Apr 12, 2025",
    label: "marginalia",
  },
  {
    type: "tweet",
    handle: "@AswathDamodaran",
    name: "Aswath Damodaran",
    quote:
      "Valuation is not a science. It is not even an art. It is storytelling with numbers, and the best valuations are the ones where the story and the numbers reinforce each other.",
    likes: "4.2K",
    retweets: "1.1K",
    date: "Mar 14, 2024",
    label: "captured post",
  },
];


// ── Parchment base styles ─────────────────────────────────────────────────────
const PARCHMENT_BG = "#f2e8c9";
const PARCHMENT_BG_IMAGE = [
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E\")",
  "radial-gradient(ellipse at top left, rgba(160,110,40,0.18) 0%, transparent 55%)",
  "radial-gradient(ellipse at bottom right, rgba(140,95,30,0.14) 0%, transparent 55%)",
].join(", ");
const PARCHMENT_BORDER = "1px solid #c9a96e";
const PARCHMENT_SHADOW =
  "inset 0 0 70px rgba(110,70,20,0.13), 0 6px 24px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.12)";

// ── Card components ───────────────────────────────────────────────────────────
function BookCard({ spark, rotation, offset }: { spark: BookSpark; rotation: number; offset: string }) {
  return (
    <div
      className="w-full rounded-sm p-7"
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundColor: PARCHMENT_BG,
        backgroundImage: PARCHMENT_BG_IMAGE,
        border: PARCHMENT_BORDER,
        boxShadow: PARCHMENT_SHADOW,
      }}
    >
      {/* Washi tape */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-6 rounded-sm opacity-60"
        style={{
          background: "rgba(90,122,98,0.35)",
          border: "1px solid rgba(90,122,98,0.45)",
          backdropFilter: "blur(1px)",
        }}
      />
      {/* Book label */}
      <div className="flex items-center gap-2 mb-5">
        <span
          className="inline-block text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "#5a7a62",
            borderColor: "rgba(90,122,98,0.35)",
          }}
        >
          {spark.label}
        </span>
        <span
          className="text-[10px] ml-auto"
          style={{ fontFamily: '"JetBrains Mono", monospace', color: "#8a6a3a" }}
        >
          {spark.source}
        </span>
      </div>
      {/* Opening ornament */}
      <p
        className="mb-1"
        style={{ fontFamily: '"IM Fell English", Georgia, serif', fontSize: "2rem", color: "#8a6a3a", lineHeight: 1, opacity: 0.5 }}
      >
        ❝
      </p>
      <p
        className="mb-5"
        style={{
          fontFamily: '"IM Fell English", Georgia, serif',
          fontStyle: "italic",
          fontSize: "1.05rem",
          lineHeight: "1.85",
          color: "#1a0e06",
          textShadow: "0.4px 0.4px 0px rgba(26,14,6,0.45), 0 0 1.5px rgba(26,14,6,0.18)",
          letterSpacing: "0.01em",
        }}
      >
        {spark.quote}
      </p>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: "rgba(140,95,30,0.25)" }} />
        <p
          style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: "0.8rem",
            color: "#5a3e20",
            textShadow: "0.3px 0.3px 0px rgba(90,62,32,0.4)",
          }}
        >
          — {spark.author}
        </p>
      </div>
    </div>
  );
}

function AiCard({ spark, rotation, offset }: { spark: AiSpark; rotation: number; offset: string }) {
  return (
    <div
      className="w-full rounded-sm p-7"
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundColor: PARCHMENT_BG,
        backgroundImage: PARCHMENT_BG_IMAGE,
        border: PARCHMENT_BORDER,
        boxShadow: PARCHMENT_SHADOW,
      }}
    >
      {/* AI header row */}
      <div className="flex items-center gap-3 mb-5 pb-3" style={{ borderBottom: "1px dashed rgba(140,95,30,0.3)" }}>
        {/* Gemini-style gradient orb */}
        <div
          className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
          style={{
            background: "conic-gradient(from 180deg at 50% 50%, #4e6a57 0%, #87a893 25%, #c9a96e 50%, #87a893 75%, #4e6a57 100%)",
            boxShadow: "0 0 8px rgba(78,106,87,0.4)",
          }}
        >
          <span style={{ fontSize: "0.6rem", color: "#fff", fontWeight: 700 }}>G</span>
        </div>
        <div>
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.65rem",
              color: "#5a7a62",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {spark.model}
          </p>
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.6rem",
              color: "#8a6a3a",
            }}
          >
            {spark.date}
          </p>
        </div>
        <span
          className="ml-auto inline-block text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "#5a7a62",
            borderColor: "rgba(90,122,98,0.35)",
          }}
        >
          {spark.label}
        </span>
      </div>
      {/* Left accent bar + quote */}
      <div className="flex gap-3">
        <div
          className="w-0.5 rounded-full shrink-0 mt-1"
          style={{ background: "rgba(78,106,87,0.5)", minHeight: "100%" }}
        />
        <p
          style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontStyle: "italic",
            fontSize: "0.97rem",
            lineHeight: "1.85",
            color: "#1a0e06",
            textShadow: "0.4px 0.4px 0px rgba(26,14,6,0.45), 0 0 1.5px rgba(26,14,6,0.18)",
            letterSpacing: "0.01em",
          }}
        >
          {spark.quote}
        </p>
      </div>
    </div>
  );
}

function TweetCard({ spark, rotation, offset }: { spark: TweetSpark; rotation: number; offset: string }) {
  return (
    <div
      className="w-full rounded-sm p-7"
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundColor: PARCHMENT_BG,
        backgroundImage: PARCHMENT_BG_IMAGE,
        border: PARCHMENT_BORDER,
        boxShadow: PARCHMENT_SHADOW,
      }}
    >
      {/* Tweet header */}
      <div className="flex items-start gap-3 mb-4">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
          style={{
            background: "rgba(140,95,30,0.2)",
            border: "1.5px solid rgba(140,95,30,0.35)",
            color: "#5a3e20",
            fontFamily: '"IM Fell English", Georgia, serif',
          }}
        >
          AD
        </div>
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "#1a0e06",
              textShadow: "0.3px 0.3px 0px rgba(26,14,6,0.3)",
            }}
          >
            {spark.name}
          </p>
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.65rem",
              color: "#8a6a3a",
            }}
          >
            {spark.handle}
          </p>
        </div>
        {/* X logo */}
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ fill: "rgba(140,95,30,0.5)" }}
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.847L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
      {/* Tweet text */}
      <p
        className="mb-4"
        style={{
          fontFamily: '"IM Fell English", Georgia, serif',
          fontStyle: "italic",
          fontSize: "0.97rem",
          lineHeight: "1.85",
          color: "#1a0e06",
          textShadow: "0.4px 0.4px 0px rgba(26,14,6,0.45), 0 0 1.5px rgba(26,14,6,0.18)",
          letterSpacing: "0.01em",
        }}
      >
        {spark.quote}
      </p>
      {/* Tweet metadata row */}
      <div
        className="flex items-center gap-5 pt-3"
        style={{ borderTop: "1px dashed rgba(140,95,30,0.3)" }}
      >
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.6rem",
            color: "#8a6a3a",
          }}
        >
          {spark.date}
        </span>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.6rem",
            color: "#5a7a62",
          }}
        >
          ♻ {spark.retweets}
        </span>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.6rem",
            color: "#8a6a3a",
          }}
        >
          ♥ {spark.likes}
        </span>
        <span
          className="ml-auto inline-block text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "#5a7a62",
            borderColor: "rgba(90,122,98,0.35)",
          }}
        >
          {spark.label}
        </span>
      </div>
    </div>
  );
}

function SparkCard({ spark, rotation, offset }: { spark: Spark; rotation: number; offset: string }) {
  if (spark.type === "book") return <BookCard spark={spark} rotation={rotation} offset={offset} />;
  if (spark.type === "ai") return <AiCard spark={spark} rotation={rotation} offset={offset} />;
  return <TweetCard spark={spark} rotation={rotation} offset={offset} />;
}

// ── Botanical side decoration SVGs ────────────────────────────────────────────
function BotanicalLeft() {
  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-32 pointer-events-none select-none hidden lg:block"
      style={{ opacity: 0.22 }}
    >
      <svg
        viewBox="0 0 128 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ color: "#4e6a57" }}
      >
        {/* Spine of a closed book */}
        <rect x="12" y="60" width="28" height="90" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="12" y="60" width="4" height="90" rx="1" fill="currentColor" opacity="0.55" />
        <line x1="12" y1="80" x2="40" y2="80" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
        <line x1="12" y1="100" x2="40" y2="100" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
        <line x1="12" y1="120" x2="40" y2="120" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />

        {/* Second book stacked */}
        <rect x="6" y="155" width="34" height="75" rx="2" fill="currentColor" opacity="0.28" />
        <rect x="6" y="155" width="4" height="75" rx="1" fill="currentColor" opacity="0.45" />

        {/* Loose pages fanned out */}
        <path d="M8 250 Q30 240 45 260 Q30 270 8 265 Z" fill="currentColor" opacity="0.18" />
        <path d="M5 258 Q28 245 46 268 Q28 278 5 272 Z" fill="currentColor" opacity="0.13" />
        <path d="M3 266 Q26 250 47 276 Q26 286 3 279 Z" fill="currentColor" opacity="0.10" />

        {/* Stem up the left edge */}
        <path d="M20 340 C20 320 22 300 18 280" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

        {/* Large monstera leaf */}
        <path
          d="M18 280 C0 260 -5 235 10 220 C25 205 45 215 50 235 C55 255 40 270 18 280 Z"
          fill="currentColor"
          opacity="0.25"
        />
        {/* Monstera cuts */}
        <path d="M18 280 C25 265 35 250 50 235" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
        <path d="M10 260 C18 255 28 248 40 245" stroke="currentColor" strokeWidth="0.6" opacity="0.25" />

        {/* Smaller leaf */}
        <path
          d="M20 340 C5 325 0 308 12 298 C24 288 38 295 38 310 C38 325 28 335 20 340 Z"
          fill="currentColor"
          opacity="0.22"
        />
        <path d="M20 340 C26 328 32 315 38 310" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />

        {/* Long drooping stem */}
        <path d="M18 340 C15 370 10 400 14 440 C18 480 22 500 20 530" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

        {/* Leaf at bottom */}
        <path
          d="M20 530 C4 515 -2 495 8 482 C18 469 35 474 36 490 C37 506 28 522 20 530 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path d="M20 530 C25 516 30 500 36 490" stroke="currentColor" strokeWidth="0.7" opacity="0.28" />

        {/* Fine tendrils */}
        <path d="M14 440 C5 430 -2 420 4 412" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
        <path d="M16 400 C8 392 2 382 8 375" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.25" />
      </svg>
    </div>
  );
}

function BotanicalRight() {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none select-none hidden lg:block"
      style={{ opacity: 0.22 }}
    >
      <svg
        viewBox="0 0 128 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ color: "#4e6a57", transform: "scaleX(-1)" }}
      >
        {/* Mirror of left side with slight variation */}
        {/* Book stack */}
        <rect x="12" y="80" width="30" height="85" rx="2" fill="currentColor" opacity="0.3" />
        <rect x="38" y="80" width="4" height="85" rx="1" fill="currentColor" opacity="0.5" />
        <line x1="12" y1="98" x2="42" y2="98" stroke="currentColor" strokeWidth="0.8" opacity="0.38" />
        <line x1="12" y1="115" x2="42" y2="115" stroke="currentColor" strokeWidth="0.8" opacity="0.38" />
        <line x1="12" y1="132" x2="42" y2="132" stroke="currentColor" strokeWidth="0.8" opacity="0.38" />

        <rect x="8" y="170" width="32" height="68" rx="2" fill="currentColor" opacity="0.24" />
        <rect x="36" y="170" width="4" height="68" rx="1" fill="currentColor" opacity="0.4" />

        {/* Fanned pages */}
        <path d="M8 255 Q30 245 46 265 Q30 275 8 270 Z" fill="currentColor" opacity="0.16" />
        <path d="M5 263 Q28 250 47 272 Q28 282 5 276 Z" fill="currentColor" opacity="0.12" />

        {/* Central stem */}
        <path d="M20 360 C20 335 18 305 22 282" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

        {/* Large leaf */}
        <path
          d="M22 282 C5 265 -2 240 12 224 C26 208 48 218 52 240 C56 262 40 274 22 282 Z"
          fill="currentColor"
          opacity="0.24"
        />
        <path d="M22 282 C30 266 40 252 52 240" stroke="currentColor" strokeWidth="0.8" opacity="0.32" />
        <path d="M12 262 C20 257 32 250 44 246" stroke="currentColor" strokeWidth="0.6" opacity="0.22" />

        {/* Mid leaf */}
        <path
          d="M20 360 C4 344 -2 326 10 314 C22 302 40 308 40 325 C40 342 30 352 20 360 Z"
          fill="currentColor"
          opacity="0.22"
        />
        <path d="M20 360 C27 346 33 330 40 325" stroke="currentColor" strokeWidth="0.7" opacity="0.28" />

        {/* Downward stem */}
        <path d="M20 360 C18 392 14 420 18 460 C22 498 24 515 22 540" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

        {/* Bottom leaf */}
        <path
          d="M22 540 C6 524 0 504 10 490 C20 476 38 480 38 498 C38 516 30 530 22 540 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path d="M22 540 C27 524 32 508 38 498" stroke="currentColor" strokeWidth="0.7" opacity="0.26" />

        {/* Tendrils */}
        <path d="M16 460 C8 450 2 438 8 430" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.28" />
        <path d="M18 415 C10 406 5 396 10 388" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.22" />
      </svg>
    </div>
  );
}


// ── Hero typing lines ─────────────────────────────────────────────────────────
const LINE1 = "Every idea you've ever read,";
const LINE2 = "remembered in one place.";

const SUBLINE_PHRASES = [
  "Capture marginalia",
  "Dig up relics of your past",
  "Ignite sparks",
];

// Starts after a delay so Mind Palace scramble finishes first
function useTypingAnimation(delayMs = 1500) {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const startId = setTimeout(() => {
      let i = 0;
      let j = 0;
      const timer = setInterval(() => {
        let active = false;
        if (i < LINE1.length) { i++; setText1(LINE1.slice(0, i)); active = true; }
        if (j < LINE2.length) { j++; setText2(LINE2.slice(LINE2.length - j)); active = true; }
        if (!active) { clearInterval(timer); setDone(true); }
      }, 38);
      return () => clearInterval(timer);
    }, delayMs);
    return () => clearTimeout(startId);
  }, [delayMs]);

  return { text1, text2, done };
}

// ── Capture Section ──────────────────────────────────────────────────────────

const ARTICLE_LINES = [
  { text: "The medium is the message, McLuhan argued,", highlight: false },
  { text: "suggesting that the form of a medium", highlight: false },
  { text: "embeds itself in the message, creating", highlight: false },
  { text: "a symbiotic relationship by which the", highlight: false },
  { text: "medium influences how the message", highlight: true },
  { text: "is perceived by its audience.", highlight: true },
  { text: "Understanding this concept is essential", highlight: false },
  { text: "to modern media theory.", highlight: false },
];

const PALACE_CARDS = [
  { label: "marginalia", source: "McLuhan", text: "the medium influences how the message is perceived by its audience." },
  { label: "book quote", source: "Antifragile", text: "Wind extinguishes a candle and energizes fire." },
  { label: "captured post", source: "@naval", text: "Reading is faster than listening. Doing is faster than watching." },
];

function CaptureSection() {
  const [phase, setPhase] = useState<"idle" | "selecting" | "captured" | "arrived">("idle");
  const [particleKey, setParticleKey] = useState(0);

  useEffect(() => {
    // Orchestrate the animation loop
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let t4: ReturnType<typeof setTimeout>;

    function run() {
      setPhase("idle");
      t1 = setTimeout(() => setPhase("selecting"), 800);
      t2 = setTimeout(() => { setPhase("captured"); setParticleKey(k => k + 1); }, 2200);
      t3 = setTimeout(() => setPhase("arrived"), 3600);
      t4 = setTimeout(run, 6000);
    }
    run();
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <section className="py-28 px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 1000,
          height: 600,
          borderRadius: "9999px",
          background: "radial-gradient(ellipse at 35% 50%, rgba(78,106,87,0.13) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(78,106,87,0.08) 0%, transparent 55%)",
          filter: "blur(60px)",
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <p
            className="text-xs uppercase tracking-widest text-primary/60 mb-4"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Capture anything
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-foreground"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Highlight. It's in your palace.
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm mx-auto">
            Select any text on the web. Watch it arrive, indexed and alive.
          </p>
        </div>

        {/* Main split stage */}
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-0">

          {/* ── LEFT: Browser mock ── */}
          <div className="flex-1 flex justify-center lg:justify-end lg:pr-8">
            <div
              className="w-full max-w-sm rounded-xl overflow-hidden border border-border/60"
              style={{
                boxShadow: "0 24px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
              }}
            >
              {/* Browser chrome */}
              <div className="bg-muted/60 px-4 py-3 border-b border-border/40 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                </div>
                <div
                  className="flex-1 bg-background/50 rounded-md px-3 py-1 text-[10px] text-muted-foreground/50 border border-border/30"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  en.wikipedia.org/wiki/Marshall_McLuhan
                </div>
              </div>

              {/* Article body */}
              <div className="bg-card px-6 py-5">
                {/* Fake article header */}
                <div className="mb-4">
                  <div className="h-5 w-3/5 rounded bg-foreground/10 mb-2" />
                  <div className="h-3 w-2/5 rounded bg-foreground/6" />
                </div>
                <div className="space-y-1.5">
                  {ARTICLE_LINES.map((line, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed transition-all duration-500"
                      style={{
                        fontFamily: '"IM Fell English", Georgia, serif',
                        color: line.highlight
                          ? (phase === "selecting" || phase === "captured" || phase === "arrived")
                            ? "#1a0e06"
                            : "var(--foreground)"
                          : "var(--muted-foreground)",
                        backgroundColor: line.highlight
                          ? (phase === "selecting" || phase === "captured" || phase === "arrived")
                            ? "rgba(78,106,87,0.28)"
                            : "transparent"
                          : "transparent",
                        borderRadius: "2px",
                        padding: line.highlight ? "0 2px" : "0",
                        transitionDelay: line.highlight ? `${i * 60}ms` : "0ms",
                        opacity: phase === "captured" || phase === "arrived" ? (line.highlight ? 0.4 : 1) : 1,
                      }}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>

                {/* Cursor indicator */}
                <div
                  className="mt-3 flex items-center gap-1.5 transition-opacity duration-300"
                  style={{ opacity: phase === "selecting" ? 1 : 0 }}
                >
                  <div
                    className="w-3 h-3 rounded-sm border-2 flex items-center justify-center"
                    style={{ borderColor: "#4e6a57" }}
                  >
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  </div>
                  <span
                    className="text-[9px] text-primary/70 uppercase tracking-widest"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    Save to Mind Palace
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER: Particle flow channel ── */}
          <div className="relative flex items-center justify-center" style={{ width: 120, minHeight: 240 }}>
            {/* Dashed guide line */}
            <div
              className="absolute top-1/2 -translate-y-1/2 hidden lg:block"
              style={{
                left: 0, right: 0,
                height: 1,
                background: "repeating-linear-gradient(90deg, rgba(78,106,87,0.35) 0px, rgba(78,106,87,0.35) 4px, transparent 4px, transparent 10px)",
              }}
            />

            {/* Flying letters */}
            {(phase === "captured" || phase === "arrived") && (
              <div key={particleKey} className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
                {["t","h","e"," ","m","e","d","i","u","m"].map((char, i) => (
                  <span
                    key={i}
                    className="absolute text-xs font-bold"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: "#4e6a57",
                      left: "50%",
                      top: `${30 + i * 7}%`,
                      animation: `capture-fly 1.1s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
                      animationDelay: `${i * 55}ms`,
                      opacity: 0,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            )}

            {/* Arrow tip */}
            <div
              className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center hidden lg:flex transition-all duration-500"
              style={{
                background: phase === "captured" || phase === "arrived"
                  ? "rgba(78,106,87,0.9)"
                  : "rgba(78,106,87,0.2)",
                border: "1.5px solid rgba(78,106,87,0.5)",
                boxShadow: phase === "captured" || phase === "arrived"
                  ? "0 0 16px rgba(78,106,87,0.6)"
                  : "none",
                transform: phase === "captured" || phase === "arrived" ? "scale(1.15)" : "scale(1)",
              }}
            >
              <ArrowRight
                className="w-4 h-4"
                style={{ color: phase === "captured" || phase === "arrived" ? "#fff" : "#4e6a57" }}
              />
            </div>
          </div>

          {/* ── RIGHT: Mind Palace mock ── */}
          <div className="flex-1 flex justify-center lg:justify-start lg:pl-8">
            <div
              className="w-full max-w-sm rounded-xl overflow-hidden border border-border/60"
              style={{
                boxShadow: "0 24px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
              }}
            >
              {/* App chrome */}
              <div className="bg-muted/60 px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
                    <Leaf className="w-3 h-3 text-primary" />
                  </div>
                  <span
                    className="text-xs font-semibold text-foreground"
                    style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                  >
                    Mind Palace
                  </span>
                </div>
                <span
                  className="text-[9px] text-muted-foreground/50 uppercase tracking-widest"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  highlights
                </span>
              </div>

              {/* Card list */}
              <div className="bg-card px-4 py-4 space-y-3">
                {/* Incoming card — animates in */}
                <div
                  className="rounded-lg p-4 border transition-all duration-700"
                  style={{
                    backgroundColor: PARCHMENT_BG,
                    backgroundImage: PARCHMENT_BG_IMAGE,
                    border: PARCHMENT_BORDER,
                    boxShadow: phase === "arrived"
                      ? `${PARCHMENT_SHADOW}, 0 0 0 2px rgba(78,106,87,0.4)`
                      : PARCHMENT_SHADOW,
                    opacity: phase === "arrived" ? 1 : 0.15,
                    transform: phase === "arrived" ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5"
                      style={{ fontFamily: '"JetBrains Mono", monospace', color: "#5a7a62", borderColor: "rgba(90,122,98,0.35)" }}
                    >
                      just captured
                    </span>
                    {phase === "arrived" && (
                      <span
                        className="text-[9px] text-primary/60 ml-auto"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        McLuhan
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: '"IM Fell English", Georgia, serif',
                      fontStyle: "italic",
                      fontSize: "0.8rem",
                      lineHeight: "1.75",
                      color: "#1a0e06",
                      textShadow: "0.3px 0.3px 0px rgba(26,14,6,0.4)",
                    }}
                  >
                    "the medium influences how the message is perceived by its audience."
                  </p>
                </div>

                {/* Existing cards */}
                {PALACE_CARDS.slice(1).map((card, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3.5 border"
                    style={{
                      backgroundColor: PARCHMENT_BG,
                      backgroundImage: PARCHMENT_BG_IMAGE,
                      border: PARCHMENT_BORDER,
                      boxShadow: PARCHMENT_SHADOW,
                      opacity: 0.6,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5"
                        style={{ fontFamily: '"JetBrains Mono", monospace', color: "#5a7a62", borderColor: "rgba(90,122,98,0.35)" }}
                      >
                        {card.label}
                      </span>
                      <span
                        className="text-[9px] text-primary/50 ml-auto"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {card.source}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: '"IM Fell English", Georgia, serif',
                        fontStyle: "italic",
                        fontSize: "0.75rem",
                        lineHeight: "1.6",
                        color: "#1a0e06",
                      }}
                    >
                      "{card.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes capture-fly {
          0%   { transform: translateX(-8px); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateX(88px); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

function LandingNav() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 md:px-8 py-5">
        {/* Logo */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <Leaf className="w-3.5 h-3.5 text-primary" />
          </div>
          <span
            className="text-foreground font-semibold tracking-tight group-hover:text-primary transition-colors"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Mind Palace
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => navigate("/contact")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-full px-3 h-7 transition-all"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {theme === "light" ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
          {isAuthenticated && (
            <button
              onClick={() => navigate("/settings")}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {isAuthenticated ? (
            <Button size="sm" onClick={() => navigate("/mind-palace")} className="rounded-full px-5 h-8 text-xs">
              Open Mind Palace
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate("/register")} className="rounded-full px-5 h-8 text-xs">
              Create Account
            </Button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <XIcon className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-3">
          <button
            onClick={() => { navigate("/contact"); setMenuOpen(false); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            Contact
          </button>
          <button
            onClick={() => { toggleTheme(); setMenuOpen(false); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === "light" ? "Switch to Dark" : "Switch to Light"}
          </button>
          {isAuthenticated && (
            <button
              onClick={() => { navigate("/settings"); setMenuOpen(false); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          )}
          {isAuthenticated ? (
            <Button size="sm" onClick={() => { navigate("/mind-palace"); setMenuOpen(false); }} className="rounded-full w-full">
              Open Mind Palace
            </Button>
          ) : (
            <Button size="sm" onClick={() => { navigate("/register"); setMenuOpen(false); }} className="rounded-full w-full">
              Create Account
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { text1, text2, done } = useTypingAnimation(1400);
  const rotations = [-2, 1.5, -1];
  const offsets = ["self-start", "self-center", "self-end"];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      {/* Rain spans the entire page — fixed, z-index: -1 so content sits above it */}
      <RainingLettersBackground />
      <div className="noise-overlay" />
      <LandingNav />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">

        {/* Moss glow — sits behind all text */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: 700,
            height: 700,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(78,106,87,0.22) 0%, rgba(78,106,87,0.07) 50%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />

        {/* ① "Mind Palace" — scrambles in once, stays with blinking cursors */}
        <div className="relative z-10 mb-8">
          <ScrambledOnce text="Mind Palace" />
        </div>

        {/* Thin divider */}
        <div className="relative z-10 w-20 h-px bg-primary/25 mb-9" />

        {/* ② Two typing lines — start after Mind Palace scramble finishes */}
        <div className="relative z-10 mb-10 w-full max-w-5xl">
          {/* Line 1: cursor fixed at left, text grows rightward */}
          <div className="flex items-center justify-start gap-2 mb-3">
            <span
              className="w-0.5 h-8 md:h-11 bg-primary shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
            />
            <span
              className="text-2xl md:text-4xl font-bold text-foreground leading-none text-left whitespace-nowrap"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text1}
            </span>
          </div>
          {/* Line 2: cursor fixed at right, text grows leftward */}
          <div className="flex items-center justify-end gap-2">
            <span
              className="text-2xl md:text-4xl font-bold text-foreground leading-none text-right whitespace-nowrap"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text2}
            </span>
            <span
              className="w-0.5 h-8 md:h-11 bg-primary/60 shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite 0.4s" }}
            />
          </div>
        </div>

        {/* ③ Cycling scramble: Capture marginalia / Dig up relics / Ignite sparks */}
        <div
          className="relative z-10 mb-12 transition-opacity duration-700"
          style={{ opacity: done ? 1 : 0 }}
        >
          <ScrambledCycling
            phrases={SUBLINE_PHRASES}
            className="text-xs uppercase tracking-widest text-primary/70"
            holdMs={1900}
          />
        </div>

        {/* CTA */}
        <div className="relative z-10 transition-opacity duration-700" style={{ opacity: done ? 1 : 0 }}>
          {isAuthenticated ? (
            <Button
              size="lg"
              onClick={() => navigate("/mind-palace")}
              className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/20"
            >
              Open Mind Palace <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/20"
            >
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Fade-to-background gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── CAPTURE ANIMATION ── */}
      <CaptureSection />

      {/* ── SPARKS ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        {/* Botanical side decorations */}
        <BotanicalLeft />
        <BotanicalRight />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p
              className="text-xs uppercase tracking-widest text-primary/60 mb-4"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              From curious minds
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Ideas worth keeping.
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Books, AI conversations, posts from the web — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {SPARKS.map((spark, i) => (
              <SparkCard
                key={i}
                spark={spark}
                rotation={rotations[i]}
                offset={offsets[i]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA + SPARKS PREVIEW ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: 900,
            height: 600,
            borderRadius: "9999px",
            background: "radial-gradient(ellipse at center, rgba(78,106,87,0.12) 0%, rgba(78,106,87,0.04) 50%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row items-center gap-16 lg:gap-24">

          {/* ── Left: copy + CTA ── */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs uppercase tracking-widest text-primary mb-5"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              Your archive, alive
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold text-foreground mb-2 leading-tight"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Your daily dose of
            </h2>
            <h2
              className="text-4xl md:text-5xl font-bold text-primary mb-6 leading-tight"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic" }}
            >
              brilliance.
            </h2>
            <p className="text-sm text-muted-foreground mb-10 leading-relaxed max-w-sm">
              Every day, rediscover your own notes, long-forgotten quotes, and interconnected ideas — all waiting inside your Mind Palace.
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  onClick={() => navigate("/mind-palace")}
                  className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/20"
                >
                  Open Mind Palace <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate("/register")}
                    className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/20"
                  >
                    Create Account <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/login")}
                    className="rounded-full px-10 h-12"
                  >
                    Sign In
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Right: macOS-style sparks preview card ── */}
          <div className="flex-1 flex justify-center md:justify-end">
            <div
              className="w-80 rounded-2xl overflow-hidden bg-card border border-border/50"
              style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)" }}
            >
              {/* macOS title bar */}
              <div className="px-4 py-3 flex items-center gap-2 border-b border-border/30 bg-muted/20">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span
                  className="flex-1 text-center text-[11px] text-muted-foreground/60"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  Daily Sparks — Mind Palace
                </span>
              </div>

              {/* Scrolling sparks */}
              <div className="overflow-hidden h-64 px-5 py-4">
                <div style={{ animation: "scroll-up 14s linear infinite" }}>
                  {[...SPARKS_PREVIEW, ...SPARKS_PREVIEW].map((s, i) => (
                    <div key={i} className="py-3.5 border-b border-border/20 last:border-0">
                      <p
                        className="text-[10px] uppercase tracking-widest text-primary/50 mb-1.5"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {s.source ? `from: ${s.source}` : "marginalia note"}
                      </p>
                      <p
                        className="text-xs text-foreground/80 leading-relaxed line-clamp-3 text-left"
                        style={{ fontFamily: '"IM Fell English", Georgia, serif', fontStyle: "italic" }}
                      >
                        {s.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Mind Palace
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">
              Contact
            </button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">
              Sign in
            </button>
            <button onClick={() => navigate("/faq")} className="hover:text-foreground transition-colors">
              FAQ
            </button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">
              Privacy Policy
            </button>
          </div>
          <p
            className="text-xs text-muted-foreground/40"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Your marginalia, forever.
          </p>
        </div>
      </footer>
    </div>
  );
}
