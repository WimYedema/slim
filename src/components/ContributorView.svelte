<script lang="ts">
	import {
		type Opportunity,
		type Stage,
		type Perspective,
		type CellSignal,
		type Score,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		CELL_QUESTIONS,
		stageLabel,
	} from '../lib/types'
	import ScoreToggle from './ScoreToggle.svelte'
	import type { ScoreEntry } from '../lib/sync'

	interface Props {
		opportunities: Opportunity[]
		contributorName: string
		pendingScores: ScoreEntry[]
		submittedScores: ScoreEntry[]
		busy: boolean
		onScore: (oppId: string, stage: Stage, perspective: Perspective, signal: CellSignal) => void
		onSubmit: () => void
		onRefresh: () => void
	}

	let { opportunities, contributorName, pendingScores, submittedScores, busy, onScore, onSubmit, onRefresh }: Props = $props()

	interface AssignedCell {
		opp: Opportunity
		stage: Stage
		perspective: Perspective
		signal: CellSignal
		question: string
	}

	/** Find all cells assigned to this contributor, either by name match in people or unscored cells where they're an expert */
	const assignedCells = $derived.by(() => {
		const cells: AssignedCell[] = []
		const nameLower = contributorName.toLowerCase()

		for (const opp of opportunities) {
			if (opp.discontinuedAt) continue

			// Find perspective assignments for this person
			const person = opp.people.find((p) => p.name.toLowerCase() === nameLower)
			if (!person) continue

			for (const assignment of person.perspectives) {
				const signal = opp.signals[assignment.stage]?.[assignment.perspective]
				if (!signal) continue
				cells.push({
					opp,
					stage: assignment.stage,
					perspective: assignment.perspective,
					signal,
					question: CELL_QUESTIONS[assignment.stage][assignment.perspective],
				})
			}
		}

		return cells
	})

	/** Group cells by opportunity, sort unscored cells first within each group */
	const groupedByOpp = $derived.by(() => {
		const groups = new Map<string, { opp: Opportunity; cells: AssignedCell[] }>()
		for (const cell of assignedCells) {
			let group = groups.get(cell.opp.id)
			if (!group) {
				group = { opp: cell.opp, cells: [] }
				groups.set(cell.opp.id, group)
			}
			group.cells.push(cell)
		}
		// Sort cells within each group: unscored first, then pending, then submitted, then scored
		for (const group of groups.values()) {
			group.cells.sort((a, b) => {
				const aP = !!getPendingSignal(a.opp.id, a.stage, a.perspective)
				const bP = !!getPendingSignal(b.opp.id, b.stage, b.perspective)
				const aS = !!getSubmittedSignal(a.opp.id, a.stage, a.perspective)
				const bS = !!getSubmittedSignal(b.opp.id, b.stage, b.perspective)
				const aEff = effectiveSignal(a)
				const bEff = effectiveSignal(b)
				const aRank = aEff.score === 'none' && !aP && !aS ? 0 : aP ? 1 : aS ? 2 : 3
				const bRank = bEff.score === 'none' && !bP && !bS ? 0 : bP ? 1 : bS ? 2 : 3
				return aRank - bRank
			})
		}
		return [...groups.values()]
	})

	const unscoredCount = $derived(
		assignedCells.filter((c) => {
			const eff = effectiveSignal(c)
			const isPending = !!getPendingSignal(c.opp.id, c.stage, c.perspective)
			return eff.score === 'none' && !isPending
		}).length,
	)
	const pendingCount = $derived(pendingScores.length)
	const totalCount = $derived(assignedCells.length)
	const doneCount = $derived(totalCount - unscoredCount - pendingCount)
	const progressPct = $derived(totalCount > 0 ? Math.round(((totalCount - unscoredCount) / totalCount) * 100) : 0)

	function getPendingSignal(oppId: string, stage: Stage, perspective: Perspective): CellSignal | undefined {
		const entry = pendingScores.find(
			(e) => e.opportunityId === oppId && e.stage === stage && e.perspective === perspective,
		)
		return entry?.signal
	}

	function getSubmittedSignal(oppId: string, stage: Stage, perspective: Perspective): CellSignal | undefined {
		const entry = submittedScores.find(
			(e) => e.opportunityId === oppId && e.stage === stage && e.perspective === perspective,
		)
		return entry?.signal
	}

	function effectiveSignal(cell: AssignedCell): CellSignal {
		return getPendingSignal(cell.opp.id, cell.stage, cell.perspective)
			?? getSubmittedSignal(cell.opp.id, cell.stage, cell.perspective)
			?? cell.signal
	}

	/** Get the signals from other perspectives at the same stage for context */
	function otherPerspectives(cell: AssignedCell): { perspective: Perspective; score: Score }[] {
		return PERSPECTIVES
			.filter((p) => p !== cell.perspective)
			.map((p) => ({
				perspective: p,
				score: cell.opp.signals[cell.stage]?.[p]?.score ?? 'none' as Score,
			}))
			.filter((p) => p.score !== 'none')
	}

	function handleScoreChange(cell: AssignedCell, score: Score) {
		const current = effectiveSignal(cell)
		onScore(cell.opp.id, cell.stage, cell.perspective, {
			...current,
			score,
			owner: contributorName,
		})
	}

	function handleVerdictChange(cell: AssignedCell, verdict: string) {
		const current = effectiveSignal(cell)
		onScore(cell.opp.id, cell.stage, cell.perspective, {
			...current,
			verdict,
			owner: contributorName,
		})
	}

	function handleEvidenceChange(cell: AssignedCell, evidence: string) {
		const current = effectiveSignal(cell)
		onScore(cell.opp.id, cell.stage, cell.perspective, {
			...current,
			evidence,
			owner: contributorName,
		})
	}
