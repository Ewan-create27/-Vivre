import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredAsset = { url: string; key: string | null };
type AssetKind = "image" | "video";
type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

const localDirectory = path.join(process.cwd(), "public", "uploads");

function cloudinaryConfig(): CloudinaryConfig | null {
  const value = process.env.CLOUDINARY_URL;
  if (!value) return null;

  const parsed = new URL(value);
  const cloudName = parsed.hostname;
  const apiKey = decodeURIComponent(parsed.username);
  const apiSecret = decodeURIComponent(parsed.password);
  if (parsed.protocol !== "cloudinary:" || !cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_URL est invalide.");
  }
  return { cloudName, apiKey, apiSecret };
}

function signature(parameters: Record<string, string>, apiSecret: string) {
  const payload = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

async function uploadToCloudinary({
  config,
  content,
  file,
  kind,
  folder,
  id,
}: {
  config: CloudinaryConfig;
  content: ArrayBuffer;
  file: File;
  kind: AssetKind;
  folder: string;
  id: string;
}): Promise<StoredAsset> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedParameters = { folder, overwrite: "false", public_id: id, timestamp };
  const form = new FormData();
  form.set("file", new Blob([content], { type: file.type || "application/octet-stream" }), file.name || "souvenir");
  for (const [key, value] of Object.entries(signedParameters)) form.set(key, value);
  form.set("api_key", config.apiKey);
  form.set("signature", signature(signedParameters, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${kind}/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !result?.secure_url || !result.public_id) {
    throw new Error(result?.error?.message || "Téléversement Cloudinary impossible.");
  }
  return { url: result.secure_url, key: result.public_id };
}

async function removeFromCloudinary(config: CloudinaryConfig, key: string, kind: AssetKind) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedParameters = { public_id: key, timestamp };
  const form = new URLSearchParams({
    ...signedParameters,
    api_key: config.apiKey,
    signature: signature(signedParameters, config.apiSecret),
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${kind}/destroy`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) throw new Error("Suppression Cloudinary impossible.");
}

function safeFilename(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  return clean || "souvenir";
}

export async function storeAsset({
  id,
  file,
  kind,
  folder,
}: {
  id: string;
  file: File;
  kind: AssetKind;
  folder: string;
}): Promise<StoredAsset> {
  const content = await file.arrayBuffer();
  const config = cloudinaryConfig();

  if (config) return uploadToCloudinary({ config, content, file, kind, folder, id });

  await mkdir(localDirectory, { recursive: true });
  const filename = `${id}-${safeFilename(file.name)}`;
  await writeFile(path.join(localDirectory, filename), Buffer.from(content));
  return { url: `/uploads/${filename}`, key: filename };
}

export async function removeAsset(key: string | null, kind: AssetKind) {
  if (!key) return;
  try {
    const config = cloudinaryConfig();
    if (config) return await removeFromCloudinary(config, key, kind);
    await unlink(path.join(localDirectory, key));
  } catch {
    // A deleted remote asset should never block an update to the user's data.
  }
}
