export type Stage = 'explore' | 'sketch' | 'validate' | 'decompose'

export type Perspective = 'desirability' | 'feasibility' | 'viability'

export const PERSPECTIVES: Perspective[] = ['desirability', 'feasibility', 'viability']

/** Where the opportunity came from — shapes entry assumptions */
export type OriginType = 'demand' | 'supply' | 'incident' | 'debt'

export const ORIGIN_TYPES: { key: OriginType; label: string; description: string }[] = [
	{
		key: 'demand',
		label: 'Request',
		description: 'Someone asked for it — users, customers, or stakeholders',
	},
	{
		key: 'supply',
		label: 'Idea',
		description: 'We thought of it — a capability, innovation, or technical opportunity',
	},
	{ key: 'incident', label: 'Incident', description: 'An urgent disruption — production is down' },
	{
		key: 'debt',
		label: 'Debt',
		description: 'Accumulated concerns — pattern of bugs or workarounds',
	},
]

/** Exit state when an opportunity leaves the active pipeline */
export type ExitState = 'killed' | 'parked' | 'merged'

export const EXIT_STATES: { key: ExitState; label: string; icon: string; description: string }[] = [
	{
		key: 'killed',
		label: 'Kill',
		icon: '✗',
		description: 'Evaluated and rejected — a lens failed or priorities shifted',
	},
	{
		key: 'parked',
		label: 'Park',
		icon: '⏸',
		description: 'Not now — optionally set a horizon to revisit',
	},
	{ key: 'merged', label: 'Merge', icon: '⤵', description: 'Subsumed by another opportunity' },
]

/** Role a person plays on an opportunity */
export type PersonRole = 'approver' | 'expert' | 'stakeholder'

export const PERSON_ROLES: { key: PersonRole; label: string; description: string }[] = [
	{
		key: 'approver',
		label: 'Approver',
		description: 'Unblocks progress — someone needs something from them',
	},
	{ key: 'expert', label: 'Expert', description: 'Provides knowledge for a specific perspective' },
	{
		key: 'stakeholder',
		label: 'Stakeholder',
		description: 'Cares about the outcome, wants to stay informed',
	},
]

/** When a perspective was delegated to a person */
export interface PerspectiveAssignment {
	perspective: Perspective
	stage: Stage
	assignedAt: number
}

/** A person linked to an opportunity */
export interface PersonLink {
	id: string
	name: string
	role: PersonRole
	/** Which perspectives they own — the cell's "assigned to" */
	perspectives: PerspectiveAssignment[]
}

/** Traffic-light assessment for a matrix cell */
export type Score = 'none' | 'uncertain' | 'positive' | 'negative'

/** How the score was determined */
export type ScoreSource = 'manual' | 'skatting'

/** One cell in the stage × perspective matrix */
export interface CellSignal {
	score: Score
	source: ScoreSource
	/** One-line verdict or finding */
	verdict: string
	/** URL or reference to the evidence */
	evidence: string
	/** Who provided this signal */
	owner: string
}

/** All three perspective signals for a given stage */
export type StageSignals = Record<Perspective, CellSignal>

/** A promise made to someone about reaching a milestone by a date */
export interface Commitment {
	id: string
	/** Who was the promise made to */
	to: string
	/** What stage should be reached */
	milestone: Stage
	/** Deadline timestamp */
	by: number
}

export interface Opportunity {
	id: string
	title: string
	/** Optional longer description */
	description: string
	stage: Stage
	createdAt: number
	/** Timestamp of last meaningful change */
	updatedAt: number
	/** Timestamp when the opportunity entered its current stage — used for card aging */
	stageEnteredAt: number
	/** Where the opportunity came from */
	origin?: OriginType
	/** Exit state when discontinued (undefined = never exited) */
	exitState?: ExitState
	/** Why the opportunity was exited — one sentence */
	exitReason?: string
	/** Timestamp when discontinued, or undefined if active */
	discontinuedAt?: number
	/** When to revisit a parked opportunity — freeform horizon label */
	parkUntil?: string
	/** PO believes all deliverables have been identified */
	decompositionComplete?: boolean
	/** Roadmap horizon — freeform label, defaults to YYYYQ[1-4] */
	horizon: string
	/** People linked to this opportunity */
	people: PersonLink[]
	/** Promises made about this opportunity */
	commitments: Commitment[]
	/** Verdict signals per stage × perspective, accumulated as the card moves right */
	signals: Record<Stage, StageSignals>
}

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

export const STAGES: { key: Stage; label: string; thinking: string }[] = [
	{ key: 'explore', label: 'Explore', thinking: 'Open' },
	{ key: 'sketch', label: 'Sketch', thinking: 'Focused' },
	{ key: 'validate', label: 'Validate', thinking: 'Evaluative' },
	{ key: 'decompose', label: 'Decompose', thinking: 'Structural' },
]

export const PERSPECTIVE_LABELS: Record<Perspective, string> = {
	desirability: 'Users',
	feasibility: 'Technical',
	viability: 'Business',
}

export const PERSPECTIVE_SHORT: Record<Perspective, string> = {
	desirability: 'U',
	feasibility: 'T',
	viability: 'B',
}

