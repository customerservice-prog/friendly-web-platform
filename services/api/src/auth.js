import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function requireJwtSecret() {
  const s = getJwtSecret();
  if (!s) {
    // Throw a descriptive error so clients understand this is server config.
    throw new Error('Server misconfigured: JWT_SECRET is required');
  }
  return s;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  const secret = requireJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  const secret = requireJwtSecret();
  return jwt.verify(token, secret);
}

export function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h) return null;
  const [type, token] = h.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
