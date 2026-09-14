import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken, packEncrypted } from '../crypto';

describe('AES-256-GCM Token Encryption', () => {
  it('encrypts and decrypts Canvas tokens accurately', () => {
    const rawToken = '2345~abcde12345FGHIJklmnopQRSTUvwxyz67890';
    const encrypted = encryptToken(rawToken);

    assert.ok(encrypted.encrypted, 'Must produce encrypted ciphertext');
    assert.ok(encrypted.iv, 'Must produce IV');
    assert.ok(encrypted.tag, 'Must produce GCM auth tag');
    assert.notEqual(encrypted.encrypted, rawToken, 'Ciphertext must not match raw token');

    const decrypted = decryptToken(encrypted.encrypted, encrypted.iv, encrypted.tag);
    assert.equal(decrypted, rawToken, 'Decrypted token must match original plaintext');
  });

  it('supports colon-delimited packed format (iv:tag:ciphertext)', () => {
    const rawToken = 'my-canvas-api-token-value-999';
    const encrypted = encryptToken(rawToken);
    const packed = packEncrypted(encrypted);

    assert.ok(packed.includes(':'), 'Packed token must be colon-delimited');

    const decrypted = decryptToken(packed);
    assert.equal(decrypted, rawToken, 'Decrypted packed token must match original');
  });

  it('throws on tampered ciphertext or invalid auth tag', () => {
    const rawToken = 'secret-token';
    const encrypted = encryptToken(rawToken);

    // Swap last hex character keeping even length
    const lastChar = encrypted.encrypted.slice(-1);
    const replacement = lastChar === 'a' ? 'b' : 'a';
    const tampered = encrypted.encrypted.slice(0, -1) + replacement;

    assert.throws(() => {
      decryptToken(tampered, encrypted.iv, encrypted.tag);
    }, /Unsupported state or unable to authenticate data|bad decrypt/);
  });
});
