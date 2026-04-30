import type {
	CellSignal,
	Certainty,
	Commitment,
	Deliverable,
	Opportunity,
	OpportunityDeliverableLink,
	PersonRole,
	Perspective,
	Score,
	Stage,
	TShirtSize,
} from './types'
import {
	CELL_QUESTIONS,
	linksForDeliverable,
	PERSPECTIVES,
	SCORE_SYMBOL,
	STAGES,
	stageIndex,
} from './types'

// ── Meeting records ──

/** A snapshot of what was discussed in a meeting */
export interface MeetingRecord {
	personName: string
	timestamp: number
	/** Brief summary of discussed items */
	summary: string[]
}

/** Snapshot of an opportunity's key fields at meeting time */
interface OppSnapshot {
	stage: Stage
	/** Flat map: "stage:perspective" → score */
	scores: Record<string, Score>
	title: string
	horizon: string
	peopleCount: number
	commitmentsCount: number
}

/** Snapshot of a deliverable's key fields at meeting time */
interface DelSnapshot {
	title: string
	size: TShirtSize | null
	certainty: Certainty | null
	linkCount: number
	contributorCount: number
	consumerCount: number
}

/** State captured at meeting completion, used to diff next time */
interface PersonSnapshot {
	opportunities: Record<string, OppSnapshot>
	deliverables: Record<string, DelSnapshot>
}

/** Per-person meeting state, persisted */
export interface MeetingData {
	/** Person name → timestamp of last completed meeting */
	lastDiscussed: Record<string, number>
	/** History of past meetings */
	records: MeetingRecord[]
	/** Person name → snapshot of board state at last meeting */
	snapshots: Record<string, PersonSnapshot>
	/** In-progress meeting state (survives tab close) */
	inProgress?: Record<string, InProgressMeeting>
}

/** Transient state for a meeting that hasn't been stamped yet */
export interface InProgressMeeting {
	discussed: string[]
	recentlyScored: string[]
}

// ── Snapshot helpers ──

function snapshotOpp(opp: Opportunity): OppSnapshot {
	const scores: Record<string, Score> = {}
	for (const stage of STAGES) {
		for (const p of PERSPECTIVES) {
			const sig = opp.signals[stage.key]?.[p]
			if (sig && sig.score !== 'none') {
				scores[`${stage.key}:${p}`] = sig.score
			}
		}
	}
	return {
		stage: opp.stage,
		scores,
		title: opp.title,
		horizon: opp.horizon,
		peopleCount: opp.people.length,
		commitmentsCount: opp.commitments.length,
	}
}

function snapshotDel(del: Deliverable, linkCount: number): DelSnapshot {
	return {
		title: del.title,
		size: del.size,
		certainty: del.certainty,
		linkCount,
		contributorCount: del.extraContributors.length,
		consumerCount: del.extraConsumers.length,
	}
}

/** Describe what changed in an opportunity compared to a previous snapshot */
function diffOpp(opp: Opportunity, prev: OppSnapshot): string[] {
	const descs: string[] = []
	if (prev.title !== undefined && opp.title !== prev.title) {
		descs.push(`Renamed: "${prev.title}" → "${opp.title}"`)
	}
	if (opp.stage !== prev.stage) {
		descs.push(`Stage: ${prev.stage} → ${opp.stage}`)
	}
	if (prev.horizon !== undefined && opp.horizon !== prev.horizon) {
		descs.push(`Horizon: ${prev.horizon} → ${opp.horizon}`)
	}
	if (prev.peopleCount !== undefined && opp.people.length !== prev.peopleCount) {
		descs.push(`People: ${prev.peopleCount} → ${opp.people.length}`)
	}
	if (prev.commitmentsCount !== undefined && opp.commitments.length !== prev.commitmentsCount) {
		descs.push(`Commitments: ${prev.commitmentsCount} → ${opp.commitments.length}`)
	}
	// Check for new or changed scores
	for (const stage of STAGES) {
		for (const p of PERSPECTIVES) {
			const key = `${stage.key}:${p}`
			const sig = opp.signals[stage.key]?.[p]
			const curScore = sig && sig.score !== 'none' ? sig.score : null
			const prevScore = prev.scores[key] ?? null
			if (curScore !== prevScore) {
				const prevLabel = prevScore ? SCORE_SYMBOL[prevScore] : '—'
				const curLabel = curScore ? SCORE_SYMBOL[curScore] : '—'
				descs.push(`${p}@${stage.key}: ${prevLabel} → ${curLabel}`)
			}
		}
	}
	return descs
}

