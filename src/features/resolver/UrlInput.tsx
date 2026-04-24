import { useEffect, useState, type FormEvent } from "react";
import {
  Link2,
  ClipboardPaste,
  Sparkles,
  Loader2,
  ListPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { detectSource } from "@/lib/detect-source";
import type { ResolvedItem } from "@/lib/types";

interface UrlInputProps {
  onResolved: (item: ResolvedItem) => void;
  onOpenBatch: () => void;
  prefillUrl?: string;
}

export function UrlInput({ onResolved, onOpenBatch, prefillUrl }: UrlInputProps) {
  const [url, setUrl] = useState(prefillUrl ?? "");

  useEffect(() => {
    if (prefillUrl && prefillUrl !== url) {
      setUrl(prefillUrl);
    }
  }, [prefillUrl]);

  const [loading, setLoading] = useState(false);
  const detected = url.trim() ? detectSource(url) : null;
  const ready = !!detected && detected.source !== "unknown";

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      toast.error("Couldn't read clipboard");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) {
      toast.error("Unrecognized URL", {
        description: "Paste a Spotify, SoundCloud, or YouTube link.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ResolvedItem;
      onResolved(data);
    } catch (err) {
      toast.error("Couldn't resolve URL", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      className="group relative flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2 shadow-lg shadow-black/5 backdrop-blur-md transition-colors focus-within:border-ring"
    >
      <Link2 className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://open.spotify.com/playlist/…  or  https://soundcloud.com/…"
        className="h-11 flex-1 border-0 bg-transparent !text-base shadow-none focus-visible:ring-0"
        autoFocus
        disabled={loading}
      />
      <AnimatePresence>
        {ready && !loading && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium capitalize text-accent-foreground"
          >
            {detected.source} · {detected.kind}
          </motion.span>
        )}
      </AnimatePresence>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handlePaste}
        disabled={loading}
        title="Paste from clipboard"
      >
        <ClipboardPaste className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenBatch}
        disabled={loading}
        title="Batch download multiple URLs"
      >
        <ListPlus className="h-4 w-4" />
      </Button>
      <Button type="submit" size="sm" className="h-9" disabled={!ready || loading}>
        {loading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1 h-4 w-4" />
        )}
        {loading ? "Resolving…" : "Resolve"}
      </Button>
    </motion.form>
  );
}
