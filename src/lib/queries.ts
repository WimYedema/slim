import {
	type AgingLevel,
	type CellSignal,
	type Commitment,
	type ConsentStatus,
	type Deliverable,
	type HorizonPressure,
	type Opportunity,
	type OpportunityDeliverableLink,
	ORIGIN_TYPES,
	type OriginType,
	PERSPECTIVES,
	type PersonLink,
	type Perspective,
	type PerspectiveAssignment,
	type Score,
	STAGES,
	type Stage,
} from './types'

// ── Stage navigation ──

const STAGE_ORDER: Stage[] = ['explore', 'sketch', 'validate', 'decompose']

export function stageIndex(stage: Stage): number {
	return STAGE_ORDER.indexOf(stage)
}

export function nextStage(stage: Stage): Stage | null {
	const i = STAGE_ORDER.indexOf(stage)
	return i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null
}

export function prevStage(stage: Stage): Stage | null {
	const i = STAGE_ORDER.indexOf(stage)
	return i > 0 ? STAGE_ORDER[i - 1] : null
}

// ── Horizon helpers ──

/** Default horizon label: next quarter, e.g. "2026Q3" — new ideas need exploration before "now" */
export function defaultHorizon(): string {
	const d = new Date()
	const q = Math.ceil((d.getMonth() + 1) / 3)
	if (q < 4) return `${d.getFullYear()}Q${q + 1}`
	return `${d.getFullYear() + 1}Q1`
}

/** Current quarter label, e.g. "2026Q2" */
export function currentQuarter(): string {
	const d = new Date()
	const q = Math.ceil((d.getMonth() + 1) / 3)
	return `${d.getFullYear()}Q${q}`
}

/** True if the horizon string sorts strictly after the current quarter */
export function isFutureHorizon(horizon: string): boolean {
	return horizon.localeCompare(currentQuarter(), undefined, { numeric: true }) > 0
}

// ── Score helpers ──

/** Score cycle: none → uncertain → positive → negative → none */
const SCORE_CYCLE: Score[] = ['none', 'uncertain', 'positive', 'negative']

export function nextScore(current: Score): Score {
	const idx = SCORE_CYCLE.indexOf(current)
	return SCORE_CYCLE[(idx + 1) % SCORE_CYCLE.length]
}

export function cellHasSignal(signal: CellSignal): boolean {
	return signal.score !== 'none'
}

/** CSS class for a score value — used by multiple views */
export function scoreClass(score: Score): string {
	return `score-${score}`
}

// ── Aging ──

/** Days an opportunity has been in its current stage */
export function daysInStage(opp: Opportunity): number {
	const entered = opp.stageEnteredAt ?? opp.createdAt
	return Math.floor((Date.now() - entered) / 86_400_000)
}

/**
 * Aging thresholds shift based on horizon pressure:
 * - now:  tighter (fresh < 5d, aging 5-9, stale ≥ 10)
 * - next: standard (fresh < 7d, aging 7-13, stale ≥ 14)
 * - none: standard
 */
export function agingLevel(opp: Opportunity, pressure: HorizonPressure = 'none'): AgingLevel {
	const days = daysInStage(opp)
	if (pressure === 'now') {
		if (days >= 10) return 'stale'
		if (days >= 5) return 'aging'
		return 'fresh'
	}
	if (days >= 14) return 'stale'
	if (days >= 7) return 'aging'
	return 'fresh'
}

/** Human-readable pacing summary for tooltip and zoomed view */
export function pacingSummary(opp: Opportunity, pressure: HorizonPressure = 'none'): string {
	const days = daysInStage(opp)
	const level = agingLevel(opp, pressure)
	const stage = stageLabel(opp.stage)
	const horizon = opp.horizon ? `targeting ${opp.horizon}` : ''
	const pace =
		level === 'stale' ? 'behind pace' : level === 'aging' ? 'needs attention' : 'on track'
	const parts = [`${days}d in ${stage}`]
	if (horizon) parts.push(horizon)
	parts.push(pace)
	return parts.join(' · ')
}

// ── Display helpers ──

