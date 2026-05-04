import { describe, expect, it } from 'vitest'
import {
	addMember,
	addPublicKey,
	createTeamSpace,
	findMemberByName,
	findMemberByPubkey,
	removeMember,
	renameMember,
	rosterNames,
	touchMember,
} from './roster'
import type { TeamSpace } from './types'

function makeTeam(): TeamSpace {
	return createTeamSpace('room-123', 'Test Squad', 'Alice', 'pubkey-alice')
}

describe('createTeamSpace', () => {
	it('creates a team with the owner as first member', () => {
		const team = makeTeam()
		expect(team.roomCode).toBe('room-123')
		expect(team.name).toBe('Test Squad')
		expect(team.members).toHaveLength(1)
		expect(team.members[0].displayName).toBe('Alice')
		expect(team.members[0].role).toBe('owner')
		expect(team.members[0].publicKeys).toEqual(['pubkey-alice'])
		expect(team.members[0].id).toBeTruthy()
		expect(team.createdAt).toBeGreaterThan(0)
		expect(team.updatedAt).toBe(team.createdAt)
	})
})

describe('addMember', () => {
	it('adds a new member', () => {
		const team = addMember(makeTeam(), 'Bob', 'pubkey-bob')
		expect(team.members).toHaveLength(2)
		const bob = team.members[1]
		expect(bob.displayName).toBe('Bob')
		expect(bob.role).toBe('member')
		expect(bob.publicKeys).toEqual(['pubkey-bob'])
	})

	it('merges pubkey when name already exists (case-insensitive)', () => {
		const team = addMember(makeTeam(), 'alice', 'pubkey-alice-phone')
		expect(team.members).toHaveLength(1)
		expect(team.members[0].publicKeys).toEqual(['pubkey-alice', 'pubkey-alice-phone'])
	})

	it('does not duplicate pubkey on re-add', () => {
		const team = addMember(makeTeam(), 'Alice', 'pubkey-alice')
		expect(team.members).toHaveLength(1)
		expect(team.members[0].publicKeys).toEqual(['pubkey-alice'])
	})
})

describe('removeMember', () => {
	it('removes a member by ID', () => {
		let team = addMember(makeTeam(), 'Bob', 'pubkey-bob')
		const bobId = team.members[1].id
		team = removeMember(team, bobId)
		expect(team.members).toHaveLength(1)
		expect(team.members[0].displayName).toBe('Alice')
	})

	it('is a no-op for unknown ID', () => {
		const team = removeMember(makeTeam(), 'nonexistent')
		expect(team.members).toHaveLength(1)
	})
})

describe('renameMember', () => {
	it('renames a member', () => {
		const team = renameMember(makeTeam(), makeTeam().members[0].id, 'Alicia')
		// Need to use the same team instance
		const t = makeTeam()
		const renamed = renameMember(t, t.members[0].id, 'Alicia')
		expect(renamed.members[0].displayName).toBe('Alicia')
		expect(renamed.updatedAt).toBeGreaterThanOrEqual(t.createdAt)
	})
})

describe('addPublicKey', () => {
	it('adds a new pubkey to a member', () => {
		const team = makeTeam()
		const updated = addPublicKey(team, team.members[0].id, 'pubkey-alice-tablet')
		expect(updated.members[0].publicKeys).toEqual(['pubkey-alice', 'pubkey-alice-tablet'])
	})

	it('does not duplicate an existing pubkey', () => {
		const team = makeTeam()
		const updated = addPublicKey(team, team.members[0].id, 'pubkey-alice')
		expect(updated.members[0].publicKeys).toEqual(['pubkey-alice'])
	})
})

describe('touchMember', () => {
	it('updates lastSeenAt', () => {
		const team = makeTeam()
		const before = team.members[0].lastSeenAt
		const updated = touchMember(team, team.members[0].id)
		expect(updated.members[0].lastSeenAt).toBeGreaterThanOrEqual(before)
	})
})

describe('findMemberByPubkey', () => {
	it('finds a member by pubkey', () => {
		const team = addMember(makeTeam(), 'Bob', 'pubkey-bob')
		const found = findMemberByPubkey(team, 'pubkey-bob')
		expect(found?.displayName).toBe('Bob')
	})

	it('returns undefined for unknown pubkey', () => {
		expect(findMemberByPubkey(makeTeam(), 'unknown')).toBeUndefined()
	})
})

describe('findMemberByName', () => {
	it('finds by exact name', () => {
		expect(findMemberByName(makeTeam(), 'Alice')?.role).toBe('owner')
	})

	it('finds case-insensitively', () => {
		expect(findMemberByName(makeTeam(), 'alice')?.role).toBe('owner')
	})

	it('trims whitespace', () => {
		expect(findMemberByName(makeTeam(), '  Alice  ')?.role).toBe('owner')
	})

	it('returns undefined for unknown name', () => {
		expect(findMemberByName(makeTeam(), 'Charlie')).toBeUndefined()
	})
})

describe('rosterNames', () => {
	it('returns sorted display names', () => {
		let team = addMember(makeTeam(), 'Charlie', 'pk-c')
		team = addMember(team, 'Bob', 'pk-b')
		expect(rosterNames(team)).toEqual(['Alice', 'Bob', 'Charlie'])
	})
})
