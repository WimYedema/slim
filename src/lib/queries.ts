import {
	type AgingLevel,
	type CellSignal,
	type Certainty,
	type Commitment,
	type ConsentStatus,
	type Deliverable,
	type DeliverableEstimate,
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
	type TShirtSize,
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
	status: 'ready' | 'urgent' | 'incomplete'
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
	if (objections.length > 0) return { status: 'urgent', objections, unheard }
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

// ── People registry ──

/** Collect all unique person names from the board, sorted alphabetically.
 *  Deduplicates case-insensitively, keeping the first-seen casing. */
export function boardNames(opportunities: Opportunity[], deliverables: Deliverable[]): string[] {
	const seen = new Map<string, string>() // lowercased → first-seen casing
	function add(name: string) {
		const key = name.trim()
		if (!key) return
		const lower = key.toLowerCase()
		if (!seen.has(lower)) seen.set(lower, key)
	}
	for (const opp of opportunities) {
		for (const p of opp.people) add(p.name)
		for (const c of opp.commitments) add(c.to)
		for (const stageKey of Object.keys(opp.signals)) {
			const stage = opp.signals[stageKey as Stage]
			if (!stage) continue
			for (const persKey of Object.keys(stage)) {
				const sig = stage[persKey as Perspective]
				if (sig?.owner) add(sig.owner)
			}
		}
	}
	for (const d of deliverables) {
		for (const n of d.extraContributors) add(n)
		for (const n of d.extraConsumers) add(n)
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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

// ── Board health ──

export interface BoardHealth {
	/** Total active opportunities */
	totalOpps: number
	/** Counts per stage */
	stageCounts: { stage: Stage; count: number }[]
	/** Aging distribution */
	freshCount: number
	agingCount: number
	staleCount: number
	/** Total scored cells / total possible cells across active opps at current stage */
	scoredCells: number
	totalCells: number
	/** Perspectives with at least one negative score */
	objectionCount: number
	/** Per-perspective breakdown at current stage */
	perspectiveBreakdown: {
		perspective: Perspective
		scored: number
		unheard: number
		objections: number
	}[]
	/** Consent readiness: how many opps are ready / incomplete / urgent */
	readyCount: number
	incompleteCount: number
	urgentCount: number
	/** Active commitments */
	totalCommitments: number
	overdueCommitments: number
	dueSoonCommitments: number
	/** Deliverable stats */
	totalDeliverables: number
	estimatedDeliverables: number
	orphanDeliverables: number
	avgLinksPerDeliverable: number
	/** Origin balance: count per origin type */
	originCounts: { origin: OriginType; count: number }[]
}

export function boardHealth(
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): BoardHealth {
	const active = opportunities.filter((o) => !o.discontinuedAt)
	const now = Date.now()

	const stageCounts: { stage: Stage; count: number }[] = STAGES.map((s) => ({
		stage: s.key,
		count: active.filter((o) => o.stage === s.key).length,
	}))

	let freshCount = 0
	let agingCount = 0
	let staleCount = 0
	let scoredCells = 0
	let totalCells = 0
	let objectionCount = 0
	let readyCount = 0
	let incompleteCount = 0
	let urgentCount = 0
	let totalCommitments = 0
	let overdueCommitments = 0
	let dueSoonCommitments = 0
	const originTally = new Map<OriginType, number>()
	const perspTally = new Map<Perspective, { scored: number; unheard: number; objections: number }>()
	for (const p of PERSPECTIVES) perspTally.set(p, { scored: 0, unheard: 0, objections: 0 })

	for (const opp of active) {
		const aging = agingLevel(opp)
		if (aging === 'fresh') freshCount++
		else if (aging === 'aging') agingCount++
		else staleCount++
		const consent = stageConsent(opp)
		if (consent.status === 'ready') readyCount++
		else if (consent.status === 'urgent') urgentCount++
		else incompleteCount++
		for (const p of PERSPECTIVES) {
			totalCells++
			const score = opp.signals[opp.stage]?.[p]?.score ?? 'none'
			const tally = perspTally.get(p)!
			if (score === 'negative') {
				scoredCells++
				objectionCount++
				tally.objections++
				tally.scored++
			} else if (score !== 'none') {
				scoredCells++
				tally.scored++
			} else {
				tally.unheard++
			}
		}
		for (const c of opp.commitments) {
			totalCommitments++
			const daysLeft = Math.ceil((c.by - now) / 86_400_000)
			const si = stageIndex(opp.stage)
			const met = stageIndex(c.milestone) < si
			if (!met && daysLeft < 0) overdueCommitments++
			else if (!met && daysLeft <= 7) dueSoonCommitments++
		}
		if (opp.origin) {
			originTally.set(opp.origin, (originTally.get(opp.origin) ?? 0) + 1)
		}
	}

	const activeDels = deliverables.filter((d) => d.status === 'active')
	let orphanDeliverables = 0
	let estimatedDeliverables = 0
	let totalLinks = 0
	for (const d of activeDels) {
		const count = links.filter((l) => l.deliverableId === d.id).length
		totalLinks += count
		if (count === 0) orphanDeliverables++
		if (d.estimate) estimatedDeliverables++
	}

	const originCounts = ORIGIN_TYPES.map((o) => ({
		origin: o.key,
		count: originTally.get(o.key) ?? 0,
	})).filter((o) => o.count > 0)

	return {
		totalOpps: active.length,
		stageCounts: stageCounts.filter((s) => s.count > 0),
		freshCount,
		agingCount,
		staleCount,
		scoredCells,
		totalCells,
		objectionCount,
		perspectiveBreakdown: PERSPECTIVES.map((p) => ({ perspective: p, ...perspTally.get(p)! })),
		readyCount,
		incompleteCount,
		urgentCount,
		totalCommitments,
		overdueCommitments,
		dueSoonCommitments,
		totalDeliverables: activeDels.length,
		estimatedDeliverables,
		orphanDeliverables,
		avgLinksPerDeliverable:
			activeDels.length > 0 ? Math.round((totalLinks / activeDels.length) * 10) / 10 : 0,
		originCounts,
	}
}

// ── CFD (Cumulative Flow Diagram) ──

/** One data point in the CFD: how many opps were at-or-past each stage on a given day */
export interface CfdPoint {
	/** Day offset from the earliest recorded transition */
	day: number
	/** Timestamp at midnight for this day */
	ts: number
	/** Cumulative counts: how many opps had reached at-or-past each stage */
	explore: number
	sketch: number
	validate: number
	decompose: number
}

/**
 * Build CFD data from opportunity stage histories.
 * For each day in the range, counts how many opportunities had reached
 * at-or-past each stage by that day. Returns at most `maxDays` points.
 */
export function buildCfd(opportunities: Opportunity[], maxDays = 60): CfdPoint[] {
	const active = opportunities.filter((o) => !o.discontinuedAt)
	if (active.length === 0) return []

	// Collect all transitions
	const allTransitions: { stage: Stage; enteredAt: number }[] = []
	for (const opp of active) {
		const history = opp.stageHistory ?? []
		if (history.length === 0) {
			allTransitions.push({ stage: opp.stage, enteredAt: opp.stageEnteredAt })
		} else {
			for (const t of history) {
				allTransitions.push({ stage: t.stage, enteredAt: t.enteredAt })
			}
		}
	}

	if (allTransitions.length === 0) return []

	const earliest = Math.min(...allTransitions.map((t) => t.enteredAt))
	const now = Date.now()
	const DAY = 86_400_000

	// Snap to midnight boundaries
	const startDay = Math.floor(earliest / DAY) * DAY
	const endDay = Math.floor(now / DAY) * DAY
	const totalDays = Math.floor((endDay - startDay) / DAY) + 1

	// If too many days, sample evenly
	const step = totalDays > maxDays ? Math.ceil(totalDays / maxDays) : 1
	const points: CfdPoint[] = []

	for (let dayOffset = 0; dayOffset <= totalDays; dayOffset += step) {
		const ts = startDay + dayOffset * DAY
		const endOfDay = ts + DAY

		let explore = 0
		let sketch = 0
		let validate = 0
		let decompose = 0

		for (const opp of active) {
			const history = opp.stageHistory ?? [{ stage: opp.stage, enteredAt: opp.stageEnteredAt }]
			let highestIdx = -1
			for (const t of history) {
				if (t.enteredAt < endOfDay) {
					const idx = stageIndex(t.stage)
					if (idx > highestIdx) highestIdx = idx
				}
			}
			if (highestIdx >= 0) explore++
			if (highestIdx >= 1) sketch++
			if (highestIdx >= 2) validate++
			if (highestIdx >= 3) decompose++
		}

		points.push({ day: dayOffset, ts, explore, sketch, validate, decompose })
	}

	return points
}

// ── Lead time ──

export interface LeadTimeStats {
	/** Per-stage average days spent (only for opps that have moved past that stage) */
	stageAvg: { stage: Stage; avgDays: number; count: number }[]
	/** Average total days from explore entry to current stage (for opps past explore) */
	avgTotalDays: number
	/** Median total days */
	medianTotalDays: number
}

/**
 * Compute lead-time statistics from stage histories.
 * For each completed stage transition (explore→sketch, sketch→validate, etc.),
 * calculates average days spent.
 */
export function leadTimeStats(opportunities: Opportunity[]): LeadTimeStats {
	const active = opportunities.filter((o) => !o.discontinuedAt)
	const stageKeys: Stage[] = ['explore', 'sketch', 'validate', 'decompose']
	const stageDurations: Record<Stage, number[]> = {
		explore: [],
		sketch: [],
		validate: [],
		decompose: [],
	}
	const totalDays: number[] = []
	const DAY = 86_400_000

	for (const opp of active) {
		const history = opp.stageHistory ?? [{ stage: opp.stage, enteredAt: opp.stageEnteredAt }]
		if (history.length < 2) continue

		const sorted = [...history].sort((a, b) => a.enteredAt - b.enteredAt)

		for (let i = 0; i < sorted.length - 1; i++) {
			const days = (sorted[i + 1].enteredAt - sorted[i].enteredAt) / DAY
			stageDurations[sorted[i].stage].push(days)
		}

		const total = (sorted[sorted.length - 1].enteredAt - sorted[0].enteredAt) / DAY
		if (total > 0) totalDays.push(total)
	}

	const stageAvg = stageKeys
		.map((stage) => {
			const durations = stageDurations[stage]
			if (durations.length === 0) return { stage, avgDays: 0, count: 0 }
			const avg = durations.reduce((a, b) => a + b, 0) / durations.length
			return { stage, avgDays: Math.round(avg * 10) / 10, count: durations.length }
		})
		.filter((s) => s.count > 0)

	const sortedTotals = [...totalDays].sort((a, b) => a - b)
	const median = sortedTotals.length > 0 ? sortedTotals[Math.floor(sortedTotals.length / 2)] : 0

	return {
		stageAvg,
		avgTotalDays:
			totalDays.length > 0
				? Math.round((totalDays.reduce((a, b) => a + b, 0) / totalDays.length) * 10) / 10
				: 0,
		medianTotalDays: Math.round(median * 10) / 10,
	}
}

// ── Estimation display helpers ──

/** Derive a T-shirt size from a log-normal estimate (days median). */
export function sizeFromEstimate(est: DeliverableEstimate): TShirtSize {
	const median = Math.exp(est.mu)
	if (median < 0.5) return 'XS'
	if (median < 2) return 'S'
	if (median < 5) return 'M'
	if (median < 13) return 'L'
	return 'XL'
}

/** Derive a certainty score (1-5) from a log-normal sigma. */
export function certaintyFromEstimate(est: DeliverableEstimate): Certainty {
	if (est.sigma < 0.2) return 5
	if (est.sigma < 0.4) return 4
	if (est.sigma < 0.6) return 3
	if (est.sigma < 0.9) return 2
	return 1
}

/** Get the effective size: estimated (derived) or manual. */
export function effectiveSize(del: Deliverable): TShirtSize | null {
	if (del.estimate) return sizeFromEstimate(del.estimate)
	return del.size
}

/** Get the effective certainty: estimated (derived) or manual. */
export function effectiveCertainty(del: Deliverable): Certainty | null {
	if (del.estimate) return certaintyFromEstimate(del.estimate)
	return del.certainty
}

// ── Effort aggregation ──

/** Sum of linked deliverable effort medians (in days) for an opportunity. */
/** Format a median estimate as rounded days (e.g. "4d", "38d", "½d"). Takes raw mu (log-scale). */
export function formatEstimateDays(mu: number): string {
	return formatDays(Math.exp(mu))
}

/** Format a days value (already in linear scale) as rounded days. */
export function formatDays(days: number): string {
	if (days < 0.75) return '½d'
	if (days < 1.5) return '1d'
	return `${Math.round(days)}d`
}

/** Log-normal quantile: Q(p) = exp(mu + sigma * Φ⁻¹(p)). */
export function lognormalQuantile(mu: number, sigma: number, p: number): number {
	return Math.exp(mu + sigma * normInv(p))
}

/** Rational approximation of the standard normal inverse CDF (Abramowitz & Stegun 26.2.23). */
function normInv(p: number): number {
	if (p <= 0) return -Infinity
	if (p >= 1) return Infinity
	if (p === 0.5) return 0
	const flip = p < 0.5
	const pp = flip ? p : 1 - p
	const t = Math.sqrt(-2 * Math.log(pp))
	const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328
	const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308
	const x = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t)
	return flip ? -x : x
}

/** Box plot data for a single log-normal estimate. */
export interface BoxPlotRow {
	label: string
	p10: number
	p25: number
	p50: number
	p75: number
	p90: number
	coverage: 'full' | 'partial'
}

/**
 * Fenton-Wilkinson approximation: combine independent log-normals into a single log-normal.
 * Each entry has (mu, sigma, weight). Weight is 1 for full coverage, 0.5 for partial.
 */
export function combineLognormals(entries: Array<{ mu: number; sigma: number; weight: number }>): { mu: number; sigma: number } | null {
	if (entries.length === 0) return null
	// Mean and variance of the sum of scaled log-normals
	let meanSum = 0
	let varSum = 0
	for (const e of entries) {
		const w = e.weight
		meanSum += w * Math.exp(e.mu + e.sigma * e.sigma / 2)
		varSum += w * w * Math.exp(2 * e.mu + e.sigma * e.sigma) * (Math.exp(e.sigma * e.sigma) - 1)
	}
	// Match moments to a log-normal
	const sigmaSquared = Math.log(1 + varSum / (meanSum * meanSum))
	return {
		mu: Math.log(meanSum) - sigmaSquared / 2,
		sigma: Math.sqrt(sigmaSquared),
	}
}

/**
 * Build box plot data for an opportunity's linked deliverables + combined total.
 * Returns null if no estimated deliverables are linked.
 */
export function opportunityBoxPlotData(
	oppId: string,
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): { rows: BoxPlotRow[]; combined: BoxPlotRow } | null {
	const oppLinks = linksForOpportunity(links, oppId)
	const entries: Array<{ mu: number; sigma: number; weight: number }> = []
	const rows: BoxPlotRow[] = []

	for (const link of oppLinks) {
		const del = deliverables.find((d) => d.id === link.deliverableId)
		if (!del?.estimate) continue
		const { mu, sigma } = del.estimate
		const weight = link.coverage === 'full' ? 1 : 0.5
		entries.push({ mu, sigma, weight })
		rows.push({
			label: del.title,
			p10: lognormalQuantile(mu, sigma, 0.1) * weight,
			p25: lognormalQuantile(mu, sigma, 0.25) * weight,
			p50: lognormalQuantile(mu, sigma, 0.5) * weight,
			p75: lognormalQuantile(mu, sigma, 0.75) * weight,
			p90: lognormalQuantile(mu, sigma, 0.9) * weight,
			coverage: link.coverage,
		})
	}

	if (rows.length === 0) return null

	const sum = combineLognormals(entries)
	if (!sum) return null

	const combined: BoxPlotRow = {
		label: 'Total',
		p10: lognormalQuantile(sum.mu, sum.sigma, 0.1),
		p25: lognormalQuantile(sum.mu, sum.sigma, 0.25),
		p50: lognormalQuantile(sum.mu, sum.sigma, 0.5),
		p75: lognormalQuantile(sum.mu, sum.sigma, 0.75),
		p90: lognormalQuantile(sum.mu, sum.sigma, 0.9),
		coverage: 'full',
	}

	return { rows, combined }
}

export function opportunityEffort(
	oppId: string,
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): number | null {
	const oppLinks = linksForOpportunity(links, oppId)
	if (oppLinks.length === 0) return null
	let total = 0
	let hasEstimate = false
	for (const link of oppLinks) {
		const del = deliverables.find((d) => d.id === link.deliverableId)
		if (!del?.estimate) continue
		hasEstimate = true
		const median = Math.exp(del.estimate.mu)
		total += link.coverage === 'full' ? median : median * 0.5
	}
	return hasEstimate ? total : null
}

/**
 * Build box plot data for a set of opportunities (e.g. a horizon group).
 * One row per opportunity (combining its deliverables), plus a horizon-wide combined total.
 * Returns null if no estimated deliverables are linked to any of the opportunities.
 */
export function horizonBoxPlotData(
	oppIds: string[],
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): { rows: BoxPlotRow[]; combined: BoxPlotRow; estimatedCount: number; totalDeliverableCount: number } | null {
	const allEntries: Array<{ mu: number; sigma: number; weight: number }> = []
	const rows: BoxPlotRow[] = []
	let totalDelCount = 0

	for (const oppId of oppIds) {
		const opp = opportunities.find((o) => o.id === oppId)
		if (!opp) continue
		const oppLinks = linksForOpportunity(links, oppId)
		if (oppLinks.length === 0) continue
		totalDelCount += oppLinks.length

		const oppEntries: Array<{ mu: number; sigma: number; weight: number }> = []
		let hasPartial = false
		for (const link of oppLinks) {
			const del = deliverables.find((d) => d.id === link.deliverableId)
			if (!del?.estimate) continue
			const weight = link.coverage === 'full' ? 1 : 0.5
			if (link.coverage === 'partial') hasPartial = true
			oppEntries.push({ mu: del.estimate.mu, sigma: del.estimate.sigma, weight })
		}
		if (oppEntries.length === 0) continue

		const sum = combineLognormals(oppEntries)
		if (!sum) continue

		allEntries.push(...oppEntries)
		rows.push({
			label: opp.title,
			p10: lognormalQuantile(sum.mu, sum.sigma, 0.1),
			p25: lognormalQuantile(sum.mu, sum.sigma, 0.25),
			p50: lognormalQuantile(sum.mu, sum.sigma, 0.5),
			p75: lognormalQuantile(sum.mu, sum.sigma, 0.75),
			p90: lognormalQuantile(sum.mu, sum.sigma, 0.9),
			coverage: hasPartial ? 'partial' : 'full',
		})
	}

	if (rows.length === 0) return null

	const sum = combineLognormals(allEntries)
	if (!sum) return null

	const combined: BoxPlotRow = {
		label: 'Total',
		p10: lognormalQuantile(sum.mu, sum.sigma, 0.1),
		p25: lognormalQuantile(sum.mu, sum.sigma, 0.25),
		p50: lognormalQuantile(sum.mu, sum.sigma, 0.5),
		p75: lognormalQuantile(sum.mu, sum.sigma, 0.75),
		p90: lognormalQuantile(sum.mu, sum.sigma, 0.9),
		coverage: 'full',
	}

	return { rows, combined, estimatedCount: rows.length, totalDeliverableCount: totalDelCount }
}

/**
 * Board-wide effort summary: aggregate of all estimated deliverables.
 * Returns null if no deliverables have estimates.
 */
export function boardEffortSummary(
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
): { p25: number; p50: number; p75: number; estimatedCount: number; totalCount: number } | null {
	const entries: Array<{ mu: number; sigma: number; weight: number }> = []
	let estimatedCount = 0

	for (const del of deliverables) {
		if (!del.estimate) continue
		estimatedCount++
		// Find best coverage from any link (full > partial)
		const delLinks = links.filter((l) => l.deliverableId === del.id)
		const hasFull = delLinks.some((l) => l.coverage === 'full')
		const weight = hasFull || delLinks.length === 0 ? 1 : 0.5
		entries.push({ mu: del.estimate.mu, sigma: del.estimate.sigma, weight })
	}

	if (entries.length === 0) return null

	const sum = combineLognormals(entries)
	if (!sum) return null

	return {
		p25: lognormalQuantile(sum.mu, sum.sigma, 0.25),
		p50: lognormalQuantile(sum.mu, sum.sigma, 0.5),
		p75: lognormalQuantile(sum.mu, sum.sigma, 0.75),
		estimatedCount,
		totalCount: deliverables.length,
	}
}
