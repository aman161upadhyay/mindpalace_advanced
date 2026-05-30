import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Check,
  Copy,
  Highlighter,
  Key,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Plus,
  Send,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Extension ID Detection ──────────────────────────────────────────────────

function useExtensionBridge() {
  const [connected, setConnected] = useState(false);
  const [extSettings, setExtSettings] = useState({ apiToken: "", dashboardUrl: "" });
  const [checking, setChecking] = useState(true);

  const checkExtension = () => {
    setChecking(true);
    const marker = document.documentElement.getAttribute("data-hc-extension");
    if (!marker) {
      setConnected(false);
      setChecking(false);
      return;
    }

    const timeout = setTimeout(() => {
      setConnected(true);
      setChecking(false);
    }, 1200);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      clearTimeout(timeout);
      setConnected(true);
      setExtSettings({
        apiToken: detail.apiToken || "",
        dashboardUrl: detail.dashboardUrl || "",
      });
      setChecking(false);
      document.removeEventListener("HC_SETTINGS_RESPONSE", handler);
    };

    document.addEventListener("HC_SETTINGS_RESPONSE", handler);
    document.dispatchEvent(new CustomEvent("HC_GET_SETTINGS"));
  };

  useEffect(() => {
    const marker = document.documentElement.getAttribute("data-hc-extension");
    setChecking(true);
    if (!marker) {
      setConnected(false);
      setChecking(false);
      return;
    }

    let active = true;
    const t = setTimeout(() => {
      if (active) { setConnected(true); setChecking(false); }
    }, 1200);

    const handler = (e: Event) => {
      if (!active) return;
      const detail = (e as CustomEvent).detail || {};
      clearTimeout(t);
      setConnected(true);
      setExtSettings({ apiToken: detail.apiToken || "", dashboardUrl: detail.dashboardUrl || "" });
      setChecking(false);
      document.removeEventListener("HC_SETTINGS_RESPONSE", handler);
    };

    document.addEventListener("HC_SETTINGS_RESPONSE", handler);
    document.dispatchEvent(new CustomEvent("HC_GET_SETTINGS"));

    return () => {
      active = false;
      clearTimeout(t);
      document.removeEventListener("HC_SETTINGS_RESPONSE", handler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pushSettings = (apiToken: string, dashboardUrl: string) => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1200);
      const handler = (e: Event) => {
        clearTimeout(timeout);
        setExtSettings({ apiToken, dashboardUrl });
        document.removeEventListener("HC_SETTINGS_SAVED", handler);
        resolve(true);
      };
      document.addEventListener("HC_SETTINGS_SAVED", handler);
      document.dispatchEvent(
        new CustomEvent("HC_SAVE_SETTINGS", {
          detail: { apiToken, dashboardUrl },
        })
      );
    });
  };

  return { connected, extSettings, checking, pushSettings, recheckExtension: checkExtension };
}

// ─── Token management hooks ──────────────────────────────────────────────────

