<script lang="ts">
	import type { Opportunity, Deliverable, OpportunityDeliverableLink } from '../lib/types'
	import { linksForOpportunity, opportunityBoxPlotData } from '../lib/types'
	import EffortBoxPlot from './EffortBoxPlot.svelte'

	interface Props {
		opportunity: Opportunity
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		onUpdate: (opportunity: Opportunity) => void
		onAddDeliverable: (title: string) => Deliverable
		onLinkDeliverable: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onUnlinkDeliverable: (opportunityId: string, deliverableId: string) => void
		onUpdateLinkCoverage: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onNavigateToDeliverable?: (id: string) => void
	}

	let { opportunity, deliverables, links, onUpdate, onAddDeliverable, onLinkDeliverable, onUnlinkDeliverable, onUpdateLinkCoverage, onNavigateToDeliverable }: Props = $props()

	const oppLinks = $derived(linksForOpportunity(links, opportunity.id))
	const linkedDeliverables = $derived(
		oppLinks.map((link) => ({
			link,
			deliverable: deliverables.find((d) => d.id === link.deliverableId)!,
		})).filter((x) => x.deliverable)
	)
	const unlinkedDeliverables = $derived(
		deliverables.filter((d) => !oppLinks.some((l) => l.deliverableId === d.id))
	)

	let showLinkPicker = $state(false)
	let newDeliverableTitle = $state('')

	const boxPlotData = $derived(opportunityBoxPlotData(opportunity.id, deliverables, links))

	function addAndLink(title: string) {
		const trimmed = title.trim()
		if (!trimmed) return
		const d = onAddDeliverable(trimmed)
		onLinkDeliverable(opportunity.id, d.id, 'partial')
		newDeliverableTitle = ''
	}

	function linkExisting(deliverableId: string) {
		onLinkDeliverable(opportunity.id, deliverableId, 'partial')
		showLinkPicker = false
	}
</script>

