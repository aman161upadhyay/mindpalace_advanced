import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Leaf, ChevronDown } from "lucide-react";

const FAQS: { q: string; a: string | ReactNode }[] = [
  {
    q: "What is Mind Palace?",
    a: "Mind Palace is a personal knowledge tool that lets you save highlighted text from any webpage directly to your private account. Think of it as a digital margin — a place where everything you found worth remembering actually lives.",
  },
  {
    q: "How do I save a highlight?",
    a: (
      <>
        Install the Mind Palace Chrome extension, sign in with your account credentials, then select any text on a webpage and press{" "}
        <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">Ctrl + Shift + S</span>{" "}
        (or right-click and choose <em>Save to Mind Palace</em>). The highlight is saved instantly — no copying, no pasting.
      </>
    ),
  },
  {
    q: "Which browsers are supported?",
    a: "The extension currently runs on Google Chrome (desktop). Support for other Chromium-based browsers (Edge, Brave, Arc) is likely compatible but not officially tested. Firefox and Safari are not currently supported.",
  },
  {
    q: "Is Mind Palace free?",
    a: "Yes, entirely. Mind Palace is a personal project built for a small, trusted group. There are no plans, no subscriptions, and no ads.",
  },
  {
    q: "How do I install the Chrome extension?",
    a: (
      <>
        Search for <em>Mind Palace</em> in the{" "}
        <span className="text-foreground font-medium">Chrome Web Store</span> and click{" "}
        <em>Add to Chrome</em>. Once installed, click the extension icon, enter your API token from the Settings page, and you're ready to start capturing highlights.
      </>
    ),
  },
  {
    q: "What is an API token and where do I find it?",
    a: 'An API token is a secret key that links the Chrome extension to your account. Go to Settings → API Tokens to find yours. You can copy it with one click and paste it into the extension setup screen. Never share this token — anyone who has it can save highlights to your account.',
  },
  {
    q: "Can I use Mind Palace without the extension?",
    a: "The extension is the primary way to capture highlights. Once saved, you can read, search, tag, and organise everything from the Mind Palace dashboard in your browser — no extension needed for that part.",
  },
  {
    q: "How do tags work?",
    a: "Tags let you organise your highlights into categories (e.g. Research, Ideas, Quotes). Create tags from the sidebar in your dashboard, then apply them to any highlight by opening it and selecting the tags you want. You can filter your entire library by tag with one click.",
  },
  {
    q: "Can I search my highlights?",
    a: "Yes. The search bar in your dashboard searches across the text of every highlight, its page title, your notes, and the source domain — all at once. Results update as you type.",
  },
  {
    q: "What are the daily highlights emails?",
    a: "Mind Palace can send you a daily email with a random selection of your saved highlights — a way to resurface things you've forgotten. You can turn this on any time in Settings → Daily Digest. It is off by default.",
  },
  {
    q: "Can I export my highlights?",
    a: "Yes. From your dashboard, click Export in the sidebar. You can download everything as a JSON file (for use with other tools) or as a Markdown file (for use with Obsidian, Notion, and similar apps).",
  },
  {
    q: "How do I add notes to a highlight?",
    a: "Click any highlight card to open it. There's a Notes field where you can write anything — context, reactions, follow-up questions. Notes are saved automatically when you click Save.",
  },
  {
    q: "How do I delete a highlight?",
    a: "Open the highlight by clicking its card, then click Delete Highlight at the bottom left. You'll be asked to confirm before anything is removed.",
  },
  {
    q: "How do I reset my password?",
    a: 'Go to the Sign in page and click Forgot password. You\'ll need to provide both your username and the email address registered to your account. Enter a new password (at least 8 characters) and you\'re done — no email link required.',
  },
  {
    q: "Is my data private?",
    a: "Your highlights are stored in a private PostgreSQL database and are only accessible to you. We do not read, sell, or share your data. Passwords are hashed and never stored in plain text. Sessions use secure, HttpOnly cookies. See the Privacy Policy for full details.",
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        Email us at{" "}
        <a
          href="mailto:aupadhyay@mba2027.hbs.edu"
          className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          aupadhyay@mba2027.hbs.edu
        </a>{" "}
        with your username and we'll permanently delete your account and all associated data within 7 days.
      </>
    ),
  },
  {
    q: "I lost access to my API token. What do I do?",
    a: "Go to Settings → API Tokens. You can create a new token at any time and delete old ones. Just paste the new token into the extension settings screen to reconnect.",
  },
  {
    q: "Something is broken. How do I get help?",
    a: (
      <>
        Reach out via the{" "}
        <a
          href="/contact"
          className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Contact page
        </a>{" "}
        and describe what you're seeing. Include the page or action where the issue occurred and we'll look into it.
      </>
    ),
  },
];

function FAQItem({ q, a }: { q: string; a: string | ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {q}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180 text-primary" : ""
          }`}
        />
      </button>
      {open && (
        <p className="text-sm text-foreground/75 leading-relaxed pb-5 -mt-1">
          {a}
        </p>
      )}
    </div>
  );
}

export default function FAQ() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-border/40 bg-background/80 backdrop-blur-xl">
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
      </nav>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 pt-36 pb-24">
        <p
          className="text-xs uppercase tracking-widest text-primary mb-5"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          Help
        </p>
        <h1
          className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-muted-foreground mb-12 leading-relaxed">
          Everything you need to know about capturing, organising, and revisiting your highlights.
        </p>

        <div>
          {FAQS.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        <div className="mt-16 p-6 rounded-2xl bg-primary/5 border border-primary/20">
          <p
            className="text-sm font-semibold text-foreground mb-1"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Still have a question?
          </p>
          <p className="text-sm text-muted-foreground">
            Use the{" "}
            <button
              onClick={() => navigate("/contact")}
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              contact page
            </button>{" "}
            and we'll get back to you.
          </p>
        </div>
      </main>
    </div>
  );
}
