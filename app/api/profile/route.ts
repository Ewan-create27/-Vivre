import { dbQuery } from "@/lib/db";
import { GENDERS, badRequest, cleanText, findUserById, getSession, lifespanForGender, profileForOwner, serverError, unauthorized, validChoice } from "@/lib/server";

export const runtime = "nodejs";

function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() < Date.now() && date.getFullYear() >= 1900;
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await request.json() as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (body.displayName !== undefined) {
      const displayName = cleanText(body.displayName, 80);
      if (!displayName) return badRequest("Ton prénom ou pseudo est requis.");
      add("display_name", displayName);
    }
    let gender = session.user.gender;
    if (body.gender !== undefined) {
      gender = validChoice(cleanText(body.gender, 20), GENDERS, "unspecified");
      add("gender", gender);
    }
    if (body.birthDate !== undefined) {
      const birthDate = cleanText(body.birthDate, 10);
      if (!validBirthDate(birthDate)) return badRequest("Choisis une date de naissance valide.");
      add("birth_date", birthDate);
    }
    if (body.lifespanYears !== undefined) {
      const lifespanYears = Math.round(Number(body.lifespanYears));
      if (!Number.isFinite(lifespanYears) || lifespanYears < 50 || lifespanYears > 120) {
        return badRequest("Choisis un repère entre 50 et 120 ans.");
      }
      add("lifespan_years", lifespanYears);
    } else if (body.gender !== undefined) {
      add("lifespan_years", lifespanForGender(gender));
    }
    if (fields.length) {
      values.push(new Date().toISOString(), session.user.id);
      await dbQuery(`UPDATE users SET ${fields.join(", ")}, updated_at = $${values.length - 1} WHERE id = $${values.length}`, values);
    }
    const user = await findUserById(session.user.id);
    return Response.json({ profile: user ? profileForOwner(user) : session.user });
  } catch (error) {
    return serverError(error);
  }
}
