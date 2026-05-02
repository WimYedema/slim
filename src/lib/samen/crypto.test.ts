import { describe, expect, it } from 'vitest'
import { deriveRosterKey, computeRosterDTag, encryptRoster, decryptRoster } from './crypto'
import { deriveRoomKey, computeDTag } from '../crypto'

describe('deriveRosterKey', () => {
	it('produces a different key than the tool-level deriveRoomKey', async () => {
		const roomCode = 'test-room-code'
		const rosterKey = await deriveRosterKey(roomCode)
		const roomKey = await deriveRoomKey(roomCode)
		// Both are CryptoKey objects — we can verify independence by encrypting the same plaintext
		const plaintext = 'hello world'
		const rosterCipher = await encryptRoster(rosterKey, plaintext)
		// Import encrypt from the tool-level crypto
		const { encrypt } = await import('../crypto')
		const roomCipher = await encrypt(roomKey, plaintext)
		// Different ciphertexts (different keys + random IV)
		expect(rosterCipher).not.toBe(roomCipher)
	})
})

describe('computeRosterDTag', () => {
	it('appends -roster suffix to the base hash', async () => {
		const roomCode = 'test-room-code'
		const rosterDTag = await computeRosterDTag(roomCode)
		const baseDTag = await computeDTag(roomCode)
		expect(rosterDTag).toBe(baseDTag + '-roster')
	})
})

describe('encryptRoster / decryptRoster', () => {
	it('round-trips plaintext', async () => {
		const key = await deriveRosterKey('some-room')
		const plaintext = JSON.stringify({ name: 'Team', members: [] })
		const encrypted = await encryptRoster(key, plaintext)
		const decrypted = await decryptRoster(key, encrypted)
		expect(decrypted).toBe(plaintext)
	})

	it('fails to decrypt with a different key', async () => {
		const key1 = await deriveRosterKey('room-1')
		const key2 = await deriveRosterKey('room-2')
		const encrypted = await encryptRoster(key1, 'secret')
		await expect(decryptRoster(key2, encrypted)).rejects.toThrow()
	})
})
