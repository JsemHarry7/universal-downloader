import { useEffect } from "react";
import { detectSource } from "@/lib/detect-source";

interface ClipboardCallbacks {
  onSingleUrl: (url: string) => void;
  onManyUrls: (urls: string[]) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

function extractUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      try {
        new URL(l);
        return true;
      } catch {
        return false;
      }
    });
}

export function useClipboardMonitor({
  onSingleUrl,
  onManyUrls,
}: ClipboardCallbacks): void {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!text.trim()) return;

      const urls = extractUrls(text);
      if (urls.length === 0) return;

      if (urls.length === 1) {
        const detected = detectSource(urls[0]);
        if (detected.source === "unknown") return;
        onSingleUrl(urls[0]);
      } else {
        const recognized = urls.filter(
          (u) => detectSource(u).source !== "unknown",
        );
        if (recognized.length === 0) return;
        onManyUrls(recognized);
      }
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [onSingleUrl, onManyUrls]);
}
