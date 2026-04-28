import { collectPeople, type MeetingData } from './meeting'
import type { BoardData } from './store'
import type { Deliverable, Opportunity, OpportunityDeliverableLink } from './types'
import {
	agingLevel,
	commitmentUrgency,
	daysInStage,
	type HorizonPressure,
	isFutureHorizon,
	pacingSummary,
	PERSPECTIVE_LABELS,
	PERSPECTIVES,
	STAGES,
	stageIndex,
	stageLabel,
} from './types'

// ── Snapshot ──

/** A frozen copy of the board state at the time the user last viewed the briefing */
export interface BoardSnapshot {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
	takenAt: number
	/** Stable keys of individually dismissed items (verb:targetId) */
	dismissedKeys?: string[]
}

export function snapshotBoard(data: BoardData): BoardSnapshot {
	return {
		opportunities: structuredClone(data.opportunities),
		deliverables: structuredClone(data.deliverables),
		links: structuredClone(data.links),
		takenAt: Date.now(),
	}
}

/** Stable key for a briefing item, used for per-item dismissal */
export function briefingKey(item: AnyBriefingItem): string {
	if (isGrouped(item)) {
		const ids = item.targets.map(t => t.id).sort().join(',')
		return `${item.verb}:${ids}`
	}
	return `${item.verb}:${item.targetId}`
}

// ── Change items ──

export type ChangeVerb =
	| 'added'
	| 'removed'
	| 'stage-changed'
	| 'signal-changed'
	| 'objection-added'
	| 'objection-resolved'
	| 'exited'
	| 'reactivated'
	| 'commitment-overdue'
	| 'commitment-due-soon'
	| 'stale'
	| 'deliverable-added'
	| 'deliverable-removed'
	| 'link-added'
	| 'link-removed'
	| 'unscored-assignment'
	| 'meeting-overdue'
	| 'deliverable-changed'
	| 'revisit-due'

export type ImportanceTier = 1 | 2 | 3

export interface BriefingItem {
	id: string
	targetType: 'opportunity' | 'deliverable'
	targetId: string
	targetTitle: string
	verb: ChangeVerb
	description: string
	detail?: string
	tier: ImportanceTier
	timestamp: number
}

export interface GroupedBriefingItem {
	id: string
	verb: ChangeVerb
	description: string
	detail?: string
	targets: { type: 'opportunity' | 'deliverable'; id: string; title: string }[]
	tier: ImportanceTier
	timestamp: number
}

export type AnyBriefingItem = BriefingItem | GroupedBriefingItem

export function isGrouped(item: AnyBriefingItem): item is GroupedBriefingItem {
	return 'targets' in item
}

// ── Tier classification ──

const TIER_MAP: Record<ChangeVerb, ImportanceTier> = {
	'objection-added': 1,
	'commitment-overdue': 1,
	stale: 1,
	exited: 1,
	'stage-changed': 2,
	added: 2,
	'signal-changed': 2,
	reactivated: 2,
	'objection-resolved': 2,
	'commitment-due-soon': 2,
	'deliverable-added': 2,
	removed: 3,
	'deliverable-removed': 3,
	'link-added': 3,
	'link-removed': 3,
	'unscored-assignment': 1,
	'meeting-overdue': 2,
	'deliverable-changed': 2,
	'revisit-due': 1,
}

// ── Diff engine ──

let nextItemId = 0
function itemId(): string {
	return `bi-${++nextItemId}`
}