/** Describe what changed in a deliverable compared to a previous snapshot */
function diffDel(del: Deliverable, linkCount: number, prev: DelSnapshot): string[] {
	const descs: string[] = []
	if (prev.title !== undefined && del.title !== prev.title) {
		descs.push(`Renamed: "${prev.title}" → "${del.title}"`)
	}
	if (del.size !== prev.size) {
		descs.push(`Size: ${prev.size ?? '—'} → ${del.size ?? '—'}`)
	}
	if (del.certainty !== prev.certainty) {
		descs.push(`Certainty: ${prev.certainty ?? '—'} → ${del.certainty ?? '—'}`)
	}
	if (linkCount !== prev.linkCount) {
		descs.push(`Links: ${prev.linkCount} → ${linkCount}`)
	}
	if (
		prev.contributorCount !== undefined &&
		del.extraContributors.length !== prev.contributorCount
	) {
		descs.push(`Contributors: ${prev.contributorCount} → ${del.extraContributors.length}`)
	}
	if (prev.consumerCount !== undefined && del.extraConsumers.length !== prev.consumerCount) {
		descs.push(`Consumers: ${prev.consumerCount} → ${del.extraConsumers.length}`)
	}
	return descs
}

/** Build a PersonSnapshot capturing current state of all related entities */
export function buildPersonSnapshot(
	personName: string,
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): PersonSnapshot {
	const oppSnaps: Record<string, OppSnapshot> = {}
	const delSnaps: Record<string, DelSnapshot> = {}
	const lowerName = personName.toLowerCase()

	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue
		const isLinked =
			opp.people.some((p) => p.name.toLowerCase() === lowerName) ||
			opp.commitments.some((c) => c.to.toLowerCase() === lowerName)
		if (isLinked) oppSnaps[opp.id] = snapshotOpp(opp)
	}

	for (const d of deliverables) {
		const isContributor = d.extraContributors.some((n) => n.toLowerCase() === lowerName)
		const isConsumer = d.extraConsumers.some((n) => n.toLowerCase() === lowerName)
		const dLinks = linksForDeliverable(links, d.id)
		let inherited = false
		for (const link of dLinks) {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) continue
			if (opp.people.some((p) => p.name.toLowerCase() === lowerName)) {
				inherited = true
				break
			}
		}
		if (isContributor || isConsumer || inherited) {
			delSnaps[d.id] = snapshotDel(d, dLinks.length)
		}
	}

	return { opportunities: oppSnaps, deliverables: delSnaps }
}

/** A person aggregated across all board data */
export interface BoardPerson {
	name: string
	roles: Set<PersonRole>
	/** Opportunity IDs they're linked to via people[] */
	opportunityIds: string[]
	/** Deliverable IDs they're linked to via extraContributors/extraConsumers */
	deliverableIds: string[]
	/** Is a commitment target */
	isCommitmentTarget: boolean
}

/** Collect all unique people across the board */
export function collectPeople(
	opportunities: Opportunity[],
	deliverables: Deliverable[],
): Map<string, BoardPerson> {
	const people = new Map<string, BoardPerson>()

	function ensure(name: string): BoardPerson {
		let p = people.get(name)
		if (!p) {
			p = {
				name,
				roles: new Set(),
				opportunityIds: [],
				deliverableIds: [],
				isCommitmentTarget: false,
			}
			people.set(name, p)
		}
		return p
	}

	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue
		for (const person of opp.people) {
			const p = ensure(person.name)
			p.roles.add(person.role)
			if (!p.opportunityIds.includes(opp.id)) p.opportunityIds.push(opp.id)
		}
		for (const c of opp.commitments) {
			const p = ensure(c.to)
			p.isCommitmentTarget = true
			if (!p.opportunityIds.includes(opp.id)) p.opportunityIds.push(opp.id)
		}
	}

	for (const d of deliverables) {
		for (const name of d.extraContributors) {
			const p = ensure(name)
			if (!p.deliverableIds.includes(d.id)) p.deliverableIds.push(d.id)
		}
		for (const name of d.extraConsumers) {
			const p = ensure(name)
			if (!p.deliverableIds.includes(d.id)) p.deliverableIds.push(d.id)
		}
	}

	return people
}

/** Urgency summary for a person — used for sorting and sidebar badges */
export interface PersonUrgency {
	/** Number of overdue commitments */
	overdueCommitments: number
	/** Most overdue days (negative = overdue, positive = upcoming) */
	worstCommitmentDays: number | null
	/** Number of unscored cells assigned to them */
	unscoredCells: number
	/** Days since oldest unscored assignment */
	oldestUnscoredDays: number
	/** Numeric score for sorting (lower = more urgent) */
	score: number
}

