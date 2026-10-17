"use server";

import { signupUser } from "@/services/auth/auth-service";

export type SignupFormState = {
  ok: boolean;
  error?: string;
};

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await signupUser({ name, email, password });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}
