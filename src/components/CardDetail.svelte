<script lang="ts">
	import {
		type CellSignal,
		type Opportunity,
		type PersonLink,
		type PersonRole,
		type Perspective,
		type Score,
		type Stage,
		STAGES,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		PERSON_ROLES,
		CELL_QUESTIONS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		cellHasSignal,
		nextScore,
		perspectiveOwner,
		stageIndex,
	} from '../lib/types'

	interface Props {
		opportunity: Opportunity
		onUpdate: (opportunity: Opportunity) => void
		onClose: () => void
	}

	let { opportunity, onUpdate, onClose }: Props = $props()

	let editTitle = $state(opportunity.title)
	let editDescription = $state(opportunity.description)
	let addPersonName = $state('')
	let addPersonRole: PersonRole = $state('expert')

	/** Which cell's detail panel is showing */
	let selectedCell: { stage: Stage; perspective: Perspective } | null = $state(null)

	const selectedSignal = $derived.by(() => {
		const cell = selectedCell
		if (!cell) return null
		return opportunity.signals[cell.stage][cell.perspective]
	})

	const selectedOwner = $derived.by(() => {
		const cell = selectedCell
		if (!cell) return undefined
		return perspectiveOwner(opportunity, cell.perspective, cell.stage)
	})

	function selectCell(stage: Stage, perspective: Perspective) {
		if (selectedCell?.stage === stage && selectedCell?.perspective === perspective) {
			selectedCell = null
		} else {
			selectedCell = { stage, perspective }
		}
	}

	function cycleScore(stage: Stage, perspective: Perspective, event: MouseEvent) {
		event.stopPropagation()
		const current = opportunity.signals[stage][perspective].score
		updateSignalField(stage, perspective, 'score', nextScore(current))
	}

	function updateSignalField(stage: Stage, perspective: Perspective, field: keyof CellSignal, value: string | Score) {
		const updated: Opportunity = {
			...opportunity,
			signals: {
				...opportunity.signals,
				[stage]: {
					...opportunity.signals[stage],
					[perspective]: {
						...opportunity.signals[stage][perspective],
						[field]: value,
					},
				},
			},
		}
		onUpdate(updated)
	}

	function addPerson() {
		const trimmed = addPersonName.trim()
		if (!trimmed) return
		const person: PersonLink = {
			id: crypto.randomUUID(),
			name: trimmed,
			role: addPersonRole,
			perspectives: [],
		}
		onUpdate({ ...opportunity, people: [...opportunity.people, person] })
		addPersonName = ''
	}

	function removePerson(id: string) {
		onUpdate({ ...opportunity, people: opportunity.people.filter((p) => p.id !== id) })
	}

	function updatePersonRole(id: string, role: PersonRole) {
		onUpdate({
			...opportunity,
			people: opportunity.people.map((p) => (p.id === id ? { ...p, role } : p)),
		})
	}

	function assignPerspective(personId: string, perspective: Perspective) {
		const cell = selectedCell
		if (!cell) return
		const stage = cell.stage
		const currentOwner = perspectiveOwner(opportunity, perspective, stage)
		if (currentOwner?.id === personId) {
			// Unassign: remove this stage×perspective from this person
			onUpdate({
				...opportunity,
				people: opportunity.people.map((p) =>
					p.id === personId ? { ...p, perspectives: p.perspectives.filter((a) => !(a.perspective === perspective && a.stage === stage)) } : p
				),
			})
		} else {
			// Assign: add stage×perspective to new person, remove from previous owner
			const assignment = { perspective, stage, assignedAt: Date.now() }
			onUpdate({
				...opportunity,
				people: opportunity.people.map((p) => {
					if (p.id === personId) return { ...p, perspectives: [...p.perspectives, assignment] }
					if (p.perspectives.some((a) => a.perspective === perspective && a.stage === stage)) return { ...p, perspectives: p.perspectives.filter((a) => !(a.perspective === perspective && a.stage === stage)) }
					return p
				}),
			})
		}
	}

	function handleAddPersonKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') addPerson()
	}

	function commitTitle() {
		const trimmed = editTitle.trim()
		if (trimmed && trimmed !== opportunity.title) {
			onUpdate({ ...opportunity, title: trimmed })
		} else {
			editTitle = opportunity.title
		}
	}

	function handleTitleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			;(event.target as HTMLInputElement).blur()
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose()
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (selectedCell) {
				selectedCell = null
			} else {
				onClose()
			}
		}
	}

	function rowState(rowStage: Stage): 'completed' | 'current' | 'future' {
		const current = stageIndex(opportunity.stage)
		const row = stageIndex(rowStage)
		if (row < current) return 'completed'
		if (row === current) return 'current'
		return 'future'
	}

	function stageHasAnySignal(stage: Stage): boolean {
		return PERSPECTIVES.some((p) => cellHasSignal(opportunity.signals[stage][p]))
	}

	function scoreClass(score: Score): string {
		return `score-${score}`
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleOverlayClick}>
	<div class="card-detail" role="dialog" aria-label="Card detail: {opportunity.title}">
		<header class="detail-header">
			<input
				class="title-input"
				type="text"
				bind:value={editTitle}
				onblur={commitTitle}
				onkeydown={handleTitleKeydown}
			/>
			<div class="detail-meta">
				<span class="stage-badge">{STAGES.find((s) => s.key === opportunity.stage)?.label}</span>
			</div>
			<button class="close-btn" onclick={onClose} aria-label="Close">×</button>
			<textarea
				class="description-input"
				placeholder="Add a description…"
				bind:value={editDescription}
				onblur={() => { if (editDescription !== opportunity.description) onUpdate({ ...opportunity, description: editDescription }) }}
				rows="2"
			></textarea>
		</header>

		<section class="people-section">
			<div class="people-header">
				<span class="section-label">People</span>
			</div>

			{#if opportunity.people.length > 0}
				<div class="people-list">
					{#each opportunity.people as person (person.id)}
					<div class="person-row">
							<span class="person-name">{person.name}</span>
							<select
								class="person-role-select"
								value={person.role}
								onchange={(e) => updatePersonRole(person.id, (e.target as HTMLSelectElement).value as PersonRole)}
							>
								{#each PERSON_ROLES as role}
									<option value={role.key}>{role.label}</option>
								{/each}
							</select>
							<button class="person-remove" onclick={() => removePerson(person.id)} aria-label="Remove {person.name}">×</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="add-person-row">
				<input
					type="text"
					class="add-person-input"
					placeholder="Add someone…"
					bind:value={addPersonName}
					onkeydown={handleAddPersonKeydown}
				/>
				<select class="person-role-select" bind:value={addPersonRole}>
					{#each PERSON_ROLES as role}
						<option value={role.key}>{role.label}</option>
					{/each}
				</select>
				<button class="add-person-btn" onclick={addPerson} disabled={!addPersonName.trim()}>Add</button>
			</div>
		</section>

		<div class="matrix">
			<div class="matrix-header-row">
				<div class="matrix-cell label-cell"></div>
				{#each PERSPECTIVES as p}
					<div class="matrix-cell header-cell">{PERSPECTIVE_LABELS[p]}</div>
				{/each}
			</div>

			{#each STAGES as stage}
				{@const state = rowState(stage.key)}
				{#if state !== 'future' || stageHasAnySignal(stage.key)}
					<div class="matrix-row" class:current={state === 'current'} class:completed={state === 'completed'} class:future={state === 'future'}>
						<div class="matrix-cell label-cell">
							<span class="row-stage">{stage.label}</span>
						</div>
						{#each PERSPECTIVES as p}
							{@const signal = opportunity.signals[stage.key][p]}
							{@const isSelected = selectedCell?.stage === stage.key && selectedCell?.perspective === p}
							<div class="matrix-cell">
								<div class="score-cell-row">
									{#if state === 'completed'}
										<span class="score-pill {scoreClass(signal.score)} locked"								role="img" aria-label="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[signal.score].label}"											><span class="score-indicator"></span></span>
										<span class="score-cell locked">
											{#if signal.verdict}
												<span class="cell-verdict">{signal.verdict}</span>
											{:else}
												<span class="cell-hint">—</span>
											{/if}
										</span>
									{:else}
										<button
											class="score-pill {scoreClass(signal.score)}"
											onclick={(e) => cycleScore(stage.key, p, e)}
											title="{SCORE_DISPLAY[signal.score].label} — click to change"										aria-label="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[signal.score].label}"										><span class="score-indicator"></span></button>
										<button
											class="score-cell"
											class:selected={isSelected}
											onclick={() => selectCell(stage.key, p)}
											title={CELL_QUESTIONS[stage.key][p]}
										>
											{#if signal.verdict}
												<span class="cell-verdict">{signal.verdict}</span>
											{:else}
												<span class="cell-hint">…</span>
											{/if}
											{#if signal.source === 'skatting'}
												<span class="source-badge" title="From Skatting estimation">⊕</span>
											{/if}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>

		{#if selectedCell && selectedSignal}
			<div class="detail-panel">
				<div class="panel-header">
					<span class="panel-stage">{STAGES.find((s) => s.key === selectedCell?.stage)?.label}</span>
					<span class="panel-separator">›</span>
					<span class="panel-perspective">{PERSPECTIVE_LABELS[selectedCell.perspective]}</span>
				</div>
				<p class="panel-question">{CELL_QUESTIONS[selectedCell.stage][selectedCell.perspective]}</p>

				<div class="panel-fields">
					<label class="field-label">
						<span class="field-name">Verdict</span>
						<input
							type="text"
							class="field-input"
							placeholder="One-line finding…"
							value={selectedSignal.verdict}
							oninput={(e) => updateSignalField(selectedCell!.stage, selectedCell!.perspective, 'verdict', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<label class="field-label">
						<span class="field-name">Evidence</span>
						<input
							type="text"
							class="field-input"
							placeholder="Link or reference…"
							value={selectedSignal.evidence}
							oninput={(e) => updateSignalField(selectedCell!.stage, selectedCell!.perspective, 'evidence', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<div class="field-row-secondary">
						<span class="field-name-inline">Assigned</span>
						{#if opportunity.people.length > 0}
							<select
								class="assign-select"
								value={selectedOwner?.id ?? ''}
								onchange={(e) => {
									const personId = (e.target as HTMLSelectElement).value
									if (personId) {
										assignPerspective(personId, selectedCell!.perspective)
									} else if (selectedOwner) {
										// Unassign current owner
										assignPerspective(selectedOwner.id, selectedCell!.perspective)
									}
								}}
							>
								<option value="">Unassigned</option>
								{#each opportunity.people as person}
									<option value={person.id}>{person.name}</option>
								{/each}
							</select>
						{:else}
							<span class="assigned-hint">Add people first</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.card-detail {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		width: min(90vw, 560px);
		max-height: 85vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.detail-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-lg);
		border-bottom: 1px solid var(--c-border-soft);
		position: relative;
	}

	.title-input {
		flex: 1;
		min-width: 200px;
		font-family: var(--font);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.title-input:hover {
		border-color: var(--c-border-soft);
	}

	.title-input:focus {
		outline: none;
		border-color: var(--c-accent);
		background: var(--c-bg);
	}

	.detail-meta {
		display: flex;
		gap: var(--sp-sm);
		width: 100%;
	}

	.stage-badge {
		font-size: var(--fs-sm);
		color: var(--c-accent-text);
		background: var(--c-accent-bg);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
	}

	.description-input {
		width: 100%;
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text-soft);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		resize: vertical;
		line-height: var(--lh-normal);
	}

	.description-input::placeholder {
		color: var(--c-text-ghost);
	}

	.description-input:hover {
		border-color: var(--c-border-soft);
	}

	.description-input:focus {
		outline: none;
		border-color: var(--c-accent);
		background: var(--c-bg);
	}

	.close-btn {
		position: absolute;
		top: var(--sp-md);
		right: var(--sp-md);
		background: none;
		border: none;
		font-size: var(--fs-2xl);
		color: var(--c-text-faint);
		cursor: pointer;
		padding: 0 var(--sp-sm);
		font-family: var(--font);
		line-height: var(--lh-tight);
	}

	.close-btn:hover {
		color: var(--c-text);
	}

	/* People section */
	.people-section {
		padding: var(--sp-sm) var(--sp-lg);
		border-bottom: 1px solid var(--c-border-soft);
	}

	.people-header {
		margin-bottom: var(--sp-xs);
	}

	.section-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.people-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: var(--sp-sm);
	}

	.person-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) 0;
	}

	.person-name {
		flex: 1;
		font-size: var(--fs-sm);
		color: var(--c-text);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.person-role-select,
	.person-perspective-select {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
	}

	.person-perspective-select {
		color: var(--c-accent-text);
	}

	.person-remove {
		background: none;
		border: none;
		font-size: var(--fs-base);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		font-family: var(--font);
		line-height: var(--lh-tight);
	}

	.person-remove:hover {
		color: var(--c-danger);
	}

	.add-person-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.add-person-input {
		flex: 1;
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px dashed var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		box-sizing: border-box;
	}

	.add-person-input::placeholder {
		color: var(--c-text-ghost);
	}

	.add-person-input:focus {
		outline: none;
		border-color: var(--c-accent);
		border-style: solid;
	}

	.add-person-btn {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-accent-text);
		background: var(--c-accent-bg);
		border: 1px solid var(--c-accent-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-sm);
		cursor: pointer;
	}

	.add-person-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.add-person-btn:not(:disabled):hover {
		background: var(--c-accent-bg-hover);
	}

	.assigned-name {
		font-size: var(--fs-xs);
		color: var(--c-accent-text);
	}

	.assigned-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.assign-select {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
	}

	/* Compact score matrix */
	.matrix {
		padding: var(--sp-md) var(--sp-lg);
	}

	.matrix-header-row {
		display: grid;
		grid-template-columns: 80px repeat(3, 1fr);
		gap: 2px;
		margin-bottom: 2px;
	}

	.matrix-row {
		display: grid;
		grid-template-columns: 80px repeat(3, 1fr);
		gap: 2px;
		border-radius: var(--radius-sm);
	}

	.matrix-row.current {
		background: var(--c-accent-bg);
	}

	.matrix-row.completed {
		opacity: 0.55;
	}

	.matrix-row.future {
		opacity: 0.3;
	}

	.matrix-cell {
		padding: 2px var(--sp-xs);
	}

	.label-cell {
		display: flex;
		align-items: center;
	}

	.header-cell {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-align: center;
	}

	.row-stage {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	/* Score cell: pill + verdict area */
	.score-cell-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		width: 100%;
	}

	.score-pill {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-full);
		background: var(--c-neutral-bg-light);
		cursor: pointer;
		transition: background var(--tr-fast), border-color var(--tr-fast), transform var(--tr-fast);
		padding: 0;
	}

	.score-pill:hover {
		background: var(--c-neutral-bg);
		border-color: var(--c-border);
		transform: scale(1.15);
	}

	.score-pill.locked {
		cursor: default;
	}

	.score-pill.locked:hover {
		transform: none;
	}

	.score-pill .score-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--dot-size-sm);
		height: var(--dot-size-sm);
		border-radius: var(--radius-full);
		background: transparent;
		border: 2px solid var(--c-text-ghost);
		box-sizing: border-box;
		font-size: 8px;
		font-weight: var(--fw-bold);
		color: var(--c-surface);
		line-height: var(--lh-tight);
	}

	.score-pill.score-none .score-indicator {
		color: var(--c-text-ghost);
	}

	.score-pill.score-uncertain { border-color: var(--c-warm-border); background: var(--c-warm-bg); }
	.score-pill.score-uncertain .score-indicator {
		background: var(--c-warm);
		border-color: var(--c-warm);
	}

	.score-pill.score-positive { border-color: var(--c-green-border); background: var(--c-green-bg); }
	.score-pill.score-positive .score-indicator {
		background: var(--c-green-signal);
		border-color: var(--c-green-signal);
	}

	.score-pill.score-negative { border-color: var(--c-red-border); background: var(--c-red-bg); }
	.score-pill.score-negative .score-indicator {
		background: var(--c-red);
		border-color: var(--c-red);
	}

	.score-cell {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex: 1;
		min-width: 0;
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		cursor: pointer;
		text-align: left;
		transition: background var(--tr-fast);
		min-height: 24px;
	}

	.score-cell:hover {
		background: var(--c-neutral-bg-light);
	}

	.score-cell.locked {
		cursor: default;
		padding: var(--sp-xs) var(--sp-sm);
	}

	.score-cell.locked:hover {
		background: none;
	}

	.score-cell.selected {
		border-color: var(--c-accent);
		background: var(--c-accent-bg);
	}

	.cell-verdict {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--c-text-soft);
		font-size: var(--fs-xs);
	}

	.cell-hint {
		color: var(--c-text-ghost);
	}

	.source-badge {
		flex-shrink: 0;
		font-size: var(--fs-xs);
		color: var(--c-accent-text);
	}

	/* Detail panel below matrix */
	.detail-panel {
		padding: var(--sp-md) var(--sp-lg) var(--sp-lg);
		border-top: 1px solid var(--c-border-soft);
	}

	.panel-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-xs);
	}

	.panel-stage {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.panel-separator {
		color: var(--c-text-faint);
	}

	.panel-perspective {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-accent-text);
	}

	.panel-question {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0 0 var(--sp-md);
		font-style: italic;
	}

	.panel-fields {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}

	.field-label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.field-name {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-bold);
	}

	.field-input {
		width: 100%;
		padding: var(--sp-sm);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		font-family: var(--font);
		font-size: var(--fs-base);
		color: var(--c-text);
		box-sizing: border-box;
	}

	.field-input::placeholder {
		color: var(--c-text-ghost);
	}

	.field-input:focus {
		outline: none;
		border-color: var(--c-accent);
	}

	.field-row-secondary {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding-top: var(--sp-xs);
		border-top: 1px solid var(--c-neutral-bg-light);
		margin-top: var(--sp-xs);
	}

	.field-name-inline {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		flex-shrink: 0;
	}
</style>
