import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "replace-this-in-env-with-a-long-secret"
);

export type SessionPayload = {
  sub: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const verified = await jwtVerify<SessionPayload>(token, secret);
  return verified.payload;
}
