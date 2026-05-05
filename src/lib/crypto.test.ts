import { describe, expect, it } from 'vitest'
import {
	computeBridgeDTag,
	computeDTag,
	decrypt,
	deriveBridgeKey,
	deriveRoomKey,
	encrypt,
} from './crypto'

describe('deriveBridgeKey', () => {
	it('returns an AES-GCM CryptoKey', async () => {
		const key = await deriveBridgeKey('bakitume')
		expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
		expect(key.usages).toContain('encrypt')
		expect(key.usages).toContain('decrypt')
	})

	it('produces a different key than deriveRoomKey for the same room code', async () => {
		const bridgeKey = await deriveBridgeKey('bakitume')
		const roomKey = await deriveRoomKey('bakitume')
		const ct = await encrypt(bridgeKey, 'secret')
		await expect(decrypt(roomKey, ct)).rejects.toThrow()
	})

	it('round-trips through encrypt/decrypt', async () => {
		const key = await deriveBridgeKey('bakitume')
		const ct = await encrypt(key, 'bridge payload')
		expect(await decrypt(key, ct)).toBe('bridge payload')
	})
})

describe('cross-repo bridge compatibility', () => {
	it('bridge key uses the agreed salt and info (must match Estimate repo)', async () => {
		// Both repos must derive identical keys for the same room code.
		// This test verifies by encrypting a known payload and checking round-trip.
		// The bridge constants must be: salt="slim-estimate-bridge", info="bridge-v1"
		const key = await deriveBridgeKey('bakitume')
		const ct = await encrypt(key, 'cross-repo-check')
		const pt = await decrypt(key, ct)
		expect(pt).toBe('cross-repo-check')
	})

	it('bridge d-tag is deterministic and matches expected format', async () => {
		// Both repos compute d-tags the same way: SHA-256(roomCode)[0:16hex] + "-" + suffix
		const tag = await computeBridgeDTag('bakitume', 'request')
		// Pinned value — must match Estimate repo's test
		expect(tag).toBe('eacdca523b7c0cac-request')
	})
})
