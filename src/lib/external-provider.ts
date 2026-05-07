import type { TShirtSize } from './types'

// ── External item (universal import shape) ──

/** What every provider maps to — matches Deliverable fields */
export interface ExternalItem {
	externalId: string
	title: string
	url: string
	size?: TShirtSize | null
	status?: 'open' | 'done' | 'dropped'
	labels?: string[]
	assignee?: string
}

// ── Provider interface ──

export interface ProviderConfig {
	type: string
	label: string
	baseUrl: string
	token: string
	project?: string
}

export interface ExternalProvider {
	readonly type: string
	readonly name: string
	testConnection(config: ProviderConfig): Promise<string>
	fetchItems(config: ProviderConfig): Promise<ExternalItem[]>
}

// ── Data-only connector ──

export interface ConnectorConfig {
	label: string
	url: string
	token?: string
}

/** Fetch ExternalItem[] from a data-only connector endpoint */
export async function fetchConnectorItems(config: ConnectorConfig): Promise<ExternalItem[]> {
	const headers: Record<string, string> = { Accept: 'application/json' }
	if (config.token) headers.Authorization = `Bearer ${config.token}`

	const res = await fetch(config.url, { headers })
	if (!res.ok) throw new Error(`Connector returned ${res.status}: ${res.statusText}`)

	const data: unknown = await res.json()
	if (!Array.isArray(data)) throw new Error('Connector must return an array of ExternalItem')

	return data.map(validateExternalItem)
}

/** Validate and normalize a raw object into ExternalItem */
function validateExternalItem(raw: unknown): ExternalItem {
	if (!raw || typeof raw !== 'object') throw new Error('Invalid item: not an object')
	const obj = raw as Record<string, unknown>

	const externalId = String(obj.externalId ?? '')
	const title = String(obj.title ?? '')
	const url = String(obj.url ?? '')

	if (!title) throw new Error('Invalid item: missing title')
	if (!url) throw new Error('Invalid item: missing url')

	const item: ExternalItem = { externalId, title, url }

	if (obj.size != null && typeof obj.size === 'string') {
		const s = obj.size.toUpperCase()
		if (['XS', 'S', 'M', 'L', 'XL'].includes(s)) item.size = s as TShirtSize
	}
	if (obj.status != null && typeof obj.status === 'string') {
		if (['open', 'done', 'dropped'].includes(obj.status))
			item.status = obj.status as ExternalItem['status']
	}
	if (Array.isArray(obj.labels))
		item.labels = obj.labels.filter((l): l is string => typeof l === 'string')
	if (typeof obj.assignee === 'string') item.assignee = obj.assignee

	return item
}

// ── Storage ──

const PROVIDERS_KEY = 'slim-providers'
const CONNECTORS_KEY = 'slim-connectors'

export function loadProviders(): ProviderConfig[] {
	try {
		const raw = localStorage.getItem(PROVIDERS_KEY)
		return raw ? JSON.parse(raw) : []
	} catch {
		return []
	}
}

export function saveProviders(providers: ProviderConfig[]): void {
	localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers))
}

export function loadConnectors(): ConnectorConfig[] {
	try {
		const raw = localStorage.getItem(CONNECTORS_KEY)
		return raw ? JSON.parse(raw) : []
	} catch {
		return []
	}
}

export function saveConnectors(connectors: ConnectorConfig[]): void {
	localStorage.setItem(CONNECTORS_KEY, JSON.stringify(connectors))
}
