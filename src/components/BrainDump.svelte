<script lang="ts">
	import { parseImportText, toPreview, IMPORT_TEMPLATE } from '../lib/import-parser'
	import { STAGES, originLabel, stageLabel } from '../lib/types'

	interface Props {
		onApply: (text: string) => void
		onSkip: (boardName: string) => void
	}

	let { onApply, onSkip }: Props = $props()

	let text = $state(IMPORT_TEMPLATE)
	let skipMode = $state(false)
	let skipName = $state('')
	let skipInput = $state<HTMLInputElement>()
	let parsed = $derived(parseImportText(text))
	let preview = $derived(toPreview(parsed))
	let totalOpps = $derived(preview.opportunities.length)

	function enterSkipMode() {
		skipMode = true
		// Focus the input after Svelte renders it
		queueMicrotask(() => skipInput?.focus())
	}

	function confirmSkip() {
		onSkip(skipName.trim() || 'My board')
	}
	let totalDels = $derived(
		preview.opportunities.reduce((n, o) => n + o.deliverables.length, 0) + preview.orphanDeliverables.length
	)
	let totalPeople = $derived(
		new Set(preview.opportunities.flatMap(o => o.people)).size
	)

	/** Group preview opportunities by stage for the mini pipeline */
	function byStage(stage: string) {
		return preview.opportunities.filter(o => o.stage === stage)
	}
</script>