/** Compute urgency for a person without building the full agenda */
export function personUrgency(name: string, opportunities: Opportunity[]): PersonUrgency {
	const now = Date.now()
	let overdueCommitments = 0
	let worstCommitmentDays: number | null = null
	let unscoredCells = 0
	let oldestUnscoredDays = 0

	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue

		// Commitments to this person
		for (const c of opp.commitments) {
			if (c.to.toLowerCase() !== name.toLowerCase()) continue
			const si = stageIndex(opp.stage)
			if (stageIndex(c.milestone) < si) continue // already met
			const daysLeft = Math.ceil((c.by - now) / 86_400_000)
			if (daysLeft < 0) overdueCommitments++
			if (worstCommitmentDays === null || daysLeft < worstCommitmentDays) {
				worstCommitmentDays = daysLeft
			}
		}

		// Unscored cells assigned to them
		for (const pl of opp.people) {
			if (pl.name.toLowerCase() !== name.toLowerCase()) continue
			for (const a of pl.perspectives) {
				if (!a.stage) continue
				const signal = opp.signals[a.stage]?.[a.perspective]
				if (!signal || signal.score === 'none') {
					unscoredCells++
					const days = Math.floor((now - a.assignedAt) / 86_400_000)
					if (days > oldestUnscoredDays) oldestUnscoredDays = days
				}
			}
		}
	}

	// Score: overdue commitments are most urgent, then stale unscored cells
	// Lower score = more urgent (for sorting)
	let score = 0
	if (overdueCommitments > 0) score -= 1000 + overdueCommitments * 100
	if (worstCommitmentDays !== null && worstCommitmentDays <= 7)
		score -= 500 - worstCommitmentDays * 10
	if (unscoredCells > 0) score -= oldestUnscoredDays * 10 + unscoredCells

	return { overdueCommitments, worstCommitmentDays, unscoredCells, oldestUnscoredDays, score }
}

// ── Meeting agenda items ──

export interface UnscoredCell {
	opportunityId: string
	opportunityTitle: string
	stage: Stage
	perspective: Perspective
	question: string
	daysAssigned: number
}

export interface CommitmentItem {
	opportunityId: string
	opportunityTitle: string
	commitment: Commitment
	daysLeft: number
	met: boolean
}

export interface ConflictItem {
	opportunityId: string
	opportunityTitle: string
	stage: Stage
	perspective: Perspective
	theirScore: CellSignal
	conflictingPerspective: Perspective
	conflictingScore: CellSignal
}

export interface DeliverableItem {
	deliverableId: string
	title: string
	role: 'contributor' | 'consumer'
	size: TShirtSize | null
	certainty: Certainty | null
	linkedOpportunityTitles: string[]
	/** Whether this item changed since last meeting */
	changed: boolean
}

/** Something that changed since last meeting with this person */
export interface ChangeItem {
	entityId: string
	entityTitle: string
	entityType: 'opportunity' | 'deliverable'
	description: string
}

export interface MeetingAgenda {
	/** Commitments the PO made to this person */
	commitments: CommitmentItem[]
	/** Signal cells assigned to them that are unscored */
	unscoredCells: UnscoredCell[]
	/** Deliverables they're involved with */
	deliverables: DeliverableItem[]
	/** Perspectives where their score conflicts with another perspective at the same stage */
	conflicts: ConflictItem[]
	/** Opportunities they're linked to (for reference) */
	opportunities: { id: string; title: string; stage: Stage; role: PersonRole; changed: boolean }[]
	/** Things that changed since last meeting */
	changes: ChangeItem[]
	/** Timestamp of last meeting with this person (null = never met) */
	lastMet: number | null
}

