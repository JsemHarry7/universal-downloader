export interface DownloadStreamEvent {
  percent?: number;
  stage?: string;
}

export interface DownloadStreamResult {
  outputFiles: string[];
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
  let error: Error | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as
          | { type: "progress"; percent: number }
          | { type: "stage"; name: string }
          | { type: "done"; outputFiles: string[] }
          | { type: "error"; message: string };
        if (event.type === "progress") {
          onProgress?.({ percent: event.percent });
        } else if (event.type === "stage") {
          onProgress?.({ stage: event.name });
        } else if (event.type === "done") {
          outputFiles.push(...event.outputFiles);
        } else if (event.type === "error") {
          error = new Error(event.message);
        }
      } catch {
        // non-JSON, ignore
      }
    }
  }

  if (error) throw error;
  return { outputFiles };
}
