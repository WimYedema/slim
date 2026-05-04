<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		CELL_QUESTIONS,
		PERSPECTIVES,
		STAGES,
		defaultHorizon,
		stageLabel,
		linksForDeliverable,
	} from '../lib/types'
	import { agingLevel, daysInStage } from '../lib/queries'
	import type { BoardData } from '../lib/store'
	import type { MeetingData } from '../lib/meeting'
	import { collectPeople } from '../lib/meeting'
	import {
		diffBoard,
		deduplicateItems,
		groupItems,
		isGrouped,
		snapshotBoard,
		briefingKey,
		buildReturnSummary,
		reconcileFeed,
		buildReadItems,
		CONDITION_VERBS,
		type GroupedBriefingItem,
		type AnyBriefingItem,
		type BoardSnapshot,
		type ImportanceTier,
	} from '../lib/briefing'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		snapshot: BoardSnapshot | null
		meetingData: MeetingData
		boardName: string
		boardDescription: string
		onUpdateDescription: (description: string) => void
		onMarkSeen: (snapshot: BoardSnapshot) => void
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
		onParkOpportunity: (id: string, parkUntil?: string) => void
	}

	let {
		opportunities,
		deliverables,
		links,
		snapshot,
		meetingData,
		boardName,
		boardDescription,
		onUpdateDescription,
		onMarkSeen,
		onSelectOpportunity,
		onSelectDeliverable,
		onParkOpportunity,
	}: Props = $props()

	const currentBoard = $derived<BoardData>({ opportunities, deliverables, links })
	const rawItems = $derived(diffBoard(snapshot, currentBoard, meetingData))
	const feed = $derived(reconcileFeed(rawItems, snapshot, meetingData))

	const returnSummary = $derived(buildReturnSummary(snapshot, rawItems))
	let returnDismissed = $state(false)
	// Reset dismissed state when snapshot changes (new session)
	let lastSnapshotAt = $state(snapshot?.takenAt ?? 0)
	$effect(() => {
		const snapAt = snapshot?.takenAt ?? 0
		if (snapAt !== lastSnapshotAt) {
			lastSnapshotAt = snapAt
			returnDismissed = true
		}
	})

	// Persist updated activeConditions back to snapshot (side effect)
	$effect(() => {
		const conds = feed.activeConditions
		if (!snapshot) return
		const prev = snapshot.activeConditions
		// Only update if conditions actually changed
		const prevKeys = Object.keys(prev ?? {}).sort().join(',')
		const newKeys = Object.keys(conds).sort().join(',')
		if (prevKeys !== newKeys) {
			onMarkSeen({ ...snapshot, activeConditions: conds })
		}
	})

	let parkingId = $state<string | null>(null)
	let parkUntilInput = $state(defaultHorizon())
	let editDesc = $state(boardDescription)
	let subView: 'news' | 'overview' = $state('news')

	const activeOpps = $derived(opportunities.filter(o => !o.discontinuedAt))
	const boardSummary = $derived(() => {
		const counts = STAGES.map(s => {
			const n = activeOpps.filter(o => o.stage === s.key).length
			return n > 0 ? `${n} ${s.label}` : null
		}).filter(Boolean)
		return `${activeOpps.length} opportunities (${counts.join(', ')}), ${deliverables.length} deliverables`
	})

	// ── Overview derived data ──

	type OvHealth = 'green' | 'amber' | 'red'
	const ovOpps = $derived(activeOpps.map(o => {
		const signals = { positive: 0, uncertain: 0, negative: 0, none: 0 }
		for (const p of PERSPECTIVES) {
			const score = o.signals[o.stage]?.[p]?.score ?? 'none'
			signals[score]++
		}
		const health: OvHealth = signals.negative > 0 ? 'red' : (signals.none > 0 || signals.uncertain > 0) ? 'amber' : 'green'
		return {
			id: o.id, title: o.title, stage: o.stage, horizon: o.horizon,
			aging: agingLevel(o), days: daysInStage(o), health,
		}
	}))

	const ovByStage = $derived(STAGES.map(s => ({
		stage: s,
		opps: ovOpps.filter(o => o.stage === s.key)
			.sort((a, b) => {
				const agingOrder = { stale: 0, aging: 1, fresh: 2 }
				return agingOrder[a.aging] - agingOrder[b.aging]
			}),
	})).filter(g => g.opps.length > 0))

	const activeDeliverables = $derived(deliverables.filter(d => d.status === 'active'))
	const ovDels = $derived(activeDeliverables.map(d => {
		const dLinks = linksForDeliverable(links, d.id)
		const oppTitles = dLinks
			.map(l => opportunities.find(o => o.id === l.opportunityId)?.title)
			.filter((t): t is string => !!t)
		return {
			id: d.id, title: d.title, size: d.size,
			linkCount: dLinks.length, orphan: dLinks.length === 0,
			oppTitles,
		}
	}))

	const ovStakeholders = $derived(() => {
		const people = collectPeople(opportunities, deliverables)
		const result: { name: string; oppCount: number }[] = []
		for (const [, person] of people) {
			if (!person.roles.has('stakeholder') && !person.isCommitmentTarget) continue
			result.push({ name: person.name, oppCount: person.opportunityIds.length })
		}
		// Also include consumers on deliverables
		for (const d of deliverables) {
			for (const consumer of d.extraConsumers) {
				if (!result.some(r => r.name === consumer)) {
					const person = people.get(consumer)
					result.push({ name: consumer, oppCount: person?.opportunityIds.length ?? 0 })
				}
			}
		}
		return result.sort((a, b) => b.oppCount - a.oppCount)
	})

	function handleClick(item: AnyBriefingItem) {
		if (isGrouped(item)) return
		if (item.targetType === 'opportunity') {
			onSelectOpportunity(item.targetId)
		} else {
			onSelectDeliverable(item.targetId)
		}
	}

	function unscoredQuestions(item: AnyBriefingItem): string[] {
		if (isGrouped(item) || item.targetType !== 'opportunity') return []
		if (item.verb !== 'stale') return []
		const opp = opportunities.find(o => o.id === item.targetId)
		if (!opp) return []
		const questions: string[] = []
		for (const p of PERSPECTIVES) {
			if (opp.signals[opp.stage][p].score === 'none') {
				questions.push(CELL_QUESTIONS[opp.stage][p])
			}
		}
		return questions
	}

	function handleTargetClick(target: GroupedBriefingItem['targets'][number]) {
		if (target.type === 'opportunity') {
			onSelectOpportunity(target.id)
		} else {
			onSelectDeliverable(target.id)
		}
	}

	function handleMarkRead() {
		const freshSnap = snapshotBoard(currentBoard)
		// Store current visible events as read items (conditions are recomputed, not stored)
		const allVisible = [...feed.fresh, ...feed.read]
		const storedReadItems = buildReadItems(allVisible, snapshot?.readItems ?? [])
		onMarkSeen({
			...freshSnap,
			readItems: storedReadItems,
			activeConditions: feed.activeConditions,
		})
	}

	function handleDismiss(e: Event, item: AnyBriefingItem) {
		e.stopPropagation()
		// Conditions cannot be dismissed (they demand action)
		if (!isGrouped(item) && CONDITION_VERBS.has(item.verb)) return
		const key = briefingKey(item)
		const current = snapshot ?? snapshotBoard(currentBoard)
		const keys = [...new Set([...(current.readKeys ?? []), ...(current.dismissedKeys ?? []), key])]
		onMarkSeen({ ...current, readKeys: keys })
	}

	function handleParkPrompt(e: Event, item: AnyBriefingItem) {
		e.stopPropagation()
		if (!isGrouped(item) && item.targetType === 'opportunity') {
			parkingId = item.targetId
			parkUntilInput = defaultHorizon()
		}
	}

	function confirmPark(e: Event) {
		e.stopPropagation()
		if (parkingId) {
			const until = parkUntilInput.trim() || undefined
			onParkOpportunity(parkingId, until)
			parkingId = null
		}
	}

	function cancelPark(e: Event) {
		e.stopPropagation()
		parkingId = null
	}

	function timeAgo(ts: number): string {
		const diff = Date.now() - ts
		const mins = Math.floor(diff / 60000)
		if (mins < 1) return 'just now'
		if (mins < 60) return `${mins}m ago`
		const hours = Math.floor(mins / 60)
		if (hours < 24) return `${hours}h ago`
		const days = Math.floor(hours / 24)
		return `${days}d ago`
	}
