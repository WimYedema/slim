import type { MeetingData } from './meeting'
import {
	createDeliverable,
	createOpportunity,
	type Deliverable,
	type Opportunity,
	type OpportunityDeliverableLink,
} from './types'

/**
 * Sample data based on SAMPLE-SCENARIO.md
 * Alex Torres, PO at Relay (B2B SaaS integration middleware).
 * 8 opportunities across 3 horizons, representing the classic
 * "build for existing vs. future customers" tension.
 */
export function createSampleOpportunities(): Opportunity[] {
	const DAY = 86_400_000
	const now = Date.now()
	const threeWeeksAgo = now - 21 * DAY

	// --- 2026Q2: shipping soon ---

	const sso = createOpportunity('SSO login for enterprise')
	sso.stage = 'validate'
	sso.horizon = '2026Q2'
	sso.origin = 'demand'
	sso.createdAt = threeWeeksAgo
	sso.stageEnteredAt = now - 10 * DAY
	sso.stageHistory = [
		{ stage: 'explore', enteredAt: threeWeeksAgo },
		{ stage: 'sketch', enteredAt: threeWeeksAgo + 4 * DAY },
		{ stage: 'validate', enteredAt: now - 10 * DAY },
	]
	sso.description =
		'Strategic bet: 12 enterprise accounts waiting for SSO before signing. Unlocks a completely different price tier.'
	sso.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Top request from enterprise prospects',
		evidence: 'Sales pipeline',
		owner: 'Marcus',
	}
	sso.signals.explore.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: 'Standard SAML/OIDC integration',
		evidence: '',
		owner: 'Alice',
	}
	sso.signals.explore.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Unlocks enterprise tier pricing',
		evidence: '',
		owner: 'Marcus',
	}
	sso.signals.sketch.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: '12 enterprise accounts waiting',
		evidence: 'Sales pipeline',
		owner: 'Marcus',
	}
	sso.signals.sketch.feasibility = {
		score: 'uncertain',
		source: 'manual',
		verdict: 'Need to support both SAML and OIDC',
		evidence: '',
		owner: 'Alice',
	}
	sso.signals.sketch.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'ARR increase projected at 40%',
		evidence: 'Revenue model',
		owner: 'Marcus',
	}
	// validate stage: Sarah (feasibility) and Marcus (viability) assigned but NOT yet scored
	sso.people = [
		{
			id: 'p-sarah',
			name: 'Sarah',
			role: 'expert',
			perspectives: [{ perspective: 'feasibility', stage: 'validate', assignedAt: now - 3 * DAY }],
		},
		{
			id: 'p-marcus',
			name: 'Marcus',
			role: 'stakeholder',
			perspectives: [{ perspective: 'viability', stage: 'validate', assignedAt: now - 5 * DAY }],
		},
	]
	sso.commitments = [{ id: 'c-ceo', to: 'CEO', milestone: 'validate', by: now + 5 * DAY }]

	const webhooks = createOpportunity('Webhooks API')
	webhooks.stage = 'decompose'
	webhooks.horizon = '2026Q2'
	webhooks.origin = 'demand'
	webhooks.createdAt = threeWeeksAgo
	webhooks.stageEnteredAt = now - 2 * DAY
	webhooks.stageHistory = [
		{ stage: 'explore', enteredAt: threeWeeksAgo },
		{ stage: 'sketch', enteredAt: threeWeeksAgo + 3 * DAY },
		{ stage: 'validate', enteredAt: threeWeeksAgo + 10 * DAY },
		{ stage: 'decompose', enteredAt: now - 2 * DAY },
	]
	webhooks.description =
		'Flagship feature this quarter. Fully validated, three integration partners beta-tested. Now decomposing into sprint-ready work.'
	webhooks.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Integration partners need it',
		evidence: 'Partner interviews',
		owner: 'Alex',
	}
	webhooks.signals.explore.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: 'Event system already exists internally',
		evidence: 'Architecture doc',
		owner: 'Alice',
	}
	webhooks.signals.explore.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Drives platform stickiness',
		evidence: '',
		owner: 'Alex',
	}
	webhooks.signals.sketch.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Top 5 partners committed to beta',
		evidence: 'Partner agreements',
		owner: 'Alex',
	}
	webhooks.signals.sketch.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: 'REST + retry pattern defined',
		evidence: 'RFC doc',
		owner: 'Alice',
	}
	webhooks.signals.sketch.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Partners pay for API tier',
		evidence: 'Pricing model',
		owner: 'Marcus',
	}
	webhooks.signals.validate.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Beta partners integrated successfully',
		evidence: 'Beta feedback',
		owner: 'Alex',
	}
	webhooks.signals.validate.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: 'Spike completed, 99.9% delivery rate',
		evidence: 'Load test results',
		owner: 'Alice',
	}
	webhooks.signals.validate.viability = {
		score: 'positive',
		source: 'manual',
		verdict: '3 partners upgraded to API tier',
		evidence: 'Billing data',
		owner: 'Marcus',
	}
	webhooks.signals.decompose.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Acceptance criteria signed off',
		evidence: '',
		owner: 'Alex',
	}
	webhooks.signals.decompose.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: '3 sprints, 2 devs',
		evidence: 'Sprint plan',
		owner: 'Alice',
	}
	webhooks.signals.decompose.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Budget allocated',
		evidence: 'Finance approval',
		owner: 'Alex',
	}
	webhooks.decompositionComplete = true

	// --- 2026Q3: next quarter ---

	const darkMode = createOpportunity('Dark mode')
	darkMode.stage = 'sketch'
	darkMode.horizon = '2026Q3'
	darkMode.origin = 'demand'
	darkMode.createdAt = threeWeeksAgo
	darkMode.stageEnteredAt = now - 3 * DAY
	darkMode.stageHistory = [
		{ stage: 'explore', enteredAt: threeWeeksAgo },
		{ stage: 'sketch', enteredAt: now - 3 * DAY },
	]
	darkMode.description =
		'Community crowd-pleaser, #2 most requested. Important for retention, low technical risk, not strategically critical.'
	darkMode.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: '#2 most requested feature',
		evidence: 'User forum votes',
		owner: 'Alex',
	}
	darkMode.signals.explore.feasibility = {
		score: 'uncertain',
		source: 'manual',
		verdict: 'CSS variables are mostly ready',
		evidence: '',
		owner: 'Alice',
	}
	darkMode.signals.explore.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Retention play, low cost',
		evidence: '',
		owner: 'Alex',
	}

	const aiReports = createOpportunity('AI-generated reports')
	aiReports.stage = 'sketch'
	aiReports.horizon = '2026Q3'
	aiReports.origin = 'supply'
	aiReports.createdAt = threeWeeksAgo
	aiReports.stageEnteredAt = now - 18 * DAY
	aiReports.stageHistory = [
		{ stage: 'explore', enteredAt: threeWeeksAgo },
		{ stage: 'sketch', enteredAt: now - 18 * DAY },
	]
	aiReports.description =
		'Moonshot: automated insights for managers. Feasibility objection at explore (LLM costs). Investigating local models at sketch.'
	aiReports.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Managers want automated insights',
		evidence: 'Interview notes',
		owner: 'Alex',
	}
	aiReports.signals.explore.feasibility = {
		score: 'negative',
		source: 'manual',
		verdict: 'LLM costs too high at scale',
		evidence: 'Cost projection',
		owner: 'Alice',
	}
	aiReports.signals.explore.viability = {
		score: 'uncertain',
		source: 'manual',
		verdict: 'Could be premium add-on',
		evidence: '',
		owner: 'Alex',
	}
	aiReports.signals.sketch.feasibility = {
		score: 'uncertain',
		source: 'manual',
		verdict: 'Local models might work — investigating',
		evidence: '',
		owner: 'Alex',
	}
	aiReports.people = [
		{
			id: 'p-alex',
			name: 'Alex',
			role: 'expert',
			perspectives: [{ perspective: 'feasibility', stage: 'sketch', assignedAt: now - 1 * DAY }],
		},
	]

	const multiLang = createOpportunity('Multi-language support')
	multiLang.stage = 'sketch'
	multiLang.horizon = '2026Q3'
	multiLang.origin = 'demand'
	multiLang.createdAt = threeWeeksAgo
	multiLang.stageEnteredAt = now - 14 * DAY
	multiLang.stageHistory = [
		{ stage: 'explore', enteredAt: threeWeeksAgo },
		{ stage: 'sketch', enteredAt: now - 14 * DAY },
	]
	multiLang.description =
		'Driven by DACH market expansion. i18n framework ready, translation budget approved. Commitment to DACH partner is overdue.'
	multiLang.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: 'DACH market expansion opportunity',
		evidence: 'Market research',
		owner: 'Marcus',
	}
	multiLang.signals.explore.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: 'i18n framework ready',
		evidence: 'Tech spike',
		owner: 'Alice',
	}
	multiLang.signals.explore.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Opens 3 new markets',
		evidence: 'Revenue projection',
		owner: 'Marcus',
	}
	multiLang.signals.sketch.feasibility = {
		score: 'positive',
		source: 'manual',
		verdict: '80% of strings already extracted',
		evidence: 'Codebase audit',
		owner: 'Alice',
	}
	multiLang.signals.sketch.viability = {
		score: 'positive',
		source: 'manual',
		verdict: 'Translation budget approved',
		evidence: 'Finance sign-off',
		owner: 'Alex',
	}
	multiLang.commitments = [
		{ id: 'c-dach', to: 'DACH partner', milestone: 'sketch', by: now - 3 * DAY },
	]

	// --- 2026Q4: future ---

	const offline = createOpportunity('Offline mode')
	offline.stage = 'explore'
	offline.horizon = '2026Q4'
	offline.origin = 'demand'
	offline.createdAt = threeWeeksAgo
	offline.description = 'Seed item from field workers. Might grow, might not.'
	offline.signals.explore.desirability = {
		score: 'uncertain',
		source: 'manual',
		verdict: 'Field workers mentioned wanting it',
		evidence: 'Support tickets',
		owner: 'Alex',
	}

	const mobileApp = createOpportunity('Mobile app')
	mobileApp.stage = 'explore'
	mobileApp.horizon = '2026Q4'
	mobileApp.origin = 'demand'
	mobileApp.createdAt = threeWeeksAgo
	mobileApp.description =
		'60% of users access via mobile browser. No decision yet on native, PWA, or responsive — that belongs at sketch.'
	mobileApp.signals.explore.desirability = {
		score: 'positive',
		source: 'manual',
		verdict: '60% of users on mobile browser',
		evidence: 'Analytics dashboard',
		owner: 'Alex',
	}

	const csvRevamp = createOpportunity('CSV export revamp')
	csvRevamp.stage = 'explore'
	csvRevamp.horizon = '2026Q4'
	csvRevamp.origin = 'debt'
	csvRevamp.createdAt = threeWeeksAgo
	csvRevamp.stageEnteredAt = now - 22 * DAY
	csvRevamp.stageHistory = [{ stage: 'explore', enteredAt: threeWeeksAgo }]
	csvRevamp.description =
		'Tech debt: current CSV export is clunky. Sitting with zero signals for 22 days — stale.'

	return [sso, webhooks, darkMode, aiReports, multiLang, offline, mobileApp, csvRevamp]
}

