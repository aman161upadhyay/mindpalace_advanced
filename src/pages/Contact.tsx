import { useLocation } from "wouter";
import { ArrowLeft, Mail, ExternalLink, MessageCircle } from "lucide-react";

export default function Contact() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="noise-overlay" />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Mind Palace
        </button>
      </nav>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Glow — positioned relative to this section */}
        <div className="landing-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />

        <div className="w-full max-w-sm relative z-10">

          {/* Card */}
          <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-8 shadow-xl">

            {/* Label */}
            <p
              className="text-xs uppercase tracking-widest text-primary mb-6"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              Builder · Founder · Thinker
            </p>

            {/* Name */}
            <h1
              className="text-3xl font-bold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Aman Upadhyay
            </h1>

            {/* Bio */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-1">
              AI builder at the intersection of Business and Technology.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              SME in ML/AI and Data Science. 2x Founder. MBA Candidate 2027, Harvard Business School.
            </p>

            {/* Divider */}
            <div className="w-8 h-px bg-primary/40 mb-8" />

            {/* Links */}
            <div className="flex flex-col gap-4">
              <a
                href="mailto:aupadhyay@mba2027.hbs.edu"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                aupadhyay@mba2027.hbs.edu
              </a>

              <a
                href="https://www.linkedin.com/in/amanupadhyay/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
                linkedin.com/in/amanupadhyay
              </a>

              <a
                href="https://wa.me/13128267339"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                WhatsApp · +1 312 826 7339
              </a>
            </div>
          </div>

          {/* Footer line */}
          <p
            className="text-center text-xs text-muted-foreground/50 mt-8"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Mind Palace · Your marginalia, forever.
          </p>
        </div>
      </main>
    </div>
  );
}
