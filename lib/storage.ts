import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredAsset = { url: string; key: string | null };

const localDirectory = path.join(process.cwd(), "public", "uploads");

function usesCloudinary() {
  return Boolean(process.env.CLOUDINARY_URL);
}

function resourceType(kind: "image" | "video") {
  return kind === "video" ? "video" : "image";
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
  kind: "image" | "video";
  folder: string;
}): Promise<StoredAsset> {
  const content = Buffer.from(await file.arrayBuffer());

  if (usesCloudinary()) {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: id,
          resource_type: resourceType(kind),
          use_filename: false,
          overwrite: false,
        },
        (error, upload) => error || !upload ? reject(error ?? new Error("Téléversement impossible.")) : resolve(upload),
      );
      stream.end(content);
    });
    return { url: result.secure_url, key: result.public_id };
  }

  await mkdir(localDirectory, { recursive: true });
  const filename = `${id}-${safeFilename(file.name)}`;
  await writeFile(path.join(localDirectory, filename), content);
  return { url: `/uploads/${filename}`, key: filename };
}

export async function removeAsset(key: string | null, kind: "image" | "video") {
  if (!key) return;
  try {
    if (usesCloudinary()) {
      await cloudinary.uploader.destroy(key, { resource_type: resourceType(kind) });
      return;
    }
    await unlink(path.join(localDirectory, key));
  } catch {
    // A deleted remote asset should never block an update to the user's data.
  }
}