/** Sample deliverables per SAMPLE-SCENARIO.md — 6 work items linked to Webhooks and SSO */
export function createSampleDeliverables(opps: Opportunity[]): {
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
} {
	const webhooks = opps.find((o) => o.title === 'Webhooks API')!
	const sso = opps.find((o) => o.title === 'SSO login for enterprise')!

	const eventBus = createDeliverable('Webhook event bus')
	eventBus.externalUrl = 'https://jira.example.com/PROD-142'
	eventBus.size = 'L'
	eventBus.certainty = 4
	eventBus.extraContributors = ['Alice', 'Bob']

	const retryDlq = createDeliverable('Webhook retry & DLQ')
	retryDlq.externalUrl = 'https://jira.example.com/PROD-143'
	retryDlq.size = 'M'
	retryDlq.certainty = 3
	retryDlq.extraContributors = ['DevOps team', 'Bob']

	const partnerDash = createDeliverable('Partner dashboard')
	partnerDash.size = 'XL'
	partnerDash.certainty = 2
	partnerDash.extraContributors = ['Carol']
	partnerDash.externalDependency = 'Partner API access from Acme Corp — keeps slipping'

	const saml = createDeliverable('SAML integration')
	saml.size = 'S'
	saml.certainty = 5
	saml.extraContributors = ['Alice']

	const oidc = createDeliverable('OIDC integration')
	oidc.size = 'S'
	oidc.certainty = 4
	oidc.extraContributors = ['Alice']

	const webhookDocs = createDeliverable('Webhook docs & SDK examples')
	webhookDocs.size = 'XS'
	webhookDocs.certainty = 5
	webhookDocs.extraContributors = ['Carol']

	const retrySpike = createDeliverable('Spike: retry as separate service vs event bus')
	retrySpike.kind = 'discovery'
	retrySpike.size = 'S'
	retrySpike.certainty = 3
	retrySpike.extraContributors = ['Alice']

	const deliverables = [eventBus, retryDlq, partnerDash, saml, oidc, webhookDocs, retrySpike]
	const links: OpportunityDeliverableLink[] = [
		{ opportunityId: webhooks.id, deliverableId: eventBus.id, coverage: 'full' },
		{ opportunityId: webhooks.id, deliverableId: retryDlq.id, coverage: 'full' },
		{ opportunityId: webhooks.id, deliverableId: partnerDash.id, coverage: 'partial' },
		{ opportunityId: webhooks.id, deliverableId: webhookDocs.id, coverage: 'full' },
		{ opportunityId: webhooks.id, deliverableId: retrySpike.id, coverage: 'full' },
		{ opportunityId: sso.id, deliverableId: saml.id, coverage: 'partial' },
		{ opportunityId: sso.id, deliverableId: oidc.id, coverage: 'partial' },
		{ opportunityId: sso.id, deliverableId: partnerDash.id, coverage: 'partial' }, // many-to-many: enterprise admin section
	]
	return { deliverables, links }
}