function useTokens() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const createToken = async (label: string) => {
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      await fetchTokens();
      toast.success("API token created");
    } else {
      toast.error("Failed to create token");
    }
  };

  const deleteToken = async (id: number) => {
    const res = await fetch(`/api/tokens/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      await fetchTokens();
      toast.success("Token deleted");
    }
  };

  return { tokens, loading, createToken, deleteToken, refetch: fetchTokens };
}

export default function Settings() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const { tokens, loading: tokensLoading, createToken, deleteToken } = useTokens();
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [dailyEmail, setDailyEmail] = useState(true);
  const [dailyEmailSaving, setDailyEmailSaving] = useState(false);

  // Sync dailyEmail state from user data
  useEffect(() => {
    if (user && 'dailyEmailEnabled' in user) {
      setDailyEmail((user as any).dailyEmailEnabled ?? true);
    }
  }, [user]);

  const toggleDailyEmail = async () => {
    const newValue = !dailyEmail;
    setDailyEmail(newValue);
    setDailyEmailSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dailyEmailEnabled: newValue }),
      });
      if (res.ok) {
        toast.success(newValue ? "Daily highlights email enabled" : "Daily highlights email disabled");
      } else {
        setDailyEmail(!newValue); // revert
        toast.error("Failed to update preference");
      }
    } catch {
      setDailyEmail(!newValue); // revert
      toast.error("Network error");
    } finally {
      setDailyEmailSaving(false);
    }
  };

  const copyToken = (token: string, id: number) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    toast.success("Token copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateToken = async () => {
    setCreating(true);
    await createToken("Chrome Extension");
    setCreating(false);
  };

  const dashboardUrl = window.location.origin;

  // Extension bridge
  const { connected, extSettings, checking, pushSettings, recheckExtension } =
    useExtensionBridge();
  const [extToken, setExtToken] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (extSettings.apiToken) setExtToken(extSettings.apiToken);
    if (extSettings.dashboardUrl) setExtUrl(extSettings.dashboardUrl);
  }, [extSettings]);

  useEffect(() => {
    if (connected && !extUrl) {
      setExtUrl(dashboardUrl);
    }
  }, [connected, dashboardUrl, extUrl]);

  const handlePushSettings = async () => {
    if (!extToken.trim()) {
      toast.error("Please enter an API token");
      return;
    }
    setPushing(true);
    const ok = await pushSettings(extToken, extUrl || dashboardUrl);
    setPushing(false);
    if (ok) {
      toast.success("Extension configured successfully!");
    } else {
      toast.error(
        "Could not reach the extension. Make sure it's installed and refresh the page."
      );
    }
  };

  const handleQuickConfigure = async (token: string) => {
    setExtToken(token);
    setExtUrl(dashboardUrl);
    setPushing(true);
    const ok = await pushSettings(token, dashboardUrl);
    setPushing(false);
    if (ok) {
      toast.success("Extension auto-configured! You're all set.");
    } else {
      toast.error("Extension not detected. Install it and refresh this page.");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Highlighter className="w-10 h-10 text-primary" />
        <h2 className="text-xl font-semibold">Sign in to access settings</h2>
        <Button onClick={() => navigate("/login")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/mind-palace")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Settings</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        {/* Account */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {user?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1">
                <p className="font-medium">{user?.username ?? "User"}</p>
                <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign out
              </Button>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Theme</h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-primary" />
                )}
                <div>
                  <p className="font-medium">
                    {theme === "dark" ? "Dark" : "Light"} theme
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {theme === "dark" ? "Obsidian + Cream" : "Parchment + Warm Brown"}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="relative w-14 h-7 rounded-full bg-secondary border border-border transition-colors shrink-0"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-primary transition-transform ${
                    theme === "light" ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Daily Email Highlights */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Daily Highlights Email</h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {dailyEmail ? "Enabled" : "Disabled"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive 5 random highlights in your inbox every morning
                  </p>
                </div>
              </div>
              <button
                onClick={toggleDailyEmail}
                disabled={dailyEmailSaving}
                className={`relative w-14 h-7 rounded-full border border-border transition-colors shrink-0 ${
                  dailyEmail ? "bg-primary/20" : "bg-secondary"
                } ${dailyEmailSaving ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-primary transition-transform ${
                    dailyEmail ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* API Tokens */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">API Tokens</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Use these tokens to authenticate the Chrome extension with your account.
              </p>
            </div>
            <Button size="sm" onClick={handleCreateToken} disabled={creating}>
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              New Token
            </Button>
          </div>

          <div className="space-y-3">
            {tokensLoading ? (
              <>
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </>
            ) : tokens.length === 0 ? (
              <div className="p-6 rounded-xl bg-card border border-border text-center">
                <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No API tokens yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a token to connect the Chrome extension.
                </p>
              </div>
            ) : (
              tokens.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-card border border-border flex items-center gap-3"
                >
                  <Key className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.label ?? "Chrome Extension"}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                      {t.token.slice(0, 10)}•••••••••••••{t.token.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                      onClick={() => copyToken(t.token, t.id)}
                      title="Copy token"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {connected && (
                      <button
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-primary/20 transition-colors"
                        onClick={() => handleQuickConfigure(t.token)}
                        title="Send to extension"
                      >
                        <Send className="w-4 h-4 text-primary" />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-destructive/15 transition-colors"
                      onClick={() => deleteToken(t.id)}
                      title="Delete token"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Configure Extension from Website */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Configure Extension
          </h2>
          <div className="p-5 rounded-xl bg-card border border-border space-y-5">
            {/* Connection status */}
            <div className="flex items-center gap-3">
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Detecting extension...</span>
                </>
              ) : connected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-400">
                    Extension detected -- configure it right here.
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-400">
                    Extension not detected.{" "}
                    <button
                      onClick={recheckExtension}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Retry
                    </button>
                  </span>
                </>
              )}
            </div>

            {connected ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    API Token
                  </label>
                  <Input
                    value={extToken}
                    onChange={(e) => setExtToken(e.target.value)}
                    placeholder="hc_..."
                    className="font-mono text-xs"
                  />
                  {tokens.length > 0 && !extToken && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Or click the <Send className="inline w-3 h-3" /> icon next to a token above
                      to auto-fill.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Dashboard URL
                  </label>
                  <Input
                    value={extUrl}
                    onChange={(e) => setExtUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="font-mono text-xs"
                  />
                </div>
                <Button onClick={handlePushSettings} disabled={pushing}>
                  {pushing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {pushing ? "Saving..." : "Push Settings to Extension"}
                </Button>
                {extSettings.apiToken && (
                  <div className="text-xs text-muted-foreground p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <Check className="inline w-3 h-3 text-green-500 mr-1" />
                    Extension is currently configured with token{" "}
                    <code className="font-mono text-green-400">
                      {extSettings.apiToken.slice(0, 16)}...
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Install the extension, then refresh this page. Once detected, you can configure
                  it without ever opening the popup!
                </p>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-medium">Load the extension</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Open{" "}
                        <code className="font-mono text-xs bg-secondary/50 px-1 rounded">
                          chrome://extensions
                        </code>
                        , enable Developer mode, click "Load unpacked", and select the extension
                        folder.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-medium">Refresh this page</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        The extension's content script needs to load on this page so we can
                        communicate with it.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-medium">Configure from here</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Once detected, you'll see fields to set the API token and URL -- no popup
                        needed!
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </section>

        {/* Keyboard shortcut info */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Keyboard Shortcut</h2>
          <div className="p-5 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Once the extension is installed, select any text on any webpage and press:
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  Ctrl
                </kbd>
                <span className="text-muted-foreground">+</span>
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  Shift
                </kbd>
                <span className="text-muted-foreground">+</span>
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  S
                </kbd>
              </div>
              <span className="text-muted-foreground text-xs">or</span>
              <div className="flex items-center gap-2">
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  ⌘
                </kbd>
                <span className="text-muted-foreground">+</span>
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  Shift
                </kbd>
                <span className="text-muted-foreground">+</span>
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                  S
                </kbd>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              A confirmation tooltip will appear briefly to confirm the save. The highlight will
              appear in your mind palace immediately.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
