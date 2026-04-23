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
		STAGES,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		CELL_QUESTIONS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		EXIT_STATES,
		ORIGIN_TYPES,
		cellHasSignal,
		nextStage,
		prevStage,
		perspectiveWeight,
		perspectiveAssignment,
		commitmentUrgency,
		stageConsent,
		stageIndex,
		linksForOpportunity,
		daysInStage,
		agingLevel,
	} from '../lib/types'

	interface Props {
		opportunity: Opportunity
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		allHorizons?: string[]
		onUpdate: (opportunity: Opportunity) => void
		onClose: () => void
		onAddDeliverable: (title: string) => Deliverable
		onUpdateDeliverable: (deliverable: Deliverable) => void
		onLinkDeliverable: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
		onUnlinkDeliverable: (opportunityId: string, deliverableId: string) => void
		onUpdateLinkCoverage: (opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') => void
	}

	let { opportunity, deliverables, links, allHorizons = [], onUpdate, onClose, onAddDeliverable, onUpdateDeliverable, onLinkDeliverable, onUnlinkDeliverable, onUpdateLinkCoverage }: Props = $props()

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

	// Compute gap prompts for the current stage
	const gapPrompts = $derived.by(() => {
		const stage = opportunity.stage
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
	let newPersonName = $state('')
	let expandedCells: Set<string> = $state(new Set())
	let collapsedPerspectives: Set<Perspective> = $state(new Set())

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

	function togglePerspective(p: Perspective) {
		const next = new Set(collapsedPerspectives)
		if (next.has(p)) next.delete(p)
		else next.add(p)
		collapsedPerspectives = next
	}

	// Commitment management
	let showAddCommitment = $state(false)
	let commitTo = $state('')
	let commitMilestone: Stage = $state('sketch')
	let commitByDate = $state('')

	function addCommitment() {
		const trimmed = commitTo.trim()
		if (!trimmed || !commitByDate) return
		const commitment: Commitment = {
			id: crypto.randomUUID(),
			to: trimmed,
			milestone: commitMilestone,
			by: new Date(commitByDate).getTime(),
		}
		onUpdate({ ...opportunity, commitments: [...opportunity.commitments, commitment] })
		commitTo = ''
		commitByDate = ''
		showAddCommitment = false
	}

	function removeCommitment(id: string) {
		onUpdate({ ...opportunity, commitments: opportunity.commitments.filter((c) => c.id !== id) })
	}

	function formatDaysLeft(daysLeft: number): string {
		if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`
		if (daysLeft === 0) return 'due today'
		return `${daysLeft}d left`
	}

	const urgency = $derived(commitmentUrgency(opportunity))

	// ── Deliverables ──

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

	let showExitMenu = $state(false)
	let exitReasonInput = $state('')

	function handleExit(exitState: ExitState) {
		onUpdate({
			...opportunity,
			discontinuedAt: Date.now(),
			exitState,
			exitReason: exitReasonInput.trim() || undefined,
		})
		showExitMenu = false
		exitReasonInput = ''
	}

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
		window.addEventListener('upstream:open-exit-menu', onOpenExit)
		return () => window.removeEventListener('upstream:open-exit-menu', onOpenExit)
	})
</script>

<div class="detail-pane" class:discontinued={!!opportunity.discontinuedAt}>
	<header class="pane-header">
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
			{#if opportunity.exitReason}
				<span class="exit-reason" title={opportunity.exitReason}>{opportunity.exitReason}</span>
			{/if}
			<button class="reactivate-btn" onclick={() => onUpdate({ ...opportunity, discontinuedAt: undefined, exitState: undefined, exitReason: undefined })}>↩ Reactivate</button>
		{:else}
			{#if prevStage(opportunity.stage)}
				<button
					class="stage-back"
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
				<span class="stage-done">✓ fully assessed</span>
			{/if}
			{#if showExitMenu}
				<div class="exit-menu">
					<input type="text" class="exit-reason-input" placeholder="Why?" bind:value={exitReasonInput} onkeydown={(e) => { if (e.key === 'Escape') { showExitMenu = false; exitReasonInput = '' } }} />
					{#each EXIT_STATES as es}
						<button class="exit-option" onclick={() => handleExit(es.key)} title={es.description}>{es.icon} {es.label}</button>
					{/each}
					<button class="exit-cancel" onclick={() => { showExitMenu = false; exitReasonInput = '' }}>Cancel</button>
				</div>
			{:else}
				<button class="discontinue-btn" onclick={() => showExitMenu = true}>✗</button>
			{/if}
		{/if}
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

	<textarea
		class="desc-input"
		placeholder="Notes…"
		bind:value={editDescription}
		onblur={() => { if (editDescription !== opportunity.description) onUpdate({ ...opportunity, description: editDescription }) }}
		rows="2"
	></textarea>

	<div class="signal-grid">
		{#each PERSPECTIVES as p}
			{@const hasAnySignal = STAGES.some((s) => cellHasSignal(opportunity.signals[s.key][p]))}
			{@const currentSI = stageIndex(opportunity.stage)}
			{@const isCollapsed = collapsedPerspectives.has(p)}
			<div class="perspective-section">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="perspective-label" role="button" tabindex="0" onclick={() => togglePerspective(p)}>
					<span class="perspective-toggle">{isCollapsed ? '▸' : '▾'}</span>
					{PERSPECTIVE_LABELS[p]}
					{#if isCollapsed}
						<span class="perspective-summary">
							{#each STAGES as stage}
								{@const sig = opportunity.signals[stage.key][p]}
								{#if cellHasSignal(sig)}
									<span class="score-btn-mini {scoreClass(sig.score)}">{SCORE_SYMBOL[sig.score]}</span>
								{/if}
							{/each}
						</span>
					{/if}
				</div>
				{#if !isCollapsed}
				{#each STAGES as stage, i}
					{@const state = rowState(stage.key)}
					{@const signal = opportunity.signals[stage.key][p]}
					{@const delegation = perspectiveAssignment(opportunity, p, stage.key)}
					{@const isAdding = addingFor?.perspective === p && addingFor?.stage === stage.key}
					{#if state !== 'future' || cellHasSignal(signal)}
						{#if state === 'completed' && !expandedCells.has(cellKey(stage.key, p))}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="signal-row-compact" role="button" tabindex="0" onclick={() => toggleExpand(stage.key, p)} title="Click to edit">
							<span class="score-btn-mini {scoreClass(signal.score)}">{SCORE_SYMBOL[signal.score]}</span>
							<span class="compact-verdict">{signal.verdict || '—'}{#if delegation}<span class="compact-owner"> ({delegation.person.name})</span>{/if}</span>
						</div>
						{:else}
						<div id="cell-{stage.key}-{p}" class="signal-row-edit" class:current-stage={state === 'current'} class:completed-stage={state === 'completed'}>
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
											{#if hasResponded}
												✓
											{:else}
												{@const daysAgo = Math.floor((Date.now() - delegation.assignment.assignedAt) / 86_400_000)}
												{daysAgo === 0 ? '·today' : `·${daysAgo}d`}
											{/if}
										</span>
										<button class="unassign-btn visible" onclick={() => assignPerspective(delegation.person.id, p, stage.key)} title="Unassign">×</button>
									{:else if isAdding}
										<span class="assign-inline">
											{#if opportunity.people.length > 0}
												<select class="assign-select" onchange={(e) => {
													const val = (e.target as HTMLSelectElement).value
													if (val === '__new__') {
														newPersonName = ''
													} else if (val) {
														assignPerspective(val, p, stage.key)
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
												<input
													type="text"
													class="assign-name-input"
													placeholder="Name…"
													bind:value={newPersonName}
													onkeydown={(e) => {
														if (e.key === 'Enter' && newPersonName.trim()) {
															addPersonAndAssign(newPersonName.trim(), p, stage.key)
															addingFor = null
															newPersonName = ''
														}
														if (e.key === 'Escape') { addingFor = null; newPersonName = '' }
													}}
												/>
											{/if}
											<button class="assign-cancel" onclick={() => { addingFor = null; newPersonName = '' }}>×</button>
										</span>
									{:else}
										<button class="assign-btn" onclick={() => addingFor = { perspective: p, stage: stage.key }}>+ ask</button>
									{/if}
								</span>
								<div class="score-toggle" role="radiogroup" aria-label="{PERSPECTIVE_LABELS[p]} — {stage.label}">
									{#each (['none', 'positive', 'uncertain', 'negative'] as const) as s}
										<button
											class="score-btn {scoreClass(s)}"
											class:active={signal.score === s}
											onclick={() => updateSignalField(stage.key, p, 'score', s)}
											title={SCORE_DISPLAY[s].label}
											aria-pressed={signal.score === s}
										>{SCORE_SYMBOL[s]}</button>
									{/each}
								</div>
							</div>
							<input
								type="text"
								class="verdict-input"
								placeholder={CELL_QUESTIONS[stage.key][p]}
								value={signal.verdict}
								oninput={(e) => updateSignalField(stage.key, p, 'verdict', (e.target as HTMLInputElement).value)}
							/>
						</div>
						{/if}
					{/if}
				{/each}
				{/if}
			</div>
		{/each}
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

	{#if opportunity.commitments.length > 0 || showAddCommitment}
		<div id="commitments-section" class="commitments-section">
			{#each opportunity.commitments as c (c.id)}
				{@const si = stageIndex(opportunity.stage)}
				{@const met = stageIndex(c.milestone) < si}
				{@const daysLeft = Math.ceil((c.by - Date.now()) / 86_400_000)}
				<div class="commitment-row" class:met class:overdue={!met && daysLeft < 0} class:urgent={!met && daysLeft >= 0 && daysLeft <= 7}>
					<span class="commitment-text">
						{STAGES.find((s) => s.key === c.milestone)?.label} for {c.to}
					</span>
					<span class="commitment-deadline">
						{#if met}
							✓ met
						{:else}
							{formatDaysLeft(daysLeft)}
						{/if}
					</span>
					<button class="commitment-remove" onclick={() => removeCommitment(c.id)} aria-label="Remove commitment">×</button>
				</div>
			{/each}
			{#if showAddCommitment}
				<div class="commitment-add-form">
					<input type="text" class="commitment-input" placeholder="Promised to…" bind:value={commitTo} />
					<select class="commitment-select" bind:value={commitMilestone}>
						{#each STAGES as stage}
							<option value={stage.key}>{stage.label}</option>
						{/each}
					</select>
					<input type="date" class="commitment-date" bind:value={commitByDate} />
					<button class="commitment-save" onclick={addCommitment} disabled={!commitTo.trim() || !commitByDate}>✓</button>
					<button class="commitment-cancel" onclick={() => { showAddCommitment = false; commitTo = ''; commitByDate = '' }}>×</button>
				</div>
			{/if}
		</div>
	{/if}
	{#if !showAddCommitment}
		<button class="add-commitment-btn" onclick={() => showAddCommitment = true}>+ promise</button>
	{/if}

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
				{@const consumers = [...new Set([...opportunity.people.filter((p) => p.role === 'stakeholder' || p.role === 'blocker').map((p) => p.name), ...deliverable.extraConsumers])]}
				<div class="deliverable-row">
					<button
						class="coverage-toggle"
						class:full={link.coverage === 'full'}
						onclick={() => onUpdateLinkCoverage(opportunity.id, deliverable.id, link.coverage === 'full' ? 'partial' : 'full')}
						title={link.coverage === 'full' ? 'Full coverage — click to mark partial' : 'Partial coverage — click to mark full'}
					>{link.coverage === 'full' ? '●' : '◐'}</button>
					<span class="deliverable-title">{#if deliverable.externalUrl}<a href={deliverable.externalUrl} target="_blank" rel="noopener">{deliverable.title}</a>{:else}{deliverable.title}{/if}</span>
					{#if consumers.length > 0}
						<span class="deliverable-stakeholders" title="Present to: {consumers.join(', ')}">→ {consumers.join(', ')}</span>
					{/if}
					<button class="deliverable-unlink" onclick={() => onUnlinkDeliverable(opportunity.id, deliverable.id)} title="Unlink">×</button>
				</div>
			{/each}
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
		</div>
	{/if}
</div>

<style>
	.detail-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		padding: var(--sp-md);
		gap: var(--sp-sm);
		font-family: var(--font-reading);
	}

	/* Title stays in the sketch font for visual continuity */
	.pane-header {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-sm);
	}

	.pane-title-input {
		flex: 1;
		margin: 0;
		font-family: var(--font);
		font-size: var(--fs-xl);
		font-weight: 700;
		color: var(--c-text);
		line-height: 1.3;
		background: transparent;
		border: none;
		border-bottom: 1px solid transparent;
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
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--c-text);
	}

	.pane-meta {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.pane-horizon {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-top: var(--sp-xs);
	}

	.pane-horizon .horizon-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.pane-horizon .horizon-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: 1px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-xs);
		width: 100px;
		outline: none;
		transition: border-color var(--tr-fast);
	}

	.pane-horizon .horizon-input:focus {
		border-color: var(--c-accent);
		border-style: solid;
	}

	.stage-badge {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--c-text);
		background: var(--c-neutral-bg-light);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
	}

	.stage-back {
		font-size: 0.7rem;
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 4px;
		font-family: var(--font);
		border-radius: var(--radius-sm);
		transition: color var(--tr-fast), background var(--tr-fast);
	}

	.stage-back:hover {
		color: var(--c-text);
		background: var(--c-neutral-bg-light);
	}

	.discontinued-badge {
		background: color-mix(in srgb, var(--c-red) 12%, transparent);
		color: var(--c-red);
	}

	.discontinue-btn {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-family: var(--font);
		transition: color var(--tr-fast), background var(--tr-fast);
	}

	.discontinue-btn:hover {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) 8%, transparent);
	}

	.reactivate-btn {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--c-text-muted);
		background: none;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
		font-family: var(--font);
		transition: color var(--tr-fast), border-color var(--tr-fast);
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
		font-family: var(--font-reading);
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

	.exit-option {
		font-size: var(--fs-xs);
		font-family: var(--font);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
		transition: background var(--tr-fast), border-color var(--tr-fast);
	}

	.exit-option:hover {
		background: color-mix(in srgb, var(--c-red) 10%, transparent);
		border-color: var(--c-red);
	}

	.exit-cancel {
		font-size: var(--fs-xs);
		font-family: var(--font);
		background: none;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius-sm);
		padding: 2px var(--sp-xs);
		cursor: pointer;
		color: var(--c-text-muted);
	}

	.aging-indicator {
		font-size: var(--fs-xs);
		font-weight: 600;
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
		border-top: 1px dashed var(--c-border);
		margin-top: var(--sp-xs);
	}

	.pane-origin {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.origin-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		white-space: nowrap;
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
		background: color-mix(in srgb, var(--c-accent) 15%, transparent);
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
		background: color-mix(in srgb, var(--c-green-signal) 8%, transparent);
		border-left-color: var(--c-green-signal);
	}

	.gap-prompts.all-resolved {
		background: color-mix(in srgb, var(--c-green-signal) 6%, transparent);
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
		font-size: 0.7rem;
		font-weight: 600;
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
		border: 1px solid color-mix(in srgb, var(--c-green-signal) 40%, transparent);
		background: color-mix(in srgb, var(--c-green-signal) 8%, transparent);
		cursor: pointer;
		opacity: 1;
	}

	.advance-inline.ready:hover {
		background: color-mix(in srgb, var(--c-green-signal) 18%, transparent);
	}

	.stage-done {
		font-size: 0.7rem;
		color: var(--c-green-signal);
		font-weight: 600;
	}

	.gap-prompts.has-objection {
		background: color-mix(in srgb, var(--c-red) 8%, transparent);
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

	.gap-prompt:hover:not(.resolved) {
		background: color-mix(in srgb, var(--c-warm) 10%, transparent);
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
		font-size: 0.75rem;
		color: var(--c-text);
		font-style: italic;
	}

	/* --- Notes --- */

	.desc-input {
		font-family: var(--font-reading);
		font-size: 0.75rem;
		color: var(--c-text);
		background: transparent;
		border: 1px solid transparent;
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

	/* --- Commitments --- */

	.commitments-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.commitment-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: 0.75rem;
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.commitment-row.urgent {
		background: color-mix(in srgb, var(--c-warm) 10%, transparent);
	}

	.commitment-row.overdue {
		background: color-mix(in srgb, var(--c-red) 10%, transparent);
	}

	.commitment-row.met {
		color: var(--c-text-ghost);
		text-decoration: line-through;
	}

	.commitment-text {
		flex: 1;
		color: var(--c-text);
	}

	.commitment-deadline {
		font-family: var(--font);
		font-weight: 600;
		white-space: nowrap;
		color: var(--c-text-muted);
	}

	.commitment-row.urgent .commitment-deadline {
		color: var(--c-warm);
	}

	.commitment-row.overdue .commitment-deadline {
		color: var(--c-red);
	}

	.commitment-remove {
		font-size: 0.7rem;
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
		opacity: 0;
		transition: opacity var(--tr-fast);
	}

	.commitment-row:hover .commitment-remove {
		opacity: 1;
	}

	.commitment-add-form {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
	}

	.commitment-input {
		font-family: var(--font-reading);
		font-size: 0.7rem;
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--c-border);
		padding: 1px 2px;
		width: 7em;
	}

	.commitment-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.commitment-select {
		font-family: var(--font-reading);
		font-size: 0.7rem;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.commitment-date {
		font-family: var(--font-reading);
		font-size: 0.7rem;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.commitment-save, .commitment-cancel {
		font-size: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
	}

	.commitment-save {
		color: var(--c-green-signal);
	}

	.commitment-save:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.commitment-cancel {
		color: var(--c-text-ghost);
	}

	.add-commitment-btn {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		align-self: flex-start;
		transition: color var(--tr-fast);
	}

	.add-commitment-btn:hover {
		color: var(--c-accent);
	}

	/* --- People summary --- */

	.people-summary {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-xs);
		padding: var(--sp-xs) 0;
	}

	.people-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--c-text-muted);
		margin-right: var(--sp-xs);
	}

	.people-chip {
		font-family: var(--font);
		font-size: 0.7rem;
		color: var(--c-text-soft);
		background: var(--c-neutral-bg-light);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-xs);
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.people-chip.all-responded {
		color: var(--c-green-signal);
		background: color-mix(in srgb, var(--c-green-signal) 10%, transparent);
	}

	.people-status {
		font-weight: 700;
		font-size: 0.65rem;
		opacity: 0.7;
	}

	/* --- Deliverables section --- */

	.deliverables-section {
		margin-bottom: var(--sp-sm);
		padding: var(--sp-sm);
		background: var(--c-bg);
		border-radius: var(--radius-sm);
		font-family: var(--font);
	}

	.deliverables-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-xs);
	}

	.section-label {
		font-size: var(--fs-xs);
		font-weight: 600;
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

	.coverage-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		padding: 0;
		line-height: 1;
		width: 1.2em;
		text-align: center;
	}

	.coverage-toggle.full {
		color: var(--c-green);
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

	.deliverable-stakeholders {
		font-size: 0.65rem;
		color: var(--c-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
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

	/* --- Signal grid: grouped by perspective --- */

	.signal-grid {
		display: flex;
		flex-direction: column;
		gap: var(--sp-md);
	}

	.perspective-section {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.perspective-label {
		font-family: var(--font);
		font-size: var(--fs-sm);
		font-weight: 700;
		color: var(--c-text);
		padding-bottom: 2px;
		border-bottom: 1px solid var(--c-border-soft);
		margin-bottom: 2px;
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		cursor: pointer;
		user-select: none;
	}

	.perspective-label:hover {
		color: var(--c-accent-text);
	}

	.perspective-toggle {
		font-size: 0.7rem;
		color: var(--c-text-muted);
		width: 0.8em;
	}

	.perspective-summary {
		display: flex;
		gap: 2px;
		margin-left: auto;
	}

	.delegation {
		font-family: var(--font-reading);
		font-size: 0.65rem;
		font-weight: 400;
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
		font-size: 0.65rem;
		color: var(--c-accent);
		background: none;
		border: 1px dashed color-mix(in srgb, var(--c-accent) 30%, transparent);
		border-radius: var(--radius-sm);
		padding: 0 var(--sp-xs);
		cursor: pointer;
		line-height: 1.5;
		white-space: nowrap;
		transition: color var(--tr-fast), border-color var(--tr-fast), background var(--tr-fast);
	}

	.assign-btn:hover {
		background: color-mix(in srgb, var(--c-accent) 8%, transparent);
		border-color: var(--c-accent);
	}

	.unassign-btn {
		font-size: 0.7rem;
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
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
		font-size: 0.7rem;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.assign-name-input {
		font-family: var(--font-reading);
		font-size: 0.7rem;
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
		font-size: 0.7rem;
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
		background: color-mix(in srgb, var(--c-warm) 6%, transparent);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs);
		margin: 0 calc(-1 * var(--sp-xs));
	}

	.signal-row-edit.completed-stage {
		opacity: 0.7;
	}

	.signal-row-edit.completed-stage:hover {
		opacity: 1;
	}

	.signal-row-edit.flash {
		animation: cell-flash 1.2s ease-out;
	}

	@keyframes cell-flash {
		0%, 15% { background: color-mix(in srgb, var(--c-accent) 20%, transparent); }
		100% { background: transparent; }
	}

	.signal-row-compact {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: 1px 0;
		cursor: pointer;
		opacity: 0.55;
		transition: opacity var(--tr-fast);
	}

	.signal-row-compact:hover {
		opacity: 0.85;
	}

	.score-btn-mini {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 8px;
		font-weight: 700;
		color: var(--c-surface);
		line-height: 1;
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
		font-size: 0.72rem;
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.compact-owner {
		color: var(--c-text-muted);
	}

	.signal-row-top {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.score-label {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: 600;
		font-style: italic;
		opacity: 0.45;
	}

	.score-label-positive { color: var(--c-green-signal); }
	.score-label-uncertain { color: var(--c-warm); }
	.score-label-negative { color: var(--c-red); }

	.signal-row-edit .verdict-input {
		margin-left: 0;
	}

	/* Score toggle — explicit button group */
	.score-toggle {
		display: inline-flex;
		gap: 1px;
		flex-shrink: 0;
	}

	.score-btn {
		width: 20px;
		height: 18px;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 700;
		color: var(--c-text-ghost);
		line-height: 1;
		padding: 0;
		transition: background var(--tr-fast), color var(--tr-fast), border-color var(--tr-fast);
	}

	.score-btn:first-child {
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
	}

	.score-btn:last-child {
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
	}

	.score-btn:not(:first-child) {
		border-left: none;
	}

	.score-btn:hover {
		background: color-mix(in srgb, var(--c-text) 6%, var(--c-surface));
	}

	.score-btn.active.score-none {
		background: var(--c-neutral-bg);
		color: var(--c-text-muted);
		border-color: var(--c-text-ghost);
	}

	.score-btn.active.score-positive {
		background: var(--c-green-signal);
		color: var(--c-surface);
		border-color: var(--c-green-signal);
	}

	.score-btn.active.score-uncertain {
		background: var(--c-warm);
		color: var(--c-surface);
		border-color: var(--c-warm);
	}

	.score-btn.active.score-negative {
		background: var(--c-red);
		color: var(--c-surface);
		border-color: var(--c-red);
	}

	.signal-stage {
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: 600;
		color: var(--c-text-muted);
		min-width: 4em;
	}

	.verdict-input {
		font-family: var(--font-reading);
		font-size: 0.75rem;
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) 40%, transparent);
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
