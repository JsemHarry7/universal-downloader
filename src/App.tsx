import { useState } from "react";
import { Headphones, Download, Library } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { UrlInput } from "@/features/resolver/UrlInput";
import { EmptyState } from "@/features/resolver/EmptyState";
import { PreviewCard } from "@/features/resolver/PreviewCard";
import { LibraryView } from "@/features/library/LibraryView";
import { cn } from "@/lib/utils";
import type { ResolvedItem } from "@/lib/types";

type View = "download" | "library";

export default function App() {
  const [view, setView] = useState<View>("download");
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);

  return (
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

          <span className="text-xs text-muted-foreground">v0.1.0</span>
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
                </div>

                <UrlInput onResolved={setResolved} />

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

        <Toaster richColors position="bottom-right" />
      </div>
    </TooltipProvider>
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
