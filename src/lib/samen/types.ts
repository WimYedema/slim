/**
 * Samen shared types — team roster data model.
 * Pure types, no runtime dependencies. Copied into every tool.
 */

/** A team workspace with its roster of members. */
export interface TeamSpace {
	/** Shared secret — HKDF seed (same room code used by tool-specific sync) */
	roomCode: string
	/** Team display name, e.g. "Platform Squad" */
	name: string
	/** The roster */
	members: TeamMember[]
	/** Epoch ms — when the team was created */
	createdAt: number
	/** Epoch ms — bumped on any roster mutation */
	updatedAt: number
}

/** A member of a team. */
export interface TeamMember {
	/** Stable UUID — survives renames, device changes */
	id: string
	/** Canonical display name — the single source of truth */
	displayName: string
	/** Nostr signing pubkeys (one per device) */
	publicKeys: string[]
	/** Owner can manage the roster; member can self-register */
	role: 'owner' | 'member'
	/** Epoch ms */
	joinedAt: number
	/** Epoch ms — updated on activity in any tool */
	lastSeenAt: number
}

/** Cached local identity for cross-tool recognition. */
export interface SamenIdentity {
	/** The member's stable UUID from the roster */
	memberId: string
	/** Current display name */
	displayName: string
	/** This device's Nostr public key (hex) */
	publicKeyHex: string
}
