import { motion } from "motion/react";
import { Music4, HardDrive, Clock, BarChart3 } from "lucide-react";
import type { LibraryStats } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface StatsPanelProps {
  stats: LibraryStats | null;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats || stats.total_tracks === 0) return null;

  const sourceEntries = Object.entries(stats.by_source)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/40 bg-card/30 p-4 backdrop-blur-sm"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          icon={<Music4 className="h-4 w-4" />}
          label="Tracks"
          value={stats.total_tracks.toLocaleString()}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Total length"
          value={formatDuration(stats.total_duration_s)}
        />
        <Stat
          icon={<HardDrive className="h-4 w-4" />}
          label="On disk"
          value={formatBytes(stats.total_size_bytes)}
        />
        <Stat
          icon={<BarChart3 className="h-4 w-4" />}
          label="Top"
          value={stats.top_artists[0]?.artist ?? "—"}
          sub={
            stats.top_artists[0]
              ? `${stats.top_artists[0].count} track${stats.top_artists[0].count === 1 ? "" : "s"}`
              : undefined
          }
        />
      </div>

      {sourceEntries.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="flex gap-0.5 overflow-hidden rounded-full">
            {sourceEntries.map(([source, count]) => {
              const pct = (count / stats.total_tracks) * 100;
              return (
                <div
                  key={source}
                  style={{ width: `${pct}%` }}
                  className={
                    source === "spotify"
                      ? "h-1.5 bg-emerald-500/70"
                      : source === "soundcloud"
                        ? "h-1.5 bg-orange-500/70"
                        : source === "youtube"
                          ? "h-1.5 bg-red-500/70"
                          : "h-1.5 bg-muted-foreground/40"
                  }
                  title={`${source}: ${count} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {sourceEntries.map(([source, count]) => (
              <span key={source} className="inline-flex items-center gap-1.5">
                <span
                  className={
                    source === "spotify"
                      ? "h-2 w-2 rounded-sm bg-emerald-500/70"
                      : source === "soundcloud"
                        ? "h-2 w-2 rounded-sm bg-orange-500/70"
                        : source === "youtube"
                          ? "h-2 w-2 rounded-sm bg-red-500/70"
                          : "h-2 w-2 rounded-sm bg-muted-foreground/40"
                  }
                />
                <span className="capitalize">{source}</span>
                <span className="tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

function Stat({ icon, label, value, sub }: StatProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/50 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
        {sub && (
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  );
}
