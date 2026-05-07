import { collectPeople, type MeetingData } from './meeting'
import type { BoardData } from './store'
import type { Deliverable, Opportunity, OpportunityDeliverableLink } from './types'
import {
	agingLevel,
	commitmentUrgency,
	type HorizonPressure,
	isFutureHorizon,
	PERSPECTIVE_LABELS,
	PERSPECTIVES,
	pacingSummary,
	STAGES,
	sizeFromEstimate,
	stageIndex,
	stageLabel,
	wipLevel,
	wipNudge,
} from './types'

// ── Snapshot ──

/** A frozen copy of the board state at the time the user last viewed the briefing */
export interface BoardSnapshot {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
	takenAt: number
	/** @deprecated Use readKeys instead. Kept for backward compatibility. */
	dismissedKeys?: string[]
	/** Keys of items the user has marked as read (individual ×) */
	readKeys?: string[]
	/** Items from previous "Mark all read" actions, shown in Read band until decay */
	readItems?: StoredReadItem[]
	/** Active conditions from last render, used for resolution detection */
	activeConditions?: Record<string, StoredCondition>
}

export function snapshotBoard(data: BoardData): BoardSnapshot {
	return {
		opportunities: JSON.parse(JSON.stringify(data.opportunities)),
		deliverables: JSON.parse(JSON.stringify(data.deliverables)),
		links: JSON.parse(JSON.stringify(data.links)),
		takenAt: Date.now(),
	}
}

