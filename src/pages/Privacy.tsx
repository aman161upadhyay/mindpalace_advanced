import { useLocation } from "wouter";
import { Leaf } from "lucide-react";

export default function Privacy() {
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
          Legal
        </p>
        <h1
          className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Privacy Policy
        </h1>
        <p
          className="text-xs text-muted-foreground mb-12"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          Last updated: April 27, 2026
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              What Mind Palace is
            </h2>
            <p>
              Mind Palace is a personal knowledge tool that lets you save highlighted text from web pages to your private account. Your highlights are yours — we do not read, sell, or share them with anyone.
            </p>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              What data we collect
            </h2>
            <ul className="space-y-2 list-none">
              {[
                ["Highlighted text", "The text you choose to save from a web page."],
                ["Source URL & page title", "Where the highlight came from."],
                ["Notes & tags", "Any annotations you add inside the app."],
                ["Account info", "Your username and email address, used to log in."],
                ["Usage data", "Basic server logs (timestamps, HTTP status codes) for debugging. No analytics third parties."],
              ].map(([label, desc]) => (
                <li key={label} className="flex gap-3">
                  <span
                    className="text-primary shrink-0 mt-0.5"
                    style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.7rem" }}
                  >
                    ✦
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{label} — </span>
                    {desc}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              How data is stored
            </h2>
            <p>
              All data is stored in a PostgreSQL database hosted on{" "}
              <span className="text-foreground font-medium">Neon</span> and served via{" "}
              <span className="text-foreground font-medium">Vercel</span>. Both providers are based in the United States and maintain their own security certifications. Passwords are hashed with bcrypt and never stored in plain text. Sessions use signed, HttpOnly cookies that cannot be accessed by JavaScript.
            </p>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Who can see your data
            </h2>
            <p>
              Only you. We do not sell, share, or monetise your highlights or personal information. The only exception would be if required by law, in which case we would notify you if legally permitted to do so.
            </p>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              The Chrome extension
            </h2>
            <p>
              The Mind Palace browser extension runs on every page you visit so it can detect text you highlight. It does not record your browsing history, keystrokes, or any content you do not explicitly choose to save. It communicates only with your Mind Palace account server when you trigger a save action.
            </p>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Deleting your data
            </h2>
            <p>
              You can delete individual highlights at any time from the dashboard. To delete your account and all associated data, email us at the address below and we will remove it within 7 days.
            </p>
          </section>

          <div className="h-px bg-border/40" />

          <section>
            <h2
              className="text-base font-semibold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Contact
            </h2>
            <p>
              Questions about this policy? Reach us via the{" "}
              <button
                onClick={() => navigate("/contact")}
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                contact page
              </button>
              .
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Mind Palace
            </span>
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
