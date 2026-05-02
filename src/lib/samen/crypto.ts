/**
 * Samen-specific cryptography: HKDF key derivation for roster encryption.
 * Uses the same Web Crypto API pattern as the tool-level crypto,
 * but with distinct salt/info so roster keys are independent.
 */

const HKDF_SALT = 'samen-team-tool'
const HKDF_INFO = 'samen-roster-v1'
const DTAG_SUFFIX = '-roster'

/** Derive a 256-bit AES-GCM key for roster encryption from a room code. */
export async function deriveRosterKey(roomCode: string): Promise<CryptoKey> {
	const encoder = new TextEncoder()
	const ikm = await crypto.subtle.importKey('raw', encoder.encode(roomCode), 'HKDF', false, [
		'deriveKey',
	])
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: encoder.encode(HKDF_SALT),
			info: encoder.encode(HKDF_INFO),
		},
		ikm,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)
}

/** Compute the roster d-tag: base hash + '-roster' suffix. */
export async function computeRosterDTag(roomCode: string): Promise<string> {
	const encoder = new TextEncoder()
	const hash = await crypto.subtle.digest('SHA-256', encoder.encode(roomCode))
	const bytes = new Uint8Array(hash)
	const base = Array.from(bytes.slice(0, 8))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	return base + DTAG_SUFFIX
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns base64-encoded IV+ciphertext (12-byte IV prepended).
 */
export async function encryptRoster(key: CryptoKey, plaintext: string): Promise<string> {
	const encoder = new TextEncoder()
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		encoder.encode(plaintext),
	)
	const combined = new Uint8Array(iv.length + ciphertext.byteLength)
	combined.set(iv)
	combined.set(new Uint8Array(ciphertext), iv.length)
	return uint8ToBase64(combined)
}

/** Decrypt a base64-encoded IV+ciphertext produced by encryptRoster(). */
export async function decryptRoster(key: CryptoKey, encoded: string): Promise<string> {
	const combined = base64ToUint8(encoded)
	const iv = combined.slice(0, 12)
	const ciphertext = combined.slice(12)
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
	return new TextDecoder().decode(plaintext)
}

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const b of bytes) binary += String.fromCharCode(b)
	return btoa(binary)
}

function base64ToUint8(str: string): Uint8Array {
	const binary = atob(str)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}
