import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

export function readTwoFactorKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(value)) throw new Error("TOTP_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  return Buffer.from(value, "hex");
}

export function encryptTotp(secret: string, key: Buffer, userId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`sw-exchange:totp:v1:${userId}`));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptTotp(value: string, key: Buffer, userId: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted TOTP state.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`sw-exchange:totp:v1:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export const hashCredential = (value: string) => createHash("sha256").update(value).digest("hex");
export const newTotpSecret = () => generateSecret();
export const provisioningUri = (secret: string, email: string) => generateURI({ issuer: "SW Exchange", label: email, secret, algorithm: "sha1", digits: 6, period: 30 });
export async function verifyTotp(secret: string, token: string, afterTimeStep?: number) {
  if (!/^\d{6}$/.test(token)) return null;
  const result = await verify({ secret, token, algorithm: "sha1", digits: 6, period: 30, epochTolerance: 30, afterTimeStep });
  return result.valid && "timeStep" in result ? result.timeStep : null;
}
export const newRecoveryCodes = () => Array.from({ length: 10 }, () => randomBytes(16).toString("hex").match(/.{8}/g)!.join("-"));
export function recoveryHash(userId: string, code: string) {
  return hashCredential(`${userId}:${code.replace(/-/g, "").toLowerCase()}`);
}