/** Build a meeting agenda for a specific person */
export function buildMeetingAgenda(
	personName: string,
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
	since: number | null = null,
	snapshot: PersonSnapshot | null = null,
): MeetingAgenda {
	const now = Date.now()
	const agenda: MeetingAgenda = {
		commitments: [],
		unscoredCells: [],
		deliverables: [],
		conflicts: [],
		opportunities: [],
		changes: [],
		lastMet: since,
	}

	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue

		// Find this person's link on the opportunity
		const personLinks = opp.people.filter((p) => p.name.toLowerCase() === personName.toLowerCase())

		// Detect changes since last meeting (timestamp or snapshot diff)
		const changedByTime = since !== null && (opp.updatedAt ?? opp.createdAt) > since
		const isNewOpp = since !== null && opp.createdAt > since
		const prevOppSnap = snapshot?.opportunities[opp.id]
		const changedByDiff =
			since !== null && prevOppSnap !== undefined && diffOpp(opp, prevOppSnap).length > 0
		const neverReviewed = since !== null && !prevOppSnap
		const oppChanged = changedByTime || changedByDiff || neverReviewed

		if (
			oppChanged &&
			(personLinks.length > 0 ||
				opp.commitments.some((c) => c.to.toLowerCase() === personName.toLowerCase()))
		) {
			if (isNewOpp) {
				agenda.changes.push({
					entityId: opp.id,
					entityTitle: opp.title,
					entityType: 'opportunity',
					description: 'New opportunity',
				})
			} else if (snapshot?.opportunities[opp.id]) {
				const descs = diffOpp(opp, snapshot.opportunities[opp.id])
				for (const desc of descs) {
					agenda.changes.push({
						entityId: opp.id,
						entityTitle: opp.title,
						entityType: 'opportunity',
						description: desc,
					})
				}
				if (descs.length === 0) {
					agenda.changes.push({
						entityId: opp.id,
						entityTitle: opp.title,
						entityType: 'opportunity',
						description: 'Description or notes edited',
					})
				}
			} else {
				agenda.changes.push({
					entityId: opp.id,
					entityTitle: opp.title,
					entityType: 'opportunity',
					description: 'New to agenda',
				})
			}
		}

		// Commitments made to this person
		for (const c of opp.commitments) {
			if (c.to.toLowerCase() !== personName.toLowerCase()) continue
			const si = stageIndex(opp.stage)
			const met = stageIndex(c.milestone) < si
			const daysLeft = Math.ceil((c.by - now) / 86_400_000)
			agenda.commitments.push({
				opportunityId: opp.id,
				opportunityTitle: opp.title,
				commitment: c,
				daysLeft,
				met,
			})
		}

		if (personLinks.length === 0) continue

		// Track the opportunity
		for (const pl of personLinks) {
			agenda.opportunities.push({
				id: opp.id,
				title: opp.title,
				stage: opp.stage,
				role: pl.role,
				changed: oppChanged,
			})
		}

		// Unscored cells assigned to them
		for (const pl of personLinks) {
			for (const assignment of pl.perspectives) {
				if (!assignment.stage) continue
				const signal = opp.signals[assignment.stage]?.[assignment.perspective]
				if (!signal || signal.score === 'none') {
					const daysAssigned = Math.floor((now - assignment.assignedAt) / 86_400_000)
					agenda.unscoredCells.push({
						opportunityId: opp.id,
						opportunityTitle: opp.title,
						stage: assignment.stage,
						perspective: assignment.perspective,
						question: CELL_QUESTIONS[assignment.stage][assignment.perspective],
						daysAssigned,
					})
				}
			}
		}

		// Conflicts: their scored perspective vs. another perspective at the same stage
		for (const pl of personLinks) {
			for (const assignment of pl.perspectives) {
				if (!assignment.stage) continue
				const theirSignal = opp.signals[assignment.stage]?.[assignment.perspective]
				if (!theirSignal || theirSignal.score === 'none') continue

				for (const otherP of PERSPECTIVES) {
					if (otherP === assignment.perspective) continue
					const otherSignal = opp.signals[assignment.stage]?.[otherP]
					if (!otherSignal || otherSignal.score === 'none') continue

					// Conflict = one positive and one negative
					const scores = [theirSignal.score, otherSignal.score]
					if (scores.includes('positive') && scores.includes('negative')) {
						agenda.conflicts.push({
							opportunityId: opp.id,
							opportunityTitle: opp.title,
							stage: assignment.stage,
							perspective: assignment.perspective,
							theirScore: theirSignal,
							conflictingPerspective: otherP,
							conflictingScore: otherSignal,
						})
					}
				}
			}
		}
	}

	// Deliverables they're involved with
	for (const d of deliverables) {
		const isContributor = d.extraContributors.some(
			(n) => n.toLowerCase() === personName.toLowerCase(),
		)
		const isConsumer = d.extraConsumers.some((n) => n.toLowerCase() === personName.toLowerCase())

		// Also check inherited role from opportunity experts/stakeholders
		const dLinks = linksForDeliverable(links, d.id)
		let inheritedContributor = false
		let inheritedConsumer = false
		for (const link of dLinks) {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) continue
			for (const pl of opp.people) {
				if (pl.name.toLowerCase() !== personName.toLowerCase()) continue
				if (pl.role === 'expert') inheritedContributor = true
				if (pl.role === 'stakeholder' || pl.role === 'approver') inheritedConsumer = true
			}
		}

		const role: 'contributor' | 'consumer' | null =
			isContributor || inheritedContributor
				? 'contributor'
				: isConsumer || inheritedConsumer
					? 'consumer'
					: null

		if (!role) continue

		const delChangedByTime = since !== null && (d.updatedAt ?? 0) > since
		const prevDelSnap = snapshot?.deliverables[d.id]
		const delChangedByDiff =
			since !== null &&
			prevDelSnap !== undefined &&
			diffDel(d, dLinks.length, prevDelSnap).length > 0
		const delNeverReviewed = since !== null && !prevDelSnap
		const delChanged = delChangedByTime || delChangedByDiff || delNeverReviewed

		if (delChanged) {
			const dLinks = linksForDeliverable(links, d.id)
			if (snapshot?.deliverables[d.id]) {
				const descs = diffDel(d, dLinks.length, snapshot.deliverables[d.id])
				for (const desc of descs) {
					agenda.changes.push({
						entityId: d.id,
						entityTitle: d.title,
						entityType: 'deliverable',
						description: desc,
					})
				}
				if (descs.length === 0) {
					agenda.changes.push({
						entityId: d.id,
						entityTitle: d.title,
						entityType: 'deliverable',
						description: 'Description or notes edited',
					})
				}
			} else {
				agenda.changes.push({
					entityId: d.id,
					entityTitle: d.title,
					entityType: 'deliverable',
					description: 'New to agenda',
				})
			}
		}

		const linkedOppTitles = dLinks
			.map((l) => opportunities.find((o) => o.id === l.opportunityId)?.title)
			.filter((t): t is string => !!t)

		agenda.deliverables.push({
			deliverableId: d.id,
			title: d.title,
			role,
			size: d.size,
			certainty: d.certainty,
			linkedOpportunityTitles: linkedOppTitles,
			changed: delChanged,
		})
	}

	// Sort: commitments by urgency, unscored by days assigned (oldest first)
	agenda.commitments.sort((a, b) => a.daysLeft - b.daysLeft)
	agenda.unscoredCells.sort((a, b) => b.daysAssigned - a.daysAssigned)
	// Sort: changed items first in deliverables and opportunities
	agenda.deliverables.sort((a, b) => (a.changed === b.changed ? 0 : a.changed ? -1 : 1))
	agenda.opportunities.sort((a, b) => (a.changed === b.changed ? 0 : a.changed ? -1 : 1))

	return agenda
}

