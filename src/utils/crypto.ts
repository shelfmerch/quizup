/**
 * Cryptographic helper module for client-side End-to-End Encryption (E2E).
 * Uses the native Web Crypto API (supported in all modern browsers).
 * Key Exchange: ECDH (P-256 curve)
 * Symmetric Encryption: AES-GCM (256-bit key, 12-byte IV)
 */

/** Generate a new ECDH P-256 keypair for E2E encryption. */
export async function generateE2eKeypair(): Promise<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
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
    true, // extractable
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

  // Convert IV and Ciphertext to Base64 strings for transmission
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));

  return `e2e:${ivBase64}:${ciphertextBase64}`;
}

/** Decrypt a formatted E2E message (e2e:iv:ciphertext) using a derived shared key. */
export async function decryptMessage(sharedKey: CryptoKey, encryptedPayload: string): Promise<string> {
  if (!encryptedPayload.startsWith("e2e:")) {
    return encryptedPayload; // Not encrypted, return plain text (fallback)
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid E2E message format");
  }

  const ivBase64 = parts[1];
  const ciphertextBase64 = parts[2];

  // Decode from Base64
  const iv = new Uint8Array(
    atob(ivBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const ciphertext = new Uint8Array(
    atob(ciphertextBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

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
