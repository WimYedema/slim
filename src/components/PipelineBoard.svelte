<script lang="ts">
	import {
		type Opportunity,
		type Stage,
		STAGES,
		PERSPECTIVES,
		PERSPECTIVE_SHORT,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		currentStageScores,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		addOpportunity: (title: string) => void
		moveOpportunity: (id: string, stage: Stage) => void
		removeOpportunity: (id: string) => void
		onSelect: (id: string) => void
	}

	let { opportunities, addOpportunity, moveOpportunity, removeOpportunity, onSelect }: Props =
		$props()

	let newTitle = $state('')

	function handleAdd(event: KeyboardEvent) {
		if (event.key === 'Enter' && newTitle.trim()) {
			addOpportunity(newTitle.trim())
			newTitle = ''
		}
	}

	function handleDragStart(event: DragEvent, id: string) {
		event.dataTransfer?.setData('text/plain', id)
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault()
	}

	function handleDrop(event: DragEvent, stage: Stage) {
		event.preventDefault()
		const id = event.dataTransfer?.getData('text/plain')
		if (id) {
			moveOpportunity(id, stage)
		}
	}

	function cardsForStage(stage: Stage): Opportunity[] {
		return opportunities.filter((o) => o.stage === stage && !o.discontinuedAt)
	}
</script>

<div class="board">
	{#each STAGES as stage}
		<div
			class="column"
			ondragover={handleDragOver}
			ondrop={(e) => handleDrop(e, stage.key)}
			role="list"
		>
			<div class="column-header">
				<h2>{stage.label}</h2>
				<span class="thinking-mode">{stage.thinking}</span>
				<span class="count">{cardsForStage(stage.key).length}</span>
			</div>

			{#if stage.key === 'explore'}
				<div class="add-card">
					<input
						type="text"
						placeholder="Add an idea…"
						bind:value={newTitle}
						onkeydown={handleAdd}
					/>
				</div>
			{/if}

			<div class="card-list">
				{#each cardsForStage(stage.key) as card (card.id)}
					{@const scores = currentStageScores(card)}
					<div
						class="card"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, card.id)}
						onclick={() => onSelect(card.id)}
						role="listitem"
					>
						<span class="card-title">{card.title}</span>
						<span class="card-scores">
							{#each PERSPECTIVES as p}
								<span class="card-dot score-{scores[p]}" title="{PERSPECTIVE_SHORT[p]}: {SCORE_DISPLAY[scores[p]].label}"><span class="dot-indicator">{SCORE_SYMBOL[scores[p]]}</span></span>
							{/each}
						</span>
						<button
							class="card-remove"
							onclick={(e) => { e.stopPropagation(); removeOpportunity(card.id) }}
							aria-label="Remove {card.title}"
						>×</button>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-md);
		padding: var(--sp-lg);
		flex: 1;
		overflow-x: auto;
		min-height: 0;
	}

	.column {
		display: flex;
		flex-direction: column;
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		padding: var(--sp-md);
		min-height: 200px;
	}

	.column-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-md);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--c-border-soft);
	}

	.column-header h2 {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: 700;
	}

	.thinking-mode {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.count {
		margin-left: auto;
		font-size: var(--fs-sm);
		color: var(--c-text-faint);
	}

	.add-card {
		margin-bottom: var(--sp-sm);
	}

	.add-card input {
		width: 100%;
		padding: var(--sp-sm) var(--sp-md);
		border: 1px dashed var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		font-family: var(--font);
		font-size: var(--fs-base);
		color: var(--c-text);
		box-sizing: border-box;
	}

	.add-card input::placeholder {
		color: var(--c-text-ghost);
	}

	.add-card input:focus {
		outline: none;
		border-color: var(--c-accent);
		border-style: solid;
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		flex: 1;
	}

	.card {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-md);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		cursor: grab;
		transition: box-shadow var(--tr-fast);
	}

	.card:hover {
		box-shadow: var(--shadow-sm);
	}

	.card:active {
		cursor: grabbing;
	}

	.card-title {
		flex: 1;
		font-size: var(--fs-base);
	}

	.card-remove {
		background: none;
		border: none;
		font-size: var(--fs-lg);
		color: var(--c-text-faint);
		cursor: pointer;
		padding: 0 var(--sp-xs);
		font-family: var(--font);
		line-height: 1;
	}

	.card-remove:hover {
		color: var(--c-danger);
	}

	.card-scores {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.card-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 10px;
		height: 10px;
	}

	.dot-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
		background: transparent;
		border: 1.5px solid var(--c-text-ghost);
		box-sizing: border-box;
		font-size: 7px;
		font-weight: 700;
		color: var(--c-surface);
		line-height: 1;
	}

	.card-dot.score-none .dot-indicator {
		color: var(--c-text-ghost);
	}

	.card-dot.score-uncertain .dot-indicator {
		background: var(--c-warm);
		border-color: var(--c-warm);
	}

	.card-dot.score-positive .dot-indicator {
		background: var(--c-green-signal);
		border-color: var(--c-green-signal);
	}

	.card-dot.score-negative .dot-indicator {
		background: var(--c-red);
		border-color: var(--c-red);
	}
</style>
