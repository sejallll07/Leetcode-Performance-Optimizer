/**
 * One-off smoke test for the auth/signup foundation — not a full test
 * suite, just enough to catch a broken foundation before building on
 * it. Run with `npm run test:foundation` against a real database.
 * Exercises the real signup/auth service and repository (not mocks)
 * so it proves the actual code path works, not just that it compiles.
 */
import "dotenv/config";
import { signupUser, verifyCredentials } from "../src/services/auth/auth-service";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  const email = `test.user.${Date.now()}@example.com`;
  const password = "correct-horse-battery-staple";

  const signupResult = await signupUser({ name: "Test Student", email, password });
  assert(signupResult.ok, "signup succeeds with a fresh email");

  const dupeResult = await signupUser({ name: "Test Student", email, password });
  assert(!dupeResult.ok, "duplicate signup is rejected");
  if (!dupeResult.ok) {
    assert(
      dupeResult.error.includes("already exists"),
      `duplicate error message is sensible (got: "${dupeResult.error}")`
    );
  }

  const invalidResult = await signupUser({
    name: "Test Student",
    email: `other.${Date.now()}@example.com`,
    password: "short",
  });
  assert(!invalidResult.ok, "short password is rejected by validation");

  const verified = await verifyCredentials(email, password);
  assert(verified !== null, "correct credentials verify successfully");
  assert(verified?.email === email, "verified user has the expected email");

  const wrongPassword = await verifyCredentials(email, "not-the-right-password");
  assert(wrongPassword === null, "wrong password is rejected");

  const unknownUser = await verifyCredentials("nobody@example.com", password);
  assert(unknownUser === null, "unknown email is rejected");

  console.log("\nAll foundation checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