{#if opportunity.stage === 'decompose' || linkedDeliverables.length > 0}
	<div class="deliverables-section">
		<div class="deliverables-header">
			<span class="section-label">Deliverables</span>
			{#if linkedDeliverables.length > 0}
				<span class="deliverable-count">{linkedDeliverables.filter((x) => x.link.coverage === 'full').length}/{linkedDeliverables.length} full</span>
			{/if}
			{#if opportunity.stage === 'decompose'}
				<label class="decomposition-complete-toggle" title={opportunity.decompositionComplete ? 'Decomposition complete' : 'Mark decomposition as complete'}>
					<input
						type="checkbox"
						checked={opportunity.decompositionComplete ?? false}
						onchange={() => onUpdate({ ...opportunity, decompositionComplete: !opportunity.decompositionComplete })}
					/>
					complete
				</label>
			{/if}
		</div>
		{#each linkedDeliverables as { link, deliverable } (deliverable.id)}
			{@const contributors = [...new Set([...opportunity.people.filter((p) => p.role === 'expert').map((p) => p.name), ...deliverable.extraContributors])]}
			{@const consumers = [...new Set([...opportunity.people.filter((p) => p.role === 'stakeholder' || p.role === 'approver').map((p) => p.name), ...deliverable.extraConsumers])]}
			<div class="deliverable-row">
				<button
					class="coverage-dot"
					class:full={link.coverage === 'full'}
					class:partial={link.coverage === 'partial'}
					class:discovery={deliverable.kind === 'discovery'}
					onclick={() => onUpdateLinkCoverage(opportunity.id, deliverable.id, link.coverage === 'full' ? 'partial' : 'full')}
					title={link.coverage === 'full' ? 'Full coverage — click to mark partial' : 'Partial coverage — click to mark full'}
				></button>
				<span class="deliverable-title">{#if onNavigateToDeliverable}<button class="deliverable-nav" onclick={() => onNavigateToDeliverable(deliverable.id)}>{#if deliverable.ticketId}<span class="ticket-id-prefix">{deliverable.ticketId}</span>{/if}{deliverable.title}</button>{:else if deliverable.externalUrl}<a href={deliverable.externalUrl} target="_blank" rel="noopener">{#if deliverable.ticketId}<span class="ticket-id-prefix">{deliverable.ticketId}</span>{/if}{deliverable.title}</a>{:else}{#if deliverable.ticketId}<span class="ticket-id-prefix">{deliverable.ticketId}</span>{/if}{deliverable.title}{/if}</span>
				{#if deliverable.size}
					<span class="deliverable-size-badge">{deliverable.size}</span>
				{/if}
				{#if consumers.length > 0}
					<span class="deliverable-stakeholders" title="Present to: {consumers.join(', ')}">→ {consumers.join(', ')}</span>
				{/if}
				<button class="deliverable-unlink" onclick={() => onUnlinkDeliverable(opportunity.id, deliverable.id)} title="Unlink">×</button>
			</div>
		{/each}
		{#if !opportunity.decompositionComplete}
			<div class="deliverable-add">
				<input
					type="text"
					class="deliverable-input"
					placeholder="New deliverable…"
					bind:value={newDeliverableTitle}
					onkeydown={(e) => { if (e.key === 'Enter') addAndLink(newDeliverableTitle) }}
				/>
				{#if unlinkedDeliverables.length > 0}
					{#if showLinkPicker}
						<div class="link-picker">
							{#each unlinkedDeliverables as d (d.id)}
								<button class="link-option" onclick={() => linkExisting(d.id)}>{d.title}</button>
							{/each}
							<button class="link-option cancel" onclick={() => showLinkPicker = false}>Cancel</button>
						</div>
					{:else}
						<button class="link-existing-btn" onclick={() => showLinkPicker = true}>+ link existing</button>
					{/if}
				{/if}
			</div>
		{/if}
		{#if boxPlotData}
			<div class="effort-chart">
				<EffortBoxPlot rows={boxPlotData.rows} combined={boxPlotData.combined} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.deliverables-section {
		margin-bottom: var(--sp-sm);
		padding: var(--sp-sm);
		background: var(--c-bg);
		border-radius: var(--radius-sm);
		font-family: var(--font);
	}

	.effort-chart {
		margin-top: var(--sp-sm);
		padding-top: var(--sp-xs);
		border-top: 1px solid var(--c-border);
	}

	.deliverables-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-xs);
	}

	.section-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
	}

	.deliverable-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		opacity: 0.7;
	}

	.decomposition-complete-toggle {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
	}

	.decomposition-complete-toggle input {
		margin: 0;
	}

	.deliverable-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: 2px 0;
	}

	.coverage-dot {
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		transition: background 0.1s ease;
	}

	.coverage-dot::after {
		content: '';
		display: block;
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
	}

	.coverage-dot:hover {
		background: var(--c-neutral-bg);
	}

	.coverage-dot:hover::after {
		border-color: var(--c-text-muted);
	}

	.coverage-dot.partial::after {
		background: var(--c-green-border);
		border-color: var(--c-green-border);
		clip-path: inset(0 50% 0 0);
	}

	.coverage-dot.full::after {
		background: var(--c-green-signal);
		border-color: var(--c-green-signal);
	}

	.coverage-dot.discovery::after {
		border-radius: 1px;
		transform: rotate(45deg);
	}

	.deliverable-title {
		font-size: var(--fs-xs);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deliverable-title a {
		color: var(--c-text);
		text-decoration: none;
	}

	.deliverable-title a:hover {
		color: var(--c-accent-text);
		text-decoration: underline;
	}

	.ticket-id-prefix {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-normal);
		margin-right: var(--sp-xs);
	}

	.deliverable-nav {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--c-text);
		cursor: pointer;
		text-align: left;
	}

	.deliverable-nav:hover {
		color: var(--c-accent-text);
		text-decoration: underline;
	}

	.deliverable-stakeholders {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.deliverable-size-badge {
		font-size: var(--fs-2xs);
		font-family: var(--font);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-border) 40%, transparent);
		padding: 0 var(--sp-2xs);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.deliverable-unlink {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		opacity: 0;
		padding: 0 2px;
		transition: opacity var(--tr-fast);
	}

	.deliverable-row:hover .deliverable-unlink {
		opacity: 0.6;
	}

	.deliverable-add {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-xs);
		margin-top: var(--sp-xs);
	}

	.deliverable-input {
		flex: 1;
		min-width: 120px;
		font: inherit;
		font-size: var(--fs-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		color: var(--c-text);
	}

	.link-existing-btn {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-accent);
		cursor: pointer;
		padding: 0;
	}

	.link-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		width: 100%;
		margin-top: var(--sp-xs);
	}

	.link-option {
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		cursor: pointer;
		padding: 2px var(--sp-xs);
	}

	.link-option:hover {
		background: var(--c-hover);
	}

	.link-option.cancel {
		color: var(--c-text-muted);
	}
</style>
