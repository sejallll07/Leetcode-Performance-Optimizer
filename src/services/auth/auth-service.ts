import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "@/repositories/user-repository";
import { signupSchema, type SignupInput } from "@/lib/validation";

const SALT_ROUNDS = 10;

export type SignupResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * All signup business logic lives here, not in the Server Action or
 * the UI — the Server Action just calls this and translates the
 * result into form state.
 */
export async function signupUser(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return { ok: false, error: "An account with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, SALT_ROUNDS);
  const user = await createUser({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
  });

  return { ok: true, userId: user.id };
}

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}