/** Sample meeting history per SAMPLE-SCENARIO.md — 4 past meetings, 2 never-met */
export function createSampleMeetingData(): MeetingData {
	const DAY = 86_400_000
	const now = Date.now()
	return {
		lastDiscussed: {
			Alice: now - 5 * DAY,
			Marcus: now - 5 * DAY,
			Bob: now - 8 * DAY,
			Carol: now - 12 * DAY,
		},
		records: [
			{
				personName: 'Alice',
				timestamp: now - 5 * DAY,
				summary: [
					'4 deliverables reviewed',
					'Event bus: confirmed pub/sub pattern, certainty → 4/5',
					'SAML: straightforward, certainty 5/5',
					'OIDC: newer spec revision, certainty 4/5',
					'Asked to spike retry & DLQ service vs event bus piggyback',
				],
			},
			{
				personName: 'Marcus',
				timestamp: now - 5 * DAY,
				summary: [
					'SSO viability at validate: briefed on enterprise pipeline numbers',
					'Asked for updated ARR projections by end of week',
					'CEO commitment April 29 discussed — 5 days remaining',
					'1 unscored cell: viability@validate',
				],
			},
			{
				personName: 'Bob',
				timestamp: now - 8 * DAY,
				summary: [
					'Event bus: confirmed availability for next 2 sprints',
					'Retry & DLQ: DevOps stretched with another project',
					'Capacity concern flagged — check DevOps bandwidth',
				],
			},
			{
				personName: 'Carol',
				timestamp: now - 12 * DAY,
				summary: [
					'Partner dashboard: Acme Corp API access timeline slipping',
					'Cannot start admin UI design until partner API shape finalized',
					'Webhook docs: 80% drafted, waiting for final API surface',
					'Agreed to sketch wireframe even without final API',
					'Risk escalated: partner dashboard is biggest risk item',
				],
			},
		],
		snapshots: {},
	}
}
