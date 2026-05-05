import type {
	Deliverable,
	Opportunity,
	OpportunityDeliverableLink,
	OriginType,
	Stage,
} from './types'
import { createDeliverable, createOpportunity } from './types'

// ── Parsed result types ──

export interface ParsedOpportunity {
	title: string
	stage: Stage
	origin?: OriginType
	horizon?: string
	people: string[]
}

export interface ParsedDeliverable {
	title: string
	/** Index into ParsedBoard.opportunities, or -1 for orphans */
	opportunityIndex: number
}

export interface ParsedBoard {
	boardName?: string
	opportunities: ParsedOpportunity[]
	deliverables: ParsedDeliverable[]
}

// ── Tag constants ──

const STAGE_TAGS: Record<string, Stage> = {
	explore: 'explore',
	sketch: 'sketch',
	validate: 'validate',
	decompose: 'decompose',
}

const ORIGIN_TAGS: Record<string, OriginType> = {
	request: 'demand',
	idea: 'supply',
	incident: 'incident',
	debt: 'debt',
	demand: 'demand',
	supply: 'supply',
}

// ── Parser ──

interface ExtractedTags {
	stage?: Stage
	origin?: OriginType
	horizon?: string
	people: string[]
	cleanTitle: string
}

function extractTags(raw: string): ExtractedTags {
	let stage: Stage | undefined
	let origin: OriginType | undefined
	let horizon: string | undefined
	const people: string[] = []

	// Extract @Name or @Multi-word (hyphenated/alphanumeric)
	const text = raw.replace(/@([\w][\w-]*)/g, (_match, name: string) => {
		people.push(name)
		return ''
	})

	// Extract #tags
	const cleanTitle = text
		.replace(/#([\w][\w-]*)/g, (_match, tag: string) => {
			const lower = tag.toLowerCase()
			if (lower in STAGE_TAGS) {
				stage = STAGE_TAGS[lower]
			} else if (lower in ORIGIN_TAGS) {
				origin = ORIGIN_TAGS[lower]
			} else {
				horizon = tag
			}
			return ''
		})
		.replace(/\s+/g, ' ')
		.trim()

	return { stage, origin, horizon, people, cleanTitle }
}

const HEADING_RE = /^#{1,3}\s+(.+)$/
const BOARD_NAME_RE = /^#\s+(.+)$/
const BULLET_RE = /^[\s]*[-*•]\s+(.+)$/

export function parseImportText(text: string): ParsedBoard {
	const lines = text.split('\n')
	const opportunities: ParsedOpportunity[] = []
	const deliverables: ParsedDeliverable[] = []
	let currentOppIndex = -1
	let boardName: string | undefined
	let firstContentLine = true

	for (const rawLine of lines) {
		const line = rawLine.trimEnd()
		if (!line.trim()) continue

		// First non-empty line: single # (not ##) → board name
		if (firstContentLine) {
			firstContentLine = false
			const boardMatch = line.match(BOARD_NAME_RE)
			if (boardMatch && !line.startsWith('## ')) {
				boardName = boardMatch[1].trim()
				continue
			}
		}

		const headingMatch = line.match(HEADING_RE)
		if (headingMatch) {
			const { cleanTitle, stage, origin, horizon, people } = extractTags(headingMatch[1])
			if (!cleanTitle) continue
			opportunities.push({
				title: cleanTitle,
				stage: stage ?? 'explore',
				origin,
				horizon,
				people,
			})
			currentOppIndex = opportunities.length - 1
			continue
		}

		const bulletMatch = line.match(BULLET_RE)
		if (bulletMatch) {
			const { cleanTitle } = extractTags(bulletMatch[1])
			if (!cleanTitle) continue
			deliverables.push({
				title: cleanTitle,
				opportunityIndex: currentOppIndex,
			})
			continue
		}

		// Plain text line → treat as opportunity
		const { cleanTitle, stage, origin, horizon, people } = extractTags(line.trim())
		if (!cleanTitle) continue
		opportunities.push({
			title: cleanTitle,
			stage: stage ?? 'explore',
			origin,
			horizon,
			people,
		})
		currentOppIndex = opportunities.length - 1
	}

	return { boardName, opportunities, deliverables }
}

// ── Default template ──

export const IMPORT_TEMPLATE = `# My product
## Reduce onboarding churn
- Simplify signup flow
- Add progress indicator

## Mobile checkout redesign #sketch
- Payment SDK integration

## Fix auth token expiry #incident
`

// ── Preview types (for live preview in BrainDump) ──

export interface PreviewOpportunity {
	title: string
	stage: Stage
	origin?: OriginType
	horizon?: string
	people: string[]
	deliverables: string[]
}

export interface PreviewResult {
	opportunities: PreviewOpportunity[]
	orphanDeliverables: string[]
}

/** Convert a ParsedBoard into a preview-friendly structure */
export function toPreview(board: ParsedBoard): PreviewResult {
	const opportunities: PreviewOpportunity[] = board.opportunities.map((o) => ({
		title: o.title,
		stage: o.stage,
		origin: o.origin,
		horizon: o.horizon,
		people: o.people,
		deliverables: [],
	}))

	const orphanDeliverables: string[] = []

	for (const del of board.deliverables) {
		if (del.opportunityIndex >= 0 && del.opportunityIndex < opportunities.length) {
			opportunities[del.opportunityIndex].deliverables.push(del.title)
		} else {
			orphanDeliverables.push(del.title)
		}
	}

	return { opportunities, orphanDeliverables }
}

// ── Materialization (parsed → real Slim entities) ──

export interface MaterializedBoard {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
}

/** Convert a ParsedBoard into real Slim entities */
export function materialize(board: ParsedBoard): MaterializedBoard {
	const opportunities: Opportunity[] = []
	const deliverables: Deliverable[] = []
	const links: OpportunityDeliverableLink[] = []

	const realOpps = board.opportunities.map((parsed) => {
		const opp = createOpportunity(parsed.title)
		opp.stage = parsed.stage
		if (parsed.stage !== 'explore') {
			opp.stageEnteredAt = Date.now()
			opp.stageHistory = [{ stage: parsed.stage, enteredAt: Date.now() }]
		}
		if (parsed.origin) opp.origin = parsed.origin
		if (parsed.horizon) opp.horizon = parsed.horizon
		for (const name of parsed.people) {
			opp.people.push({
				id: crypto.randomUUID(),
				name,
				role: 'stakeholder',
				perspectives: [],
			})
		}
		opportunities.push(opp)
		return opp
	})

	for (const del of board.deliverables) {
		const deliverable = createDeliverable(del.title)
		deliverables.push(deliverable)
		if (del.opportunityIndex >= 0 && del.opportunityIndex < realOpps.length) {
			links.push({
				opportunityId: realOpps[del.opportunityIndex].id,
				deliverableId: deliverable.id,
				coverage: 'full',
			})
		}
	}

	return { opportunities, deliverables, links }
}
