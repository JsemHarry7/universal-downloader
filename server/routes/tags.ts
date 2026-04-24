import { Hono } from "hono";
import { getDb } from "../lib/db";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  attachTag,
  detachTag,
  tagIdsForTrack,
} from "../lib/tags";

export function tagRoutes() {
  const routes = new Hono();

  routes.get("/tags", (c) => {
    return c.json({ tags: listTags(getDb()) });
  });

  routes.post("/tags", async (c) => {
    const body = await c.req.json<{
      name?: string;
      color?: string;
      id?: string;
    }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "name required" }, 400);
    try {
      return c.json(createTag(getDb(), name, body.color, body.id));
    } catch (err) {
      return c.json(
        { error: (err as Error).message || "couldn't create tag" },
        400,
      );
    }
  });

  routes.patch("/tags/:id", async (c) => {
    const body = await c.req.json<{ name?: string; color?: string }>();
    const ok = updateTag(getDb(), c.req.param("id"), body);
    if (!ok) return c.json({ error: "not found or no fields" }, 404);
    return c.json({ ok: true });
  });

  routes.delete("/tags/:id", (c) => {
    const ok = deleteTag(getDb(), c.req.param("id"));
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  routes.post("/tags/:id/tracks", async (c) => {
    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json({ error: "trackId required" }, 400);
    const ok = attachTag(getDb(), c.req.param("id"), body.trackId);
    return c.json({ ok });
  });

  routes.delete("/tags/:id/tracks/:trackId", (c) => {
    const ok = detachTag(
      getDb(),
      c.req.param("id"),
      c.req.param("trackId"),
    );
    return c.json({ ok });
  });

  routes.get("/tracks/:id/tags", (c) => {
    return c.json({ tagIds: tagIdsForTrack(getDb(), c.req.param("id")) });
  });

  return routes;
}