/** Human label for an origin type key */
export function originLabel(origin: OriginType): string {
	return ORIGIN_TYPES.find((o) => o.key === origin)?.label ?? origin
}

/** Human label for a stage key */
export function stageLabel(stage: Stage): string {
	return STAGES.find((s) => s.key === stage)?.label ?? stage
}

/** Format days until deadline as a human-readable string */
export function formatDaysLeft(daysLeft: number): string {
	if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`
	if (daysLeft === 0) return 'due today'
	return `${daysLeft}d left`
}

// ── Link queries ──

/** Get all deliverable links for an opportunity */
export function linksForOpportunity(
	links: OpportunityDeliverableLink[],
	opportunityId: string,
): OpportunityDeliverableLink[] {
	return links.filter((l) => l.opportunityId === opportunityId)
}

/** Get all opportunity links for a deliverable */
export function linksForDeliverable(
	links: OpportunityDeliverableLink[],
	deliverableId: string,
): OpportunityDeliverableLink[] {
	return links.filter((l) => l.deliverableId === deliverableId)
}

// ── Commitment queries ──

/** Most urgent unmet commitment: returns days until deadline (negative = overdue), or undefined if none */
export function commitmentUrgency(
	opp: Opportunity,
): { commitment: Commitment; daysLeft: number } | undefined {
	const now = Date.now()
	const si = stageIndex(opp.stage)
	// Only unmet commitments (milestone not yet reached)
	const unmet = opp.commitments.filter((c) => stageIndex(c.milestone) >= si)
	if (unmet.length === 0) return undefined
	// Most urgent = closest deadline
	const sorted = [...unmet].sort((a, b) => a.by - b.by)
	const commitment = sorted[0]
	const daysLeft = Math.ceil((commitment.by - now) / 86_400_000)
	return { commitment, daysLeft }
}

// ── Stage scores & consent ──

/** Get the D/F/V scores for the card's current stage */
export function currentStageScores(opp: Opportunity): Record<Perspective, Score> {
	const s = opp.signals[opp.stage]
	return {
		desirability: s.desirability.score,
		feasibility: s.feasibility.score,
		viability: s.viability.score,
	}
}

/** Score weight — consent semantics:
 *  none=0 (not consulted, can't advance),
 *  negative=0.1 (objection — blocks progress),
 *  uncertain=0.5 (concern noted, consent given),
 *  positive=1 (full consent) */
const SCORE_WEIGHT: Record<Score, number> = {
	none: 0,
	negative: 0.1,
	uncertain: 0.5,
	positive: 1,
}

/** Compute 0..1 weight for a perspective across all stages up to (and including) current */
export function perspectiveWeight(opp: Opportunity, perspective: Perspective): number {
	const idx = stageIndex(opp.stage)
	let total = 0
	let count = 0
	for (let i = 0; i <= idx; i++) {
		const stage = STAGE_ORDER[i]
		const signal = opp.signals[stage][perspective]
		total += SCORE_WEIGHT[signal.score]
		count++
	}
	return count > 0 ? total / count : 0
}

/** Consent status for a perspective at the current stage.
 *  'consent' = positive or uncertain (no objection),
 *  'objection' = negative (blocks progress),
 *  'unheard' = none (not yet consulted) */
export function consentStatus(score: Score): ConsentStatus {
	if (score === 'none') return 'unheard'
	if (score === 'negative') return 'objection'
	return 'consent'
}

/** Check consent across all perspectives at the current stage */
export function stageConsent(opp: Opportunity): {
	status: 'ready' | 'blocked' | 'incomplete'
	objections: Perspective[]
	unheard: Perspective[]
} {
	const objections: Perspective[] = []
	const unheard: Perspective[] = []
	for (const p of PERSPECTIVES) {
		const score = opp.signals[opp.stage][p].score
		if (score === 'negative') objections.push(p)
		else if (score === 'none') unheard.push(p)
	}
	if (objections.length > 0) return { status: 'blocked', objections, unheard }
	if (unheard.length > 0) return { status: 'incomplete', objections, unheard }
	return { status: 'ready', objections, unheard }
}

// ── People queries ──

/** Find the person assigned to a perspective at a specific stage */
export function perspectiveOwner(
	opp: Opportunity,
	perspective: Perspective,
	stage: Stage,
): PersonLink | undefined {
	return opp.people.find((p) =>
		p.perspectives.some((a) => a.perspective === perspective && a.stage === stage),
	)
}

/** Get assignment details for a perspective at a specific stage */
export function perspectiveAssignment(
	opp: Opportunity,
	perspective: Perspective,
	stage: Stage,
): { person: PersonLink; assignment: PerspectiveAssignment } | undefined {
	for (const person of opp.people) {
		const assignment = person.perspectives.find(
			(a) => a.perspective === perspective && a.stage === stage,
		)
		if (assignment) return { person, assignment }
	}
	return undefined
}

/** Get people inherited from linked opportunities, by role group */
export function inheritedPeople(
	deliverableId: string,
	group: 'contributors' | 'consumers',
	links: OpportunityDeliverableLink[],
	opportunities: Opportunity[],
): string[] {
	const dLinks = linksForDeliverable(links, deliverableId)
	const names = new Set<string>()
	for (const link of dLinks) {
		const opp = opportunities.find((o) => o.id === link.opportunityId)
		if (!opp) continue
		for (const p of opp.people) {
			if (group === 'contributors' && p.role === 'expert') names.add(p.name)
			if (group === 'consumers' && (p.role === 'stakeholder' || p.role === 'approver'))
				names.add(p.name)
		}
	}
	return [...names].sort()
}

// ── Visualization ──

// ── WIP limits ──

/** Default WIP thresholds per stage (floor = too few, ceiling = too many) */
export const WIP_THRESHOLDS: Record<Stage, { floor: number; ceiling: number }> = {
	explore: { floor: 3, ceiling: 15 },
	sketch: { floor: 1, ceiling: 8 },
	validate: { floor: 1, ceiling: 5 },
	decompose: { floor: 1, ceiling: 3 },
}

export type WipLevel = 'over' | 'under' | 'ok'

/** Check WIP health for a stage given its active item count */
export function wipLevel(stage: Stage, count: number): WipLevel {
	const t = WIP_THRESHOLDS[stage]
	if (count > t.ceiling) return 'over'
	if (count < t.floor) return 'under'
	return 'ok'
}

/** Friendly WIP nudge message, or null if healthy */
export function wipNudge(stage: Stage, count: number): string | null {
	const t = WIP_THRESHOLDS[stage]
	const label = stageLabel(stage)
	if (count > t.ceiling) {
		return `${label} feels crowded — ${count} items, consider focusing or parking some`
	}
	if (stage === 'explore' && count < t.floor) {
		return `${label} is looking quiet — fresh ideas keep the pipeline healthy`
	}
	if (stage === 'validate' && count === 0) {
		return `Nothing in ${label} — are ideas getting tested before they ship?`
	}
	if (stage === 'decompose' && count === 0) {
		return `Nothing in ${label} — upcoming sprints may run dry`
	}
	if (count < t.floor) {
		return `${label} could use more items — only ${count} right now`
	}
	return null
}

/** Barycentric coordinates for a ternary triangle. Returns {x, y} in 0..1 range */
export function ternaryPosition(opp: Opportunity): { x: number; y: number } {
	let d = perspectiveWeight(opp, 'desirability')
	let f = perspectiveWeight(opp, 'feasibility')
	let v = perspectiveWeight(opp, 'viability')

	// Normalize to sum=1 (if all zero, center)
	const sum = d + f + v
	if (sum === 0) {
		d = 1 / 3
		f = 1 / 3
		v = 1 / 3
	} else {
		d /= sum
		f /= sum
		v /= sum
	}

	// Triangle: D=top, F=bottom-left, V=bottom-right
	// Barycentric → cartesian (equilateral triangle in unit space)
	const x = 0.5 * (2 * v + d)
	const y = 1 - d * (Math.sqrt(3) / 2)

	return { x, y }
}
