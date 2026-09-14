import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || 'canvasflow-default-secret-change-in-prod-32b';
  // Always derive a 32-byte key via SHA-256 to ensure exact key length
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export interface EncryptedPayload {
  encrypted: string; // Hex-encoded ciphertext
  iv: string;        // Hex-encoded IV
  tag: string;       // Hex-encoded auth tag
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 */
export function encryptToken(plaintext: string): EncryptedPayload {
  if (!plaintext) {
    throw new Error('Plaintext token cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt an AES-256-GCM encrypted token.
 * Supports passing separated fields or a single colon-delimited string (iv:tag:ciphertext).
 */
export function decryptToken(encrypted: string, iv?: string, tag?: string | null): string {
  if (!encrypted) {
    throw new Error('Encrypted payload cannot be empty');
  }

  let cipherTextHex = encrypted;
  let ivHex = iv;
  let tagHex = tag || undefined;

  // Handle format iv:tag:ciphertext
  if (!ivHex && encrypted.includes(':')) {
    const parts = encrypted.split(':');
    if (parts.length === 3) {
      ivHex = parts[0];
      tagHex = parts[1];
      cipherTextHex = parts[2];
    }
  }

  if (!ivHex) {
    throw new Error('Initialization vector (IV) is required for decryption');
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));

  if (tagHex) {
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  }

  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Packs encrypted payload into a single portable string format.
 */
export function packEncrypted(payload: EncryptedPayload): string {
  return `${payload.iv}:${payload.tag}:${payload.encrypted}`;
}
