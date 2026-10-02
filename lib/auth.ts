import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

const scrypt = promisify(nodeScrypt);
const SESSION_COOKIE = 'nexa_session';
const SESSION_DAYS = 30;

export type User = {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium';
  memory_enabled: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:v1:${salt.toString('base64url')}:${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
  const salt = Buffer.from(parts[2], 'base64url');
  const expected = Buffer.from(parts[3], 'base64url');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function issueSession(userId: string) {
  await query('delete from sessions where user_id = $1 and expires_at <= now()', [userId]);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await query(
    `insert into sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + interval '30 days')`,
    [userId, tokenHash],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    priority: 'high',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function createUser(params: { name: string; email: string; password: string }) {
  const email = normalizeEmail(params.email);
  const name = params.name.trim().slice(0, 80);

  if (!name) throw new Error('Name is required.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
  if (params.password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (params.password.length > 128) throw new Error('Password must be 128 characters or fewer.');

  const passwordHash = await hashPassword(params.password);
  const result = await query<User>(
    `insert into users (name, email, password_hash)
     values ($1, $2, $3)
     returning id, email, name, plan, memory_enabled`,
    [name, email, passwordHash],
  );

  const user = result.rows[0];
  await issueSession(user.id);
  return user;
}

export async function loginUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const result = await query<User & { password_hash: string }>(
    `select id, email, name, plan, memory_enabled, password_hash
     from users where email = $1 limit 1`,
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new Error('Invalid email or password.');
  }

  await issueSession(user.id);
  const { password_hash: _ignored, ...safeUser } = user;
  return safeUser;
}

export async function logoutUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query('delete from sessions where token_hash = $1', [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<User>(
    `select u.id, u.email, u.name, u.plan, u.memory_enabled
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
    [hashToken(token)],
  );

  if (!result.rows[0]) {
    store.delete(SESSION_COOKIE);
    return null;
  }
  return result.rows[0];
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