function diffOpportunities(
	prev: Opportunity[],
	curr: Opportunity[],
	prevLinks: OpportunityDeliverableLink[],
	currLinks: OpportunityDeliverableLink[],
	now: number,
): BriefingItem[] {
	const items: BriefingItem[] = []
	const prevMap = new Map(prev.map((o) => [o.id, o]))
	const currMap = new Map(curr.map((o) => [o.id, o]))

	// New opportunities
	for (const opp of curr) {
		if (!prevMap.has(opp.id)) {
			const advanced = stageIndex(opp.stage) > 0
			const desc = advanced
				? `Advanced to ${stageLabel(opp.stage)}`
				: `New in ${stageLabel(opp.stage)}`
			const activeInStage = curr.filter(o => !o.discontinuedAt && o.stage === opp.stage).length
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'added',
				description: desc,
				detail: `Now ${activeInStage} in ${stageLabel(opp.stage)}`,
				tier: TIER_MAP.added,
				timestamp: opp.createdAt,
			})
		}
	}

	// Removed opportunities
	for (const opp of prev) {
		if (!currMap.has(opp.id)) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'removed',
				description: 'Removed from board',
				tier: TIER_MAP.removed,
				timestamp: now,
			})
		}
	}

	// Changed opportunities
	for (const opp of curr) {
		const old = prevMap.get(opp.id)
		if (!old) continue

		// Stage change
		if (opp.stage !== old.stage) {
			const forward = stageIndex(opp.stage) > stageIndex(old.stage)
			const activeInTo = curr.filter(o => !o.discontinuedAt && o.stage === opp.stage).length
			const activeInFrom = curr.filter(o => !o.discontinuedAt && o.stage === old.stage).length
			const verb = forward ? 'Advanced to' : 'Returned to'
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'stage-changed',
				description: `${verb} ${stageLabel(opp.stage)}`,
				detail: `Now ${activeInFrom} in ${stageLabel(old.stage)} and ${activeInTo} in ${stageLabel(opp.stage)}`,
				tier: TIER_MAP['stage-changed'],
				timestamp: opp.stageEnteredAt,
			})
		}

		// Exited
		if (!old.discontinuedAt && opp.discontinuedAt) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'exited',
				description: `Exited${opp.exitState ? ` (${opp.exitState})` : ''} at ${stageLabel(opp.stage)}`,
				tier: TIER_MAP.exited,
				timestamp: opp.discontinuedAt,
			})
		}

		// Reactivated
		if (old.discontinuedAt && !opp.discontinuedAt) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'reactivated',
				description: `Reactivated in ${stageLabel(opp.stage)}`,
				tier: TIER_MAP.reactivated,
				timestamp: opp.updatedAt,
			})
		}

		// Signal changes (per stage/perspective)
		diffSignals(old, opp, items)

		// Link changes
		diffLinks(opp, prevLinks, currLinks, items)
	}

	// Current-state warnings (not diffs — always computed fresh)
	for (const opp of curr) {
		if (opp.discontinuedAt) continue

		// Overdue commitments
		const cu = commitmentUrgency(opp)
		if (cu && cu.daysLeft < 0) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'commitment-overdue',
				description: `Commitment to ${cu.commitment.to} is ${Math.abs(cu.daysLeft)}d overdue — reach ${stageLabel(cu.commitment.milestone)}`,
				tier: TIER_MAP['commitment-overdue'],
				timestamp: now,
			})
		} else if (cu && cu.daysLeft <= 7) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'commitment-due-soon',
				description: `Commitment to ${cu.commitment.to} due in ${cu.daysLeft}d — reach ${stageLabel(cu.commitment.milestone)}`,
				tier: TIER_MAP['commitment-due-soon'],
				timestamp: now,
			})
		}

		// Gone stale — horizon-aware, only report when newly stale (not stale in snapshot)
		const pressure: HorizonPressure = opp.horizon
			? isFutureHorizon(opp.horizon)
				? 'next'
				: 'now'
			: 'none'
		if (agingLevel(opp, pressure) === 'stale') {
			const oldOpp = prevMap.get(opp.id)
			const wasStale = oldOpp && agingLevel(oldOpp, pressure) === 'stale'
			if (!wasStale) {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: opp.id,
					targetTitle: opp.title,
					verb: 'stale',
					description: `Gone stale — ${pacingSummary(opp, pressure)}`,
					tier: TIER_MAP.stale,
					timestamp: now,
				})
			}
		}
	}

	return items
}

function diffSignals(old: Opportunity, curr: Opportunity, items: BriefingItem[]): void {
	for (const stage of STAGES) {
		for (const p of PERSPECTIVES) {
			const oldScore = old.signals[stage.key][p].score
			const newScore = curr.signals[stage.key][p].score
			if (oldScore === newScore) continue

			// Objection added
			if (newScore === 'negative' && oldScore !== 'negative') {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: curr.id,
					targetTitle: curr.title,
					verb: 'objection-added',
					description: `${PERSPECTIVE_LABELS[p]} objection at ${stage.label}`,
					tier: TIER_MAP['objection-added'],
					timestamp: curr.updatedAt,
				})
			}
			// Objection resolved
			else if (oldScore === 'negative' && newScore !== 'negative') {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: curr.id,
					targetTitle: curr.title,
					verb: 'objection-resolved',
					description: `${PERSPECTIVE_LABELS[p]} objection cleared at ${stage.label}`,
					tier: TIER_MAP['objection-resolved'],
					timestamp: curr.updatedAt,
				})
			}
			// Other signal change
			else {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: curr.id,
					targetTitle: curr.title,
					verb: 'signal-changed',
					description: `${PERSPECTIVE_LABELS[p]} updated at ${stage.label}`,
					tier: TIER_MAP['signal-changed'],
					timestamp: curr.updatedAt,
				})
			}
		}
	}
}

