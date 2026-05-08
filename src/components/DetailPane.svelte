<script lang="ts">
	import {
		type Opportunity,
		type CellSignal,
		type Commitment,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Perspective,
		type PersonLink,
		type Score,
		type Stage,
		type ExitState,
		type PersonRole,
		STAGES,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		CELL_QUESTIONS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		EXIT_STATES,
		ORIGIN_TYPES,
		PERSON_ROLES,
		cellHasSignal,
		canAdvanceToDeliver,
		nextStage,
		prevStage,
		perspectiveWeight,
		perspectiveAssignment,
		commitmentUrgency,
		commitmentStatuses,
		stageConsent,
		stageIndex,
		daysInStage,
		agingLevel,
		scoreClass,
		formatDaysLeft,
	} from '../lib/types'
	import { linksForOpportunity } from '../lib/queries'
	import ScoreToggle from './ScoreToggle.svelte'
	import MemberPicker from './MemberPicker.svelte'
	import DeliverablesSection from './DeliverablesSection.svelte'
	import CommitmentsAndPeople from './CommitmentsAndPeople.svelte'

	interface Props {
		opportunity: Opportunity
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		allHorizons?: string[]
		knownNames?: string[]
		nameAnnotations?: Map<string, string>
		onUpdate: (opportunity: Opportunity) => void
		onClose: () => void
		onAddDeliverable: (title: string) => Deliverable
		onUpdateDeliverable: (deliverable: Deliverable) => void
		onLinkDeliverable: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onUnlinkDeliverable: (opportunityId: string, deliverableId: string) => void
		onUpdateLinkCoverage: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onNavigateToDeliverable?: (id: string) => void
		lens?: Perspective | null
	}

	let { opportunity, deliverables, links, allHorizons = [], knownNames = [], nameAnnotations, lens = null, onUpdate, onClose, onAddDeliverable, onUpdateDeliverable, onLinkDeliverable, onUnlinkDeliverable, onUpdateLinkCoverage, onNavigateToDeliverable }: Props = $props()

	function updateSignalField(stage: Stage, perspective: Perspective, field: keyof CellSignal, value: string | Score) {
		onUpdate({
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
		})
	}





	// Compute gap prompts for the current stage
	const gapPrompts = $derived.by(() => {
		const stage = opportunity.stage

		// Deliver stage: no consent prompts (no signal grid)
		if (stage === 'deliver') return []

		const consent = stageConsent(opportunity)
		const prompts: { perspective: Perspective; question: string; isObjection: boolean }[] = []

		// Objections first
		for (const p of consent.objections) {
			prompts.push({
				perspective: p,
				question: `Objection: ${opportunity.signals[stage][p].verdict || 'resolve before advancing'}`,
				isObjection: true,
			})
		}

		// Then unheard perspectives
		for (const p of consent.unheard) {
			prompts.push({
				perspective: p,
				question: CELL_QUESTIONS[stage][p],
				isObjection: false,
			})
		}

		// Gate: decompose → deliver requires linked deliverables
		if (stage === 'decompose' && prompts.length === 0) {
			const gate = canAdvanceToDeliver(opportunity, links, deliverables)
			if (!gate.ok && gate.reason !== 'consent') {
				prompts.push({
					perspective: 'feasibility',
					question: gate.reason!,
					isObjection: false,
				})
			}
		}

		return prompts
	})

	// Snapshot prompts when ticket changes — resolved ones get strikethrough
	let snapshotPrompts: { perspective: Perspective; question: string; isObjection: boolean }[] = $state([])
	let lastOppId = $state('')

	$effect(() => {
		if (opportunity.id !== lastOppId) {
			lastOppId = opportunity.id
			snapshotPrompts = gapPrompts
		}
	})

	const displayPrompts = $derived.by(() => {
		const liveKeys = new Set(gapPrompts.map((p) => p.perspective))
		return snapshotPrompts.map((p) => ({
			...p,
			resolved: !liveKeys.has(p.perspective),
		}))
	})

	let editDescription = $state(opportunity.description)
	let editTitle = $state(opportunity.title)

	$effect(() => {
		editDescription = opportunity.description
	})

	$effect(() => {
		editTitle = opportunity.title
	})

	function assignPerspective(personId: string, perspective: Perspective, stage: Stage) {
		const current = perspectiveAssignment(opportunity, perspective, stage)
		if (current?.person.id === personId) {
			// Unassign
			onUpdate({
				...opportunity,
				people: opportunity.people.map((p) =>
					p.id === personId ? { ...p, perspectives: p.perspectives.filter((a) => !(a.perspective === perspective && a.stage === stage)) } : p
				),
			})
		} else {
			// Assign to new person, remove from previous
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

	function addPersonAndAssign(name: string, perspective: Perspective, stage: Stage) {
		const person: PersonLink = {
			id: crypto.randomUUID(),
			name,
			role: 'expert',
			perspectives: [{ perspective, stage, assignedAt: Date.now() }],
		}
		onUpdate({ ...opportunity, people: [...opportunity.people, person] })
	}



	let addingFor: { perspective: Perspective; stage: Stage } | null = $state(null)
	let expandedCells: Set<string> = $state(new Set())

	function cellKey(stage: Stage, perspective: Perspective): string {
		return `${stage}:${perspective}`
	}

	function toggleExpand(stage: Stage, perspective: Perspective) {
		const key = cellKey(stage, perspective)
		const next = new Set(expandedCells)
		if (next.has(key)) next.delete(key)
		else next.add(key)
		expandedCells = next
	}





	const urgency = $derived(commitmentUrgency(opportunity))

	// ── Deliverables ──

	let showExitMenu = $state(false)
	let exitReasonInput = $state('')
	let parkUntilInput = $state('')

	function handleExit(exitState: ExitState) {
		onUpdate({
			...opportunity,
			discontinuedAt: Date.now(),
			exitState,
			exitReason: exitReasonInput.trim() || undefined,
			parkUntil: exitState === 'parked' && parkUntilInput.trim() ? parkUntilInput.trim() : undefined,
		})
		showExitMenu = false
		exitReasonInput = ''
		parkUntilInput = ''
	}

	function scrollToCell(perspective: Perspective) {
		const id = `cell-${opportunity.stage}-${perspective}`
		scrollAndFlash(id)
	}

	function scrollAndFlash(id: string) {
		const el = document.getElementById(id)
		if (!el) return
		el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		el.classList.add('flash')
		setTimeout(() => el.classList.remove('flash'), 1200)
	}

	// Listen for keyboard-triggered exit menu
	$effect(() => {
		function onOpenExit() { if (!opportunity.discontinuedAt) showExitMenu = true }
		window.addEventListener('slim:open-exit-menu', onOpenExit)
		return () => window.removeEventListener('slim:open-exit-menu', onOpenExit)
	})
</script>

<div class="detail-pane" class:discontinued={!!opportunity.discontinuedAt}>
	<header class="pane-header">
		{#if opportunity.ticketId}<span class="pane-ticket-prefix">{opportunity.ticketId}</span>{/if}
		<input
			type="text"
			class="pane-title-input"
			bind:value={editTitle}
			onblur={() => { if (editTitle.trim() && editTitle !== opportunity.title) onUpdate({ ...opportunity, title: editTitle.trim() }) }}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
		/>
		<button class="close-btn" onclick={onClose} aria-label="Close">×</button>
	</header>

	<div class="pane-meta">
		{#if opportunity.discontinuedAt}
			<span class="stage-badge discontinued-badge">{EXIT_STATES.find((e) => e.key === opportunity.exitState)?.label ?? 'Discontinued'}</span>
			{#if opportunity.parkUntil}
				<span class="park-until-badge" title="Revisit at {opportunity.parkUntil}">until {opportunity.parkUntil}</span>
			{/if}
			{#if opportunity.exitReason}
				<span class="exit-reason" title={opportunity.exitReason}>{opportunity.exitReason}</span>
			{/if}
			<button class="btn-solid reactivate-btn" onclick={() => onUpdate({ ...opportunity, discontinuedAt: undefined, exitState: undefined, exitReason: undefined, parkUntil: undefined })}>↩ Reactivate</button>
		{:else}
			{#if prevStage(opportunity.stage)}
				<button
					class="btn-icon stage-back"
					onclick={() => { const prev = prevStage(opportunity.stage); if (prev) onUpdate({ ...opportunity, stage: prev, stageEnteredAt: Date.now() }) }}
					title="Move back to {STAGES.find((s) => s.key === prevStage(opportunity.stage))?.label}"
				>←</button>
			{/if}
			<span class="stage-badge">{STAGES.find((s) => s.key === opportunity.stage)?.label}</span>
			{@const aging = agingLevel(opportunity)}
			{@const days = daysInStage(opportunity)}
			{#if days > 0}
				<span class="aging-indicator aging-{aging}" title="{days} day{days === 1 ? '' : 's'} in {opportunity.stage}">{days}d</span>
			{/if}
			{#if nextStage(opportunity.stage)}
				{@const canAdvance = gapPrompts.length === 0}
				{@const objCount = gapPrompts.filter((p) => p.isObjection).length}
				{@const unheardCount = gapPrompts.filter((p) => !p.isObjection).length}
				<button
					class="advance-inline"
					class:ready={canAdvance}
					disabled={!canAdvance}
					onclick={() => { const next = nextStage(opportunity.stage); if (next) onUpdate({ ...opportunity, stage: next, stageEnteredAt: Date.now() }) }}
				>{#if canAdvance}→ {STAGES.find((s) => s.key === nextStage(opportunity.stage))?.label}{:else if objCount > 0}{objCount} objection{objCount > 1 ? 's' : ''} blocking{:else}{unheardCount} unheard{/if}</button>
			{:else}
				{@const allFulfilled = opportunity.stage === 'deliver' && opportunity.commitments.length > 0 && commitmentStatuses(opportunity).every(s => s.met)}
				{#if allFulfilled}
					<button class="advance-inline ready" onclick={() => { showExitMenu = true }}>✓ All commitments met — done?</button>
				{:else}
					<span class="stage-done">{opportunity.stage === 'deliver' ? 'In delivery' : '✓ fully assessed'}</span>
				{/if}
			{/if}
			{#if showExitMenu}
				<div class="exit-menu">
					<input type="text" class="exit-reason-input" placeholder="Why?" bind:value={exitReasonInput} onkeydown={(e) => { if (e.key === 'Escape') { showExitMenu = false; exitReasonInput = ''; parkUntilInput = '' } }} />
					<div class="exit-park-row">
						<button class="btn-solid exit-option" onclick={() => handleExit('parked')} title={EXIT_STATES.find(e => e.key === 'parked')!.description}>⏸ Park</button>
						<input type="text" class="park-until-input" placeholder="Revisit at…" list="horizon-options" bind:value={parkUntilInput} />
						<datalist id="horizon-options">
							{#each allHorizons as h}
								<option value={h}></option>
							{/each}
						</datalist>
					</div>
					{#each EXIT_STATES.filter(es => es.key !== 'parked' && (es.key !== 'done' || opportunity.stage === 'deliver')) as es}
						<button class="btn-solid exit-option" onclick={() => handleExit(es.key)} title={es.description}>{es.icon} {es.label}</button>
					{/each}
					<button class="btn-ghost exit-cancel" onclick={() => { showExitMenu = false; exitReasonInput = ''; parkUntilInput = '' }}>Cancel</button>
				</div>
			{:else}
				<button class="btn-ghost discontinue-btn" onclick={() => showExitMenu = true} title="{opportunity.stage === 'deliver' ? 'Done, kill, park, or merge this opportunity' : 'Kill, park, or merge this opportunity'}">Exit…</button>
			{/if}
		{/if}
	</div>

	<div class="pane-metadata">
		<div class="pane-origin">
			<span class="origin-label">Origin</span>
			<div class="origin-toggles">
				{#each ORIGIN_TYPES as ot}
					<button
						class="origin-btn"
						class:active={opportunity.origin === ot.key}
						title={ot.description}
						onclick={() => onUpdate({ ...opportunity, origin: opportunity.origin === ot.key ? undefined : ot.key })}
					>{ot.label}</button>
				{/each}
			</div>
		</div>
		<div class="pane-horizon">
			<label class="horizon-label" for="horizon-input">Horizon</label>
			<input
				id="horizon-input"
				class="horizon-input"
				type="text"
				list="horizon-options"
				value={opportunity.horizon}
				onchange={(e) => {
					const v = (e.target as HTMLInputElement).value.trim()
					if (v && v !== opportunity.horizon) onUpdate({ ...opportunity, horizon: v })
				}}
				onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
			/>
			<datalist id="horizon-options">
				{#each allHorizons as h}
					<option value={h}></option>
				{/each}
			</datalist>
		</div>
	</div>

	{#if displayPrompts.length > 0}
		{@const allResolved = displayPrompts.every((p) => p.resolved)}
		{@const hasObjection = displayPrompts.some((p) => p.isObjection && !p.resolved)}
		<div class="gap-prompts" class:has-objection={hasObjection} class:all-resolved={allResolved}>
			{#each displayPrompts as prompt}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="gap-prompt" class:resolved={prompt.resolved} role="button" tabindex="0" onclick={() => scrollToCell(prompt.perspective)}>
					<span class="gap-dot dot-{prompt.perspective}" class:objection={prompt.isObjection && !prompt.resolved}></span>
					<span class="gap-question">{prompt.question}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if urgency && urgency.daysLeft <= 14}
		<div class="gap-prompts" class:has-objection={urgency.daysLeft < 0}>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="gap-prompt" role="button" tabindex="0" onclick={() => scrollAndFlash('commitments-section')}>
				<span class="gap-dot" class:objection={urgency.daysLeft < 0} style="background: var(--c-accent)"></span>
				<span class="gap-question">
					{STAGES.find((s) => s.key === urgency.commitment.milestone)?.label} promised to {urgency.commitment.to} — {formatDaysLeft(urgency.daysLeft)}
				</span>
			</div>
		</div>
	{/if}

	{#if opportunity.stage === 'deliver'}
		<!-- Deliver stage: commitments first, then deliverables, then evidence trail -->
		<CommitmentsAndPeople {opportunity} {knownNames} {nameAnnotations} {onUpdate} />

		<DeliverablesSection
			{opportunity}
			{deliverables}
			{links}
			{onUpdate}
			{onAddDeliverable}
			{onLinkDeliverable}
			{onUnlinkDeliverable}
			{onUpdateLinkCoverage}
			{onNavigateToDeliverable}
		/>

		{#if stageIndex(opportunity.stage) > 0}
			<div class="signal-grid">
				<div class="history-section">
					<div class="section-heading">
						<span class="section-heading-label">Evidence trail</span>
					</div>
					{#each PERSPECTIVES as p}
						{@const completedStages = STAGES.filter((_, i) => i < stageIndex(opportunity.stage))}
						{@const hasAny = completedStages.some(s => cellHasSignal(opportunity.signals[s.key][p]))}
						{#if hasAny}
							<div class="history-perspective">
								<span class="history-perspective-label">{PERSPECTIVE_LABELS[p]}</span>
								{#each completedStages as stage}
									{@const signal = opportunity.signals[stage.key][p]}
									{@const delegation = perspectiveAssignment(opportunity, p, stage.key)}
									{#if cellHasSignal(signal)}
										<div class="history-verdict">
											<span class="history-stage">{stage.label}</span>
											<span class="score-btn-mini {scoreClass(signal.score)}" role="img" aria-label="{SCORE_DISPLAY[signal.score].label}">{SCORE_SYMBOL[signal.score]}</span>
											<span class="history-verdict-text">{signal.verdict || '—'}{#if delegation}<span class="compact-owner"> ({delegation.person.name})</span>{/if}</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<label class="pane-field">
			<span class="pane-label">Notes</span>
			<textarea
				class="desc-input"
				placeholder="Notes…"
				bind:value={editDescription}
				onblur={() => { if (editDescription !== opportunity.description) onUpdate({ ...opportunity, description: editDescription }) }}
				rows="2"
			></textarea>
		</label>
	{:else}
		<!-- Explore–Decompose: standard layout -->
		<div class="signal-grid">
		<!-- Section 1: Current Stage — action rows for all perspectives -->
		<div class="current-stage-section">
			<div class="section-heading">
				<span class="section-heading-label">{STAGES.find(s => s.key === opportunity.stage)?.label}</span>
			</div>
			{#each PERSPECTIVES as p}
				{@const signal = opportunity.signals[opportunity.stage][p]}
				{@const delegation = perspectiveAssignment(opportunity, p, opportunity.stage)}
				{@const isAdding = addingFor?.perspective === p && addingFor?.stage === opportunity.stage}
				<div id="cell-{opportunity.stage}-{p}" class="signal-row-edit current-stage">
					<div class="cell-header">
						<span class="cell-question">{CELL_QUESTIONS[opportunity.stage][p]}</span>
						<span class="cell-meta">
							<span class="cell-perspective">{PERSPECTIVE_LABELS[p]}</span>
							<span class="row-delegation">
								{#if delegation}
									{@const hasResponded = cellHasSignal(signal)}
									<span class="delegation" class:responded={hasResponded}>
										{delegation.person.name}
										{#if hasResponded}
											✓
										{:else}
											{@const daysAgo = Math.floor((Date.now() - delegation.assignment.assignedAt) / 86_400_000)}
											{daysAgo === 0 ? '·today' : `·${daysAgo}d`}
										{/if}
									</span>
									<button class="unassign-btn visible" onclick={() => assignPerspective(delegation.person.id, p, opportunity.stage)} title="Unassign">×</button>
								{:else if isAdding}
									<span class="assign-inline">
										{#if opportunity.people.length > 0}
											<select class="assign-select" onchange={(e) => {
												const val = (e.target as HTMLSelectElement).value
												if (val === '__new__') {
													// MemberPicker handles new name entry
												} else if (val) {
													assignPerspective(val, p, opportunity.stage)
													addingFor = null
												}
											}}>
												<option value="">Pick…</option>
												{#each opportunity.people as person}
													<option value={person.id}>{person.name}</option>
												{/each}
												<option value="__new__">+ New</option>
											</select>
										{/if}
										{#if opportunity.people.length === 0 || isAdding}
											<MemberPicker
												{knownNames}
												annotations={nameAnnotations}
												placeholder="Name…"
												inputClass="assign-name-input"
												onPick={(name) => {
													addPersonAndAssign(name, p, opportunity.stage)
													addingFor = null
												}}
											/>
										{/if}
										<button class="assign-cancel" onclick={() => { addingFor = null }}>×</button>
									</span>
								{:else}
									<button class="assign-btn" onclick={() => addingFor = { perspective: p, stage: opportunity.stage }}>+ ask</button>
								{/if}
							</span>
						</span>
					</div>
					<input
						type="text"
						class="verdict-input"
						placeholder="Your verdict…"
						value={signal.verdict}
						oninput={(e) => updateSignalField(opportunity.stage, p, 'verdict', (e.target as HTMLInputElement).value)}
					/>
					<ScoreToggle
						score={signal.score}
						label="{PERSPECTIVE_LABELS[p]} — {STAGES.find(s => s.key === opportunity.stage)?.label}"
						onScoreChange={(s) => updateSignalField(opportunity.stage, p, 'score', s)}
						expanded
					/>
				</div>
			{/each}
		</div>

		<!-- Section 2: History — completed stage verdicts as readable document -->
		{#if stageIndex(opportunity.stage) > 0}
			<div class="history-section">
				<div class="section-heading">
					<span class="section-heading-label">Verdicts</span>
				</div>
				{#each PERSPECTIVES as p}
					{@const completedStages = STAGES.filter((_, i) => i < stageIndex(opportunity.stage))}
					{@const hasAny = completedStages.some(s => cellHasSignal(opportunity.signals[s.key][p]))}
					{#if hasAny}
						<div class="history-perspective">
							<span class="history-perspective-label">{PERSPECTIVE_LABELS[p]}</span>
							{#each completedStages as stage}
								{@const signal = opportunity.signals[stage.key][p]}
								{@const delegation = perspectiveAssignment(opportunity, p, stage.key)}
								{@const isExpanded = expandedCells.has(cellKey(stage.key, p))}
								{#if cellHasSignal(signal)}
									{#if !isExpanded}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<div class="history-verdict" role="button" tabindex="0" onclick={() => toggleExpand(stage.key, p)} title="Click to edit">
											<span class="history-stage">{stage.label}</span>
											<span class="score-btn-mini {scoreClass(signal.score)}" role="img" aria-label="{SCORE_DISPLAY[signal.score].label}">{SCORE_SYMBOL[signal.score]}</span>
											<span class="history-verdict-text">{signal.verdict || '—'}{#if delegation}<span class="compact-owner"> ({delegation.person.name})</span>{/if}</span>
										</div>
									{:else}
										<div id="cell-{stage.key}-{p}" class="signal-row-edit completed-stage">
											<div class="signal-row-top">
												<span class="signal-stage">{stage.label}</span>
												{#if signal.score !== 'none'}
													<span class="score-label score-label-{signal.score}">{SCORE_DISPLAY[signal.score].label}</span>
												{/if}
												<span class="row-delegation">
													{#if delegation}
														{@const hasResponded = cellHasSignal(signal)}
														<span class="delegation" class:responded={hasResponded}>
															{delegation.person.name}
															{#if hasResponded}✓{/if}
														</span>
													{/if}
												</span>
												<ScoreToggle
													score={signal.score}
													label="{PERSPECTIVE_LABELS[p]} — {stage.label}"
													onScoreChange={(s) => updateSignalField(stage.key, p, 'score', s)}
												/>
											</div>
											<div class="verdict-field">
												<label class="verdict-label">{CELL_QUESTIONS[stage.key][p]}</label>
												<input
													type="text"
													class="verdict-input"
													placeholder="Your verdict…"
													value={signal.verdict}
													oninput={(e) => updateSignalField(stage.key, p, 'verdict', (e.target as HTMLInputElement).value)}
												/>
											</div>
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<span class="history-collapse" role="button" tabindex="0" onclick={() => toggleExpand(stage.key, p)}>collapse</span>
										</div>
									{/if}
								{/if}
							{/each}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<CommitmentsAndPeople {opportunity} {knownNames} {nameAnnotations} {onUpdate} />

	<label class="pane-field">
		<span class="pane-label">Notes</span>
		<textarea
			class="desc-input"
			placeholder="Notes…"
			bind:value={editDescription}
			onblur={() => { if (editDescription !== opportunity.description) onUpdate({ ...opportunity, description: editDescription }) }}
			rows="2"
		></textarea>
	</label>

	<DeliverablesSection
		{opportunity}
		{deliverables}
		{links}
		{onUpdate}
		{onAddDeliverable}
		{onLinkDeliverable}
		{onUnlinkDeliverable}
		{onUpdateLinkCoverage}
		{onNavigateToDeliverable}
	/>
	{/if}
</div>

<style>
	.detail-pane {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-md);
		gap: var(--sp-sm);
		font-family: var(--font-reading);
	}

	/* Title stays in the sketch font for visual continuity */
	.pane-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
	}

	.pane-title-input {
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

	.pane-title-input:hover {
		border-bottom-color: var(--c-border);
	}

	.pane-title-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.close-btn {
		flex-shrink: 0;
		font-family: var(--font);
		font-size: var(--fs-xl);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 4px;
		line-height: var(--lh-tight);
	}

	.close-btn:hover {
		color: var(--c-text);
	}

	.pane-meta {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--c-border);
	}

	.pane-horizon {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.pane-horizon .horizon-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		flex-shrink: 0;
		font-weight: var(--fw-medium);
	}

	.pane-horizon .horizon-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: 1px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		width: 100px;
		outline: none;
		transition: border-color var(--tr-fast);
	}

	.pane-horizon .horizon-input:focus {
		border-color: var(--c-accent);
		border-style: solid;
	}

	.pane-ticket-prefix {
		flex-shrink: 0;
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}

	.stage-badge {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		background: var(--c-neutral-bg-light);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
	}

	.stage-back {
		font-size: var(--fs-2xs);
	}

	.stage-back:hover {
		color: var(--c-text);
		background: var(--c-neutral-bg-light);
	}

	.discontinued-badge {
		background: color-mix(in srgb, var(--c-red) var(--opacity-moderate), transparent);
		color: var(--c-red);
	}

	.discontinue-btn {
		margin-left: auto;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.discontinue-btn:hover {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) var(--opacity-subtle), transparent);
	}

	.reactivate-btn {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		border-style: dashed;
	}

	.reactivate-btn:hover {
		color: var(--c-text);
		border-color: var(--c-text-muted);
	}

	.exit-reason {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-style: italic;
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.exit-menu {
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
		margin-left: auto;
		align-items: center;
	}

	.exit-reason-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--c-border);
		padding: 2px 0;
		width: 100px;
		outline: none;
		transition: border-color var(--tr-fast);
	}

	.exit-reason-input:focus {
		border-bottom-color: var(--c-accent);
	}

	.exit-reason-input::placeholder {
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.exit-park-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.park-until-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--c-border);
		padding: 2px 0;
		width: 90px;
		outline: none;
		transition: border-color var(--tr-fast);
	}

	.park-until-input:focus {
		border-bottom-color: var(--c-accent);
	}

	.park-until-input::placeholder {
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.park-until-badge {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
	}

	.exit-option:hover {
		background: color-mix(in srgb, var(--c-red) var(--opacity-moderate), transparent);
		border-color: var(--c-red);
	}

	.exit-cancel {
		border-style: dashed;
	}

	.aging-indicator {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.aging-fresh { color: var(--c-green-signal); }
	.aging-aging { color: var(--c-warm); }
	.aging-stale { color: var(--c-red); }

	.pane-metadata {
		display: flex;
		gap: var(--sp-md);
		align-items: center;
		flex-wrap: wrap;
		padding: var(--sp-xs) 0;
	}

	.pane-origin {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.origin-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		white-space: nowrap;
		font-weight: var(--fw-medium);
	}

	.origin-toggles {
		display: flex;
		gap: 2px;
	}

	.origin-btn {
		font-size: var(--fs-xs);
		font-family: var(--font);
		background: none;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
		color: var(--c-text-muted);
		transition: background var(--tr-fast), color var(--tr-fast), border-color var(--tr-fast);
	}

	.origin-btn:hover {
		background: var(--c-surface-alt);
		color: var(--c-text);
	}

	.origin-btn.active {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
		color: var(--c-accent);
		border-color: var(--c-accent);
	}

	.detail-pane.discontinued {
		opacity: 0.7;
	}

	/* --- Gap prompts: the reason you clicked --- */

	.gap-prompts {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--c-warm-bg);
		border-left: 3px solid var(--c-warm-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.gap-prompts.balanced {
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-subtle), transparent);
		border-left-color: var(--c-green-signal);
	}

	.gap-prompts.all-resolved {
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-subtle), transparent);
		border-left-color: var(--c-green-signal);
	}

	.gap-prompt.resolved .gap-question {
		text-decoration: line-through;
		color: var(--c-text-ghost);
	}

	.gap-prompt.resolved .gap-dot {
		opacity: 0.3;
	}

	.advance-inline {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-ghost);
		background: none;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: default;
		font-family: var(--font);
		transition: color var(--tr-fast), border-color var(--tr-fast), background var(--tr-fast);
	}

	.advance-inline:disabled {
		opacity: 0.5;
	}

	.advance-inline.ready {
		color: var(--c-green-signal);
		border: 1px solid color-mix(in srgb, var(--c-green-signal) var(--opacity-strong), transparent);
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-subtle), transparent);
		cursor: pointer;
		opacity: 1;
	}

	.advance-inline.ready:hover {
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-moderate), transparent);
	}

	.stage-done {
		font-size: var(--fs-2xs);
		color: var(--c-green-signal);
		font-weight: var(--fw-medium);
	}

	.gap-prompts.has-objection {
		background: color-mix(in srgb, var(--c-red) var(--opacity-subtle), transparent);
		border-left-color: var(--c-red);
	}

	.gap-prompt {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		cursor: pointer;
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-xs);
		margin: 0 calc(-1 * var(--sp-xs));
		transition: background var(--tr-fast);
	}

	.gap-prompt::after {
		content: '↓';
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		opacity: 0;
		transition: opacity var(--tr-fast);
		margin-left: auto;
	}

	.gap-prompt:hover:not(.resolved)::after {
		opacity: 1;
	}

	.gap-prompt:hover:not(.resolved) {
		background: color-mix(in srgb, var(--c-warm) var(--opacity-moderate), transparent);
	}

	.gap-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.gap-dot.dot-desirability { background: var(--c-red); }
	.gap-dot.dot-feasibility { background: var(--c-warm); }
	.gap-dot.dot-viability { background: var(--c-text-muted); }
	.gap-dot.objection { outline: 2px solid var(--c-red); outline-offset: 1px; }

	.gap-question {
		font-size: var(--fs-xs);
		color: var(--c-text);
		font-style: italic;
	}

	/* --- Notes --- */

	.desc-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs);
		resize: vertical;
		min-height: 2.4em;
		transition: border-color var(--tr-fast);
	}

	.desc-input:focus {
		outline: none;
		border-color: var(--c-border);
	}

	.desc-input::placeholder {
		color: var(--c-text-ghost);
	}

	.pane-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pane-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}

	/* --- Signal grid: action-first layout --- */

	.signal-grid {
		display: flex;
		flex-direction: column;
		gap: var(--sp-lg);
		background: var(--c-bg);
		padding: var(--sp-sm);
		border-radius: var(--radius-sm);
		margin-top: var(--sp-xs);
	}

	.section-heading {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding-bottom: 2px;
		border-bottom: 1px solid var(--c-border-soft);
		margin-bottom: var(--sp-xs);
	}

	.section-heading-label {
		font-family: var(--font);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.current-stage-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.signal-perspective-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		min-width: 5em;
	}

	/* History section */

	.history-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}

	.history-perspective {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.history-perspective-label {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 1px;
	}

	.history-verdict {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: 2px 0;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.history-verdict:hover {
		background: color-mix(in srgb, var(--c-text) var(--opacity-subtle), transparent);
	}

	.history-stage {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		min-width: 4em;
	}

	.history-verdict-text {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.history-collapse {
		font-family: var(--font);
		font-size: var(--fs-3xs);
		color: var(--c-accent);
		cursor: pointer;
		align-self: flex-end;
	}

	.history-collapse:hover {
		text-decoration: underline;
	}

	.delegation {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-normal);
		color: var(--c-warm);
		font-style: italic;
		white-space: nowrap;
	}

	.delegation.responded {
		color: var(--c-green-signal);
	}

	.row-delegation {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
		flex-shrink: 0;
	}

	.assign-btn {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		color: var(--c-accent);
		background: none;
		border: 1px dashed color-mix(in srgb, var(--c-accent) var(--opacity-emphasis), transparent);
		border-radius: var(--radius-sm);
		padding: 0 var(--sp-xs);
		cursor: pointer;
		line-height: var(--lh-relaxed);
		white-space: nowrap;
		transition: color var(--tr-fast), border-color var(--tr-fast), background var(--tr-fast);
	}

	.assign-btn:hover {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), transparent);
		border-color: var(--c-accent);
	}

	.unassign-btn {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
		line-height: var(--lh-tight);
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.unassign-btn.visible {
		opacity: 0.5;
	}

	.unassign-btn.visible:hover,
	.signal-row-edit:hover .unassign-btn {
		opacity: 1;
		color: var(--c-red);
	}

	.assign-inline {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.assign-select {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.assign-name-input {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--c-border);
		padding: 1px 2px;
		width: 6em;
	}

	.assign-name-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.assign-cancel {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
	}

	.signal-row-edit {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-xs) 0;
	}

	.signal-row-edit.current-stage {
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs);
		margin: 0 calc(-1 * var(--sp-xs));
	}

	.signal-row-edit.completed-stage {
		opacity: 0.85;
	}

	.signal-row-edit.completed-stage:hover {
		opacity: 1;
	}

	.signal-row-edit.flash {
		animation: cell-flash 1.2s ease-out;
	}

	@keyframes cell-flash {
		0%, 15% { background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent); }
		100% { background: transparent; }
	}

	.signal-row-compact {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: 1px 0;
		cursor: pointer;
		opacity: 0.7;
		transition: opacity var(--tr-fast);
	}

	.signal-row-compact:hover {
		opacity: 1;
	}

	.score-btn-mini {
		width: var(--dot-size-md);
		height: var(--dot-size-md);
		border-radius: 50%;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 8px;
		font-weight: var(--fw-bold);
		color: var(--c-surface);
		line-height: var(--lh-tight);
	}

	.score-btn-mini.score-none {
		background: var(--c-neutral-bg);
		border: 1.5px dashed var(--c-border);
		color: var(--c-text-ghost);
	}

	.score-btn-mini.score-positive { background: var(--c-green-signal); }
	.score-btn-mini.score-uncertain { background: var(--c-warm); }
	.score-btn-mini.score-negative { background: var(--c-red); }

	.compact-verdict {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.compact-owner {
		color: var(--c-text-muted);
	}

	.cell-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--sp-sm);
	}

	.cell-question {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		font-style: italic;
		line-height: var(--lh-reading, 1.5);
		flex: 1;
	}

	.cell-meta {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-shrink: 0;
	}

	.cell-perspective {
		font-family: var(--font);
		font-size: var(--fs-3xs);
		color: var(--c-text-ghost);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.signal-row-edit .verdict-input {
		margin-left: 0;
	}

	.signal-row-edit.current-stage .verdict-input {
		font-family: var(--font-reading);
		font-size: var(--fs-sm);
		color: var(--c-text);
		padding: var(--sp-xs) 0;
		border-bottom-width: 1.5px;
	}

	/* History (completed-stage) edit rows */
	.signal-row-top {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.score-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		font-style: italic;
		opacity: 0.45;
	}

	.score-label-positive { color: var(--c-green-signal); }
	.score-label-uncertain { color: var(--c-warm); }
	.score-label-negative { color: var(--c-red); }

	.verdict-field {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.verdict-label {
		font-family: var(--font);
		font-size: var(--fs-3xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.signal-stage {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		min-width: 4em;
	}

	.verdict-input {
		font-family: var(--font-reading);
		font-size: var(--fs-2xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
		padding: 1px 0;
		width: 100%;
		transition: border-color var(--tr-fast);
	}

	.verdict-input:focus {
		outline: none;
		border-bottom-color: var(--c-border);
	}

	.verdict-input::placeholder {
		color: var(--c-text-ghost);
		font-style: italic;
	}
</style>
