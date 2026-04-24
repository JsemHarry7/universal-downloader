import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LegalNoticeLinkProps {
  className?: string;
  label?: string;
}

export function LegalNoticeLink({
  className,
  label = "Legal notice",
}: LegalNoticeLinkProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
          className,
        )}
      >
        {label}
      </button>
      <LegalNoticeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
}

function LegalNoticeDialog({ open, onClose }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Legal notice
          </DialogTitle>
          <DialogDescription>
            A personal tool for downloading audio you have the right to use.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mr-4 max-h-[60vh] pr-4">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p className="text-foreground">
              Universal Downloader runs on your machine and orchestrates{" "}
              <a
                href="https://github.com/yt-dlp/yt-dlp"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                yt-dlp
              </a>
              . Using it is your decision and your responsibility.
            </p>

            <section className="space-y-1">
              <h3 className="font-semibold text-foreground">You're responsible for:</h3>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  Complying with the Terms of Service of the source platforms
                  (YouTube, Spotify, SoundCloud, Bandcamp, etc.). All of them
                  generally prohibit downloading content except through their
                  own apps, so using any tool like this likely breaches ToS.
                </li>
                <li>
                  Copyright law in your country. Rules vary — private-copying
                  exceptions exist in parts of the EU, not in the UK or US.
                  Safe default: assume downloads are infringing unless you have
                  a specific right to copy.
                </li>
                <li>
                  Not redistributing what you download. Sharing copies is a
                  clearer copyright violation than a personal download.
                </li>
                <li>
                  Not hosting a public instance for others. Running a service
                  that downloads media for strangers is a different legal
                  category; this project isn't designed for that use.
                </li>
              </ul>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-foreground">
                What this tool does and doesn't do:
              </h3>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  It doesn't circumvent DRM. Spotify streams are DRM-protected
                  and never touched. Spotify support works by reading public
                  embed metadata, then fetching audio from public YouTube
                  streams via yt-dlp.
                </li>
                <li>
                  It doesn't host anything. Code runs locally; files land in
                  your own <code>~/Music/universal-downloader/</code> folder.
                </li>
                <li>
                  Source code for projects like yt-dlp is protected speech (see
                  the EFF's 2020 response to the RIAA's DMCA takedown of
                  youtube-dl on GitHub).
                </li>
              </ul>
            </section>

            <section className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
              <p className="text-foreground">
                If you like the music, pay for it.
              </p>
              <p className="mt-1 text-xs">
                Spotify Premium and YouTube Premium both support offline
                playback. Bandcamp pays artists directly. Go to shows. Buy
                merch. Those are the right answers — this tool isn't a
                replacement for supporting the people who made what you're
                listening to.
              </p>
            </section>

            <p className="text-xs italic">This is not legal advice.</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
