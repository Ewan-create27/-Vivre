import {
  GENDERS,
  badRequest,
  cleanText,
  createSession,
  findUserByEmail,
  hashPassword,
  lifespanForGender,
  newId,
  normalizeEmail,
  now,
  profileForOwner,
  serverError,
  sessionCookie,
  validChoice,
  type UserRecord,
} from "@/lib/server";
import { dbQuery } from "@/lib/db";

export const runtime = "nodejs";

function validEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() < Date.now() && date.getFullYear() >= 1900;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const birthDate = cleanText(body.birthDate, 10);
    const gender = validChoice(cleanText(body.gender, 20), GENDERS, "unspecified");
    const displayName = cleanText(body.displayName, 80) || email.split("@")[0] || "Mon espace";
    if (!validEmail(email)) return badRequest("Entre une adresse e-mail valide.");
    if (password.length < 8 || password.length > 128) return badRequest("Choisis un mot de passe de 8 caractères minimum.");
    if (!validBirthDate(birthDate)) return badRequest("Choisis une date de naissance valide.");
    if (await findUserByEmail(email)) return Response.json({ error: "Un espace existe déjà avec cette adresse." }, { status: 409 });

    const id = newId();
    const timestamp = now();
    await dbQuery(
      `INSERT INTO users (id, email, display_name, avatar_color, password_hash, birth_date, gender, lifespan_years, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, email, displayName, "#C98768", await hashPassword(password), birthDate, gender, lifespanForGender(gender), timestamp],
    );
    const created = await dbQuery<UserRecord>("SELECT * FROM users WHERE id = $1", [id]);
    const user = created.rows[0];
    if (!user) throw new Error("Compte introuvable après création.");
    const session = await createSession(id);
    return Response.json({ profile: profileForOwner(user) }, { status: 201, headers: { "set-cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) {
    return serverError(error);
  }
}