/** Complete a meeting session — returns updated meeting data.
 *  If discussedEntityIds is provided, only snapshot those entities (scoped stamp).
 *  Undiscussed entities keep their previous snapshot so changes surface next meeting. */
export function completeMeeting(
	personName: string,
	agenda: MeetingAgenda,
	meetingData: MeetingData,
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
	discussedEntityIds?: Set<string>,
): MeetingData {
	const isScoped = discussedEntityIds !== undefined
	const inScope = (id: string) => !isScoped || discussedEntityIds.has(id)

	const unscoredCount = agenda.unscoredCells.filter((c) => inScope(c.opportunityId)).length
	const commitmentCount = agenda.commitments.filter((c) => inScope(c.opportunityId)).length
	const changeCount = agenda.changes.filter((c) => inScope(c.entityId)).length
	const conflictCount = agenda.conflicts.filter((c) => inScope(c.opportunityId)).length

	const summary: string[] = []
	if (unscoredCount > 0) summary.push(`${unscoredCount} cells to score`)
	if (commitmentCount > 0) summary.push(`${commitmentCount} commitments reviewed`)
	if (changeCount > 0) summary.push(`${changeCount} changes discussed`)
	if (conflictCount > 0) summary.push(`${conflictCount} conflicts`)
	if (summary.length === 0) summary.push('No items')

	const record: MeetingRecord = {
		personName,
		timestamp: Date.now(),
		summary,
	}

	const fullSnap = buildPersonSnapshot(personName, opportunities, deliverables, links)

	let snap: PersonSnapshot
	if (isScoped) {
		const existing = meetingData.snapshots[personName] ?? { opportunities: {}, deliverables: {} }
		snap = {
			opportunities: { ...existing.opportunities },
			deliverables: { ...existing.deliverables },
		}
		for (const [id, s] of Object.entries(fullSnap.opportunities)) {
			if (discussedEntityIds.has(id)) snap.opportunities[id] = s
		}
		for (const [id, s] of Object.entries(fullSnap.deliverables)) {
			if (discussedEntityIds.has(id)) snap.deliverables[id] = s
		}
	} else {
		snap = fullSnap
	}

	return {
		lastDiscussed: { ...meetingData.lastDiscussed, [personName]: Date.now() },
		records: [...meetingData.records, record],
		snapshots: { ...meetingData.snapshots, [personName]: snap },
	}
}
