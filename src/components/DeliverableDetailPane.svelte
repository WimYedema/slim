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

	const dLinks = $derived(linksForDeliverable(links, deliverable.id))

	/** Opportunities not yet linked to this deliverable */
	const unlinkedOpportunities = $derived.by(() => {
		const linked = new Set(dLinks.map((l) => l.opportunityId))
		return opportunities.filter((o) => !o.discontinuedAt && !linked.has(o.id))
	})

	/** People inherited from linked opportunities */
	function inheritedPeople(group: 'contributors' | 'consumers'): string[] {
		const names = new Set<string>()
		for (const link of dLinks) {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) continue
			for (const p of opp.people) {
				if (group === 'contributors' && p.role === 'expert') names.add(p.name)
				if (group === 'consumers' && (p.role === 'stakeholder' || p.role === 'blocker')) names.add(p.name)
			}
		}
		return [...names].sort()
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
	<div class="ddp-header">
		<h2 class="ddp-title-display">{deliverable.title}</h2>
		<button class="ddp-close" onclick={onClose}>×</button>
	</div>

	<!-- Title -->
	<label class="ddp-field">
		<span class="ddp-label">Title</span>
		<input
			type="text"
			class="ddp-input"
			value={deliverable.title}
			onblur={(e) => {
				const v = (e.target as HTMLInputElement).value.trim()
				if (v && v !== deliverable.title) onUpdate({ ...deliverable, title: v })
			}}
			onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
		/>
	</label>

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

	<!-- Size + Certainty -->
	<div class="ddp-row">
		<div class="ddp-field">
			<span class="ddp-label">Size</span>
			<div class="ddp-size-picker">
				{#each TSHIRT_SIZES as size}
					<button
						class="ddp-size-btn"
						class:active={deliverable.size === size}
						onclick={() => setSize(deliverable.size === size ? null : size)}
					>{size}</button>
				{/each}
			</div>
		</div>
		<div class="ddp-field">
			<span class="ddp-label">Certainty</span>
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
		</div>
	</div>

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

	<!-- Linked opportunities -->
	<div class="ddp-section">
		<span class="ddp-label">Opportunities</span>
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
			<button class="ddp-add-link" onclick={() => linkingOpportunity = true}>+ link opportunity</button>
		{/if}
	</div>

	<!-- Contributors -->
	{#each [{ group: 'contributors' as const, label: 'Built by', field: 'extraContributors' as const, adding: addingContributor, setAdding: (v: boolean) => addingContributor = v }, { group: 'consumers' as const, label: 'Present to', field: 'extraConsumers' as const, adding: addingConsumer, setAdding: (v: boolean) => addingConsumer = v }] as { group, label, field, adding, setAdding }}
		{@const inherited = inheritedPeople(group)}
		{@const extras = deliverable[field]}
		<div class="ddp-section">
			<span class="ddp-label">{label}</span>
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
		<button class="ddp-delete" onclick={() => { onRemove(deliverable.id); onClose() }}>Delete deliverable</button>
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
		justify-content: space-between;
		gap: var(--sp-sm);
	}

	.ddp-title-display {
		font-family: var(--font);
		font-size: var(--fs-xl);
		font-weight: 700;
		margin: 0;
		color: var(--c-text);
	}

	.ddp-close {
		background: none;
		border: none;
		font-family: var(--font);
		font-size: var(--fs-xl);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
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

	.ddp-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.ddp-input {
		font: inherit;
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) 40%, transparent);
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

	.ddp-row {
		display: flex;
		gap: var(--sp-lg);
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
		font: inherit;
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
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-accent);
		cursor: pointer;
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
		font-size: var(--fs-xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c-accent) 10%, var(--c-surface));
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
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 0;
		line-height: 1;
	}

	.ddp-chip-remove:hover {
		color: var(--c-red);
	}

	.ddp-chip-add {
		background: none;
		border: 1px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 0 4px;
		line-height: 1.4;
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
	}

	.ddp-delete {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-red);
		cursor: pointer;
		padding: 0;
		opacity: 0.6;
	}

	.ddp-delete:hover {
		opacity: 1;
	}
</style>
