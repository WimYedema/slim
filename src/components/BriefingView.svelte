<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		CELL_QUESTIONS,
		PERSPECTIVES,
		STAGES,
		defaultHorizon,
	} from '../lib/types'
	import type { BoardData } from '../lib/store'
	import type { MeetingData } from '../lib/meeting'
	import {
		diffBoard,
		deduplicateItems,
		groupItems,
		isGrouped,
		snapshotBoard,
		briefingKey,
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
		onMarkSeen,
		onSelectOpportunity,
		onSelectDeliverable,
		onParkOpportunity,
	}: Props = $props()

	const currentBoard = $derived<BoardData>({ opportunities, deliverables, links })
	const rawItems = $derived(diffBoard(snapshot, currentBoard, meetingData))
	const deduped = $derived(deduplicateItems(rawItems))
	const allItems = $derived(groupItems(deduped))
	const dismissedSet = $derived(new Set(snapshot?.dismissedKeys ?? []))
	const items = $derived(allItems.filter(i => !dismissedSet.has(briefingKey(i))))

	const tier1 = $derived(items.filter(i => i.tier === 1))
	const tier2 = $derived(items.filter(i => i.tier === 2))
	const tier3 = $derived(items.filter(i => i.tier === 3))

	let parkingId = $state<string | null>(null)
	let parkUntilInput = $state(defaultHorizon())

	const activeOpps = $derived(opportunities.filter(o => !o.discontinuedAt))
	const boardSummary = $derived(() => {
		const counts = STAGES.map(s => {
			const n = activeOpps.filter(o => o.stage === s.key).length
			return n > 0 ? `${n} ${s.label}` : null
		}).filter(Boolean)
		return `${activeOpps.length} opportunities (${counts.join(', ')}), ${deliverables.length} deliverables`
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

	function handleMarkSeen() {
		const freshSnap = snapshotBoard(currentBoard)
		// Dismiss all currently visible items; prune stale keys
		const visibleKeys = items.map(i => briefingKey(i))
		const freshAllKeys = new Set(allItems.map(i => briefingKey(i)))
		const existingKeys = (snapshot?.dismissedKeys ?? []).filter(k => freshAllKeys.has(k))
		const allKeys = [...new Set([...existingKeys, ...visibleKeys])]
		onMarkSeen({ ...freshSnap, dismissedKeys: allKeys })
	}

	function handleDismiss(e: Event, item: AnyBriefingItem) {
		e.stopPropagation()
		const key = briefingKey(item)
		const current = snapshot ?? snapshotBoard(currentBoard)
		const keys = [...(current.dismissedKeys ?? []), key]
		onMarkSeen({ ...current, dismissedKeys: keys })
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
	{#if items.length === 0}
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
			<span class="bf-summary">{items.length} item{items.length === 1 ? '' : 's'} since {snapshot ? timeAgo(snapshot.takenAt) : 'first visit'}</span>
			<button class="btn-ghost bf-mark-btn" onclick={handleMarkSeen}>Mark all seen</button>
		</div>

		{#if tier1.length > 0}
			<section class="bf-tier bf-tier-1">
				<div class="bf-headlines">
					{#each tier1 as item (item.id)}
						{#if isGrouped(item)}
							<div class="bf-headline">
								<button class="bf-dismiss" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
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
								<button class="bf-dismiss" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
								<span class="bf-headline-desc">{item.description}</span>
								<span class="bf-headline-subject">{item.targetTitle}</span>							{#if item.detail}<span class="bf-detail">{item.detail}</span>{/if}								{#if questions.length > 0}
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

		{#if tier2.length > 0}
			<section class="bf-tier bf-tier-2">
				{#if tier1.length === 0}<h3 class="bf-tier-label">What changed</h3>{/if}
				<div class="bf-wire">
					{#each tier2 as item (item.id)}
						{#if isGrouped(item)}
							<div class="bf-wire-item bf-wire-grouped">
								<span class="bf-dot"></span>
								<span class="bf-wire-text">{item.description}:
									{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
								</span>
								<span class="bf-time">{timeAgo(item.timestamp)}</span>
								<button class="bf-dismiss-wire" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
							</div>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="bf-wire-item" role="button" tabindex="0" onclick={() => handleClick(item)}>
								<span class="bf-dot"></span>
								<span class="bf-wire-text">{item.description} — <span class="bf-entity">{item.targetTitle}</span>{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}</span>
								<span class="bf-time">{timeAgo(item.timestamp)}</span>
								<button class="bf-dismiss-wire" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		{#if tier3.length > 0}
			<details class="bf-tier bf-tier-3">
				<summary class="bf-tier-label bf-tier-toggle">Background <span class="bf-tier-count">{tier3.length}</span></summary>
				<div class="bf-wire">
					{#each tier3 as item (item.id)}
						{#if isGrouped(item)}
							<div class="bf-wire-item bf-wire-grouped bf-wire-muted">
								<span class="bf-dot bf-dot-muted"></span>
								<span class="bf-wire-text">{item.description}:
									{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
								</span>
								<span class="bf-time">{timeAgo(item.timestamp)}</span>
								<button class="bf-dismiss-wire" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
							</div>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="bf-wire-item bf-wire-muted" role="button" tabindex="0" onclick={() => handleClick(item)}>
								<span class="bf-dot bf-dot-muted"></span>
								<span class="bf-wire-text">{item.description} — <span class="bf-entity">{item.targetTitle}</span>{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}</span>
								<span class="bf-time">{timeAgo(item.timestamp)}</span>
								<button class="bf-dismiss-wire" title="Dismiss" onclick={(e) => handleDismiss(e, item)}>×</button>
							</div>
						{/if}
					{/each}
				</div>
			</details>
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
