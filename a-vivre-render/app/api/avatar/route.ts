import { dbQuery } from "@/lib/db";
import { badRequest, findUserById, getSession, profileForOwner, serverError, unauthorized } from "@/lib/server";
import { removeAsset, storeAsset } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const form = await request.formData();
    const asset = form.get("asset");
    if (!(asset instanceof File) || !asset.type.startsWith("image/")) return badRequest("Choisis une image.");
    if (asset.size > MAX_AVATAR_BYTES) return badRequest("La photo doit faire moins de 5 Mo.");
    const current = await findUserById(session.user.id);
    if (!current) return unauthorized();
    const stored = await storeAsset({ id: `${session.user.id}-avatar-${Date.now()}`, file: asset, kind: "image", folder: "a-vivre/avatars" });
    await dbQuery("UPDATE users SET avatar_url = $1, avatar_key = $2, updated_at = $3 WHERE id = $4", [stored.url, stored.key, new Date().toISOString(), session.user.id]);
    await removeAsset(current.avatar_key, "image");
    const user = await findUserById(session.user.id);
    return Response.json({ profile: user ? profileForOwner(user) : session.user });
  } catch (error) {
    return serverError(error);
  }
}
