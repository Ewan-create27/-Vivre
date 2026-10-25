import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { dbQuery } from "@/lib/db";

export const COLORS = ["terracotta", "mimosa", "sage", "ocean", "rose"] as const;
export const STATUSES = ["dreaming", "progress", "done"] as const;
export const GENDERS = ["male", "female", "other", "unspecified"] as const;

const SESSION_COOKIE = "a_vivre_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const scrypt = promisify(scryptCallback);

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  birthDate: string | null;
  gender: string;
  lifespanYears: number;
  avatarUrl: string | null;
  updatedAt: string;
};

export type MemoryDto = {
  id: string;
  type: "image" | "video";
  url: string;
  caption: string;
  createdAt: string;
};

export type WishDto = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  color: string;
  status: string;
  privacy: string;
  progress: number;
  nextStep: string;
  targetDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  memories: MemoryDto[];
};

export type UserRecord = {
  id: string;
  email: string;
  display_name: string;
  avatar_color: string;
  password_hash: string;
  birth_date: string | null;
  gender: string;
  lifespan_years: number;
  avatar_url: string | null;
  avatar_key: string | null;
  created_at: string;
  updated_at: string;
};

type WishRecord = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  status: string;
  progress: number;
  next_step: string;
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MemoryRecord = {
  id: string;
  wish_id: string;
  owner_id: string;
  asset_url: string;
  asset_key: string | null;
  kind: "image" | "video";
  mime_type: string;
  caption: string;
  size_bytes: number;
  created_at: string;
};

export type Session = { user: Profile; sessionId: string };

export function now() {
  return new Date().toISOString();
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanDate(value: unknown) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

export function validChoice(value: string, choices: readonly string[], fallback: string) {
  return choices.includes(value) ? value : fallback;
}

export function lifespanForGender(gender: string) {
  if (gender === "male") return 80;
  if (gender === "female") return 86;
  return 83;
}

export function profileForOwner(user: UserRecord): Profile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarColor: user.avatar_color,
    birthDate: user.birth_date,
    gender: user.gender,
    lifespanYears: user.lifespan_years,
    avatarUrl: user.avatar_url,
    updatedAt: user.updated_at,
  };
}

export function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export function unauthorized() {
  return Response.json({ error: "Connexion requise." }, { status: 401 });
}

export function serverError(error: unknown) {
  console.error(error);
  return Response.json({ error: "Une erreur est survenue. Réessaie dans un instant." }, { status: 500 });
}

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expectedBytes = Buffer.from(expected, "hex");
  return expectedBytes.length === derived.length && timingSafeEqual(expectedBytes, derived);
}

export async function findUserByEmail(email: string) {
  const result = await dbQuery<UserRecord>("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string) {
  const result = await dbQuery<UserRecord>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ?? null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await dbQuery("DELETE FROM sessions WHERE expires_at <= $1", [now()]);
  await dbQuery(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), userId, tokenHash(token), expiresAt, now()],
  );
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: string) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie() {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await dbQuery<UserRecord & { session_id: string }>(
    `SELECT u.*, s.id AS session_id
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > $2
      LIMIT 1`,
    [tokenHash(token), now()],
  );
  const row = result.rows[0];
  return row ? { user: profileForOwner(row), sessionId: row.session_id } : null;
}

export async function destroyCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await dbQuery("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

function mapMemory(memory: MemoryRecord): MemoryDto {
  return {
    id: memory.id,
    type: memory.kind === "video" ? "video" : "image",
    url: memory.asset_url,
    caption: memory.caption,
    createdAt: memory.created_at,
  };
}

function mapWish(wish: WishRecord, memories: MemoryDto[]): WishDto {
  return {
    id: wish.id,
    ownerId: wish.owner_id,
    title: wish.title,
    description: wish.description,
    category: wish.category,
    color: wish.color,
    status: wish.status,
    privacy: "private",
    progress: wish.progress,
    nextStep: wish.next_step,
    targetDate: wish.target_date,
    completedAt: wish.completed_at,
    sortOrder: wish.sort_order,
    createdAt: wish.created_at,
    updatedAt: wish.updated_at,
    memories,
  };
}

export async function listWishesForOwner(ownerId: string): Promise<WishDto[]> {
  const wishes = await dbQuery<WishRecord>(
    "SELECT * FROM wishes WHERE owner_id = $1 ORDER BY sort_order ASC, updated_at DESC, created_at DESC",
    [ownerId],
  );
  if (!wishes.rows.length) return [];
  const ids = wishes.rows.map((wish) => wish.id);
  const memories = await dbQuery<MemoryRecord>(
    "SELECT * FROM memories WHERE wish_id = ANY($1::text[]) ORDER BY created_at DESC",
    [ids],
  );
  const memoriesByWish = new Map<string, MemoryDto[]>();
  for (const memory of memories.rows) {
    const entries = memoriesByWish.get(memory.wish_id) ?? [];
    entries.push(mapMemory(memory));
    memoriesByWish.set(memory.wish_id, entries);
  }
  return wishes.rows.map((wish) => mapWish(wish, memoriesByWish.get(wish.id) ?? []));
}

export async function getOwnedWish(wishId: string, ownerId: string) {
  const result = await dbQuery<WishRecord>("SELECT * FROM wishes WHERE id = $1 AND owner_id = $2 LIMIT 1", [wishId, ownerId]);
  const wish = result.rows[0];
  if (!wish) return null;
  const memories = await dbQuery<MemoryRecord>("SELECT * FROM memories WHERE wish_id = $1 ORDER BY created_at DESC", [wishId]);
  return mapWish(wish, memories.rows.map(mapMemory));
}

export async function listMemoryAssetsForWish(wishId: string, ownerId: string) {
  const result = await dbQuery<MemoryRecord>("SELECT * FROM memories WHERE wish_id = $1 AND owner_id = $2", [wishId, ownerId]);
  return result.rows;
}

export function newId() {
  return randomUUID();
}

export function createResetCode() {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

export function hashResetCode(code: string) {
  return tokenHash(code);
}
