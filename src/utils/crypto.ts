/**
 * Cryptographic helper module for client-side End-to-End Encryption (E2E).
 * Uses the native Web Crypto API (supported in all modern browsers).
 * Key Exchange: ECDH (P-256 curve)
 * Symmetric Encryption: AES-GCM (256-bit key, 12-byte IV)
 */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Parse a stored public key (handles accidental double JSON encoding). */
export function parsePublicKeyJwk(stored: string): JsonWebKey {
  let value: unknown = JSON.parse(stored.trim());
  while (typeof value === "string") {
    value = JSON.parse(value);
  }
  if (!value || typeof value !== "object") {
    throw new Error("Invalid E2E public key format");
  }
  const jwk = value as JsonWebKey;
  if (jwk.kty !== "EC") {
    throw new Error("Invalid E2E public key format");
  }
  return jwk;
}

/** Generate a new ECDH P-256 keypair for E2E encryption. */
export async function generateE2eKeypair(): Promise<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

/** Derive a shared symmetric AES-GCM key from my private key and peer's public key. */
export async function deriveSharedKey(
  myPrivateKeyJwk: JsonWebKey,
  peerPublicKeyJwk: JsonWebKey
): Promise<CryptoKey> {
  const myPrivateKey = await window.crypto.subtle.importKey(
    "jwk",
    myPrivateKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );

  const peerPublicKey = await window.crypto.subtle.importKey(
    "jwk",
    peerPublicKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    myPrivateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a plaintext string using a derived symmetric AES-GCM key. */
export async function encryptMessage(sharedKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    encodedText
  );

  return `e2e:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertextBuffer))}`;
}

/** Decrypt a formatted E2E message (e2e:iv:ciphertext) using a derived shared key. */
export async function decryptMessage(sharedKey: CryptoKey, encryptedPayload: string): Promise<string> {
  if (!encryptedPayload.startsWith("e2e:")) {
    return encryptedPayload;
  }

  const rest = encryptedPayload.slice(4);
  const sep = rest.indexOf(":");
  if (sep <= 0) {
    throw new Error("Invalid E2E message format");
  }

  const iv = base64ToBytes(rest.slice(0, sep));
  const ciphertext = base64ToBytes(rest.slice(sep + 1));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export function e2eStorageKeys(userId: string) {
  return {
    private: `quizup_e2e_private_${userId}`,
    public: `quizup_e2e_public_${userId}`,
  };
}
