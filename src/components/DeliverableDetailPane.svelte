<script lang="ts">
	import {
		type Deliverable,
		type OpportunityDeliverableLink,
		type Opportunity,
		type TShirtSize,
		type Certainty,
		linksForDeliverable,
		STAGES,
		TSHIRT_SIZES,
		inheritedPeople as inheritedPeopleForDeliverable,
	} from '../lib/types'

	interface Props {
		deliverable: Deliverable
		links: OpportunityDeliverableLink[]
		opportunities: Opportunity[]
		onUpdate: (deliverable: Deliverable) => void
		onRemove: (id: string) => void
		onLink: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onUnlink: (opportunityId: string, deliverableId: string) => void
		onUpdateCoverage: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onClose: () => void
		onSelectOpportunity: (id: string) => void
	}

	let { deliverable, links, opportunities, onUpdate, onRemove, onLink, onUnlink, onUpdateCoverage, onClose, onSelectOpportunity }: Props = $props()

	let linkingOpportunity = $state(false)
	let addingContributor = $state(false)
	let addingConsumer = $state(false)
	let newPersonName = $state('')
	let showExternalFields = $state(false)
	let confirmDelete = $state(false)

	let editTitle = $state(deliverable.title)

	// Keep editTitle in sync when deliverable prop changes
	$effect(() => { editTitle = deliverable.title })

	const dLinks = $derived(linksForDeliverable(links, deliverable.id))

	const hasExternalData = $derived(!!deliverable.externalUrl || !!deliverable.externalDependency)

	/** Opportunities not yet linked to this deliverable */
	const unlinkedOpportunities = $derived.by(() => {
		const linked = new Set(dLinks.map((l) => l.opportunityId))
		return opportunities.filter((o) => !o.discontinuedAt && !linked.has(o.id))
	})

	/** People inherited from linked opportunities */
	function inheritedPeople(group: 'contributors' | 'consumers'): string[] {
		return inheritedPeopleForDeliverable(deliverable.id, group, links, opportunities)
	}

	function setSize(size: TShirtSize | null) {
		onUpdate({ ...deliverable, size })
	}

	function setCertainty(certainty: Certainty | null) {
		onUpdate({ ...deliverable, certainty })
	}

	function addPerson(group: 'contributors' | 'consumers') {
		const name = newPersonName.trim()
		if (!name) return
		const field = group === 'contributors' ? 'extraContributors' : 'extraConsumers'
		if (deliverable[field].includes(name)) return
		onUpdate({ ...deliverable, [field]: [...deliverable[field], name] })
		newPersonName = ''
		if (group === 'contributors') addingContributor = false
		else addingConsumer = false
	}

	function removePerson(name: string, group: 'contributors' | 'consumers') {
		const field = group === 'contributors' ? 'extraContributors' : 'extraConsumers'
		onUpdate({ ...deliverable, [field]: deliverable[field].filter((s) => s !== name) })
	}
</script>

