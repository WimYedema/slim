import { defaultHorizon as _defaultHorizon } from './queries'

export type Stage = 'explore' | 'sketch' | 'validate' | 'decompose' | 'deliver'

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
export type ExitState = 'killed' | 'parked' | 'merged' | 'done'

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
	{ key: 'done', label: 'Done', icon: '✓', description: 'Delivered — commitments fulfilled' },
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

/** A record of when an opportunity entered a stage */
export interface StageTransition {
	stage: Stage
	enteredAt: number
}

export interface Opportunity {
	id: string
	/** User-facing ticket identifier (e.g. "OPP-42") — optional, freeform */
	ticketId?: string
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
	/** History of stage transitions — used for CFD and lead time */
	stageHistory: StageTransition[]
	/** Verdict signals per stage × perspective, accumulated as the card moves right */
	signals: Record<Stage, StageSignals>
}

/** Default horizon label: next quarter, e.g. "2026Q3" — new ideas need exploration before "now" */
export { currentQuarter, defaultHorizon, isFutureHorizon } from './queries'

export const STAGES: { key: Stage; label: string; thinking: string }[] = [
	{ key: 'explore', label: 'Explore', thinking: 'Open' },
	{ key: 'sketch', label: 'Sketch', thinking: 'Focused' },
	{ key: 'validate', label: 'Validate', thinking: 'Evaluative' },
	{ key: 'decompose', label: 'Decompose', thinking: 'Structural' },
	{ key: 'deliver', label: 'Deliver', thinking: 'Observational' },
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
	deliver: {
		desirability: 'Did we deliver what users needed?',
		feasibility: 'Did implementation match the plan?',
		viability: 'Did we meet our commitments?',
	},
}

export { nextScore } from './queries'

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
		horizon: _defaultHorizon(),
		people: [],
		commitments: [],
		stageHistory: [{ stage: 'explore', enteredAt: now }],
		signals: {
			explore: emptyStageSignals(),
			sketch: emptyStageSignals(),
			validate: emptyStageSignals(),
			decompose: emptyStageSignals(),
			deliver: emptyStageSignals(),
		},
	}
}

/** Aging level based on days in current stage, horizon-aware */
export type AgingLevel = 'fresh' | 'aging' | 'stale'

export type HorizonPressure = 'now' | 'next' | 'none'

/** Consent status for a perspective at the current stage */
export type ConsentStatus = 'consent' | 'objection' | 'unheard'

export {
	agingLevel,
	canAdvanceToDeliver,
	cellHasSignal,
	commitmentStatuses,
	daysInStage,
	nextStage,
	originLabel,
	pacingSummary,
	prevStage,
	stageIndex,
} from './queries'

// ── Deliverables (many-to-many with opportunities) ──

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL'
export type Certainty = 1 | 2 | 3 | 4 | 5

/** Whether the deliverable produces an artifact or knowledge */
export type DeliverableKind = 'delivery' | 'discovery'

/** Lifecycle state of a deliverable */
export type DeliverableStatus = 'active' | 'done' | 'dropped'

/** Log-normal estimation result from Skatting (Estimate) */
export interface DeliverableEstimate {
	/** Log-normal location parameter */
	mu: number
	/** Log-normal spread parameter */
	sigma: number
	/** Number of estimators */
	n: number
	/** Estimation unit */
	unit: 'days' | 'points'
	/** Human-readable snapped value (e.g. "3d", "M") */
	snappedValue: string
	/** When this verdict was produced */
	estimatedAt: number
}

export interface Deliverable {
	id: string
	/** User-facing ticket identifier (e.g. "DEL-7") — optional, freeform */
	ticketId?: string
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
	/** Free-text notes (technical context, design constraints, etc.) */
	notes: string
	/** Estimation result from Skatting, if available */
	estimate?: DeliverableEstimate
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
		notes: '',
	}
}

export const TSHIRT_SIZES: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL']

/** Row height in pixels per T-shirt size */
export const SIZE_ROW_HEIGHT: Record<TShirtSize, number> = { XS: 18, S: 28, M: 40, L: 56, XL: 80 }
export const UNESTIMATED_ROW_HEIGHT = 40

export {
	type BoxPlotRow,
	boardEffortSummary,
	certaintyFromEstimate,
	commitmentUrgency,
	consentStatus,
	currentStageScores,
	effectiveCertainty,
	effectiveSize,
	formatDays,
	formatDaysLeft,
	formatEstimateDays,
	horizonBoxPlotData,
	inheritedPeople,
	linksForDeliverable,
	linksForOpportunity,
	lognormalQuantile,
	opportunityBoxPlotData,
	opportunityEffort,
	perspectiveAssignment,
	perspectiveOwner,
	perspectiveWeight,
	scoreClass,
	sizeFromEstimate,
	stageConsent,
	stageLabel,
	ternaryPosition,
	WIP_THRESHOLDS,
	type WipLevel,
	wipLevel,
	wipNudge,
} from './queries'
