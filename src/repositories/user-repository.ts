import { randomUUID } from "crypto";
import { pool } from "@/lib/db";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: Date;
};

/**
 * Repository layer — the only place in the app that knows how user
 * data is actually stored. Services and Server Actions call these
 * functions and never touch `pool`/SQL directly, so swapping this
 * file's internals for real Prisma Client calls later requires no
 * changes anywhere else in the app.
 */

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT "id", "email", "passwordHash", "name", "createdAt"
     FROM "users" WHERE "email" = $1 LIMIT 1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT "id", "email", "passwordHash", "name", "createdAt"
     FROM "users" WHERE "id" = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<User> {
  const id = randomUUID();
  const result = await pool.query(
    `INSERT INTO "users" ("id", "email", "passwordHash", "name", "updatedAt")
     VALUES ($1, $2, $3, $4, now())
     RETURNING "id", "email", "passwordHash", "name", "createdAt"`,
    [id, input.email.toLowerCase().trim(), input.passwordHash, input.name ?? null]
  );
  return result.rows[0];
}