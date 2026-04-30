import type { Opportunity, OriginType, Score, Stage } from './types'
import { createOpportunity, PERSPECTIVES } from './types'

/** Escape a value for CSV: wrap in quotes if it contains comma, quote, or newline */
export function csvEscape(s: string): string {
	if (s.includes(',') || s.includes('"') || s.includes('\n')) {
		return `"${s.replace(/"/g, '""')}"`
	}
	return s
}

/** Parse a single CSV row, handling quoted fields with embedded commas and escaped quotes */
export function parseCsvRow(line: string): string[] {
	const fields: string[] = []
	let current = ''
	let inQuotes = false
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				current += '"'
				i++
			} else if (ch === '"') {
				inQuotes = false
			} else {
				current += ch
			}
		} else if (ch === '"') {
			inQuotes = true
		} else if (ch === ',') {
			fields.push(current.trim())
			current = ''
		} else {
			current += ch
		}
	}
	fields.push(current.trim())
	return fields
}

const CSV_HEADER = 'Title,Stage,Origin,Horizon,Desirability,Feasibility,Viability,Created'

/** Build CSV string from opportunities */
export function opportunitiesToCsv(opportunities: Opportunity[]): string {
	const rows = opportunities.map((o) => {
		const scores = o.signals[o.stage]
		return [
			csvEscape(o.title),
			o.stage,
			o.origin ?? '',
			csvEscape(o.horizon),
			scores.desirability.score,
			scores.feasibility.score,
			scores.viability.score,
			new Date(o.createdAt).toISOString().slice(0, 10),
		].join(',')
	})
	return [CSV_HEADER, ...rows].join('\n')
}

const VALID_STAGES = new Set<string>(['explore', 'sketch', 'validate', 'decompose'])
const VALID_ORIGINS = new Set<string>(['demand', 'supply', 'incident', 'debt'])
const VALID_SCORES = new Set<string>(['none', 'uncertain', 'positive', 'negative'])

export interface CsvImportResult {
	imported: Opportunity[]
	skipped: string[]
}

/** Parse CSV text into opportunities. Returns imported items and skip reasons. */
export function csvToOpportunities(text: string): CsvImportResult {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
	if (lines.length < 2) {
		return { imported: [], skipped: ['File is empty or has no data rows'] }
	}

	const headerFields = parseCsvRow(lines[0]).map((h) => h.toLowerCase())
	const titleIdx = headerFields.indexOf('title')
	if (titleIdx < 0) {
		return { imported: [], skipped: ['CSV must have a "Title" column'] }
	}
	const stageIdx = headerFields.indexOf('stage')
	const originIdx = headerFields.indexOf('origin')
	const horizonIdx = headerFields.indexOf('horizon')
	const _desIdx = headerFields.indexOf('desirability')
	const _feasIdx = headerFields.indexOf('feasibility')
	const _viaIdx = headerFields.indexOf('viability')

	const imported: Opportunity[] = []
	const skipped: string[] = []

	for (let i = 1; i < lines.length; i++) {
		const fields = parseCsvRow(lines[i])
		const title = fields[titleIdx]
		if (!title) {
			skipped.push(`Row ${i + 1}: empty title`)
			continue
		}

		const opp = createOpportunity(title)

		if (stageIdx >= 0 && VALID_STAGES.has(fields[stageIdx])) {
			opp.stage = fields[stageIdx] as Stage
			opp.stageEnteredAt = Date.now()
		}
		if (originIdx >= 0 && VALID_ORIGINS.has(fields[originIdx])) {
			opp.origin = fields[originIdx] as OriginType
		}
		if (horizonIdx >= 0 && fields[horizonIdx]) {
			opp.horizon = fields[horizonIdx]
		}

		for (const p of PERSPECTIVES) {
			const idx = headerFields.indexOf(p)
			if (idx >= 0 && VALID_SCORES.has(fields[idx])) {
				opp.signals[opp.stage][p].score = fields[idx] as Score
			}
		}

		imported.push(opp)
	}

	return { imported, skipped }
}