<div class="bd-container">
	<div class="bd-header">
		<h2 class="bd-title">What's on your plate?</h2>
		<p class="bd-subtitle">Opportunities are goals or problems worth investigating. Deliverables are the concrete work items that serve them.</p>
		<p class="bd-hint">
			<code># Title</code> = board name · <code>## Heading</code> = opportunity · <code>- Bullet</code> = deliverable · <code>#sketch</code> = stage · <code>#request</code> = origin · <code>@Name</code> = person
		</p>
	</div>

	<div class="bd-split">
		<div class="bd-editor-pane">
			<textarea
				class="bd-textarea"
				bind:value={text}
				spellcheck="false"
			></textarea>
		</div>

		<div class="bd-preview-pane">
			{#if totalOpps === 0 && totalDels === 0}
				<div class="bd-preview-empty">Type or paste your ideas on the left</div>
			{:else}
				{#each STAGES as stage}
					{@const items = byStage(stage.key)}
						<div class="bd-stage">
							<div class="bd-stage-header" style="--stage-color: var(--c-stage-{stage.key})">
								{stage.label} <span class="bd-stage-count">{items.length}</span>
							</div>
							{#each items as opp}
								<div class="bd-card">
									<div class="bd-card-line1">
										<span class="bd-card-title">{opp.title}</span>
										{#if opp.origin}
											<span class="bd-tag bd-tag-origin">{originLabel(opp.origin)}</span>
										{/if}
										{#if opp.horizon}
											<span class="bd-tag">{opp.horizon}</span>
										{/if}
									</div>
									{#if opp.people.length > 0}
										<div class="bd-card-people">
											{#each opp.people as person}
												<span class="bd-person">@{person}</span>
											{/each}
										</div>
									{/if}
									{#if opp.deliverables.length > 0}
										<div class="bd-card-deliverables">
											{#each opp.deliverables as del}
												<div class="bd-del">— {del}</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
				{/each}
				{#if preview.orphanDeliverables.length > 0}
					<div class="bd-stage">
						<div class="bd-stage-header bd-stage-orphan">Unlinked deliverables</div>
						{#each preview.orphanDeliverables as del}
							<div class="bd-card">
								<span class="bd-card-title bd-orphan-title">{del}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<div class="bd-footer">
		<span class="bd-summary">
			{#if parsed.boardName}<strong>{parsed.boardName}</strong> · {/if}{totalOpps} {totalOpps === 1 ? 'opportunity' : 'opportunities'} · {totalDels} {totalDels === 1 ? 'deliverable' : 'deliverables'} · {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
		</span>
		<div class="bd-actions">
			{#if skipMode}
				<div class="bd-skip-name">
					<input
						class="bd-skip-input"
						type="text"
						bind:this={skipInput}
						bind:value={skipName}
						placeholder="My board"
						onkeydown={(e) => { if (e.key === 'Enter') confirmSkip(); if (e.key === 'Escape') { skipMode = false } }}
					/>
					<button class="bd-btn-create" onclick={confirmSkip}>Start empty</button>
					<button class="bd-btn-skip" onclick={() => { skipMode = false }}>Cancel</button>
				</div>
			{:else}
				<button class="bd-btn-skip" onclick={enterSkipMode}>Skip — start empty</button>
				<button class="bd-btn-create" disabled={totalOpps === 0 && totalDels === 0} onclick={() => onApply(text)}>Create board</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.bd-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		padding: var(--sp-md);
		gap: var(--sp-md);
	}

	.bd-header {
		text-align: center;
	}

	.bd-title {
		font-size: var(--fs-xl);
		font-weight: 600;
		color: var(--c-text);
		margin: 0 0 var(--sp-xs);
	}

	.bd-subtitle {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0 0 var(--sp-sm);
	}

	.bd-hint {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		margin: 0;
	}

	.bd-hint code {
		background: var(--c-surface-alt);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
		font-size: var(--fs-2xs);
	}

	.bd-split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-md);
		flex: 1;
		min-height: 0;
	}

	@media (max-width: 640px) {
		.bd-split {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}

	.bd-editor-pane {
		display: flex;
		min-height: 0;
	}

	.bd-textarea {
		flex: 1;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		font-size: var(--fs-sm);
		line-height: 1.6;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		padding: var(--sp-md);
		resize: none;
		tab-size: 2;
	}

	.bd-textarea:focus {
		outline: none;
		border-color: var(--c-accent);
	}

	.bd-preview-pane {
		overflow-y: auto;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		padding: var(--sp-sm);
		background: var(--c-bg);
	}

	.bd-preview-empty {
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		font-style: italic;
		text-align: center;
		padding: var(--sp-xl);
	}

	.bd-stage {
		margin-bottom: var(--sp-md);
	}

	.bd-stage-header {
		font-size: var(--fs-xs);
		font-weight: 600;
		color: var(--stage-color, var(--c-text-muted));
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: var(--sp-xs) var(--sp-sm);
		border-left: 3px solid var(--stage-color, var(--c-border));
	}

	.bd-stage-orphan {
		--stage-color: var(--c-warm);
	}

	.bd-card {
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		margin: var(--sp-xs) 0;
	}

	.bd-card-line1 {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-wrap: wrap;
	}

	.bd-card-title {
		font-size: var(--fs-sm);
		color: var(--c-text);
		font-weight: 500;
	}

	.bd-tag {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		background: var(--c-surface-alt);
		padding: 1px 5px;
		border-radius: var(--radius-sm);
	}

	.bd-tag-origin {
		color: var(--c-warm);
	}

	.bd-card-people {
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
		margin-top: 2px;
	}

	.bd-person {
		font-size: var(--fs-2xs);
		color: var(--c-accent);
	}

	.bd-card-deliverables {
		margin-top: 2px;
	}

	.bd-del {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		padding-left: var(--sp-sm);
	}

	.bd-orphan-title {
		font-style: italic;
		color: var(--c-text-muted);
	}

	.bd-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--sp-sm);
	}

	.bd-summary {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.bd-actions {
		display: flex;
		gap: var(--sp-sm);
	}

	.bd-btn-skip {
		background: none;
		border: none;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
	}

	.bd-btn-skip:hover {
		color: var(--c-text);
	}

	.bd-skip-name {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.bd-skip-input {
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		width: 10rem;
	}

	.bd-skip-input:focus {
		outline: none;
		border-color: var(--c-accent);
	}

	.bd-btn-create {
		padding: var(--sp-sm) var(--sp-lg);
		border: 1px solid var(--c-accent);
		border-radius: var(--radius-sm);
		background: var(--c-accent);
		color: white;
		font-size: var(--fs-sm);
		font-weight: 500;
		cursor: pointer;
		transition: opacity var(--tr-fast, 0.1s);
	}

	.bd-btn-create:hover {
		opacity: 0.9;
	}

	.bd-btn-create:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.bd-btn-create:focus-visible {
		outline: 2px solid var(--c-accent);
		outline-offset: 2px;
	}
</style>