/** Challenge question per stage × perspective — what the cell asks */
export const CELL_QUESTIONS: Record<Stage, Record<Perspective, string>> = {
	explore: {
		desirability: 'Who might want this?',
		feasibility: 'Could we build it?',
		viability: 'Does it fit our strategy?',
	},
	sketch: {
		desirability: 'Who exactly is affected, and what does done look like?',
		feasibility: 'What are the technical constraints and dependencies?',
		viability: 'Does this align with strategy and scope?',
	},
	validate: {
		desirability: 'Did users confirm they want this?',
		feasibility: 'Did a spike confirm we can build it?',
		viability: 'Does the business case hold?',
	},
	decompose: {
		desirability: 'Which deliverables serve this need?',
		feasibility: 'What is the estimated effort?',
		viability: 'Is it worth the cost?',
	},
}

/** Score cycle: none → uncertain → positive → negative → none */
const SCORE_CYCLE: Score[] = ['none', 'uncertain', 'positive', 'negative']

export function nextScore(current: Score): Score {
	const idx = SCORE_CYCLE.indexOf(current)
	return SCORE_CYCLE[(idx + 1) % SCORE_CYCLE.length]
}

export const SCORE_DISPLAY: Record<Score, { label: string }> = {
	none: { label: 'Not consulted' },
	uncertain: { label: 'Concern' },
	positive: { label: 'Consent' },
	negative: { label: 'Objection' },
}

export const SCORE_SYMBOL: Record<Score, string> = {
	none: '—',
	uncertain: '?',
	positive: '✓',
	negative: '✗',
}

const EMPTY_SIGNAL: CellSignal = {
	score: 'none',
	source: 'manual',
	verdict: '',
	evidence: '',
	owner: '',
}

function emptyStageSignals(): StageSignals {
	return {
		desirability: { ...EMPTY_SIGNAL },
		feasibility: { ...EMPTY_SIGNAL },
		viability: { ...EMPTY_SIGNAL },
	}
}

export function createOpportunity(title: string): Opportunity {
	const now = Date.now()
	return {
		id: crypto.randomUUID(),
		title,
		description: '',
		stage: 'explore',
		createdAt: now,
		updatedAt: now,
		stageEnteredAt: now,
		horizon: defaultHorizon(),
		people: [],
		commitments: [],
		signals: {
			explore: emptyStageSignals(),
			sketch: emptyStageSignals(),
			validate: emptyStageSignals(),
			decompose: emptyStageSignals(),
		},
	}
}

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

/** Days an opportunity has been in its current stage */
export function daysInStage(opp: Opportunity): number {
	const entered = opp.stageEnteredAt ?? opp.createdAt
	return Math.floor((Date.now() - entered) / 86_400_000)
}

/** Aging level based on days in current stage, horizon-aware */
export type AgingLevel = 'fresh' | 'aging' | 'stale'

export type HorizonPressure = 'now' | 'next' | 'none'

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

/** Human label for an origin type key */
export function originLabel(origin: OriginType): string {
	return ORIGIN_TYPES.find((o) => o.key === origin)?.label ?? origin
}

export function cellHasSignal(signal: CellSignal): boolean {
	return signal.score !== 'none'
}

// ── Deliverables (many-to-many with opportunities) ──

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL'
export type Certainty = 1 | 2 | 3 | 4 | 5

/** Whether the deliverable produces an artifact or knowledge */
export type DeliverableKind = 'delivery' | 'discovery'

/** Lifecycle state of a deliverable */
export type DeliverableStatus = 'active' | 'done' | 'dropped'

export interface Deliverable {
	id: string
	title: string
	/** Build something (delivery) or learn something (discovery) */
	kind: DeliverableKind
	/** Lifecycle state — active items show in the matrix, done/dropped go to archive */
	status: DeliverableStatus
	/** Timestamp when marked done or dropped */
	completedAt?: number
	/** Why the deliverable was dropped — one sentence */
	dropReason?: string
	/** Optional link to external sprint tool (Jira, Linear, etc.) */
	externalUrl: string
	/** Timestamp of last meaningful change */
	updatedAt: number
	/** Extra contributors not inherited from opportunity experts */
	extraContributors: string[]
	/** Extra consumers not inherited from opportunity stakeholders/approvers */
	extraConsumers: string[]
	/** T-shirt effort estimate (manual or derived from Skatting mu) */
	size: TShirtSize | null
	/** Certainty 1-5 (manual or derived from Skatting sigma) */
	certainty: Certainty | null
	/** Free-text description of external dependency, if any */
	externalDependency: string
}

export type Coverage = 'full' | 'partial'

/** A link between an opportunity and a deliverable */
export interface OpportunityDeliverableLink {
	opportunityId: string
	deliverableId: string
	coverage: Coverage
}

export function createDeliverable(title: string): Deliverable {
	return {
		id: crypto.randomUUID(),
		title,
		kind: 'delivery',
		status: 'active',
		externalUrl: '',
		updatedAt: Date.now(),
		extraContributors: [],
		extraConsumers: [],
		size: null,
		certainty: null,
		externalDependency: '',
	}
}

export const TSHIRT_SIZES: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL']

/** Row height in pixels per T-shirt size */
export const SIZE_ROW_HEIGHT: Record<TShirtSize, number> = { XS: 18, S: 28, M: 40, L: 56, XL: 80 }
export const UNESTIMATED_ROW_HEIGHT = 40

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

/** Get the D/F/V scores for the card's current stage */
export function currentStageScores(opp: Opportunity): Record<Perspective, Score> {
	const s = opp.signals[opp.stage]
	return {
		desirability: s.desirability.score,
		feasibility: s.feasibility.score,
		viability: s.viability.score,
	}
}

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
export type ConsentStatus = 'consent' | 'objection' | 'unheard'

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

// ── Shared display helpers (extracted from components) ──

/** CSS class for a score value — used by multiple views */
export function scoreClass(score: Score): string {
	return `score-${score}`
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
