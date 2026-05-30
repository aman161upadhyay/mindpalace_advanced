import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { parseTagIds } from "@/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  Highlighter,
  Loader2,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Safe JSON helpers ────────────────────────────────────────────────────────

function safeParseTags(val: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(val || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({
  tag,
  selected,
  onClick,
  onRemove,
}: {
  tag: { id: number; name: string; color: string };
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all select-none ${
        selected ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-80 hover:opacity-100"
      }`}
      style={{
        backgroundColor: tag.color + "22",
        color: tag.color,
        borderColor: tag.color + "44",
        border: "1px solid",
      }}
      onClick={onClick}
    >
      {tag.name}
      {onRemove && (
        <X
          className="w-2.5 h-2.5 hover:opacity-70"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </span>
  );
}

// ─── Highlight Card ───────────────────────────────────────────────────────────

function HighlightCard({
  highlight,
  tags,
  onClick,
  onUpdated,
}: {
  highlight: {
    id: number;
    text: string;
    sourceUrl: string;
    pageTitle: string;
    domain: string;
    notes: string | null;
    tagIds: string;
    metadataTags?: string;
    createdAt: Date;
  };
  tags: { id: number; name: string; color: string }[];
  onClick: () => void;
  onUpdated: () => void;
}) {
  const tagIds = parseTagIds(highlight.tagIds);
  const highlightTags = tags.filter((t) => tagIds.includes(t.id));
  const preview = highlight.text.length > 280 ? highlight.text.slice(0, 280) + "\u2026" : highlight.text;

  return (
    <div
      className="group p-5 rounded-3xl glass-panel hover:bg-card border border-border hover:border-primary/40 cursor-pointer transition-all hover:shadow-2xl hover:shadow-primary/10 relative overflow-hidden"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

      {/* Quote text */}
      <blockquote className="highlight-text text-foreground/90 text-[15px] mb-5 leading-relaxed line-clamp-4 relative z-10">
        &ldquo;{preview}&rdquo;
      </blockquote>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4 relative z-10">
        {highlightTags.map((t) => (
          <TagChip
            key={t.id}
            tag={t}
            onRemove={() => {
              const updatedTagIds = highlightTags
                .filter((tag) => tag.id !== t.id)
                .map((tag) => tag.id);
              fetch(`/api/highlights?id=${highlight.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ tagIds: updatedTagIds }),
              }).then(() => onUpdated());
            }}
          />
        ))}
        {highlight.metadataTags && safeParseTags(highlight.metadataTags).map((mt: string) => (
          <span key={mt} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
            {mt}
          </span>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground/70 relative z-10 font-mono uppercase tracking-wider">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Globe className="w-3 h-3 shrink-0" />
          <span className="truncate">{highlight.domain || (() => { try { return new URL(highlight.sourceUrl).hostname; } catch { return highlight.sourceUrl; } })()}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Calendar className="w-3 h-3" />
          <span>{new Date(highlight.createdAt).toLocaleDateString()}</span>
        </div>
        {highlight.notes && (
          <div className="shrink-0 text-primary/60 text-xs">has note</div>
        )}
      </div>
    </div>
  );
}

// ─── Highlight Detail Modal ───────────────────────────────────────────────────

function HighlightDetailModal({
  highlightId,
  tags,
  onClose,
  onUpdated,
  onDeleted,
  onTagCreated,
}: {
  highlightId: number;
  tags: { id: number; name: string; color: string }[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onTagCreated: () => void;
}) {
  const [highlight, setHighlight] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [notes, setNotes] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/highlights?id=${highlightId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setHighlight(data);
        }
      } catch (err) {
        console.error("Failed to load highlight:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [highlightId]);

  if (highlight && !initialized) {
    setNotes(highlight.notes ?? "");
    setText(highlight.text ?? "");
    setSelectedTagIds(parseTagIds(highlight.tagIds));
    setInitialized(true);
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/highlights?id=${highlightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: text || undefined, notes: notes || null, tagIds: selectedTagIds }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setIsEditingText(false);
      onUpdated();
      toast.success("Highlight updated");
    } catch (err) {
      toast.error("Failed to update highlight");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/highlights?id=${highlightId}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    onDeleted();
    toast.success("Highlight deleted");
    onClose();
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newTagName.trim(), color }),
    });
    if (res.ok) {
      const newTag = await res.json();
      onTagCreated();
      
      const updatedTagIds = [...selectedTagIds, newTag.id];
      setSelectedTagIds(updatedTagIds);
      setNewTagName("");
      
      // Auto-save the highlight to attach the tag immediately
      await fetch(`/api/highlights?id=${highlightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tagIds: updatedTagIds }),
      });
      onUpdated();
      
      toast.success("Tag created & attached");
    } else {
      toast.error("Failed to create tag");
    }
    setCreatingTag(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 bg-card border-border shadow-2xl shadow-primary/5 rounded-3xl">
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2 font-serif italic text-2xl">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Highlighter className="w-4 h-4 text-primary" />
            </div>
            Review Highlight
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : highlight ? (
            <>
              {/* Highlight text */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest">
                    Captured Text
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs rounded-full bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setIsEditingText(!isEditingText)}
                  >
                    {isEditingText ? "Cancel Edit" : "Edit Highlight"}
                  </Button>
                </div>
                
                {isEditingText ? (
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[200px] bg-secondary/30 border-border focus:border-primary/50 text-[15px] leading-relaxed resize-y p-5 rounded-2xl shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
                  />
                ) : (
                  <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 shadow-sm relative group max-h-[40vh] overflow-y-auto custom-scrollbar">
                    <blockquote className="highlight-text text-foreground/90 text-lg md:text-xl">
                      &ldquo;{text}&rdquo;
                    </blockquote>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Meta details */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Source</p>
                    <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                      <Globe className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{highlight.pageTitle || highlight.domain}</p>
                        <a
                          href={highlight.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 mt-1"
                        >
                          <span className="truncate max-w-[200px] inline-block">{highlight.sourceUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Date</p>
                    <div className="flex items-center gap-2 text-sm text-foreground p-3 rounded-xl bg-secondary/30 border border-border/50 w-fit">
                      <Calendar className="w-4 h-4 text-primary" />
                      {new Date(highlight.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Notes & Tags */}
                <div className="space-y-6 flex flex-col h-full">
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Personal Notes</p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add your thoughts, context, or connections..."
                      className="h-[120px] bg-secondary/30 border-border focus:border-primary/50 resize-none text-sm p-4 rounded-2xl shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tags</p>
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-secondary/30 border border-border/50 min-h-[60px]">
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <TagChip
                            key={t.id}
                            tag={t}
                            selected={selectedTagIds.includes(t.id)}
                            onClick={() => toggleTag(t.id)}
                          />
                        ))}
                        {tags.length === 0 && (
                          <p className="text-xs text-muted-foreground self-center">No tags yet.</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                          placeholder="Type a new tag & press Enter..."
                          className="h-8 text-xs bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                          disabled={creatingTag}
                        />
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 px-3 text-xs"
                          onClick={handleCreateTag}
                          disabled={!newTagName.trim() || creatingTag}
                        >
                          {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {highlight.metadataTags && safeParseTags(highlight.metadataTags).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Auto Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {safeParseTags(highlight.metadataTags).map((mt: string) => (
                          <span key={mt} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest shadow-sm">
                            {mt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Actions Footer */}
        <div className="px-8 py-5 border-t border-border/50 bg-secondary/10 shrink-0 flex items-center justify-between">
          <Button
            variant="ghost"
            size="default"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full px-6"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting || isLoading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Highlight
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="default"
              className="rounded-full px-6 bg-background"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </Button>
            <Button
              size="default"
              className="rounded-full px-8 shadow-lg shadow-primary/20 magnetic-btn"
              onClick={handleSave}
              disabled={saving || isLoading}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Details
            </Button>
          </div>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete highlight?"
        description="This cannot be undone. The highlight will be permanently removed from your Mind Palace."
        confirmLabel="Delete"
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Dialog>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<"json" | "markdown">("json");
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/highlights?action=export&format=${format}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([data.content], {
        type: format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${data.filename}`);
    }
    setIsLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="w-4 h-4 text-primary" />
            Export Mind Palace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download your entire highlight collection in your preferred format.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["json", "markdown"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  format === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/30"
                }`}
              >
                {f === "json" ? "JSON" : "Markdown"}
                <p className="text-xs font-normal mt-0.5 opacity-70">
                  {f === "json" ? "Structured data" : "Readable format"}
                </p>
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={handleExport} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download {format === "json" ? "JSON" : "Markdown"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Tag Modal ────────────────────────────────────────────────────────────

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function NewTagModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name) return;
    setCreating(true);
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, color }),
    });
    setCreating(false);
    onCreated();
    toast.success("Tag created");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Tag className="w-4 h-4 text-primary" />
            New Tag
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Tag name\u2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary/50"
            onKeyDown={(e) => e.key === "Enter" && name && handleCreate()}
          />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Color</p>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name || creating}
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Create Tag
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Mind Palace Page ─────────────────────────────────────────────────────

export default function MindPalace() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedMetadataTags, setSelectedMetadataTags] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [selectedHighlightId, setSelectedHighlightId] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [offset, setOffset] = useState(0);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<{ id: number; name: string } | null>(null);
  const LIMIT = 30;

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setOffset(0);
    }, 300);
  }, []);

  // ─── Data fetching (fetch-based) ────────────────────────────────────────────

  const [highlightsData, setHighlightsData] = useState<{ items: any[]; total: number } | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(true);

  const fetchHighlights = useCallback(async () => {
    setHighlightsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTagIds.length) params.set("tagIds", selectedTagIds.join(","));
      if (selectedMetadataTags.length) params.set("metadataTag", selectedMetadataTags.join(","));
      if (selectedDomain) params.set("domain", selectedDomain);
      params.set("page", String(Math.floor(offset / LIMIT) + 1));
      const res = await fetch(`/api/highlights?${params}`, { credentials: "include" });
      if (res.ok) setHighlightsData(await res.json());
    } catch {
      // ignore network errors, loading state will clear
    } finally {
      setHighlightsLoading(false);
    }
  }, [debouncedSearch, selectedTagIds, selectedMetadataTags, selectedDomain, offset]);

  useEffect(() => { fetchHighlights(); }, [fetchHighlights]);

  const [tags, setTags] = useState<any[]>([]);
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags", { credentials: "include" });
      if (res.ok) setTags(await res.json());
    } catch {
      // ignore network errors
    }
  }, []);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  const [domainStats, setDomainStats] = useState<any[]>([]);
  const fetchDomainStats = useCallback(async () => {
    try {
      const res = await fetch("/api/highlights?action=stats", { credentials: "include" });
      if (res.ok) setDomainStats(await res.json());
    } catch {
      // ignore network errors
    }
  }, []);
  useEffect(() => { fetchDomainStats(); }, [fetchDomainStats]);

  const [allMetadataTags, setAllMetadataTags] = useState<string[]>([]);
  const fetchMetadataTags = useCallback(async () => {
    try {
      const res = await fetch("/api/highlights?action=metadata-tags", { credentials: "include" });
      if (res.ok) setAllMetadataTags(await res.json());
    } catch {
      // ignore network errors
    }
  }, []);
  useEffect(() => { fetchMetadataTags(); }, [fetchMetadataTags]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handleDeleteTag = (id: number, name: string) => {
    setConfirmDeleteTag({ id, name });
  };

  const confirmHandleDeleteTag = async () => {
    if (!confirmDeleteTag) return;
    const { id, name } = confirmDeleteTag;
    setConfirmDeleteTag(null);
    await fetch(`/api/tags/${id}`, { method: "DELETE", credentials: "include" });
    fetchTags();
    setSelectedTagIds((prev) => prev.filter((tid) => tid !== id));
    toast.success(`Tag "${name}" deleted`);
  };

  const highlights = highlightsData?.items ?? [];
  const total = highlightsData?.total ?? 0;

  // Derive "Best Highlights" - sorting highlights with notes or tags on top
  const sortedHighlights = useMemo(() => {
    return [...highlights].sort((a, b) => {
      const aScore = (a.notes ? 2 : 0) + (parseTagIds(a.tagIds).length > 0 ? 1 : 0) + (a.text.length > 300 ? 1 : 0);
      const bScore = (b.notes ? 2 : 0) + (parseTagIds(b.tagIds).length > 0 ? 1 : 0) + (b.text.length > 300 ? 1 : 0);
      return bScore - aScore;
    });
  }, [highlights]);

  // Group highlights by domain for display
  const grouped = useMemo(() => {
    if (selectedDomain || debouncedSearch || selectedTagIds.length || selectedMetadataTags.length) return null; // flat list when filtering
    const map: Record<string, typeof highlights> = {};
    for (const h of sortedHighlights) {
      const key = h.domain || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(h);
    }
    return map;
  }, [highlights, selectedDomain, debouncedSearch, selectedTagIds, selectedMetadataTags]);

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
        <h2 className="text-xl font-semibold">Sign in to access your mind palace</h2>
        <Button onClick={() => navigate("/login")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`shrink-0 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-64" : "w-0 border-r-0"}`}>
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate("/")}>
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Highlighter className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight group-hover:text-primary transition-colors">Mind Palace</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1">
          <button
            onClick={() => { setSelectedTagIds([]); setSelectedMetadataTags([]); setSelectedDomain(undefined); setSearch(""); setDebouncedSearch(""); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
          >
            <BookOpen className="w-4 h-4" />
            All Highlights
            <span className="ml-auto text-xs text-muted-foreground">{total}</span>
          </button>
        </nav>

        {/* Domains */}
        {domainStats.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">Sources</p>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {domainStats.map((d) => (
                <button
                  key={d.domain}
                  onClick={() => setSelectedDomain(selectedDomain === d.domain ? undefined : d.domain)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedDomain === d.domain
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-sidebar-accent text-sidebar-foreground"
                  }`}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1 text-left">{d.domain || "Unknown"}</span>
                  <span className="text-muted-foreground">{d.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="px-3 py-2 flex-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</p>
            <button
              onClick={() => setShowNewTag(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {tags.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  selectedTagIds.includes(t.id)
                    ? "bg-primary/10"
                    : "hover:bg-sidebar-accent"
                }`}
                onClick={() => setSelectedTagIds((prev) =>
                  prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                )}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span
                  className="flex-1 truncate"
                  style={{ color: selectedTagIds.includes(t.id) ? t.color : undefined }}
                >
                  {t.name}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(t.id, t.name);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-1">No tags yet</p>
            )}
          </div>
        </div>

        {/* Auto Topics */}
        {allMetadataTags.length > 0 && (
          <div className="px-3 py-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">Topics</p>
            <div className="flex flex-wrap gap-1.5 px-3">
              {allMetadataTags.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setSelectedMetadataTags((prev) =>
                    prev.includes(mt) ? prev.filter((t) => t !== mt) : [...prev, mt]
                  )}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                    selectedMetadataTags.includes(mt)
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search your highlights…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-secondary/50 border-border focus:border-primary/50"
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => handleSearchChange("")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active filters */}
          {(selectedTagIds.length > 0 || selectedMetadataTags.length > 0 || selectedDomain) && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground shrink-0">Filtering by:</span>
              {selectedTagIds.map((id) => {
                const tag = tags.find((t) => t.id === id);
                if (!tag) return null;
                return (
                  <TagChip
                    key={id}
                    tag={tag}
                    onRemove={() => setSelectedTagIds((prev) => prev.filter((tid) => tid !== id))}
                  />
                );
              })}
              {selectedMetadataTags.map((mt) => (
                <span key={mt} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {mt}
                  <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => setSelectedMetadataTags((prev) => prev.filter((t) => t !== mt))} />
                </span>
              ))}
              {selectedDomain && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary border border-border text-foreground">
                  <Globe className="w-3 h-3" />
                  {selectedDomain}
                  <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => setSelectedDomain(undefined)} />
                </span>
              )}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
          <div className="w-full max-w-3xl">
            {highlightsLoading ? (
              <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-5 rounded-xl bg-card border border-border space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-1/3 mt-2" />
                </div>
              ))}
            </div>
          ) : highlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Highlighter className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {debouncedSearch || selectedTagIds.length || selectedMetadataTags.length || selectedDomain
                  ? "No highlights match your filters"
                  : "Your mind palace is empty"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {debouncedSearch || selectedTagIds.length || selectedMetadataTags.length || selectedDomain
                  ? "Try adjusting your search or removing filters."
                  : "Install the Chrome extension, select text on any webpage, and press Ctrl+Shift+S to start capturing knowledge."}
              </p>
            </div>
          ) : grouped ? (
            // Grouped by domain
            <div className="space-y-8">
              {Object.entries(grouped).map(([domain, items]) => (
                <div key={domain}>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {domain}
                    </h2>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {items.map((h) => (
                      <HighlightCard
                        key={h.id}
                        highlight={h}
                        tags={tags}
                        onClick={() => setSelectedHighlightId(h.id)}
                        onUpdated={() => fetchHighlights()}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat list (when filtering)
            <div className="flex flex-col gap-4">
              {sortedHighlights.map((h) => (
                <HighlightCard
                  key={h.id}
                  highlight={h}
                  tags={tags}
                  onClick={() => setSelectedHighlightId(h.id)}
                  onUpdated={() => fetchHighlights()}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}&ndash;{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
              </Button>
            </div>
          )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {selectedHighlightId !== null && (
        <HighlightDetailModal
          highlightId={selectedHighlightId}
          tags={tags}
          onClose={() => setSelectedHighlightId(null)}
          onUpdated={() => fetchHighlights()}
          onDeleted={() => fetchHighlights()}
          onTagCreated={() => fetchTags()}
        />
      )}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showNewTag && <NewTagModal onClose={() => setShowNewTag(false)} onCreated={() => fetchTags()} />}
      <ConfirmDialog
        open={confirmDeleteTag !== null}
        title={`Delete "${confirmDeleteTag?.name}"?`}
        description="This tag will be removed from all highlights. This cannot be undone."
        confirmLabel="Delete Tag"
        onConfirm={confirmHandleDeleteTag}
        onCancel={() => setConfirmDeleteTag(null)}
      />
    </div>
  );
}