</script>

<div class="bf-container">
	<div class="bf-product-header">
		<div class="bf-product-top">
			<h2 class="bf-product-name">{boardName}</h2>
			<span class="bf-toggle">
				<button class="bf-toggle-btn" class:active={subView === 'news'} onclick={() => subView = 'news'}>News</button>
				<button class="bf-toggle-btn" class:active={subView === 'overview'} onclick={() => subView = 'overview'}>Overview</button>
			</span>
		</div>
		<input
			type="text"
			class="bf-product-desc"
			placeholder="What is this product about?"
			value={editDesc}
			oninput={(e) => { editDesc = (e.target as HTMLInputElement).value }}
			onblur={() => { if (editDesc !== boardDescription) onUpdateDescription(editDesc) }}
		/>
	</div>

	{#if subView === 'overview'}
		<!-- Overview: inventory snapshot -->
		<section class="ov-section">
			<h3 class="ov-section-title">Opportunities <span class="ov-count">{activeOpps.length}</span></h3>
			{#if ovByStage.length === 0}
				<p class="ov-empty">No active opportunities</p>
			{:else}
				{#each ovByStage as group (group.stage.key)}
					<h4 class="ov-stage-label" style="--stage-color: var(--c-stage-{group.stage.key})">{group.stage.label} <span class="ov-count">{group.opps.length}</span></h4>
					{#each group.opps as opp (opp.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="ov-row" role="button" tabindex="0" onclick={() => onSelectOpportunity(opp.id)}>
							<span class="ov-health ov-health-{opp.health}" title="{opp.health === 'green' ? 'All clear' : opp.health === 'red' ? 'Has objections' : 'Needs attention'}">●</span>
							<span class="ov-title">{opp.title}</span>
							{#if opp.horizon}<span class="ov-pill ov-horizon">{opp.horizon}</span>{/if}
							{#if opp.aging !== 'fresh'}<span class="ov-aging ov-aging-{opp.aging}">{opp.days}d</span>{/if}
						</div>
					{/each}
				{/each}
			{/if}
		</section>

		<section class="ov-section">
			<h3 class="ov-section-title">Deliverables <span class="ov-count">{ovDels.length}</span></h3>
			{#if ovDels.length === 0}
				<p class="ov-empty">No active deliverables</p>
			{:else}
				{#each ovDels as d (d.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="ov-row" role="button" tabindex="0" onclick={() => onSelectDeliverable(d.id)}>
						<span class="ov-title">{d.title}</span>
						{#if d.size}<span class="ov-pill">{d.size}</span>{/if}
						{#if d.orphan}<span class="ov-pill ov-orphan">orphan</span>{/if}
						{#if d.oppTitles.length > 0}<span class="ov-meta">← {d.oppTitles.join(', ')}</span>{/if}
					</div>
				{/each}
			{/if}
		</section>

		{#if ovStakeholders().length > 0}
			<section class="ov-section">
				<h3 class="ov-section-title">Stakeholders <span class="ov-count">{ovStakeholders().length}</span></h3>
				<div class="ov-chips">
					{#each ovStakeholders() as person (person.name)}
						<span class="ov-chip">{person.name}{#if person.oppCount > 0}<span class="ov-chip-count">{person.oppCount}</span>{/if}</span>
					{/each}
				</div>
			</section>
		{/if}
	{:else}
	<!-- News feed with age bands -->
	{#snippet wireItem(item: AnyBriefingItem, muted: boolean)}
		{#if isGrouped(item)}
			<div class="bf-wire-item bf-wire-grouped" class:bf-wire-muted={muted}>
				<span class="bf-dot" class:bf-dot-muted={muted}></span>
				<span class="bf-wire-text">{item.description}:
					{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
				</span>
				<span class="bf-time">{timeAgo(item.timestamp)}</span>
				{#if !CONDITION_VERBS.has(item.verb)}
					<button class="bf-dismiss-wire" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
				{/if}
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="bf-wire-item" class:bf-wire-muted={muted} role="button" tabindex="0" onclick={() => handleClick(item)}>
				<span class="bf-dot" class:bf-dot-muted={muted}></span>
				<span class="bf-wire-text">
					{#if item.verb === 'resolved'}
						<span class="bf-resolved-icon">✓</span>
					{/if}
					{item.description} — <span class="bf-entity">{item.targetTitle}</span>{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
				</span>
				<span class="bf-time">{timeAgo(item.timestamp)}</span>
				{#if !CONDITION_VERBS.has(item.verb)}
					<button class="bf-dismiss-wire" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
				{/if}
			</div>
		{/if}
	{/snippet}

	{#if feed.total === 0}
		<div class="bf-empty">
			<span class="bf-empty-icon">✓</span>
			<p class="bf-empty-text">All caught up — nothing new since your last check.</p>
			{#if !snapshot}
				<p class="bf-empty-hint">This is your first visit. Changes will show up here next time.</p>
			{:else}
				<p class="bf-empty-hint">{boardSummary()}</p>
			{/if}
		</div>
	{:else}
		<div class="bf-header">
			<span class="bf-summary">{feed.total} item{feed.total === 1 ? '' : 's'} since {snapshot ? timeAgo(snapshot.takenAt) : 'first visit'}</span>
			{#if feed.fresh.length > 0}
				<button class="btn-ghost bf-mark-btn" onclick={handleMarkRead}>Mark all read</button>
			{/if}
		</div>

		{#if returnSummary && !returnDismissed}
			<div class="bf-return">
				<span class="bf-return-text">{returnSummary.text}</span>
				<button class="bf-return-dismiss" title="Dismiss" onclick={() => returnDismissed = true}>×</button>
			</div>
		{/if}

		{#if feed.fresh.length > 0}
			{@const freshT1 = feed.fresh.filter(i => i.tier === 1)}
			{@const freshRest = feed.fresh.filter(i => i.tier !== 1)}

			{#if freshT1.length > 0}
				<section class="bf-tier bf-tier-1">
					<div class="bf-headlines">
						{#each freshT1 as item (item.id)}
							{#if isGrouped(item)}
								<div class="bf-headline">
									{#if !CONDITION_VERBS.has(item.verb)}
										<button class="bf-dismiss" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
									{/if}
									<span class="bf-headline-desc">{item.description}:
										{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}
									</span>
									{#if item.detail}<span class="bf-detail">{item.detail}</span>{/if}
									<span class="bf-time">{timeAgo(item.timestamp)}</span>
								</div>
							{:else}
								{@const questions = unscoredQuestions(item)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div class="bf-headline" role="button" tabindex="0" onclick={() => handleClick(item)}>
									{#if !CONDITION_VERBS.has(item.verb)}
										<button class="bf-dismiss" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
									{/if}
									<span class="bf-headline-desc">{item.description}</span>
									<span class="bf-headline-subject">{item.targetTitle}</span>
									{#if item.detail}<span class="bf-detail">{item.detail}</span>{/if}
									{#if questions.length > 0}
										<ul class="bf-questions">
											{#each questions as q}
												<li>{q}</li>
											{/each}
										</ul>
									{/if}
									<div class="bf-headline-footer">
										{#if !isGrouped(item) && (item.verb === 'stale' || item.verb === 'revisit-due')}
											{#if parkingId === item.targetId}
												<span class="bf-park-inline">
													<input class="bf-park-input" type="text" placeholder="e.g. 2026Q3" bind:value={parkUntilInput} onclick={(e) => e.stopPropagation()} />
													<button class="bf-park-btn" onclick={confirmPark}>Park</button>
													<button class="bf-park-cancel" onclick={cancelPark}>×</button>
												</span>
											{:else}
												<button class="bf-park-btn" onclick={(e) => handleParkPrompt(e, item)}>Park it</button>
											{/if}
										{/if}
										<span class="bf-time">{timeAgo(item.timestamp)}</span>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{/if}

			{#if freshRest.length > 0}
				<section class="bf-tier bf-tier-2">
					<div class="bf-wire">
						{#each freshRest as item (item.id)}
							{@render wireItem(item, false)}
						{/each}
					</div>
				</section>
			{/if}
		{/if}

		{#if feed.read.length > 0}
			<section class="bf-tier bf-tier-read">
				<h3 class="bf-tier-label bf-tier-label-read">Read</h3>
				<div class="bf-wire">
					{#each feed.read as item (item.id)}
						{@render wireItem(item, true)}
					{/each}
				</div>
			</section>
		{/if}

		{#if feed.older.length > 0}
			<details class="bf-tier bf-tier-3">
				<summary class="bf-tier-label bf-tier-toggle">Older <span class="bf-tier-count">{feed.older.length}</span></summary>
				<div class="bf-wire">
					{#each feed.older as item (item.id)}
						{@render wireItem(item, true)}
					{/each}
				</div>
			</details>
		{/if}
	{/if}
	{/if}
</div>

<style>
	.bf-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-md);
	}

	.bf-container > * {
		width: 100%;
		max-width: 720px;
	}

	/* --- Product header --- */
	.bf-product-header {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--c-border);
	}

	.bf-product-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-sm);
	}

	.bf-product-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		margin: 0;
	}

	.bf-product-desc {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		background: transparent;
		border: none;
		border-bottom: 1px dashed transparent;
		padding: 2px 0;
		transition: border-color var(--tr-fast);
	}

	.bf-product-desc:hover {
		border-bottom-color: var(--c-border);
	}

	.bf-product-desc:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
		color: var(--c-text);
	}

	.bf-product-desc::placeholder {
		color: var(--c-text-ghost);
		font-style: italic;
	}

	/* --- Sub-view toggle --- */
	.bf-toggle {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}

	.bf-toggle-btn {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 2px var(--sp-sm);
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.bf-toggle-btn:hover {
		color: var(--c-text);
	}

	.bf-toggle-btn.active {
		background: var(--c-accent);
		color: var(--c-bg);
	}

	/* --- Overview sections --- */
	.ov-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--c-surface);
		border-radius: var(--radius-md);
		padding: var(--sp-sm) var(--sp-md);
		box-shadow: var(--shadow-sm);
	}

	.ov-section-title {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
		margin: 0 0 var(--sp-2xs);
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.ov-count {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		font-weight: normal;
	}

	.ov-empty {
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		font-style: italic;
		margin: 0;
		padding: var(--sp-xs) 0;
	}

	.ov-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: var(--sp-2xs) var(--sp-xs);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.ov-row:hover {
		background: var(--c-surface-alt);
	}

	.ov-title {
		flex: 1;
		color: var(--c-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ov-stage-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		margin: var(--sp-xs) 0 0;
		padding: var(--sp-2xs) var(--sp-xs);
		border-left: 3px solid var(--stage-color);
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
	}

	.ov-health {
		font-size: var(--fs-2xs);
		flex-shrink: 0;
	}

	.ov-health-green { color: var(--c-green-signal); }
	.ov-health-amber { color: var(--c-warm); }
	.ov-health-red { color: var(--c-red); }

	.ov-pill {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: var(--c-bg-hover);
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.ov-horizon {
		color: var(--c-accent);
	}

	.ov-orphan {
		color: var(--c-warm);
	}

	.ov-aging {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		white-space: nowrap;
	}

	.ov-aging-aging {
		color: var(--c-warm);
	}

	.ov-aging-stale {
		color: var(--c-red);
	}

	.ov-meta {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12rem;
	}

	.ov-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2xs);
	}

	.ov-chip {
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: var(--c-bg-hover);
		padding: 0.15rem var(--sp-xs);
		border-radius: var(--radius-sm);
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2xs);
	}

	.ov-chip-count {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
	}

	/* --- Empty state --- */
	.bf-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xl) var(--sp-md);
		text-align: center;
	}

	.bf-empty-icon {
		font-size: var(--fs-3xl);
		color: var(--c-green-signal);
	}

	.bf-empty-text {
		font-size: var(--fs-md);
		color: var(--c-text);
		margin: 0;
	}

	.bf-empty-hint {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0;
	}

	/* --- Header --- */
	.bf-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-xs) 0;
	}

	.bf-summary {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.bf-mark-btn {
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	/* --- Return summary --- */
	.bf-return {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-md);
		background: var(--c-surface-alt);
		border-left: 3px solid var(--c-accent);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}

	.bf-return-text {
		flex: 1;
		font-weight: var(--fw-medium);
		color: var(--c-text);
	}

	.bf-return-dismiss {
		background: none;
		border: none;
		color: var(--c-text-muted);
		cursor: pointer;
		font-size: var(--fs-md);
		padding: 0 var(--sp-2xs);
		line-height: 1;
	}

	.bf-return-dismiss:hover {
		color: var(--c-text);
	}

	/* --- Tiers --- */
	.bf-tier {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.bf-tier-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
		padding: var(--sp-xs) 0;
		min-height: 0;
	}

	.bf-tier-label:empty {
		display: none;
	}

	.bf-tier-3 .bf-tier-label {
		color: var(--c-text-ghost);
		cursor: pointer;
	}

	.bf-tier-toggle {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
	}

	.bf-tier-count {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-normal);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
		padding: 0 6px;
		border-radius: var(--radius-sm);
	}

	/* --- Headlines (tier 1) --- */
	.bf-headlines {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--sp-sm);
		max-width: 900px;
	}

	.bf-headline {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-sm);
		border-left: 3px solid var(--c-red);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c-red) 4%, var(--c-surface));
		cursor: pointer;
		transition: background var(--tr-fast);
		position: relative;
	}

	.bf-headline:hover {
		background: color-mix(in srgb, var(--c-red) 8%, var(--c-surface));
	}

	.bf-dismiss {
		position: absolute;
		top: var(--sp-xs);
		right: var(--sp-xs);
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
		border-radius: var(--radius-xs);
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.bf-headline:hover .bf-dismiss {
		opacity: 1;
	}

	.bf-dismiss:hover {
		color: var(--c-text);
		background: color-mix(in srgb, var(--c-text) 8%, transparent);
	}

	.bf-headline-desc {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--c-text);
		line-height: 1.4;
	}

	.bf-headline-subject {
		font-size: var(--fs-sm);
		color: var(--c-text-soft);
	}

	.bf-questions {
		margin: 0;
		padding: 0 0 0 var(--sp-md);
		list-style: disc;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		line-height: 1.5;
	}

	.bf-headline .bf-time {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		align-self: flex-end;
	}

	.bf-headline-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-sm);
	}

	.bf-park-btn {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--c-text) 10%, transparent);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-sm);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.bf-park-btn:hover {
		background: color-mix(in srgb, var(--c-text) 12%, transparent);
		color: var(--c-text);
	}

	.bf-park-inline {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.bf-park-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--c-border);
		padding: 1px 0;
		width: 80px;
		outline: none;
	}

	.bf-park-input:focus {
		border-bottom-color: var(--c-accent);
	}

	.bf-park-cancel {
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
	}

	.bf-park-cancel:hover {
		color: var(--c-text);
	}

	/* --- Wire feed (tier 2 + 3) --- */
	.bf-wire {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.bf-wire-item {
		display: grid;
		grid-template-columns: 8px 1fr auto auto;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.bf-wire-item:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.bf-dismiss-wire {
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		border-radius: var(--radius-xs);
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.bf-wire-item:hover .bf-dismiss-wire {
		opacity: 1;
	}

	.bf-dismiss-wire:hover {
		color: var(--c-text);
	}

	.bf-wire-grouped {
		cursor: default;
	}

	.bf-wire-muted {
		opacity: 0.7;
	}

	.bf-resolved-icon {
		color: var(--c-green-signal);
		font-weight: var(--fw-bold);
		margin-right: 2px;
	}

	.bf-tier-label-read {
		color: var(--c-text-ghost);
	}

	.bf-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--c-text-soft);
		flex-shrink: 0;
	}

	.bf-dot-muted {
		background: var(--c-text-ghost);
	}

	.bf-wire-text {
		font-size: var(--fs-sm);
		color: var(--c-text-soft);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bf-entity {
		color: var(--c-text);
		font-weight: var(--fw-medium);
	}

	.bf-detail {
		color: var(--c-text-muted);
		font-style: italic;
	}

	.bf-time {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* --- Target links (grouped items) --- */
	.bf-target-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: var(--fw-medium);
		color: var(--c-text);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--c-text-ghost);
		text-underline-offset: 2px;
	}

	.bf-target-link:hover {
		color: var(--c-link);
		text-decoration-color: var(--c-link);
	}
</style>
