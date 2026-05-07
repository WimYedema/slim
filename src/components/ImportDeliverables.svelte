<script lang="ts">
	import type { ConnectorConfig, ExternalItem, ProviderConfig } from '../lib/external-provider'
	import type { Deliverable } from '../lib/types'
	import { githubProvider } from '../lib/github-provider'
	import {
		fetchConnectorItems,
		loadConnectors,
		loadProviders,
		saveConnectors,
		saveProviders,
	} from '../lib/external-provider'

	interface Props {
		deliverables: Deliverable[]
		onImport: (items: ExternalItem[]) => void
		onClose: () => void
	}

	let { deliverables, onImport, onClose }: Props = $props()

	// ── State ──
	let tab: 'github' | 'connector' | 'paste' = $state('github')
	let items: ExternalItem[] = $state([])
	let selected = $state(new Set<string>())
	let loading = $state(false)
	let error = $state('')
	let message = $state('')

	// GitHub config
	let savedProviders = $state(loadProviders())
	let githubConfig = $state<ProviderConfig>(
		savedProviders.find((p) => p.type === 'github') ?? {
			type: 'github',
			label: 'GitHub',
			baseUrl: '',
			token: '',
			project: '',
		},
	)

	// Connector tab
	let savedConnectors = $state(loadConnectors())
	let connectorIndex = $state(savedConnectors.length > 0 ? 0 : -1)
	let connectorConfig = $state<ConnectorConfig>(
		savedConnectors[0] ?? { label: '', url: '', token: '' },
	)

	// Paste tab
	let pasteText = $state('')

	// ── Derived ──
	const existingUrls = $derived(new Set(deliverables.map((d) => d.externalUrl).filter(Boolean)))
	const newItems = $derived(items.filter((i) => !existingUrls.has(i.url)))
	const linkedCount = $derived(items.length - newItems.length)
	const selectedCount = $derived(selected.size)

	// ── Actions ──
	async function fetchGitHub() {
		if (!githubConfig.token || !githubConfig.project) {
			error = 'Enter a token and repository'
			return
		}
		loading = true
		error = ''
		message = ''
		items = []
		selected = new Set()
		try {
			items = await githubProvider.fetchItems(githubConfig)
			// Auto-select all new items
			selected = new Set(newItems.map((i) => i.url))
			if (items.length === 0) message = 'No open issues found'
			// Save config for next time (persist token + repo)
			const others = savedProviders.filter((p) => p.type !== 'github')
			savedProviders = [...others, { ...githubConfig }]
			saveProviders(savedProviders)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch issues'
		} finally {
			loading = false
		}
	}

	const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const
	const URL_RE = /https?:\/\/\S+/i
	const SIZE_RE = /^(XS|S|M|L|XL)$/i

	async function fetchConnector() {
		if (!connectorConfig.url) {
			error = 'Enter a connector URL'
			return
		}
		loading = true
		error = ''
		message = ''
		items = []
		selected = new Set()
		try {
			items = await fetchConnectorItems(connectorConfig)
			selected = new Set(newItems.map((i) => i.url || i.title))
			if (items.length === 0) message = 'No items returned'
			// Save connector config
			const label = connectorConfig.label || new URL(connectorConfig.url).hostname
			const toSave = { ...connectorConfig, label }
			if (connectorIndex >= 0) {
				savedConnectors[connectorIndex] = toSave
			} else {
				savedConnectors = [...savedConnectors, toSave]
				connectorIndex = savedConnectors.length - 1
			}
			connectorConfig = toSave
			saveConnectors(savedConnectors)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch from connector'
		} finally {
			loading = false
		}
	}

	function selectConnector(index: number) {
		if (index === -1) {
			// New connector
			connectorIndex = -1
			connectorConfig = { label: '', url: '', token: '' }
		} else {
			connectorIndex = index
			connectorConfig = { ...savedConnectors[index] }
		}
		items = []
		selected = new Set()
		error = ''
		message = ''
	}

	function deleteConnector() {
		if (connectorIndex < 0) return
		savedConnectors = savedConnectors.filter((_, i) => i !== connectorIndex)
		saveConnectors(savedConnectors)
		connectorIndex = savedConnectors.length > 0 ? 0 : -1
		connectorConfig = savedConnectors[0] ?? { label: '', url: '', token: '' }
		items = []
		selected = new Set()
	}

	function parsePaste() {
		error = ''
		const lines = pasteText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean)

		if (lines.length === 0) {
			error = 'Paste at least one line'
			return
		}

		const parsed: ExternalItem[] = []
		for (const line of lines) {
			// Split on tabs or 2+ spaces to support pasted spreadsheet data
			const tokens = line.split(/\t|\s{2,}/)
			let url = ''
			let size: string | undefined
			const titleParts: string[] = []

			for (const tok of tokens) {
				const trimmed = tok.trim()
				if (!trimmed) continue
				if (!url && URL_RE.test(trimmed)) {
					url = trimmed
				} else if (!size && SIZE_RE.test(trimmed)) {
					size = trimmed.toUpperCase()
				} else {
					titleParts.push(trimmed)
				}
			}

			const title = titleParts.join(' ')
			if (!title) continue

			parsed.push({
				externalId: url || title,
				title,
				url,
				size: (VALID_SIZES as readonly string[]).includes(size ?? '') ? (size as ExternalItem['size']) : undefined,
			})
		}

		items = parsed
		selected = new Set(parsed.filter((i) => !existingUrls.has(i.url)).map((i) => i.url || i.title))
	}

	function toggleItem(key: string) {
		const next = new Set(selected)
		if (next.has(key)) next.delete(key)
		else next.add(key)
		selected = next
	}

	function toggleAll() {
		if (selected.size === newItems.length) {
			selected = new Set()
		} else {
			selected = new Set(newItems.map((i) => i.url || i.title))
		}
	}

	function doImport() {
		const toImport = newItems.filter((i) => selected.has(i.url || i.title))
		if (toImport.length === 0) return
		onImport(toImport)
		onClose()
	}

	function switchTab(t: typeof tab) {
		tab = t
		items = []
		selected = new Set()
		error = ''
		message = ''
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="id-overlay" onclick={onClose}>
	<div class="id-dialog" role="dialog" aria-label="Import deliverables" onclick={(e) => e.stopPropagation()}>
		<div class="id-header">
			<h2 class="id-title">Import deliverables</h2>
			<button class="btn-icon" onclick={onClose} aria-label="Close">✕</button>
		</div>

		<div class="id-tabs">
			<button class="id-tab" class:active={tab === 'github'} onclick={() => switchTab('github')}>GitHub</button>
			<button class="id-tab" class:active={tab === 'connector'} onclick={() => switchTab('connector')}>Connector</button>
			<button class="id-tab" class:active={tab === 'paste'} onclick={() => switchTab('paste')}>Paste</button>
		</div>

		{#if tab === 'github'}
			<div class="id-config">
				<label class="id-field">
					<span class="id-label">Repository</span>
					<input
						class="id-input"
						type="text"
						placeholder="owner/repo"
						bind:value={githubConfig.project}
						onkeydown={(e) => { if (e.key === 'Enter') fetchGitHub() }}
					/>
				</label>
				<label class="id-field">
					<span class="id-label">Token <span class="id-hint">(PAT with repo scope)</span></span>
					<input
						class="id-input"
						type="password"
						placeholder="ghp_..."
						bind:value={githubConfig.token}
						onkeydown={(e) => { if (e.key === 'Enter') fetchGitHub() }}
					/>
				</label>
				<button class="btn-solid" onclick={fetchGitHub} disabled={loading}>
					{loading ? 'Fetching…' : 'Fetch issues'}
				</button>
			</div>
		{:else if tab === 'connector'}
			<div class="id-config">
				{#if savedConnectors.length > 0}
					<label class="id-field">
						<span class="id-label">Connector</span>
						<div class="id-connector-row">
							<select
								class="id-select"
								value={connectorIndex}
								onchange={(e) => selectConnector(Number((e.target as HTMLSelectElement).value))}
							>
								{#each savedConnectors as c, i}
									<option value={i}>{c.label || c.url}</option>
								{/each}
								<option value={-1}>+ New connector</option>
							</select>
							{#if connectorIndex >= 0}
								<button class="btn-icon id-delete-btn" onclick={deleteConnector} title="Delete connector" aria-label="Delete connector">✕</button>
							{/if}
						</div>
					</label>
				{/if}
				<label class="id-field">
					<span class="id-label">Label <span class="id-hint">(optional)</span></span>
					<input
						class="id-input"
						type="text"
						placeholder="My Jira connector"
						bind:value={connectorConfig.label}
					/>
				</label>
				<label class="id-field">
					<span class="id-label">URL <span class="id-hint">(returns ExternalItem[] JSON)</span></span>
					<input
						class="id-input"
						type="url"
						placeholder="https://my-connector.workers.dev/items"
						bind:value={connectorConfig.url}
						onkeydown={(e) => { if (e.key === 'Enter') fetchConnector() }}
					/>
				</label>
				<label class="id-field">
					<span class="id-label">Bearer token <span class="id-hint">(optional)</span></span>
					<input
						class="id-input"
						type="password"
						placeholder="secret-token"
						bind:value={connectorConfig.token}
						onkeydown={(e) => { if (e.key === 'Enter') fetchConnector() }}
					/>
				</label>
				<button class="btn-solid" onclick={fetchConnector} disabled={loading}>
					{loading ? 'Fetching…' : 'Fetch items'}
				</button>
			</div>
		{:else}
			<div class="id-config">
				<p class="id-hint-block">One item per line. URLs and sizes (XS/S/M/L/XL) are detected automatically.</p>
				<textarea
					class="id-textarea"
					rows="6"
					placeholder={"Payment flow  M  https://jira.com/browse/PAY-123\nAuth refactor  L\nLogin page"}
					bind:value={pasteText}
				></textarea>
				<button class="btn-solid" onclick={parsePaste}>Parse</button>
			</div>
		{/if}

		{#if error}
			<p class="id-error">{error}</p>
		{/if}
		{#if message}
			<p class="id-message">{message}</p>
		{/if}

		{#if newItems.length > 0}
			<div class="id-list-header">
				<label class="id-check-all">
					<input type="checkbox" checked={selected.size === newItems.length} onchange={toggleAll} />
					<span>{newItems.length} item{newItems.length === 1 ? '' : 's'}</span>
				</label>
				{#if linkedCount > 0}
					<span class="id-linked">{linkedCount} already linked (hidden)</span>
				{/if}
			</div>
			<ul class="id-list">
				{#each newItems as item (item.url || item.title)}
					<li class="id-item">
						<label class="id-item-label">
							<input
								type="checkbox"
								checked={selected.has(item.url || item.title)}
								onchange={() => toggleItem(item.url || item.title)}
							/>
							<span class="id-item-id">{item.externalId}</span>
							<span class="id-item-title">{item.title}</span>
							{#if item.size}<span class="id-item-size">{item.size}</span>{/if}
							{#if item.assignee}<span class="id-item-assignee">@{item.assignee}</span>{/if}
						</label>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="id-footer">
			<button class="btn-solid" onclick={doImport} disabled={selectedCount === 0}>
				Import {selectedCount} deliverable{selectedCount === 1 ? '' : 's'}
			</button>
		</div>
	</div>
</div>

<style>
	.id-overlay {
		position: fixed;
		inset: 0;
		background: var(--c-overlay);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 850;
	}

	.id-dialog {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: var(--sp-lg);
		width: 90vw;
		max-width: 36rem;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.id-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--sp-sm);
	}

	.id-title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	.id-tabs {
		display: flex;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-md);
		border-bottom: 1px solid var(--c-border-soft);
		padding-bottom: var(--sp-xs);
	}

	.id-tab {
		background: none;
		border: none;
		padding: var(--sp-xs) var(--sp-sm);
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		cursor: pointer;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: color var(--tr-fast), background var(--tr-fast);
	}

	.id-tab:hover {
		color: var(--c-text);
	}

	.id-tab.active {
		color: var(--c-text);
		background: var(--c-surface-alt);
		font-weight: var(--fw-medium);
	}

	.id-config {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-sm);
	}

	.id-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.id-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.id-hint {
		color: var(--c-text-ghost);
	}

	.id-hint-block {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		margin: 0;
	}

	.id-hint-block code {
		font-size: var(--fs-2xs);
	}

	.id-input {
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
	}

	.id-input:focus {
		outline: 2px solid var(--c-accent);
		outline-offset: -1px;
	}

	.id-textarea {
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
		resize: vertical;
		font-family: monospace;
	}

	.id-error {
		font-size: var(--fs-xs);
		color: var(--c-red);
		margin: var(--sp-xs) 0;
	}

	.id-message {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		margin: var(--sp-xs) 0;
	}

	.id-list-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) 0;
		border-bottom: 1px solid var(--c-border-soft);
		font-size: var(--fs-xs);
	}

	.id-check-all {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		cursor: pointer;
		color: var(--c-text-soft);
	}

	.id-linked {
		color: var(--c-text-ghost);
		font-size: var(--fs-2xs);
	}

	.id-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		max-height: 30vh;
	}

	.id-item {
		border-bottom: 1px solid var(--c-border-soft);
	}

	.id-item-label {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: var(--sp-xs) 0;
		cursor: pointer;
		font-size: var(--fs-sm);
	}

	.id-item-label:hover {
		background: var(--c-hover);
	}

	.id-item-id {
		color: var(--c-text-muted);
		font-family: monospace;
		font-size: var(--fs-2xs);
		flex-shrink: 0;
		min-width: 3rem;
	}

	.id-item-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.id-item-size {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		padding: 1px 4px;
		border: 1px solid var(--c-border);
		border-radius: 3px;
		flex-shrink: 0;
	}

	.id-item-assignee {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		flex-shrink: 0;
	}

	.id-footer {
		padding-top: var(--sp-sm);
		display: flex;
		justify-content: flex-end;
	}

	.id-connector-row {
		display: flex;
		gap: var(--sp-xs);
		align-items: center;
	}

	.id-select {
		flex: 1;
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
	}

	.id-select:focus {
		outline: 2px solid var(--c-accent);
		outline-offset: -1px;
	}

	.id-delete-btn {
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.id-delete-btn:hover {
		color: var(--c-red);
	}
</style>