/** Stable key for a briefing item, used for per-item dismissal */
export function briefingKey(item: AnyBriefingItem): string {
	if (isGrouped(item)) {
		const ids = item.targets
			.map((t) => t.id)
			.sort()
			.join(',')
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
	| 'estimate-received'
	| 'revisit-due'
	| 'wip-over'
	| 'wip-under'
	| 'resolved'

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
	'estimate-received': 2,
	'revisit-due': 1,
	'wip-over': 2,
	'wip-under': 3,
	resolved: 3,
}

// ── Aging model ──

/** Verbs that represent current-state conditions (recomputed fresh every render) */
export const CONDITION_VERBS: ReadonlySet<ChangeVerb> = new Set([
	'commitment-overdue',
	'commitment-due-soon',
	'stale',
	'revisit-due',
	'unscored-assignment',
	'meeting-overdue',
	'wip-over',
	'wip-under',
])

/** Age band determines visual grouping in the feed */
export type AgeBand = 'fresh' | 'read' | 'older'

/** Thresholds for age band computation */
const FRESH_MS = 24 * 60 * 60 * 1000 // < 1 day = fresh
const OLDER_MS = 3 * 24 * 60 * 60 * 1000 // > 3 days = older
export const DECAY_MS = 5 * 24 * 60 * 60 * 1000 // > 5 days = removed (events only)
/** Minimum condition visibility (ms) before a resolution notice is emitted */
const FLAP_THRESHOLD_MS = 24 * 60 * 60 * 1000

/** Stored metadata for a condition that was active in the previous render */
export interface StoredCondition {
	firstSeen: number
	title: string
	targetId: string
	targetType: 'opportunity' | 'deliverable'
	verb: ChangeVerb
}

/** A read item stored from a previous "Mark all read" action */
export interface StoredReadItem {
	key: string
	verb: ChangeVerb
	targetType: 'opportunity' | 'deliverable'
	targetId: string
	targetTitle: string
	description: string
	detail?: string
	tier: ImportanceTier
	timestamp: number
	readAt: number
}

/** Human labels for resolution notices */
const RESOLUTION_LABELS: Partial<Record<ChangeVerb, string>> = {
	'commitment-overdue': 'Commitment fulfilled',
	'commitment-due-soon': 'Commitment met',
	stale: 'No longer stale',
	'unscored-assignment': 'Input received',
	'meeting-overdue': 'Meeting held',
	'revisit-due': 'Revisited',
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
			const activeInStage = curr.filter((o) => !o.discontinuedAt && o.stage === opp.stage).length
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
			const activeInTo = curr.filter((o) => !o.discontinuedAt && o.stage === opp.stage).length
			const activeInFrom = curr.filter((o) => !o.discontinuedAt && o.stage === old.stage).length
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

			const owner = curr.signals[stage.key][p].owner
			const byWhom = owner ? ` by ${owner}` : ''

			// Objection added
			if (newScore === 'negative' && oldScore !== 'negative') {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: curr.id,
					targetTitle: curr.title,
					verb: 'objection-added',
					description: `${PERSPECTIVE_LABELS[p]} objection at ${stage.label}${byWhom}`,
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
					description: `${PERSPECTIVE_LABELS[p]} objection cleared at ${stage.label}${byWhom}`,
					tier: TIER_MAP['objection-resolved'],
					timestamp: curr.updatedAt,
				})
			}
			// New verdict (was unscored)
			else if (oldScore === 'none') {
				items.push({
					id: itemId(),
					targetType: 'opportunity',
					targetId: curr.id,
					targetTitle: curr.title,
					verb: 'signal-changed',
					description: `${PERSPECTIVE_LABELS[p]} verdict in${byWhom} at ${stage.label}`,
					tier: TIER_MAP['signal-changed'],
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
					description: `${PERSPECTIVE_LABELS[p]} updated${byWhom} at ${stage.label}`,
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

		// Estimate received or updated
		if (del.estimate && (!old.estimate || del.estimate.estimatedAt > old.estimate.estimatedAt)) {
			const desc = `Estimated: ${del.estimate.snappedValue} (${del.estimate.n} estimators)`
			// Check for size mismatch between manual and estimate-derived
			const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const
			let detail: string | undefined
			if (del.size) {
				const derived = sizeFromEstimate(del.estimate)
				const manualIdx = SIZES.indexOf(del.size)
				const derivedIdx = SIZES.indexOf(derived)
				if (Math.abs(manualIdx - derivedIdx) >= 2) {
					detail = `You sized ${del.size}, team estimated ${derived} — worth reviewing?`
				}
			}
			items.push({
				id: itemId(),
				targetType: 'deliverable',
				targetId: del.id,
				targetTitle: del.title,
				verb: 'estimate-received',
				description: desc,
				detail,
				tier: detail ? 1 : TIER_MAP['estimate-received'],
				timestamp: del.estimate.estimatedAt,
			})
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

/** WIP health warnings — surfaces when stages are overcrowded or starving */
function wipWarnings(opportunities: Opportunity[], now: number): BriefingItem[] {
	const items: BriefingItem[] = []
	const active = opportunities.filter((o) => !o.discontinuedAt)

	for (const stage of STAGES) {
		const count = active.filter((o) => o.stage === stage.key).length
		const level = wipLevel(stage.key, count)
		const nudge = wipNudge(stage.key, count)
		if (level !== 'ok' && nudge) {
			items.push({
				id: itemId(),
				targetType: 'opportunity',
				targetId: '',
				targetTitle: stage.label,
				verb: level === 'over' ? 'wip-over' : 'wip-under',
				description: nudge,
				tier: TIER_MAP[level === 'over' ? 'wip-over' : 'wip-under'],
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
		const all = [
			...warnings,
			...revisitItems,
			...pWarnings,
			...wipWarnings(current.opportunities, now),
		]
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

	const wipItems = wipWarnings(current.opportunities, now)

	const all = [...oppItems, ...delItems, ...revisitItems, ...pWarnings, ...wipItems]

	// Suppress stale warnings for opportunities that have fresh signal activity
	const signalActivityIds = new Set(
		oppItems
			.filter(
				(i) =>
					i.verb === 'signal-changed' ||
					i.verb === 'objection-added' ||
					i.verb === 'objection-resolved',
			)
			.map((i) => i.targetId),
	)
	const filtered = all.filter((i) => !(i.verb === 'stale' && signalActivityIds.has(i.targetId)))

	// Sort: tier 1 first, then tier 2, then tier 3. Within each tier, newest first.
	filtered.sort((a, b) => a.tier - b.tier || b.timestamp - a.timestamp)

	return filtered
}

/** Deduplicate items targeting the same entity with the same verb */
export function deduplicateItems(items: BriefingItem[]): BriefingItem[] {
	const seen = new Set<string>()
	return items.filter((item) => {
		// Signal changes are per-perspective, so include description to keep them distinct
		const key =
			item.verb === 'signal-changed' ||
			item.verb === 'objection-added' ||
			item.verb === 'objection-resolved'
				? `${item.targetType}:${item.targetId}:${item.verb}:${item.description}`
				: `${item.targetType}:${item.targetId}:${item.verb}`
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
	'estimate-received',
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

// ── Return summary ──

/** Minimum absence (in ms) before showing a return summary (4 hours) */
const RETURN_THRESHOLD_MS = 4 * 60 * 60 * 1000

/** Human-readable labels for verb counts in the return summary */
const RETURN_VERB_LABELS: Partial<Record<ChangeVerb, [string, string]>> = {
	'objection-added': ['objection', 'objections'],
	'commitment-overdue': ['overdue commitment', 'overdue commitments'],
	stale: ['stale item', 'stale items'],
	exited: ['exit', 'exits'],
	'revisit-due': ['revisit due', 'revisits due'],
	'unscored-assignment': ['awaiting input', 'awaiting input'],
}

export interface ReturnSummary {
	/** e.g. "While you were away: 2 objections, 1 overdue commitment" */
	text: string
	/** How long the user was away, in hours */
	hoursAway: number
}

/**
 * Build a one-line return summary if the user has been away long enough
 * and there are tier-1 items worth highlighting.
 * Returns null if the absence is too short or there's nothing urgent.
 */
export function buildReturnSummary(
	snapshot: BoardSnapshot | null,
	items: BriefingItem[],
): ReturnSummary | null {
	if (!snapshot) return null

	const hoursAway = (Date.now() - snapshot.takenAt) / (60 * 60 * 1000)
	if (hoursAway * 60 * 60 * 1000 < RETURN_THRESHOLD_MS) return null

	const tier1 = items.filter((i) => i.tier === 1)
	if (tier1.length === 0) return null

	// Count by verb
	const counts = new Map<ChangeVerb, number>()
	for (const item of tier1) {
		counts.set(item.verb, (counts.get(item.verb) ?? 0) + 1)
	}

	const parts: string[] = []
	for (const [verb, count] of counts) {
		const labels = RETURN_VERB_LABELS[verb]
		if (labels) {
			parts.push(`${count} ${count === 1 ? labels[0] : labels[1]}`)
		}
	}

	if (parts.length === 0) return null

	const daysAway = Math.floor(hoursAway / 24)
	const prefix = daysAway >= 1 ? `While you were away (${daysAway}d)` : 'Since your last visit'

	return {
		text: `${prefix}: ${parts.join(', ')}`,
		hoursAway,
	}
}

// ── Resolution detection ──

/**
 * Detect conditions that were active in the previous snapshot but are no longer present.
 * Returns resolution items and updated activeConditions map.
 * Applies flap protection: conditions visible < 24h don't generate resolutions.
 * Skips wip-over/wip-under (systemic, no clear "done" moment).
 */
export function detectResolutions(
	currentItems: BriefingItem[],
	snapshot: BoardSnapshot | null,
): { resolutions: BriefingItem[]; updatedConditions: Record<string, StoredCondition> } {
	const now = Date.now()
	const updatedConditions: Record<string, StoredCondition> = {}
	const resolutions: BriefingItem[] = []

	// Build current condition keys
	for (const item of currentItems) {
		if (CONDITION_VERBS.has(item.verb)) {
			const key = `${item.verb}:${item.targetId}`
			updatedConditions[key] = {
				firstSeen: snapshot?.activeConditions?.[key]?.firstSeen ?? now,
				title: item.targetTitle,
				targetId: item.targetId,
				targetType: item.targetType,
				verb: item.verb,
			}
		}
	}

	if (!snapshot?.activeConditions) return { resolutions, updatedConditions }

	// Detect resolved conditions
	const currentConditionKeys = new Set(Object.keys(updatedConditions))
	for (const [key, stored] of Object.entries(snapshot.activeConditions)) {
		if (currentConditionKeys.has(key)) continue // still active

		// Flap protection: skip conditions visible < 24h
		if (now - stored.firstSeen < FLAP_THRESHOLD_MS) continue

		// Skip wip-over/wip-under — systemic, not actionable resolution
		if (stored.verb === 'wip-over' || stored.verb === 'wip-under') continue

		const label = RESOLUTION_LABELS[stored.verb] ?? 'Resolved'
		resolutions.push({
			id: itemId(),
			targetType: stored.targetType,
			targetId: stored.targetId,
			targetTitle: stored.title,
			verb: 'resolved',
			description: `${label} — ${stored.title}`,
			tier: TIER_MAP.resolved,
			timestamp: now,
		})
	}

	return { resolutions, updatedConditions }
}

// ── Age band computation ──

/** Compute the age band for an item */
export function computeAgeBand(item: AnyBriefingItem, readKeys: Set<string>, now: number): AgeBand {
	const key = briefingKey(item)
	const verb = item.verb

	// Conditions always stay fresh (they represent active problems)
	if (CONDITION_VERBS.has(verb)) return 'fresh'

	// Manually marked read → read band
	if (readKeys.has(key)) return 'read'

	// Age-based banding for events
	const age = now - item.timestamp
	if (age > OLDER_MS) return 'older'
	if (age > FRESH_MS) return 'read'
	return 'fresh'
}

/** Check if an event item should be filtered out (decayed) */
export function isDecayed(item: AnyBriefingItem, now: number): boolean {
	if (CONDITION_VERBS.has(item.verb)) return false // conditions never decay
	return now - item.timestamp > DECAY_MS
}

// ── Feed reconciliation ──

/** The complete reconciled feed, split into bands */
export interface ReconciledFeed {
	fresh: AnyBriefingItem[]
	read: AnyBriefingItem[]
	older: AnyBriefingItem[]
	/** Updated condition map — persist back to snapshot */
	activeConditions: Record<string, StoredCondition>
	/** Total item count across all bands */
	total: number
}

/**
 * Full feed reconciliation: takes raw diff items + snapshot and produces
 * a three-band feed with resolution notices and natural decay.
 */
export function reconcileFeed(
	rawItems: BriefingItem[],
	snapshot: BoardSnapshot | null,
	_meetingData?: MeetingData | null,
): ReconciledFeed {
	const now = Date.now()

	// 1. Deduplicate
	const deduped = deduplicateItems(rawItems)

	// 2. Detect resolutions (before grouping, needs individual item keys)
	const { resolutions, updatedConditions } = detectResolutions(deduped, snapshot)

	// 3. Merge resolutions into item list
	const withResolutions = [...deduped, ...resolutions]

	// 4. Group
	const grouped = groupItems(withResolutions)

	// 5. Build read keys set (migrate legacy dismissedKeys)
	const readKeys = new Set([...(snapshot?.readKeys ?? []), ...(snapshot?.dismissedKeys ?? [])])

	// 6. Load stored read items, prune decayed ones
	const storedReadItems: AnyBriefingItem[] = (snapshot?.readItems ?? [])
		.filter((ri) => now - ri.timestamp <= DECAY_MS)
		.map((ri) => ({
			id: ri.key,
			targetType: ri.targetType,
			targetId: ri.targetId,
			targetTitle: ri.targetTitle,
			verb: ri.verb,
			description: ri.description,
			detail: ri.detail,
			tier: ri.tier,
			timestamp: ri.timestamp,
		}))

	// 7. Merge: current items + stored read items (dedup by key, prefer current)
	const currentKeys = new Set(grouped.map(briefingKey))
	const mergedReadItems = storedReadItems.filter((ri) => !currentKeys.has(briefingKey(ri)))
	const allItems = [...grouped, ...mergedReadItems]

	// 8. Filter decayed events, assign bands
	const fresh: AnyBriefingItem[] = []
	const read: AnyBriefingItem[] = []
	const older: AnyBriefingItem[] = []

	for (const item of allItems) {
		if (isDecayed(item, now)) continue
		const band = computeAgeBand(item, readKeys, now)
		// Stored read items are always in read band at minimum
		if (mergedReadItems.includes(item) && band === 'fresh') {
			read.push(item)
		} else if (band === 'fresh') {
			fresh.push(item)
		} else if (band === 'older') {
			older.push(item)
		} else {
			read.push(item)
		}
	}

	// Sort each band: tier first, then newest first
	const sortFn = (a: AnyBriefingItem, b: AnyBriefingItem) =>
		a.tier - b.tier || b.timestamp - a.timestamp
	fresh.sort(sortFn)
	read.sort(sortFn)
	older.sort(sortFn)

	return {
		fresh,
		read,
		older,
		activeConditions: updatedConditions,
		total: fresh.length + read.length + older.length,
	}
}

/**
 * Build stored read items from current visible items (for "Mark all read").
 * Only stores events (not conditions, which are always recomputed).
 */
export function buildReadItems(
	items: AnyBriefingItem[],
	existingReadItems: StoredReadItem[],
): StoredReadItem[] {
	const now = Date.now()
	const newItems: StoredReadItem[] = []

	for (const item of items) {
		if (CONDITION_VERBS.has(item.verb)) continue // skip conditions
		if (isGrouped(item)) {
			// Store each target as a separate read item
			for (const target of item.targets) {
				newItems.push({
					key: `${item.verb}:${target.id}`,
					verb: item.verb,
					targetType: target.type,
					targetId: target.id,
					targetTitle: target.title,
					description: item.description,
					detail: item.detail,
					tier: item.tier,
					timestamp: item.timestamp,
					readAt: now,
				})
			}
		} else {
			newItems.push({
				key: briefingKey(item),
				verb: item.verb,
				targetType: item.targetType,
				targetId: item.targetId,
				targetTitle: item.targetTitle,
				description: item.description,
				detail: item.detail,
				tier: item.tier,
				timestamp: item.timestamp,
				readAt: now,
			})
		}
	}

	// Merge with existing, dedup by key (newer wins)
	const byKey = new Map<string, StoredReadItem>()
	for (const ri of existingReadItems) {
		if (now - ri.timestamp <= DECAY_MS) byKey.set(ri.key, ri)
	}
	for (const ri of newItems) {
		byKey.set(ri.key, ri)
	}

	return [...byKey.values()]
}
