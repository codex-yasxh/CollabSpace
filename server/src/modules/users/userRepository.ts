import { query } from "../../database/db.js";

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password_hash: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const trimmedName = input.name.trim();
  const trimmedEmail = input.email.trim();

  const result = await query<User>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, password_hash, created_at`,
    [trimmedName, trimmedEmail, input.password_hash],
  );

  return result.rows[0]!;
}

export async function findByEmail(email: string): Promise<User | null> {
  const trimmedEmail = email.trim().toLowerCase();

  const result = await query<User>(
    `SELECT id, name, email, password_hash, created_at
     FROM users
     WHERE lower(email) = lower($1)`,
    [trimmedEmail],
  );

  return result.rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, name, email, password_hash, created_at
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}
