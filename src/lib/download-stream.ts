export interface DownloadStreamEvent {
  percent?: number;
  stage?: string;
}

export interface DownloadStreamResult {
  outputFiles: string[];
  libraryIds: string[];
}

export interface DownloadStreamBody {
  url: string;
  title?: string;
  artist?: string;
  album?: string;
}

export async function streamDownload(
  body: DownloadStreamBody,
  onProgress?: (ev: DownloadStreamEvent) => void,
): Promise<DownloadStreamResult> {
  const res = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const outputFiles: string[] = [];
  const libraryIds: string[] = [];
  let error: Error | null = null;
  let sawDone = false;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed) as
        | { type: "progress"; percent: number }
        | { type: "stage"; name: string }
        | { type: "done"; outputFiles: string[]; libraryIds?: string[] }
        | { type: "error"; message: string };
      if (event.type === "progress") {
        onProgress?.({ percent: event.percent });
      } else if (event.type === "stage") {
        onProgress?.({ stage: event.name });
      } else if (event.type === "done") {
        sawDone = true;
        outputFiles.push(...event.outputFiles);
        libraryIds.push(...(event.libraryIds ?? []));
      } else if (event.type === "error") {
        error = new Error(event.message);
      }
    } catch {
      // non-JSON, ignore
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);

  if (error) throw error;
  if (!sawDone) throw new Error("Download stream ended before completion");
  if (outputFiles.length === 0) {
    throw new Error("Download finished but did not produce a file");
  }
  return { outputFiles, libraryIds };
}
