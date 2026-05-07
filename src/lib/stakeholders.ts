import { type BoardPerson, collectPeople } from './meeting'
import type {
	Commitment,
	Deliverable,
	Opportunity,
	OpportunityDeliverableLink,
	Perspective,
	Score,
	Stage,
} from './types'
import { linksForDeliverable, PERSPECTIVES, stageIndex, stageLabel } from './types'

// ── Types ──

export interface StakeholderOpportunity {
	id: string
	title: string
	stage: Stage
	horizon: string
	/** The desirability signal score at the current stage */
	desirabilityScore: Score
	/** Whether desirability is unscored at the current stage */
	needsInput: boolean
	/** Summary of signal health across all three perspectives at current stage */
	signalSummary: { positive: number; uncertain: number; negative: number; none: number }
}

export interface StakeholderCommitment {
	opportunityId: string
	opportunityTitle: string
	commitment: Commitment
	daysLeft: number
	met: boolean
	overdue: boolean
}

export interface StakeholderDeliverable {
	id: string
	title: string
	size: string | null
	status: string
	linkedOpportunityTitles: string[]
	/** Earliest horizon from linked opportunities */
	horizon: string | null
}

export interface StakeholderProfile {
	name: string
	/** Opportunities where this person is a stakeholder or commitment target */
	opportunities: StakeholderOpportunity[]
	/** Commitments made to this person */
	commitments: StakeholderCommitment[]
	/** Deliverables they consume (directly or inherited) */
	deliverables: StakeholderDeliverable[]
	/** Desirability cells where input is needed from them */
	inputNeeded: {
		opportunityId: string
		opportunityTitle: string
		stage: Stage
		perspective: Perspective
	}[]
	/** Timestamp of last discussion (from meeting data) */
	lastDiscussed: number | null
	/** Number of opportunities with changes since last discussion */
	changesSinceLastTalk: number
}

export interface StakeholderSummary {
	name: string
	opportunityCount: number
	commitmentCount: number
	overdueCount: number
	inputNeededCount: number
	lastDiscussed: number | null
	/** Attention needed — true if overdue commitments, input needed, or stale contact */
	attention: boolean
	/** Sort score — lower = more urgent */
	urgencyScore: number
}

// ── Core functions ──

/** Collect all stakeholders from the board */
export function collectStakeholders(
	opportunities: Opportunity[],
	deliverables: Deliverable[],
): Map<string, BoardPerson> {
	const all = collectPeople(opportunities, deliverables)
	const stakeholders = new Map<string, BoardPerson>()
	for (const [name, person] of all) {
		if (person.roles.has('stakeholder') || person.isCommitmentTarget) {
			stakeholders.set(name, person)
		}
	}
	// Also include people who are consumers on deliverables
	for (const d of deliverables) {
		for (const consumer of d.extraConsumers) {
			if (!stakeholders.has(consumer)) {
				const person = all.get(consumer)
				if (person) stakeholders.set(consumer, person)
			}
		}
	}
	return stakeholders
}

/** Build a full stakeholder profile for the detail view */
export function buildStakeholderProfile(
	name: string,
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
	lastDiscussed: number | null,
): StakeholderProfile {
	const now = Date.now()
	const lowerName = name.toLowerCase()
	const profile: StakeholderProfile = {
		name,
		opportunities: [],
		commitments: [],
		deliverables: [],
		inputNeeded: [],
		lastDiscussed,
		changesSinceLastTalk: 0,
	}

	for (const opp of opportunities) {
		if (opp.discontinuedAt) continue

		const isStakeholder = opp.people.some(
			(p) => p.name.toLowerCase() === lowerName && p.role === 'stakeholder',
		)
		const isCommitmentTarget = opp.commitments.some((c) => c.to.toLowerCase() === lowerName)

		if (!isStakeholder && !isCommitmentTarget) continue

		// Signal summary at current stage
		const stageSignals = opp.signals[opp.stage]
		const signalSummary = { positive: 0, uncertain: 0, negative: 0, none: 0 }
		for (const p of PERSPECTIVES) {
			const score = stageSignals?.[p]?.score ?? 'none'
			signalSummary[score]++
		}

		const desirabilityScore = stageSignals?.desirability?.score ?? 'none'

		profile.opportunities.push({
			id: opp.id,
			title: opp.title,
			stage: opp.stage,
			horizon: opp.horizon,
			desirabilityScore,
			needsInput: desirabilityScore === 'none',
			signalSummary,
		})

		// Commitments to this person
		for (const c of opp.commitments) {
			if (c.to.toLowerCase() !== lowerName) continue
			const si = stageIndex(opp.stage)
			const met = stageIndex(c.milestone) < si
			const daysLeft = Math.ceil((c.by - now) / 86_400_000)
			profile.commitments.push({
				opportunityId: opp.id,
				opportunityTitle: opp.title,
				commitment: c,
				daysLeft,
				met,
				overdue: !met && daysLeft < 0,
			})
		}

		// Input needed — desirability cells assigned to them that are unscored
		if (isStakeholder) {
			const person = opp.people.find((p) => p.name.toLowerCase() === lowerName)
			if (person) {
				for (const a of person.perspectives) {
					if (!a.stage) continue
					const signal = opp.signals[a.stage]?.[a.perspective]
					if (!signal || signal.score === 'none') {
						profile.inputNeeded.push({
							opportunityId: opp.id,
							opportunityTitle: opp.title,
							stage: a.stage,
							perspective: a.perspective,
						})
					}
				}
			}
		}

		// Track changes since last talk
		if (lastDiscussed && (opp.updatedAt ?? opp.createdAt) > lastDiscussed) {
			profile.changesSinceLastTalk++
		}
	}

	// Deliverables they consume
	for (const d of deliverables) {
		if (d.status !== 'active') continue
		const isDirectConsumer = d.extraConsumers.some((n) => n.toLowerCase() === lowerName)

		// Inherited consumer: stakeholder on a linked opportunity
		const dLinks = linksForDeliverable(links, d.id)
		let inheritedConsumer = false
		for (const link of dLinks) {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) continue
			if (
				opp.people.some(
					(p) =>
						p.name.toLowerCase() === lowerName &&
						(p.role === 'stakeholder' || p.role === 'approver'),
				)
			) {
				inheritedConsumer = true
				break
			}
		}

		if (!isDirectConsumer && !inheritedConsumer) continue

		const linkedOppTitles = dLinks
			.map((l) => opportunities.find((o) => o.id === l.opportunityId)?.title)
			.filter((t): t is string => !!t)

		const linkedHorizons = dLinks
			.map((l) => opportunities.find((o) => o.id === l.opportunityId)?.horizon)
			.filter((h): h is string => !!h)
			.sort()

		profile.deliverables.push({
			id: d.id,
			title: d.title,
			size: d.size,
			status: d.status,
			linkedOpportunityTitles: linkedOppTitles,
			horizon: linkedHorizons[0] ?? null,
		})
	}

	// Sort commitments by urgency
	profile.commitments.sort((a, b) => a.daysLeft - b.daysLeft)

	return profile
}

