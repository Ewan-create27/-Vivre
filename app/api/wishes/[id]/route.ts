import { dbQuery } from "@/lib/db";
import { COLORS, STATUSES, badRequest, cleanDate, cleanText, getOwnedWish, getSession, listMemoryAssetsForWish, serverError, unauthorized, validChoice } from "@/lib/server";
import { removeAsset } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;
    const wish = await getOwnedWish(id, session.user.id);
    if (!wish) return Response.json({ error: "Cet objectif est introuvable." }, { status: 404 });
    return Response.json({ wish });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;
    const current = await getOwnedWish(id, session.user.id);
    if (!current) return Response.json({ error: "Cet objectif est introuvable." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (body.title !== undefined) {
      const title = cleanText(body.title, 100);
      if (!title) return badRequest("Le titre ne peut pas être vide.");
      add("title", title);
    }
    if (body.description !== undefined) add("description", cleanText(body.description, 1500));
    if (body.category !== undefined) add("category", cleanText(body.category, 50) || "À vivre");
    if (body.nextStep !== undefined) add("next_step", cleanText(body.nextStep, 500));
    if (body.targetDate !== undefined) add("target_date", cleanText(body.targetDate, 20) || null);
    if (body.color !== undefined) add("color", validChoice(cleanText(body.color, 20), COLORS, "terracotta"));

    const requestedStatus = body.status !== undefined ? validChoice(cleanText(body.status, 20), STATUSES, current.status) : current.status;
    let progress = body.progress !== undefined ? Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0))) : current.progress;
    if (requestedStatus === "done") progress = 100;
    const status = progress === 100 ? "done" : requestedStatus === "done" ? "progress" : requestedStatus;
    if (body.status !== undefined || body.progress !== undefined || body.completedAt !== undefined) {
      add("progress", progress);
      add("status", status);
      if (progress === 100) {
        const completedAt = body.completedAt !== undefined ? cleanDate(body.completedAt) : current.completedAt;
        if (!completedAt) return badRequest("Indique la date à laquelle ce rêve a été réalisé.");
        add("completed_at", completedAt);
      } else {
        add("completed_at", null);
      }
    }
    if (fields.length) {
      values.push(new Date().toISOString(), id, session.user.id);
      await dbQuery(`UPDATE wishes SET ${fields.join(", ")}, updated_at = $${values.length - 2} WHERE id = $${values.length - 1} AND owner_id = $${values.length}`, values);
    }
    const wish = await getOwnedWish(id, session.user.id);
    return Response.json({ wish });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;
    const assets = await listMemoryAssetsForWish(id, session.user.id);
    const deleted = await dbQuery<{ id: string }>("DELETE FROM wishes WHERE id = $1 AND owner_id = $2 RETURNING id", [id, session.user.id]);
    if (!deleted.rows[0]) return Response.json({ error: "Cet objectif est introuvable." }, { status: 404 });
    await Promise.all(assets.map((asset) => removeAsset(asset.asset_key, asset.kind)));
    return Response.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
