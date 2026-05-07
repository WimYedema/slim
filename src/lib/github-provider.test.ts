import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProviderConfig } from './external-provider'
import { githubProvider } from './github-provider'

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
	return {
		type: 'github',
		label: 'GH',
		baseUrl: 'https://api.github.com',
		token: 'ghp_test',
		project: 'owner/repo',
		...overrides,
	}
}

function issue(overrides: Record<string, unknown> = {}) {
	return {
		number: 42,
		title: 'Fix bug',
		html_url: 'https://github.com/owner/repo/issues/42',
		state: 'open',
		labels: [],
		assignee: null,
		...overrides,
	}
}

function mockFetch(responses: Array<{ data: unknown; status?: number }>) {
	let callIndex = 0
	return vi.fn().mockImplementation(() => {
		const resp = responses[callIndex++] ?? responses.at(-1)!
		return Promise.resolve({
			ok: (resp.status ?? 200) >= 200 && (resp.status ?? 200) < 300,
			status: resp.status ?? 200,
			statusText: resp.status === 200 || resp.status == null ? 'OK' : 'Error',
			json: () => Promise.resolve(resp.data),
		})
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('githubProvider.fetchItems', () => {
	it('maps issues to ExternalItems', async () => {
		globalThis.fetch = mockFetch([{ data: [issue()] }])

		const items = await githubProvider.fetchItems(config())
		expect(items).toHaveLength(1)
		expect(items[0]).toEqual({
			externalId: '#42',
			title: 'Fix bug',
			url: 'https://github.com/owner/repo/issues/42',
			size: null,
			status: 'open',
			labels: [],
			assignee: undefined,
		})
	})

	it('filters out pull requests', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [
					issue({ number: 1, title: 'Issue' }),
					issue({ number: 2, title: 'PR', pull_request: { url: 'https://...' } }),
				],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items).toHaveLength(1)
		expect(items[0].title).toBe('Issue')
	})

	it('infers size from size:X labels', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ labels: [{ name: 'size:M' }, { name: 'bug' }] })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].size).toBe('M')
	})

	it('infers size from size/X labels', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ labels: [{ name: 'size/xl' }] })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].size).toBe('XL')
	})

	it('returns null size when no size label', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ labels: [{ name: 'bug' }] })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].size).toBeNull()
	})

	it('extracts assignee login', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ assignee: { login: 'alice' } })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].assignee).toBe('alice')
	})

	it('handles null assignee', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ assignee: null })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].assignee).toBeUndefined()
	})

	it('extracts all label names', async () => {
		globalThis.fetch = mockFetch([
			{
				data: [issue({ labels: [{ name: 'bug' }, { name: 'priority:high' }] })],
			},
		])

		const items = await githubProvider.fetchItems(config())
		expect(items[0].labels).toEqual(['bug', 'priority:high'])
	})

	it('paginates until a short page', async () => {
		const page1 = Array.from({ length: 100 }, (_, i) =>
			issue({ number: i + 1, title: `Issue ${i + 1}` }),
		)
		const page2 = [issue({ number: 101, title: 'Issue 101' })]

		globalThis.fetch = mockFetch([{ data: page1 }, { data: page2 }])

		const items = await githubProvider.fetchItems(config())
		expect(items).toHaveLength(101)
	})

	it('throws on 401', async () => {
		globalThis.fetch = mockFetch([{ data: {}, status: 401 }])
		await expect(githubProvider.fetchItems(config())).rejects.toThrow('Invalid token')
	})

	it('throws on 404', async () => {
		globalThis.fetch = mockFetch([{ data: {}, status: 404 }])
		await expect(githubProvider.fetchItems(config())).rejects.toThrow('Repository not found')
	})

	it('throws when project is missing', async () => {
		await expect(githubProvider.fetchItems(config({ project: undefined }))).rejects.toThrow(
			'requires a repository',
		)
	})

	it('uses default baseUrl when empty', async () => {
		const fn = mockFetch([{ data: [] }])
		globalThis.fetch = fn

		await githubProvider.fetchItems(config({ baseUrl: '' }))
		expect(fn.mock.calls[0][0]).toContain('https://api.github.com/repos/owner/repo/issues')
	})

	it('sends correct auth headers', async () => {
		const fn = mockFetch([{ data: [] }])
		globalThis.fetch = fn

		await githubProvider.fetchItems(config({ token: 'ghp_abc123' }))
		const headers = fn.mock.calls[0][1].headers
		expect(headers.Authorization).toBe('Bearer ghp_abc123')
		expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
	})
})

describe('githubProvider.testConnection', () => {
	it('returns repo name and issue count', async () => {
		globalThis.fetch = mockFetch([
			{
				data: { full_name: 'owner/repo', open_issues_count: 17 },
			},
		])

		const result = await githubProvider.testConnection(config())
		expect(result).toBe('owner/repo (17 open issues)')
	})

	it('throws on error', async () => {
		globalThis.fetch = mockFetch([{ data: {}, status: 403 }])
		await expect(githubProvider.testConnection(config())).rejects.toThrow('Cannot access')
	})
})