function diffLinks(
	opp: Opportunity,
	prevLinks: OpportunityDeliverableLink[],
	currLinks: OpportunityDeliverableLink[],
	items: BriefingItem[],
): void {
	const prevOppLinks = new Set(
		prevLinks.filter((l) => l.opportunityId === opp.id).map((l) => l.deliverableId),
	)
	const currOppLinks = new Set(
		currLinks.filter((l) => l.opportunityId === opp.id).map((l) => l.deliverableId),
	)

	for (const delId of currOppLinks) {
		if (!prevOppLinks.has(delId)) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'link-added',
				description: 'Deliverable linked',
				tier: TIER_MAP['link-added'],
				timestamp: opp.updatedAt,
			})
		}
	}

	for (const delId of prevOppLinks) {
		if (!currOppLinks.has(delId)) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'link-removed',
				description: 'Deliverable unlinked',
				tier: TIER_MAP['link-removed'],
				timestamp: opp.updatedAt,
			})
		}
	}
}

function diffDeliverables(prev: Deliverable[], curr: Deliverable[], now: number): BriefingItem[] {
	const items: BriefingItem[] = []
	const prevMap = new Map(prev.map((d) => [d.id, d]))

	for (const del of curr) {
		const old = prevMap.get(del.id)
		if (!old) {
			items.push({
				id: itemId(),
				targetType: 'deliverable',
				targetId: del.id,
				targetTitle: del.title,
				verb: 'deliverable-added',
				description: `New${del.size ? ` (${del.size})` : ''}`,
				tier: TIER_MAP['deliverable-added'],
				timestamp: now,
			})
			continue
		}

		// Field-level changes
		const changes: string[] = []
		if (del.size !== old.size) changes.push(`size → ${del.size ?? 'unset'}`)
		if (del.certainty !== old.certainty) changes.push(`certainty → ${del.certainty ?? 'unset'}`)
		if (del.externalDependency !== old.externalDependency) {
			changes.push(
				del.externalDependency ? 'external dependency updated' : 'external dependency cleared',
			)
		}
		const addedContribs = del.extraContributors.filter((c) => !old.extraContributors.includes(c))
		const removedContribs = old.extraContributors.filter((c) => !del.extraContributors.includes(c))
		if (addedContribs.length > 0) changes.push(`+${addedContribs.join(', ')}`)
		if (removedContribs.length > 0) changes.push(`-${removedContribs.join(', ')}`)

		if (changes.length > 0) {
			items.push({
				id: itemId(),
				targetType: 'deliverable',
				targetId: del.id,
				targetTitle: del.title,
				verb: 'deliverable-changed',
				description: changes.join(', '),
				tier: TIER_MAP['deliverable-changed'],
				timestamp: del.updatedAt,
			})
		}
	}

	const currMap = new Map(curr.map((d) => [d.id, d]))
	for (const del of prev) {
		if (!currMap.has(del.id)) {
			items.push({
				id: itemId(),
				targetType: 'deliverable',
				targetId: del.id,
				targetTitle: del.title,
				verb: 'deliverable-removed',
				description: 'Removed',
				tier: TIER_MAP['deliverable-removed'],
				timestamp: now,
			})
		}
	}

	return items
}

// ── People / meeting warnings ──

const MEETING_OVERDUE_DAYS = 7

function peopleWarnings(
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	meetingData: MeetingData | null,
	now: number,
): BriefingItem[] {
	const items: BriefingItem[] = []

	// Unscored assignments: person assigned to a perspective but hasn't scored yet
	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue
		for (const person of opp.people) {
			for (const pa of person.perspectives) {
				const signal = opp.signals[pa.stage][pa.perspective]
				if (signal.score === 'none') {
					const daysSince = Math.floor((now - pa.assignedAt) / 86_400_000)
					items.push({
						id: itemId(),
						targetType: 'opportunity',
						targetId: opp.id,
						targetTitle: opp.title,
						verb: 'unscored-assignment',
						description: `Awaiting ${PERSPECTIVE_LABELS[pa.perspective]} input at ${stageLabel(pa.stage)} — ${person.name} (${daysSince}d)`,
						tier: TIER_MAP['unscored-assignment'],
						timestamp: pa.assignedAt,
					})
				}
			}
		}
	}

	// Meeting overdue: person last met > threshold days ago and has pending items
	if (meetingData) {
		const people = collectPeople(opportunities, deliverables)
		for (const person of people.values()) {
			if (
				person.isCommitmentTarget &&
				person.opportunityIds.length === 0 &&
				person.deliverableIds.length === 0
			)
				continue
			const lastMet = meetingData.lastDiscussed[person.name]
			if (!lastMet) continue // never met — that's expected for new people
			const daysSince = Math.floor((now - lastMet) / 86_400_000)
			if (daysSince > MEETING_OVERDUE_DAYS) {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: person.opportunityIds[0] ?? '',
					targetTitle: person.name,
					verb: 'meeting-overdue',
					description: `Last met ${daysSince}d ago`,
					tier: TIER_MAP['meeting-overdue'],
					timestamp: lastMet,
				})
			}
		}
	}

	return items
}

