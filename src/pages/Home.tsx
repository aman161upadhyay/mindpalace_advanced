import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BookOpen, Highlighter, Search, Tag, Download, Monitor, ArrowRight, Zap, Shield } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Navigate in useEffect to avoid calling setState during render
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/mind-palace");
    }
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      <div className="noise-overlay"></div>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Highlighter className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Mind Palace</span>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : isAuthenticated ? (
            <Button onClick={() => navigate("/mind-palace")} size="sm">
              Open Mind Palace <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate("/login")}>
              Sign in
            </Button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-2/3 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            Chrome Extension + Web Dashboard
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]" style={{ fontFamily: '"Instrument Serif", serif', fontStyle: 'italic' }}>
            Your personal{" "}
            <span className="gradient-text not-italic font-sans">knowledge base</span>
            {" "}starts with a highlight
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Capture any text from any webpage with a single shortcut. Build a searchable Mind Palace of everything that matters to you — from research papers to Gemini answers.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticated ? (
              <Button size="lg" onClick={() => navigate("/mind-palace")} className="gap-2 magnetic-btn">
                Open My Mind Palace <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="lg" className="gap-2 magnetic-btn" onClick={() => navigate("/login")}>
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            <Button size="lg" variant="outline" asChild className="gap-2 magnetic-btn">
              <a href="#features">See Features</a>
            </Button>
          </div>

          {/* Shortcut badge */}
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Press</span>
            <kbd className="px-2 py-0.5 rounded bg-secondary border border-border text-xs font-mono">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-2 py-0.5 rounded bg-secondary border border-border text-xs font-mono">Shift</kbd>
            <span>+</span>
            <kbd className="px-2 py-0.5 rounded bg-secondary border border-border text-xs font-mono">S</kbd>
            <span>to save any highlighted text</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to capture knowledge</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A complete system for saving, organizing, and revisiting the ideas that matter most.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Monitor,
                title: "Chrome Extension (MV3)",
                desc: "Select text anywhere, press Ctrl+Shift+S. A confirmation tooltip confirms the save instantly.",
              },
              {
                icon: Search,
                title: "Full-text Search",
                desc: "Search across all your highlights, notes, page titles, and domains in real time.",
              },
              {
                icon: Tag,
                title: "Custom Tags",
                desc: "Organize highlights with color-coded tags. Filter your Mind Palace by any tag combination.",
              },
              {
                icon: BookOpen,
                title: "Source Tracking",
                desc: "Every highlight stores the URL, page title, and domain so you can always return to the original context.",
              },
              {
                icon: Shield,
                title: "Private & Authenticated",
                desc: "Your knowledge base is private and synced across devices via secure authentication.",
              },
              {
                icon: Download,
                title: "Export to JSON or Markdown",
                desc: "Download your entire Mind Palace at any time in structured JSON or readable Markdown format.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-5 rounded-3xl glass-panel border border-border hover:border-primary/40 transition-all hover:bg-card/50 group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Start building your Mind Palace</h2>
          <p className="text-muted-foreground mb-8">Sign in to get your API key, install the extension, and start capturing knowledge from anywhere on the web.</p>
          {isAuthenticated ? (
            <Button size="lg" onClick={() => navigate("/mind-palace")}>
              Open My Mind Palace <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate("/login")}>
              Sign in to get started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Highlighter className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Mind Palace</span>
        </div>
        <p>Your personal knowledge capture tool</p>
      </footer>
    </div>
  );
}