</script>

<div class="cv-container">
	<div class="cv-header">
		<h2 class="cv-title">Your assignments, {contributorName}</h2>
		{#if assignedCells.length > 0}
			<div class="cv-progress">
				<div class="cv-progress-bar">
					<div class="cv-progress-fill" style:width="{progressPct}%"></div>
				</div>
				<p class="cv-progress-text">
					{#if unscoredCount > 0}
						{unscoredCount} awaiting your input
					{:else}
						All scored
					{/if}
					{#if pendingCount > 0}
						· {pendingCount} pending submit
					{/if}
					· {totalCount} total
				</p>
			</div>
			<div class="cv-actions">
				<button class="cv-action-btn" onclick={onRefresh} disabled={busy}>
					{busy ? 'Refreshing…' : 'Refresh board'}
				</button>
				{#if pendingCount > 0}
					<button class="cv-action-btn cv-action-primary" onclick={onSubmit} disabled={busy}>
						Submit {pendingCount} verdict{pendingCount === 1 ? '' : 's'}
					</button>
				{/if}
			</div>
		{:else}
			<p class="cv-subtitle">No cells assigned to you yet.</p>
		{/if}
	</div>

	{#if groupedByOpp.length === 0}
		<div class="cv-empty">
			<p>Nothing here yet for <strong>{contributorName}</strong>.</p>
			<p class="cv-empty-hint">
				The PO will assign perspective cells to you — once they publish an update, hit <strong>Refresh board</strong> to check.
			</p>
			<button class="cv-action-btn" onclick={onRefresh} disabled={busy}>
				{busy ? 'Refreshing…' : 'Refresh board'}
			</button>
		</div>
	{:else}
		{#each groupedByOpp as group (group.opp.id)}
			<div class="cv-opp-card">
				<div class="cv-opp-header">
					<h3 class="cv-opp-title">{group.opp.title}</h3>
					{#if group.opp.description}
						<p class="cv-opp-desc">{group.opp.description}</p>
					{/if}
				</div>

				{#each group.cells as cell (`${cell.stage}-${cell.perspective}`)}
					{@const signal = effectiveSignal(cell)}
					{@const isPending = !!getPendingSignal(cell.opp.id, cell.stage, cell.perspective)}
					{@const isSubmitted = !isPending && !!getSubmittedSignal(cell.opp.id, cell.stage, cell.perspective)}
					{@const others = otherPerspectives(cell)}
					<div class="cv-cell" class:cv-cell-pending={isPending} class:cv-cell-submitted={isSubmitted} class:cv-cell-unscored={signal.score === 'none' && !isPending && !isSubmitted}>
						<div class="cv-cell-header">
							<span class="cv-cell-perspective">{PERSPECTIVE_LABELS[cell.perspective]}</span>
							<span class="cv-cell-stage">{stageLabel(cell.stage)}</span>
							{#if isPending}
								<span class="cv-cell-badge pending">pending</span>
							{:else if isSubmitted}
								<span class="cv-cell-badge submitted">submitted ✓</span>
							{:else if signal.score !== 'none'}
								<span class="cv-cell-badge scored">{SCORE_DISPLAY[signal.score].label}</span>
							{/if}
						</div>

						{#if others.length > 0}
							<p class="cv-cell-others">
								Others:
								{#each others as o, i}
									<span class="cv-other-score" title="{PERSPECTIVE_LABELS[o.perspective]}: {SCORE_DISPLAY[o.score].label}">
										{PERSPECTIVE_LABELS[o.perspective]} {SCORE_SYMBOL[o.score]}
									</span>{#if i < others.length - 1},{/if}
								{/each}
							</p>
						{/if}

						<p class="cv-cell-question">{cell.question}</p>

						<div class="cv-cell-controls">
							<ScoreToggle
								score={signal.score}
								label="{PERSPECTIVE_LABELS[cell.perspective]} at {stageLabel(cell.stage)}"
								onScoreChange={(s) => handleScoreChange(cell, s)}
							/>
							<span class="cv-score-hint">Consent to proceed — not a prediction of success</span>
						</div>

						<div class="cv-cell-fields">
							<input
								type="text"
								class="cv-verdict-input"
								placeholder="Your verdict — one line"
								value={signal.verdict}
								oninput={(e) => handleVerdictChange(cell, (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								class="cv-evidence-input"
								placeholder="Evidence URL or reference (optional)"
								value={signal.evidence}
								oninput={(e) => handleEvidenceChange(cell, (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>
				{/each}
			</div>
		{/each}
	{/if}
</div>

<style>
	.cv-container {
		padding: var(--sp-md) var(--sp-lg);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.cv-container > * {
		width: 100%;
		max-width: 42rem;
	}

	.cv-header {
		margin-bottom: var(--sp-lg);
	}

	.cv-title {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
	}

	.cv-subtitle {
		margin: var(--sp-xs) 0 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	/* Progress bar */
	.cv-progress {
		margin-top: var(--sp-sm);
	}

	.cv-progress-bar {
		height: 4px;
		background: var(--c-border);
		border-radius: 2px;
		overflow: hidden;
	}

	.cv-progress-fill {
		height: 100%;
		background: var(--c-accent);
		border-radius: 2px;
		transition: width 0.2s ease;
	}

	.cv-progress-text {
		margin: var(--sp-2xs) 0 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	/* Inline action buttons */
	.cv-actions {
		display: flex;
		gap: var(--sp-sm);
		margin-top: var(--sp-sm);
	}

	.cv-action-btn {
		padding: var(--sp-xs) var(--sp-md);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	.cv-action-btn:hover:not(:disabled) {
		background: var(--c-surface-hover);
	}

	.cv-action-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.cv-action-primary {
		background: var(--c-accent);
		color: white;
		border-color: var(--c-accent);
	}

	.cv-action-primary:hover:not(:disabled) {
		background: var(--c-accent-text);
	}

	/* Empty state */
	.cv-empty {
		text-align: center;
		padding: var(--sp-2xl) var(--sp-md);
		color: var(--c-text-muted);
	}

	.cv-empty p {
		margin: 0 0 var(--sp-xs);
	}

	.cv-empty-hint {
		font-size: var(--fs-sm);
		margin-bottom: var(--sp-md);
	}

	/* Opportunity cards */
	.cv-opp-card {
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		background: var(--c-surface);
		margin-bottom: var(--sp-md);
		overflow: hidden;
	}

	.cv-opp-header {
		padding: var(--sp-sm) var(--sp-md);
		border-bottom: 1px solid var(--c-border-soft);
		background: var(--c-bg);
	}

	.cv-opp-title {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.cv-opp-desc {
		margin: var(--sp-2xs) 0 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	/* Cells */
	.cv-cell {
		padding: var(--sp-sm) var(--sp-md);
		border-bottom: 1px solid var(--c-border-soft);
	}

	.cv-cell:last-child {
		border-bottom: none;
	}

	.cv-cell-unscored {
		background: color-mix(in srgb, var(--c-accent) 4%, var(--c-surface));
	}

	.cv-cell-pending {
		border-left: 3px solid var(--c-accent);
	}

	.cv-cell-submitted {
		border-left: 3px solid var(--c-positive);
		background: color-mix(in srgb, var(--c-positive) 3%, var(--c-surface));
	}

	.cv-cell-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-xs);
	}

	.cv-cell-perspective {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--c-text);
	}

	.cv-cell-stage {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.cv-cell-badge {
		font-size: var(--fs-2xs);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-weight: var(--fw-medium);
	}

	.cv-cell-badge.pending {
		background: color-mix(in srgb, var(--c-accent) 15%, transparent);
		color: var(--c-accent);
	}

	.cv-cell-badge.scored {
		background: var(--c-neutral-bg);
		color: var(--c-text-muted);
	}

	.cv-cell-badge.submitted {
		background: color-mix(in srgb, var(--c-positive) 15%, transparent);
		color: var(--c-positive);
	}

	/* Other perspectives context line */
	.cv-cell-others {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.cv-other-score {
		font-weight: var(--fw-medium);
	}

	.cv-cell-question {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		font-style: italic;
	}

	.cv-cell-controls {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-sm);
		flex-wrap: wrap;
	}

	.cv-score-hint {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.cv-cell-fields {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.cv-verdict-input,
	.cv-evidence-input {
		width: 100%;
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
		font: inherit;
		font-size: var(--fs-sm);
	}

	.cv-evidence-input {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.cv-verdict-input:focus,
	.cv-evidence-input:focus {
		outline: none;
		border-color: var(--c-accent);
		box-shadow: 0 0 0 1px var(--c-accent);
	}
</style>
