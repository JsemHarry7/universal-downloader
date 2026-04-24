import { Hono } from "hono";
import { resolveUrl } from "../lib/resolve";
import { downloadUrl } from "../lib/downloads";
import { DEFAULT_DOWNLOAD_DIR } from "../lib/paths";

export function downloadRoutes(getYtdlpPath: () => string) {
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
    }>();
    if (!body.url) return c.json({ error: "url required" }, 400);
    try {
      const result = await downloadUrl(getYtdlpPath(), {
        url: body.url,
        destDir: body.destDir ?? DEFAULT_DOWNLOAD_DIR,
        title: body.title,
        artist: body.artist,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return routes;
}
