import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	fetchConnectorItems,
	loadConnectors,
	loadProviders,
	saveConnectors,
	saveProviders,
} from './external-provider'

describe('validateExternalItem (via fetchConnectorItems)', () => {
	function mockFetch(data: unknown, status = 200) {
		return vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			statusText: status === 200 ? 'OK' : 'Error',
			json: () => Promise.resolve(data),
		})
	}

	it('accepts valid items with all fields', async () => {
		const items = [
			{
				externalId: '#1',
				title: 'Fix bug',
				url: 'https://example.com/1',
				size: 'M',
				status: 'open',
				labels: ['bug'],
				assignee: 'alice',
			},
		]
		globalThis.fetch = mockFetch(items)

		const result = await fetchConnectorItems({ label: 'test', url: 'https://connector.test' })
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			externalId: '#1',
			title: 'Fix bug',
			url: 'https://example.com/1',
			size: 'M',
			status: 'open',
			labels: ['bug'],
			assignee: 'alice',
		})
	})

	it('accepts minimal items (title + url only)', async () => {
		globalThis.fetch = mockFetch([{ title: 'Do thing', url: 'https://x.com' }])
		const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		expect(result).toHaveLength(1)
		expect(result[0].externalId).toBe('')
		expect(result[0].title).toBe('Do thing')
		expect(result[0].url).toBe('https://x.com')
		expect(result[0].size).toBeUndefined()
	})

	it('normalizes size to uppercase', async () => {
		globalThis.fetch = mockFetch([{ title: 'A', url: 'https://x.com', size: 'xl' }])
		const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		expect(result[0].size).toBe('XL')
	})

	it('ignores invalid size values', async () => {
		globalThis.fetch = mockFetch([{ title: 'A', url: 'https://x.com', size: 'HUGE' }])
		const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		expect(result[0].size).toBeUndefined()
	})

	it('ignores invalid status values', async () => {
		globalThis.fetch = mockFetch([{ title: 'A', url: 'https://x.com', status: 'blocked' }])
		const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		expect(result[0].status).toBeUndefined()
	})

	it('accepts valid status values', async () => {
		for (const status of ['open', 'done', 'dropped']) {
			globalThis.fetch = mockFetch([{ title: 'A', url: 'https://x.com', status }])
			const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
			expect(result[0].status).toBe(status)
		}
	})

	it('filters non-string labels', async () => {
		globalThis.fetch = mockFetch([
			{ title: 'A', url: 'https://x.com', labels: ['bug', 42, null, 'feat'] },
		])
		const result = await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		expect(result[0].labels).toEqual(['bug', 'feat'])
	})

	it('throws on missing title', async () => {
		globalThis.fetch = mockFetch([{ url: 'https://x.com' }])
		await expect(fetchConnectorItems({ label: 'test', url: 'https://c.test' })).rejects.toThrow(
			'missing title',
		)
	})

	it('throws on missing url', async () => {
		globalThis.fetch = mockFetch([{ title: 'A' }])
		await expect(fetchConnectorItems({ label: 'test', url: 'https://c.test' })).rejects.toThrow(
			'missing url',
		)
	})

	it('throws on non-object items', async () => {
		globalThis.fetch = mockFetch(['just a string'])
		await expect(fetchConnectorItems({ label: 'test', url: 'https://c.test' })).rejects.toThrow(
			'not an object',
		)
	})

	it('throws when response is not an array', async () => {
		globalThis.fetch = mockFetch({ items: [] })
		await expect(fetchConnectorItems({ label: 'test', url: 'https://c.test' })).rejects.toThrow(
			'must return an array',
		)
	})

	it('throws on HTTP error', async () => {
		globalThis.fetch = mockFetch(null, 500)
		await expect(fetchConnectorItems({ label: 'test', url: 'https://c.test' })).rejects.toThrow(
			'500',
		)
	})
})

describe('fetchConnectorItems headers', () => {
	it('sends Bearer token when provided', async () => {
		const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
		globalThis.fetch = fn

		await fetchConnectorItems({ label: 'test', url: 'https://c.test', token: 'secret123' })
		const headers = fn.mock.calls[0][1].headers
		expect(headers.Authorization).toBe('Bearer secret123')
	})

	it('omits Authorization when no token', async () => {
		const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
		globalThis.fetch = fn

		await fetchConnectorItems({ label: 'test', url: 'https://c.test' })
		const headers = fn.mock.calls[0][1].headers
		expect(headers.Authorization).toBeUndefined()
	})
})

describe('provider/connector storage', () => {
	beforeEach(() => localStorage.clear())

	it('round-trips providers', () => {
		const providers = [{ type: 'github', label: 'GH', baseUrl: '', token: 'tok', project: 'a/b' }]
		saveProviders(providers)
		expect(loadProviders()).toEqual(providers)
	})

	it('returns empty array when nothing saved', () => {
		expect(loadProviders()).toEqual([])
		expect(loadConnectors()).toEqual([])
	})

	it('round-trips connectors', () => {
		const connectors = [{ label: 'Jira', url: 'https://jira.test', token: 'tok' }]
		saveConnectors(connectors)
		expect(loadConnectors()).toEqual(connectors)
	})

	it('returns empty array on corrupt data', () => {
		localStorage.setItem('slim-providers', 'not-json')
		expect(loadProviders()).toEqual([])
	})
})
