import { Hono } from "hono";
import { resolveUrl } from "../lib/resolve";
import { downloadUrlStream } from "../lib/downloads";
import { DEFAULT_DOWNLOAD_DIR } from "../lib/paths";

export function downloadRoutes(
  getYtdlpPath: () => string,
  getFfmpegDir: () => string,
) {
  const routes = new Hono();

  routes.post("/resolve", async (c) => {
    const body = await c.req.json<{ url?: string }>();
    if (!body.url) return c.json({ error: "url required" }, 400);
    try {
      const resolved = await resolveUrl(body.url, getYtdlpPath());
      return c.json(resolved);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  routes.post("/download", async (c) => {
    const body = await c.req.json<{
      url?: string;
      destDir?: string;
      title?: string;
      artist?: string;
      album?: string;
    }>();
    if (!body.url) return c.json({ error: "url required" }, 400);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n"),
            );
          } catch {
            // stream already closed
          }
        };

        try {
          const result = await downloadUrlStream(
            getYtdlpPath(),
            {
              url: body.url!,
              destDir: body.destDir ?? DEFAULT_DOWNLOAD_DIR,
              title: body.title,
              artist: body.artist,
              album: body.album,
              ffmpegDir: getFfmpegDir(),
            },
            (ev) => send(ev),
          );
          send({ type: "done", outputFiles: result.outputFiles });
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  return routes;
}