<div class="ddp">
	<header class="ddp-header">
		<input
			type="text"
			class="ddp-title-input"
			bind:value={editTitle}
			onblur={() => { if (editTitle.trim() && editTitle !== deliverable.title) onUpdate({ ...deliverable, title: editTitle.trim() }) }}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
		/>
		<button class="ddp-close" onclick={onClose} aria-label="Close">×</button>
	</header>

	<div class="ddp-summary-bar">
		<div class="ddp-size-picker">
			{#each TSHIRT_SIZES as size}
				<button
					class="ddp-size-btn"
					class:active={deliverable.size === size}
					onclick={() => setSize(deliverable.size === size ? null : size)}
				>{size}</button>
			{/each}
		</div>
		<div class="ddp-certainty-picker">
			{#each [1, 2, 3, 4, 5] as level}
				<button
					class="ddp-cert-btn"
					class:active={deliverable.certainty != null && level <= deliverable.certainty}
					onclick={() => setCertainty(deliverable.certainty === level ? null : level as Certainty)}
					title="Certainty level {level}"
				></button>
			{/each}
		</div>
		<span class="ddp-summary-links">{dLinks.length} link{dLinks.length !== 1 ? 's' : ''}{#if dLinks.length > 0}{@const fullCount = dLinks.filter((l) => l.coverage === 'full').length} · {fullCount} full{/if}</span>
	</div>

	{#if hasExternalData || showExternalFields}
		<!-- External URL -->
		<label class="ddp-field">
			<span class="ddp-label">External link</span>
			<input
				type="text"
				class="ddp-input"
				placeholder="Jira / Linear URL…"
				value={deliverable.externalUrl}
				onblur={(e) => {
					const v = (e.target as HTMLInputElement).value.trim()
					if (v !== deliverable.externalUrl) onUpdate({ ...deliverable, externalUrl: v })
				}}
				onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
			/>
		</label>

		<!-- External dependency -->
		<label class="ddp-field">
			<span class="ddp-label">External dependency</span>
			<input
				type="text"
				class="ddp-input"
				placeholder="e.g. API access from Partner X"
				value={deliverable.externalDependency}
				onblur={(e) => {
					const v = (e.target as HTMLInputElement).value.trim()
					if (v !== deliverable.externalDependency) onUpdate({ ...deliverable, externalDependency: v })
				}}
				onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
			/>
		</label>
	{:else}
		<button class="btn-ghost ddp-add-detail" onclick={() => showExternalFields = true}>+ add external details</button>
	{/if}

	<!-- Linked opportunities -->
	<div class="ddp-section">
		<span class="ddp-section-label">Opportunities</span>
		{#if dLinks.length === 0}
			<p class="ddp-empty">Not linked to any opportunity</p>
		{:else}
			{#each dLinks as link (link.opportunityId)}
				{@const opp = opportunities.find((o) => o.id === link.opportunityId)}
				{#if opp}
					<div class="ddp-opp-row">
						<button
							class="ddp-coverage"
							class:full={link.coverage === 'full'}
							onclick={() => onUpdateCoverage(opp.id, deliverable.id, link.coverage === 'full' ? 'partial' : 'full')}
							title={link.coverage === 'full' ? 'Full → click for partial' : 'Partial → click for full'}
						>{link.coverage === 'full' ? '●' : '◐'}</button>
						<button class="ddp-opp-name" onclick={() => onSelectOpportunity(opp.id)}>{opp.title}</button>
						<span class="ddp-opp-stage">{STAGES.find((s) => s.key === opp.stage)?.label}</span>
						<button class="ddp-unlink" onclick={() => onUnlink(opp.id, deliverable.id)} title="Unlink">×</button>
					</div>
				{/if}
			{/each}
		{/if}
		{#if linkingOpportunity}
			{#if unlinkedOpportunities.length > 0}
				<div class="ddp-link-picker">
					{#each unlinkedOpportunities as opp (opp.id)}
						<button class="ddp-link-option" onclick={() => { onLink(opp.id, deliverable.id, 'partial'); linkingOpportunity = false }}>
							{opp.title}
							<span class="ddp-link-stage">{STAGES.find((s) => s.key === opp.stage)?.label}</span>
						</button>
					{/each}
					<button class="ddp-link-option cancel" onclick={() => linkingOpportunity = false}>Cancel</button>
				</div>
			{:else}
				<span class="ddp-empty">All opportunities linked</span>
			{/if}
		{:else}
			<button class="btn-ghost ddp-add-link" onclick={() => linkingOpportunity = true}>+ link opportunity</button>
		{/if}
	</div>

	<!-- Contributors -->
	{#each [{ group: 'contributors' as const, label: 'Built by', field: 'extraContributors' as const, adding: addingContributor, setAdding: (v: boolean) => addingContributor = v }, { group: 'consumers' as const, label: 'Present to', field: 'extraConsumers' as const, adding: addingConsumer, setAdding: (v: boolean) => addingConsumer = v }] as { group, label, field, adding, setAdding }}
		{@const inherited = inheritedPeople(group)}
		{@const extras = deliverable[field]}
		<div class="ddp-section">
			<span class="ddp-section-label">{label}</span>
			<div class="ddp-chips">
				{#each inherited as name}
					<span class="ddp-chip inherited" title="From linked opportunity">{name}</span>
				{/each}
				{#each extras as name}
					<span class="ddp-chip extra">
						{name}
						<button class="ddp-chip-remove" onclick={() => removePerson(name, group)}>×</button>
					</span>
				{/each}
				{#if adding}
					<input
						type="text"
						class="ddp-chip-input"
						placeholder="Name…"
						bind:value={newPersonName}
						onkeydown={(e) => { if (e.key === 'Enter') addPerson(group); if (e.key === 'Escape') { setAdding(false); newPersonName = '' } }}
					/>
				{:else}
					<button class="ddp-chip-add" onclick={() => setAdding(true)}>+</button>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Delete -->
	<div class="ddp-danger">
		{#if confirmDelete}
			<button class="btn-ghost ddp-delete ddp-delete-confirm" onclick={() => { onRemove(deliverable.id); onClose() }}>Confirm delete</button>
			<button class="btn-ghost ddp-delete-cancel" onclick={() => confirmDelete = false}>Cancel</button>
		{:else}
			<button class="btn-ghost ddp-delete" onclick={() => confirmDelete = true}>Delete deliverable</button>
		{/if}
	</div>
</div>

<style>
	.ddp {
		padding: var(--sp-md);
		overflow-y: auto;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		font-family: var(--font-reading);
	}

	.ddp-header {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-sm);
	}

	.ddp-title-input {
		flex: 1;
		margin: 0;
		font-family: var(--font);
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		line-height: var(--lh-normal);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
		padding: 0;
		transition: border-color var(--tr-fast);
	}

	.ddp-title-input:hover {
		border-bottom-color: var(--c-border);
	}

	.ddp-title-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.ddp-summary-bar {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--c-border);
	}

	.ddp-summary-links {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		margin-left: auto;
	}

	.ddp-close {
		background: none;
		border: none;
		font-family: var(--font);
		font-size: var(--fs-xl);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 4px;
		line-height: var(--lh-tight);
		flex-shrink: 0;
	}

	.ddp-close:hover {
		color: var(--c-text);
	}

	.ddp-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ddp-add-detail {
		font-size: var(--fs-2xs);
		align-self: flex-start;
	}

	.ddp-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}

	.ddp-input {
		font: inherit;
		font-size: var(--fs-xs);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
		padding: 1px 0;
		color: var(--c-text);
		transition: border-color var(--tr-fast);
	}

	.ddp-input:hover {
		border-bottom-color: var(--c-border);
	}

	.ddp-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	/* Size picker */
	.ddp-size-picker {
		display: flex;
		gap: 2px;
	}

	.ddp-size-btn {
		background: transparent;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: 2px var(--sp-xs);
		min-width: 28px;
		text-align: center;
	}

	.ddp-size-btn.active {
		background: var(--c-accent);
		color: white;
		border-color: var(--c-accent);
	}

	.ddp-size-btn:hover:not(.active) {
		border-color: var(--c-accent);
	}

	/* Certainty picker */
	.ddp-certainty-picker {
		display: flex;
		gap: 3px;
		align-items: center;
	}

	.ddp-cert-btn {
		width: 6px;
		height: 16px;
		border-radius: 2px;
		border: 1px solid var(--c-border-soft);
		background: transparent;
		cursor: pointer;
		padding: 0;
	}

	.ddp-cert-btn.active {
		background: var(--c-accent);
		border-color: var(--c-accent);
	}

	.ddp-cert-btn:hover:not(.active) {
		border-color: var(--c-accent);
	}

	/* External dependency */

	/* Sections */
	.ddp-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--c-bg);
		padding: var(--sp-sm);
		border-radius: var(--radius-sm);
	}

	.ddp-section-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
	}

	.ddp-empty {
		font-size: var(--fs-xs);
		color: var(--c-text-faint);
		font-style: italic;
		margin: 0;
	}

	/* Opportunity rows */
	.ddp-opp-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: 2px 0;
	}

	.ddp-coverage {
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		padding: 0;
		width: 1.2em;
		text-align: center;
	}

	.ddp-coverage.full {
		color: var(--c-green-signal);
	}

	.ddp-opp-name {
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-accent-text);
		padding: 0;
		text-align: left;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ddp-opp-name:hover {
		text-decoration: underline;
	}

	.ddp-opp-stage {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.ddp-unlink {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		opacity: 0;
		padding: 0 2px;
		transition: opacity var(--tr-fast);
	}

	.ddp-opp-row:hover .ddp-unlink {
		opacity: 0.6;
	}

	.ddp-unlink:hover {
		color: var(--c-red);
		opacity: 1 !important;
	}

	/* Link picker */
	.ddp-add-link {
		color: var(--c-accent);
		padding: 0;
	}

	.ddp-link-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}

	.ddp-link-option {
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		cursor: pointer;
		padding: 2px var(--sp-xs);
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
	}

	.ddp-link-option:hover {
		background: var(--c-hover);
	}

	.ddp-link-option.cancel {
		color: var(--c-text-muted);
	}

	.ddp-link-stage {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	/* Chips */
	.ddp-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.ddp-chip {
		font-family: var(--font);
		font-size: var(--fs-xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), var(--c-surface));
		color: var(--c-text);
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.ddp-chip.inherited {
		font-style: italic;
		opacity: 0.7;
	}

	.ddp-chip-remove {
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 0;
		line-height: var(--lh-tight);
	}

	.ddp-chip-remove:hover {
		color: var(--c-red);
	}

	.ddp-chip-add {
		background: none;
		border: 1px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 0 4px;
		line-height: var(--lh-normal);
	}

	.ddp-chip-input {
		font: inherit;
		font-size: var(--fs-xs);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-xs);
		color: var(--c-text);
		width: 100px;
	}

	/* Danger zone */
	.ddp-danger {
		margin-top: auto;
		padding-top: var(--sp-md);
		border-top: 1px solid var(--c-border-soft);
		display: flex;
		gap: var(--sp-sm);
		align-items: center;
	}

	.ddp-delete {
		color: var(--c-red);
		padding: 0;
		opacity: 0.6;
	}

	.ddp-delete:hover {
		opacity: 1;
	}

	.ddp-delete-confirm {
		opacity: 1;
		font-weight: var(--fw-bold);
	}

	.ddp-delete-cancel {
		color: var(--c-text-muted);
		padding: 0;
		font-size: var(--fs-2xs);
	}
</style>
