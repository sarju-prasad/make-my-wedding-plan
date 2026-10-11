/**
 * Argon2id password hashing — the one place `@node-rs/argon2` is called
 * directly. `hash`/`verify` default to Argon2id already (the package's own
 * "normative recommendation" default), so no explicit `algorithm` option is
 * needed to satisfy the fixed decision (backend/CLAUDE.md: "Argon2id
 * password hashing via @node-rs/argon2").
 */
import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return await verify(passwordHash, password);
}
