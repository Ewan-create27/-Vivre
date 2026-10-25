import { dbQuery } from "@/lib/db";
import { badRequest, getOwnedWish, getSession, newId, now, serverError, unauthorized } from "@/lib/server";
import { storeAsset } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const form = await request.formData();
    const wishId = String(form.get("wishId") ?? "");
    const asset = form.get("asset");
    const caption = String(form.get("caption") ?? "").trim().slice(0, 180);
    if (!wishId || !(asset instanceof File)) return badRequest("Choisis un fichier à ajouter.");
    if (asset.size > MAX_UPLOAD_BYTES) return badRequest("Le fichier est trop lourd (25 Mo maximum).");
    const wish = await getOwnedWish(wishId, session.user.id);
    if (!wish) return Response.json({ error: "Tu ne peux pas ajouter de souvenir à cet objectif." }, { status: 403 });
    const kind = asset.type.startsWith("image/") ? "image" : asset.type.startsWith("video/") ? "video" : null;
    if (!kind) return badRequest("Ajoute une image ou une vidéo.");
    const id = newId();
    const stored = await storeAsset({ id, file: asset, kind, folder: `a-vivre/memories/${session.user.id}/${wishId}` });
    const createdAt = now();
    await dbQuery(
      `INSERT INTO memories (id, wish_id, owner_id, asset_url, asset_key, kind, mime_type, caption, size_bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, wishId, session.user.id, stored.url, stored.key, kind, asset.type || "application/octet-stream", caption, asset.size, createdAt],
    );
    return Response.json({ memory: { id, type: kind, url: stored.url, caption, createdAt } });
  } catch (error) {
    return serverError(error);
  }
}
