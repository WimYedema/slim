import type { ExternalItem, ExternalProvider, ProviderConfig } from './external-provider'
import type { TShirtSize } from './types'

// ── GitHub REST API response shapes ──

interface GitHubIssue {
	number: number
	title: string
	html_url: string
	state: string
	labels: Array<{ name: string }>
	assignee?: { login: string } | null
	pull_request?: unknown
}

// ── Size inference from labels ──

const SIZE_LABELS: Record<string, TShirtSize> = {
	'size:xs': 'XS',
	'size:s': 'S',
	'size:m': 'M',
	'size:l': 'L',
	'size:xl': 'XL',
	'size/xs': 'XS',
	'size/s': 'S',
	'size/m': 'M',
	'size/l': 'L',
	'size/xl': 'XL',
}

function inferSize(labels: string[]): TShirtSize | null {
	for (const label of labels) {
		const match = SIZE_LABELS[label.toLowerCase()]
		if (match) return match
	}
	return null
}

// ── Provider implementation ──

function apiHeaders(token: string): Record<string, string> {
	return {
		Accept: 'application/vnd.github+json',
		Authorization: `Bearer ${token}`,
		'X-GitHub-Api-Version': '2022-11-28',
	}
}

async function fetchAllIssues(config: ProviderConfig): Promise<GitHubIssue[]> {
	const { baseUrl, token, project } = config
	if (!project) throw new Error('GitHub provider requires a repository (owner/repo)')

	const base = baseUrl || 'https://api.github.com'
	const all: GitHubIssue[] = []
	let page = 1
	const perPage = 100

	while (true) {
		const url = `${base}/repos/${project}/issues?state=open&per_page=${perPage}&page=${page}`
		const res = await fetch(url, { headers: apiHeaders(token) })

		if (res.status === 401)
			throw new Error('Invalid token — check your GitHub Personal Access Token')
		if (res.status === 404) throw new Error(`Repository not found: ${project}`)
		if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)

		const issues: GitHubIssue[] = await res.json()

		// Filter out pull requests (GitHub Issues API includes them)
		for (const issue of issues) {
			if (!issue.pull_request) all.push(issue)
		}

		if (issues.length < perPage) break
		page++
		if (page > 10) break // safety cap: 1000 issues max
	}

	return all
}

function mapIssue(issue: GitHubIssue): ExternalItem {
	const labels = issue.labels.map((l) => l.name)
	return {
		externalId: `#${issue.number}`,
		title: issue.title,
		url: issue.html_url,
		size: inferSize(labels),
		status: issue.state === 'open' ? 'open' : 'done',
		labels,
		assignee: issue.assignee?.login,
	}
}

export const githubProvider: ExternalProvider = {
	type: 'github',
	name: 'GitHub Issues',

	async testConnection(config: ProviderConfig): Promise<string> {
		const base = config.baseUrl || 'https://api.github.com'
		const res = await fetch(`${base}/repos/${config.project}`, {
			headers: apiHeaders(config.token),
		})
		if (!res.ok) throw new Error(`Cannot access ${config.project}: ${res.status}`)
		const repo = (await res.json()) as { full_name: string; open_issues_count: number }
		return `${repo.full_name} (${repo.open_issues_count} open issues)`
	},

	async fetchItems(config: ProviderConfig): Promise<ExternalItem[]> {
		const issues = await fetchAllIssues(config)
		return issues.map(mapIssue)
	},
}
