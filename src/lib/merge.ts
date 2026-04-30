import type { BoardData } from './store'
import type { Deliverable, Opportunity, OpportunityDeliverableLink } from './types'

export interface MergeResult {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
	stats: MergeStats
}

export interface MergeStats {
	oppsAdded: number
	oppsUpdated: number
	delsAdded: number
	delsUpdated: number
	linksAdded: number
}

/**
 * Merge incoming board data into an existing board.
 * - Entities matched by ID: incoming `updatedAt` wins if newer, otherwise local kept.
 * - New entities (ID not found locally) are appended.
 * - Links are deduplicated by (opportunityId, deliverableId) pair; incoming wins.
 */
export function mergeBoards(local: BoardData, incoming: BoardData): MergeResult {
	const stats: MergeStats = {
		oppsAdded: 0,
		oppsUpdated: 0,
		delsAdded: 0,
		delsUpdated: 0,
		linksAdded: 0,
	}

	const opportunities = mergeById(
		local.opportunities,
		incoming.opportunities,
		(a, b) => b.updatedAt > a.updatedAt,
		stats,
		'opps',
	)

	const deliverables = mergeById(
		local.deliverables,
		incoming.deliverables,
		(a, b) => b.updatedAt > a.updatedAt,
		stats,
		'dels',
	)

	const links = mergeLinks(local.links, incoming.links, stats)

	return { opportunities, deliverables, links, stats }
}

function mergeById<T extends { id: string }>(
	local: T[],
	incoming: T[],
	shouldReplace: (local: T, incoming: T) => boolean,
	stats: MergeStats,
	kind: 'opps' | 'dels',
): T[] {
	const map = new Map<string, T>()
	for (const item of local) {
		map.set(item.id, item)
	}

	for (const item of incoming) {
		const existing = map.get(item.id)
		if (!existing) {
			map.set(item.id, item)
			if (kind === 'opps') stats.oppsAdded++
			else stats.delsAdded++
		} else if (shouldReplace(existing, item)) {
			map.set(item.id, item)
			if (kind === 'opps') stats.oppsUpdated++
			else stats.delsUpdated++
		}
	}

	// Preserve local ordering: local items first (possibly updated), then new items appended
	const localIds = new Set(local.map((i) => i.id))
	const result: T[] = []
	for (const item of local) {
		result.push(map.get(item.id)!)
	}
	for (const item of incoming) {
		if (!localIds.has(item.id)) {
			result.push(item)
		}
	}

	return result
}

function mergeLinks(
	local: OpportunityDeliverableLink[],
	incoming: OpportunityDeliverableLink[],
	stats: MergeStats,
): OpportunityDeliverableLink[] {
	const key = (l: OpportunityDeliverableLink) => `${l.opportunityId}::${l.deliverableId}`
	const map = new Map<string, OpportunityDeliverableLink>()
	for (const link of local) {
		map.set(key(link), link)
	}
	for (const link of incoming) {
		const k = key(link)
		if (!map.has(k)) {
			stats.linksAdded++
		}
		map.set(k, link) // incoming wins
	}
	return [...map.values()]
}

/** Format merge stats into a human-readable summary */
export function formatMergeStats(stats: MergeStats): string {
	const parts: string[] = []
	if (stats.oppsAdded > 0)
		parts.push(`${stats.oppsAdded} new opportunit${stats.oppsAdded === 1 ? 'y' : 'ies'}`)
	if (stats.oppsUpdated > 0)
		parts.push(`${stats.oppsUpdated} opportunit${stats.oppsUpdated === 1 ? 'y' : 'ies'} updated`)
	if (stats.delsAdded > 0)
		parts.push(`${stats.delsAdded} new deliverable${stats.delsAdded === 1 ? '' : 's'}`)
	if (stats.delsUpdated > 0)
		parts.push(`${stats.delsUpdated} deliverable${stats.delsUpdated === 1 ? '' : 's'} updated`)
	if (stats.linksAdded > 0)
		parts.push(`${stats.linksAdded} new link${stats.linksAdded === 1 ? '' : 's'}`)
	if (parts.length === 0) return 'No changes — boards are identical.'
	return `Merged: ${parts.join(', ')}.`
}