/** Build summary cards for the stakeholder list view */
export function buildStakeholderSummaries(
	opportunities: Opportunity[],
	deliverables: Deliverable[],
	links: OpportunityDeliverableLink[],
	lastDiscussedMap: Record<string, number>,
): StakeholderSummary[] {
	const stakeholders = collectStakeholders(opportunities, deliverables)
	const now = Date.now()
	const summaries: StakeholderSummary[] = []

	for (const [name] of stakeholders) {
		const lastDiscussed = lastDiscussedMap[name] ?? null
		const profile = buildStakeholderProfile(name, opportunities, deliverables, links, lastDiscussed)

		const overdueCount = profile.commitments.filter((c) => c.overdue).length
		const inputNeededCount = profile.inputNeeded.length
		const daysSinceContact = lastDiscussed ? Math.floor((now - lastDiscussed) / 86_400_000) : null
		const staleContact = daysSinceContact === null || daysSinceContact > 14

		const attention =
			overdueCount > 0 || inputNeededCount > 0 || (staleContact && profile.opportunities.length > 0)

		// Urgency: overdue > input needed > stale contact > no issues
		let urgencyScore = 0
		if (overdueCount > 0) urgencyScore -= 1000 + overdueCount * 100
		if (inputNeededCount > 0) urgencyScore -= 500 + inputNeededCount * 10
		if (staleContact) urgencyScore -= 200
		if (profile.changesSinceLastTalk > 0) urgencyScore -= profile.changesSinceLastTalk * 50

		summaries.push({
			name,
			opportunityCount: profile.opportunities.length,
			commitmentCount: profile.commitments.length,
			overdueCount,
			inputNeededCount,
			lastDiscussed,
			attention,
			urgencyScore,
		})
	}

	// Sort by urgency (most urgent first)
	summaries.sort((a, b) => a.urgencyScore - b.urgencyScore)

	return summaries
}

/** Generate talking points for a stakeholder conversation */
export function buildTalkingPoints(profile: StakeholderProfile): string[] {
	const points: string[] = []

	// Overdue commitments first
	for (const c of profile.commitments) {
		if (c.overdue) {
			points.push(
				`⚠ Commitment overdue: ${c.opportunityTitle} — ${stageLabel(c.commitment.milestone)} by ${new Date(c.commitment.by).toLocaleDateString()} (${Math.abs(c.daysLeft)}d overdue)`,
			)
		}
	}

	// Upcoming commitments
	for (const c of profile.commitments) {
		if (!c.met && !c.overdue) {
			points.push(
				`📅 Commitment: ${c.opportunityTitle} — ${stageLabel(c.commitment.milestone)} in ${c.daysLeft}d`,
			)
		}
	}

	// Input needed
	if (profile.inputNeeded.length > 0) {
		const opps = [...new Set(profile.inputNeeded.map((i) => i.opportunityTitle))]
		points.push(`💬 Input needed on: ${opps.join(', ')}`)
	}

	// Changes since last talk
	if (profile.changesSinceLastTalk > 0) {
		points.push(
			`📋 ${profile.changesSinceLastTalk} opportunit${profile.changesSinceLastTalk === 1 ? 'y' : 'ies'} changed since last conversation`,
		)
	}

	// Opportunity status overview
	for (const opp of profile.opportunities) {
		const signals = []
		if (opp.signalSummary.positive > 0) signals.push(`${opp.signalSummary.positive}✓`)
		if (opp.signalSummary.uncertain > 0) signals.push(`${opp.signalSummary.uncertain}?`)
		if (opp.signalSummary.negative > 0) signals.push(`${opp.signalSummary.negative}✗`)
		if (opp.signalSummary.none > 0) signals.push(`${opp.signalSummary.none}—`)
		points.push(`${opp.title} [${stageLabel(opp.stage)}] ${signals.join(' ')}`)
	}

	return points
}
