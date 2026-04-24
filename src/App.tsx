import { useState } from "react";
import { Headphones, Download, Library } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { UrlInput } from "@/features/resolver/UrlInput";
import { EmptyState } from "@/features/resolver/EmptyState";
import { PreviewCard } from "@/features/resolver/PreviewCard";
import { BatchDialog } from "@/features/resolver/BatchDialog";
import { useClipboardMonitor } from "@/features/resolver/useClipboardMonitor";
import { LibraryView } from "@/features/library/LibraryView";
import { AuthMenu } from "@/features/auth/AuthMenu";
import { PlayerProvider } from "@/features/player/PlayerProvider";
import { Player } from "@/features/player/Player";
import { ShortcutsDialog } from "@/features/shortcuts/ShortcutsDialog";
import { LegalNoticeLink } from "@/features/legal/LegalNotice";
import { cn } from "@/lib/utils";
import { detectSource } from "@/lib/detect-source";
import type { ResolvedItem } from "@/lib/types";

type View = "download" | "library";

export default function App() {
  const [view, setView] = useState<View>("download");
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [prefillUrl, setPrefillUrl] = useState<string | undefined>(undefined);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchUrls, setBatchUrls] = useState<string[] | undefined>(undefined);

  useClipboardMonitor({
    onSingleUrl: (url) => {
      const detected = detectSource(url);
      toast.info(`${detected.source} ${detected.kind} detected`, {
        description: "Click Use to paste into the input.",
        action: {
          label: "Use",
          onClick: () => {
            setPrefillUrl(url);
            setView("download");
          },
        },
      });
    },
    onManyUrls: (urls) => {
      toast.info(`${urls.length} URLs detected`, {
        action: {
          label: "Open batch",
          onClick: () => {
            setBatchUrls(urls);
            setBatchOpen(true);
            setView("download");
          },
        },
      });
    },
  });


  return (
    <PlayerProvider>
      <TooltipProvider>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/60 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Universal Downloader</span>
          </div>

          <nav className="flex items-center gap-1 rounded-lg border border-border/40 bg-card/40 p-1 backdrop-blur-sm">
            <NavTab
              active={view === "download"}
              onClick={() => setView("download")}
              icon={<Download className="h-4 w-4" />}
              label="Download"
            />
            <NavTab
              active={view === "library"}
              onClick={() => setView("library")}
              icon={<Library className="h-4 w-4" />}
              label="Library"
            />
          </nav>

          <div className="flex items-center gap-3">
            <AuthMenu />
            <LegalNoticeLink
              className="hidden sm:inline"
              label="Legal"
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              v0.1.0
            </span>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto px-6",
            view === "download"
              ? "flex max-w-3xl flex-col gap-10 pt-20 pb-16"
              : "max-w-7xl pt-10 pb-16",
          )}
        >
          <AnimatePresence mode="wait">
            {view === "download" ? (
              <motion.div
                key="download"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-10"
              >
                <div className="space-y-3 text-center">
                  <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                    Download anything.
                  </h1>
                  <p className="text-muted-foreground">
                    Paste a Spotify or SoundCloud link — track, album, or
                    playlist — and we handle the rest.
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Personal use only. You're responsible for the ToS of the
                    source service and copyright law in your country.{" "}
                    <LegalNoticeLink label="Read the full notice" />
                  </p>
                </div>

                <UrlInput
                  onResolved={setResolved}
                  onOpenBatch={() => {
                    setBatchUrls(undefined);
                    setBatchOpen(true);
                  }}
                  prefillUrl={prefillUrl}
                />

                <AnimatePresence mode="wait">
                  {resolved ? (
                    <PreviewCard
                      key="preview"
                      item={resolved}
                      onClear={() => setResolved(null)}
                    />
                  ) : (
                    <EmptyState key="empty" />
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="library"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <LibraryView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <BatchDialog
          open={batchOpen}
          initialUrls={batchUrls}
          onClose={() => setBatchOpen(false)}
          onFinished={() => {
            /* library auto-rescans via fs.watch */
          }}
        />

        <Player />
        <ShortcutsDialog />
        <Toaster richColors position="bottom-right" />
      </div>
      </TooltipProvider>
    </PlayerProvider>
  );
}

interface NavTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function NavTab({ active, onClick, icon, label }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.div
          layoutId="active-tab"
          className="absolute inset-0 rounded-md bg-accent"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}
