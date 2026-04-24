import { Music, ListMusic, Disc3 } from "lucide-react";
import { motion } from "motion/react";

const capabilities = [
  { icon: Music, label: "Single tracks", detail: "Any public URL" },
  { icon: ListMusic, label: "Full playlists", detail: "All tracks, one click" },
  { icon: Disc3, label: "Entire albums", detail: "Tagged & organized" },
];

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {capabilities.map((cap, i) => (
        <motion.div
          key={cap.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          className="flex flex-col items-center gap-2 rounded-lg border border-border/40 bg-card/30 px-4 py-6 text-center backdrop-blur-sm transition-colors hover:border-border"
        >
          <cap.icon className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">{cap.label}</span>
          <span className="text-xs text-muted-foreground">{cap.detail}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}