/** Parked opportunities whose parkUntil horizon has arrived */
function revisitDueItems(opps: Opportunity[], now: number): BriefingItem[] {
	const items: BriefingItem[] = []
	for (const opp of opps) {
		if (!opp.discontinuedAt || opp.exitState !== 'parked' || !opp.parkUntil) continue
		if (!isFutureHorizon(opp.parkUntil)) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: opp.id,
				targetTitle: opp.title,
				verb: 'revisit-due',
				description: `Time to revisit — parked until ${opp.parkUntil}`,
				tier: TIER_MAP['revisit-due'],
				timestamp: now,
			})
		}
	}
	return items
}

/** Compute all briefing items by diffing current board against a snapshot */
export function diffBoard(
	snapshot: BoardSnapshot | null,
	current: BoardData,
	meetingData?: MeetingData | null,
): BriefingItem[] {
	const now = Date.now()

	if (!snapshot) {
		// No prior snapshot — show current-state warnings only
		const warnings = diffOpportunities([], current.opportunities, [], current.links, now)
		const revisitItems = revisitDueItems(current.opportunities, now)
		const pWarnings = peopleWarnings(
			current.opportunities,
			current.deliverables,
			meetingData ?? null,
			now,
		)
		const all = [...warnings, ...revisitItems, ...pWarnings]
		all.sort((a, b) => a.tier - b.tier || b.timestamp - a.timestamp)
		return all
	}

	const oppItems = diffOpportunities(
		snapshot.opportunities,
		current.opportunities,
		snapshot.links,
		current.links,
		now,
	)
	const delItems = diffDeliverables(snapshot.deliverables, current.deliverables, now)
	const revisitItems = revisitDueItems(current.opportunities, now)
	const pWarnings = peopleWarnings(
		current.opportunities,
		current.deliverables,
		meetingData ?? null,
		now,
	)

	const all = [...oppItems, ...delItems, ...revisitItems, ...pWarnings]

	// Sort: tier 1 first, then tier 2, then tier 3. Within each tier, newest first.
	all.sort((a, b) => a.tier - b.tier || b.timestamp - a.timestamp)

	return all
}

/** Deduplicate items targeting the same entity with the same verb */
export function deduplicateItems(items: BriefingItem[]): BriefingItem[] {
	const seen = new Set<string>()
	return items.filter((item) => {
		const key = `${item.targetType}:${item.targetId}:${item.verb}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

/** Verbs that should be grouped when multiple items share the same verb+description pattern */
const GROUPABLE_VERBS: Set<ChangeVerb> = new Set([
	'added',
	'stage-changed',
	'deliverable-added',
	'link-added',
	'link-removed',
])

/**
 * Group items with the same verb into a single compound item.
 * E.g., 3 "added" opportunities in Sketch → one row: "New in Sketch: A, B, C"
 */
export function groupItems(items: BriefingItem[]): AnyBriefingItem[] {
	const result: AnyBriefingItem[] = []
	const groups = new Map<string, BriefingItem[]>()

	for (const item of items) {
		if (GROUPABLE_VERBS.has(item.verb)) {
			const key = `${item.verb}:${item.description}`
			const group = groups.get(key)
			if (group) {
				group.push(item)
			} else {
				groups.set(key, [item])
			}
		} else {
			result.push(item)
		}
	}

	for (const [, group] of groups) {
		if (group.length === 1) {
			result.push(group[0])
		} else {
			result.push({
				id: group[0].id,
				verb: group[0].verb,
				description: group[0].description,
				detail: group[0].detail,
				targets: group.map((i) => ({ type: i.targetType, id: i.targetId, title: i.targetTitle })),
				tier: group[0].tier,
				timestamp: Math.max(...group.map((i) => i.timestamp)),
			})
		}
	}

	// Re-sort: tier first, then timestamp desc
	result.sort((a, b) => a.tier - b.tier || b.timestamp - a.timestamp)

	return result
}
