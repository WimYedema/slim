<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Stage,
		type Perspective,
		type Score,
		type PersonRole,
		PERSPECTIVE_LABELS,
		CELL_QUESTIONS,
		SCORE_SYMBOL,
		stageLabel,
		linksForDeliverable,
		opportunityEffort,
		formatDays,
	} from '../lib/types'
	import { collectPeople, buildMeetingAgenda, personUrgency, completeMeeting, type MeetingAgenda, type MeetingData, type ChangeItem, type CommitmentItem, type UnscoredCell, type ConflictItem, type DeliverableItem } from '../lib/meeting'
	import { collectStakeholders, buildStakeholderProfile, buildTalkingPoints } from '../lib/stakeholders'
	import ScoreToggle from './ScoreToggle.svelte'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		meetingData: MeetingData
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
		onUpdateOpportunity: (updated: Opportunity) => void
		onUpdateMeetingData: (data: MeetingData) => void
		onBeforeDone?: () => void
	}

	let { opportunities, deliverables, links, meetingData, onSelectOpportunity, onSelectDeliverable, onUpdateOpportunity, onUpdateMeetingData, onBeforeDone }: Props = $props()

	let selectedPerson: string | null = $state(null)
	type RoleFilter = 'all' | 'team' | 'stakeholders'
	let roleFilter: RoleFilter = $state('all')
	/** Entity IDs the user discussed — persisted in meetingData.inProgress */
	let discussedItems: Set<string> = $derived.by(() => {
		if (!selectedPerson) return new Set<string>()
		const entry = meetingData.inProgress?.[selectedPerson]
		return new Set(entry?.discussed ?? [])
	})
	/** Cells scored during this session — persisted in meetingData.inProgress.
	 *  Key format: "oppId:stage:perspective" */
	let recentlyScored: Set<string> = $derived.by(() => {
		if (!selectedPerson) return new Set<string>()
		const entry = meetingData.inProgress?.[selectedPerson]
		return new Set(entry?.recentlyScored ?? [])
	})
	/** Expanded entity card for inline detail */
	let expandedEntity: string | null = $state(null)

	const stakeholderNames = $derived(new Set(collectStakeholders(opportunities, deliverables).keys()))

	const peopleWithUrgency = $derived.by(() => {
		const map = collectPeople(opportunities, deliverables)
		const entries = [...map.values()].map((p) => {
			const urgency = personUrgency(p.name, opportunities)
			// Build the real agenda to count entity groups accurately
			const a = buildMeetingAgenda(p.name, opportunities, deliverables, links, meetingData.lastDiscussed[p.name] ?? null, meetingData.snapshots[p.name] ?? null)
			const ids = new Set<string>()
			for (const c of a.changes) ids.add(c.entityId)
			for (const c of a.commitments) ids.add(c.opportunityId)
			for (const c of a.unscoredCells) ids.add(c.opportunityId)
			for (const c of a.conflicts) ids.add(c.opportunityId)
			for (const d of a.deliverables) ids.add(d.deliverableId)
			for (const o of a.opportunities) ids.add(o.id)
			return { ...p, urgency, itemCount: ids.size, isStakeholder: stakeholderNames.has(p.name) }
		})
		// Sort: most urgent first, then by involvement, then alphabetical
		return entries.sort((a, b) =>
			a.urgency.score - b.urgency.score
			|| (b.opportunityIds.length + b.deliverableIds.length) - (a.opportunityIds.length + a.deliverableIds.length)
			|| a.name.localeCompare(b.name)
		)
	})

	const filteredPeople = $derived(
		roleFilter === 'all' ? peopleWithUrgency
		: roleFilter === 'stakeholders' ? peopleWithUrgency.filter(p => p.isStakeholder)
		: peopleWithUrgency.filter(p => !p.isStakeholder)
	)

	const isSelectedStakeholder = $derived(selectedPerson ? stakeholderNames.has(selectedPerson) : false)

	const stakeholderProfile = $derived(
		selectedPerson && isSelectedStakeholder
			? buildStakeholderProfile(selectedPerson, opportunities, deliverables, links, meetingData.lastDiscussed[selectedPerson] ?? null)
			: null
	)

	const talkingPoints = $derived(stakeholderProfile ? buildTalkingPoints(stakeholderProfile) : [])

	const agenda: MeetingAgenda | null = $derived(
		selectedPerson
			? buildMeetingAgenda(selectedPerson, opportunities, deliverables, links, meetingData.lastDiscussed[selectedPerson] ?? null, meetingData.snapshots[selectedPerson] ?? null)
			: null,
	)

	const pastMeetings = $derived(
		selectedPerson
			? meetingData.records
				.filter((r) => r.personName === selectedPerson)
				.sort((a, b) => b.timestamp - a.timestamp)
				.slice(0, 5)
			: [],
	)

	function selectPerson(name: string) {
		selectedPerson = selectedPerson === name ? null : name
		expandedEntity = null
	}

	function persistInProgress(discussed: Set<string>, scored: Set<string>) {
		if (!selectedPerson) return
		const inProgress = { ...(meetingData.inProgress ?? {}) }
		if (discussed.size === 0 && scored.size === 0) {
			delete inProgress[selectedPerson]
		} else {
			inProgress[selectedPerson] = { discussed: [...discussed], recentlyScored: [...scored] }
		}
		onUpdateMeetingData({ ...meetingData, inProgress })
	}

	/** An entity (opportunity or deliverable) with all its agenda sub-items grouped together */
	interface EntityGroup {
		id: string
		title: string
		type: 'opportunity' | 'deliverable'
		urgencyScore: number
		// opportunity fields
		stage?: Stage
		role?: PersonRole
		// sub-items
		changes: ChangeItem[]
		commitments: CommitmentItem[]
		unscoredCells: UnscoredCell[]
		conflicts: ConflictItem[]
		// deliverable fields
		deliverable?: DeliverableItem
		// nested deliverables (P2: deliverables linked to this opportunity)
		childDeliverables: EntityGroup[]
	}

	/** Agenda items grouped by entity, sorted by urgency */
	const entityGroups = $derived.by((): EntityGroup[] => {
		if (!agenda) return []
		const map = new Map<string, EntityGroup>()

		function ensure(id: string, title: string, type: 'opportunity' | 'deliverable'): EntityGroup {
			let g = map.get(id)
			if (!g) {
				g = { id, title, type, urgencyScore: 0, changes: [], commitments: [], unscoredCells: [], conflicts: [], childDeliverables: [] }
				map.set(id, g)
			}
			return g
		}

		// Opportunities from the agenda (these carry stage/role)
		for (const opp of agenda.opportunities) {
			const g = ensure(opp.id, opp.title, 'opportunity')
			g.stage = opp.stage
			g.role = opp.role
		}

		// Changes
		for (const c of agenda.changes) {
			const g = ensure(c.entityId, c.entityTitle, c.entityType)
			g.changes.push(c)
		}

		// Commitments
		for (const c of agenda.commitments) {
			const g = ensure(c.opportunityId, c.opportunityTitle, 'opportunity')
			g.commitments.push(c)
		}

		// Unscored cells
		for (const c of agenda.unscoredCells) {
			const g = ensure(c.opportunityId, c.opportunityTitle, 'opportunity')
			g.unscoredCells.push(c)
		}

		// Re-inject recently scored cells so the user can still type a verdict
		for (const key of recentlyScored) {
			const [oppId, stage, perspective] = key.split(':') as [string, Stage, Perspective]
			// Skip if still in unscored list (shouldn't happen, but safe)
			if (agenda.unscoredCells.some((c) => c.opportunityId === oppId && c.stage === stage && c.perspective === perspective)) continue
			const opp = opportunities.find((o) => o.id === oppId)
			if (!opp) continue
			const g = ensure(oppId, opp.title, 'opportunity')
			g.unscoredCells.push({
				opportunityId: oppId,
				opportunityTitle: opp.title,
				stage,
				perspective,
				question: CELL_QUESTIONS[stage][perspective],
				daysAssigned: 0,
			})
		}

		// Conflicts
		for (const c of agenda.conflicts) {
			const g = ensure(c.opportunityId, c.opportunityTitle, 'opportunity')
			g.conflicts.push(c)
		}

		// Deliverables
		for (const d of agenda.deliverables) {
			const g = ensure(d.deliverableId, d.title, 'deliverable')
			g.deliverable = d
		}

		// Nest deliverables under their parent opportunity when the opp is also in the agenda
		const nested = new Set<string>()
		for (const g of map.values()) {
			if (g.type !== 'deliverable') continue
			const dLinks = linksForDeliverable(links, g.id)
			for (const dl of dLinks) {
				const parent = map.get(dl.opportunityId)
				if (parent && parent.type === 'opportunity') {
					parent.childDeliverables.push(g)
					nested.add(g.id)
					break
				}
			}
		}
		for (const id of nested) map.delete(id)

		// Compute urgency score for sorting (lower = more urgent)
		for (const g of map.values()) {
			let s = 0
			for (const c of g.commitments) {
				if (c.daysLeft < 0) s -= 1000 + Math.abs(c.daysLeft) * 10
				else if (c.daysLeft <= 7) s -= 500 - c.daysLeft * 10
			}
			if (g.conflicts.length > 0) s -= 300
			if (g.unscoredCells.length > 0) s -= 200 + g.unscoredCells.length * 10
			if (g.changes.length > 0) s -= 100
			g.urgencyScore = s
		}

		return [...map.values()].sort((a, b) => a.urgencyScore - b.urgencyScore || a.title.localeCompare(b.title))
	})

	/** Summary counts for the strip */
	const summaryBadges = $derived.by(() => {
		if (!agenda) return { overdue: 0, soon: 0, conflicts: 0, unscored: 0, changed: 0 }
		return {
			overdue: agenda.commitments.filter((c) => c.daysLeft < 0).length,
			soon: agenda.commitments.filter((c) => c.daysLeft >= 0 && c.daysLeft <= 7 && !c.met).length,
			conflicts: agenda.conflicts.length,
			unscored: agenda.unscoredCells.length,
			changed: agenda.changes.length,
		}
	})

	const allEntityIds = $derived(new Set(entityGroups.flatMap((g) => [g.id, ...g.childDeliverables.map((c) => c.id)])))

	function isDiscussed(entityId: string): boolean {
		return discussedItems.has(entityId)
	}

	function toggleDiscussed(entityId: string) {
		const next = new Set(discussedItems)
		if (next.has(entityId)) {
			next.delete(entityId)
		} else {
			next.add(entityId)
		}
		persistInProgress(next, recentlyScored)
	}

	function markAllDiscussed() {
		if (discussedItems.size === allEntityIds.size) {
			persistInProgress(new Set(), recentlyScored)
		} else {
			persistInProgress(new Set(allEntityIds), recentlyScored)
		}
	}



	function updateSignal(oppId: string, stage: Stage, perspective: Perspective, field: 'score' | 'verdict', value: string) {
		const opp = opportunities.find((o) => o.id === oppId)
		if (!opp) return
		if (field === 'score' && value !== 'none') {
			const key = `${oppId}:${stage}:${perspective}`
			if (!recentlyScored.has(key)) {
				persistInProgress(discussedItems, new Set([...recentlyScored, key]))
			}
		}
		onUpdateOpportunity({
			...opp,
			signals: {
				...opp.signals,
				[stage]: {
					...opp.signals[stage],
					[perspective]: {
						...opp.signals[stage][perspective],
						[field]: value,
					},
				},
			},
		})
	}

	function getSignal(oppId: string, stage: Stage, perspective: Perspective) {
		const opp = opportunities.find((o) => o.id === oppId)
		return opp?.signals[stage]?.[perspective] ?? { score: 'none', verdict: '' }
	}

	function handleDone() {
		if (!selectedPerson || !agenda) return
		if (discussedItems.size === 0) {
			if (!confirm('No items marked as discussed — stamp meeting anyway?')) return
		} else {
			const skipped = allEntityIds.size - discussedItems.size
			const msg = skipped > 0
				? `Mark meeting with ${selectedPerson} as done? ${discussedItems.size} of ${allEntityIds.size} items discussed.`
				: `Mark meeting with ${selectedPerson} as done?`
			if (!confirm(msg)) return
		}
		const scope = discussedItems.size < allEntityIds.size ? discussedItems : undefined
		onBeforeDone?.()
		const updated = completeMeeting(selectedPerson, agenda, meetingData, opportunities, deliverables, links, scope)
		// Clear in-progress state for this person
		const inProgress = { ...(updated.inProgress ?? {}) }
		delete inProgress[selectedPerson]
		onUpdateMeetingData({ ...updated, inProgress })
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
	}

	function daysAgo(ts: number): string {
		const d = Math.floor((Date.now() - ts) / 86_400_000)
		if (d === 0) return 'today'
		if (d === 1) return 'yesterday'
		return `${d}d ago`
	}
</script>

{#snippet checkBox(entityId: string)}
	<span class="item-check" role="checkbox" aria-checked={isDiscussed(entityId)} tabindex="0"
		onclick={(e: MouseEvent) => { e.stopPropagation(); toggleDiscussed(entityId); }}
		onkeydown={(e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleDiscussed(entityId); } }}
	>
		<span class="check-mark"></span>
	</span>
{/snippet}

<div class="meeting-view">
	<div class="meeting-sidebar" class:focused={selectedPerson !== null}>
		{#if selectedPerson}
			<button class="focus-back" onclick={() => selectedPerson = null} title="Back to people list">← All people</button>
			<div class="focus-person-name">{selectedPerson}</div>
			{#if meetingData.lastDiscussed[selectedPerson]}
				<span class="focus-last-met">Last met {daysAgo(meetingData.lastDiscussed[selectedPerson])}</span>
			{:else}
				<span class="focus-last-met never">Never met</span>
			{/if}
		{:else}
			<h2 class="meeting-title">Meeting Prep</h2>
			<p class="meeting-subtitle">Select a person to build an agenda</p>

			<div class="role-filter">
				<button class="role-filter-btn" class:active={roleFilter === 'all'} onclick={() => roleFilter = 'all'}>All</button>
				<button class="role-filter-btn" class:active={roleFilter === 'team'} onclick={() => roleFilter = 'team'}>Team</button>
				<button class="role-filter-btn" class:active={roleFilter === 'stakeholders'} onclick={() => roleFilter = 'stakeholders'}>Stakeholders</button>
			</div>

			<div class="person-list">
			{#each filteredPeople as person}
				<button
					class="person-card"
					class:selected={selectedPerson === person.name}
					class:stakeholder={person.isStakeholder}
					class:urgent={person.urgency.overdueCommitments > 0}
					class:attention={person.urgency.score < 0 && person.urgency.overdueCommitments === 0}
					onclick={() => selectPerson(person.name)}
				>
					<span class="person-name">
						{person.name}
						{#if person.isStakeholder}<span class="stakeholder-badge">stakeholder</span>{/if}
						<span class="item-count-badge">{person.itemCount}</span>
						{#if person.urgency.overdueCommitments > 0}
							<span class="urgency-badge overdue">{person.urgency.overdueCommitments} overdue</span>
						{:else if person.urgency.worstCommitmentDays !== null && person.urgency.worstCommitmentDays <= 7}
							<span class="urgency-badge soon">{person.urgency.worstCommitmentDays}d</span>
						{/if}
					</span>
					<span class="person-meta">
						{#if person.opportunityIds.length > 0}
							<span class="person-stat">{person.opportunityIds.length} opp{person.opportunityIds.length !== 1 ? 's' : ''}</span>
						{/if}
						{#if person.deliverableIds.length > 0}
							<span class="person-stat">{person.deliverableIds.length} del{person.deliverableIds.length !== 1 ? 's' : ''}</span>
						{/if}
						{#if person.urgency.unscoredCells > 0}
							<span class="person-stat awaiting">{person.urgency.unscoredCells} awaiting</span>
						{/if}
					</span>
					<span class="person-roles">
						{#each [...person.roles] as role}
							<span class="role-tag">{role}</span>
						{/each}
						{#if meetingData.lastDiscussed[person.name]}
							<span class="last-met-tag">{daysAgo(meetingData.lastDiscussed[person.name])}</span>
						{:else}
							<span class="last-met-tag never">never met</span>
						{/if}
					</span>
				</button>
			{/each}
			{#if peopleWithUrgency.length === 0}
				<p class="empty-hint">No people to meet with yet. Open an opportunity and add experts, approvers, or stakeholders — they'll appear here with a meeting agenda.</p>
			{/if}
		</div>
		{/if}
	</div>

	<div class="meeting-agenda">
		{#if agenda && selectedPerson}
			<div class="agenda-header">
				<h2 class="agenda-title">{selectedPerson}</h2>
				<div class="agenda-actions">
					{#if allEntityIds.size > 0}
						<button class="toggle-all-btn" onclick={markAllDiscussed} title={discussedItems.size === allEntityIds.size ? 'Clear all' : 'Mark all discussed'}>
							{discussedItems.size === allEntityIds.size ? 'Clear all' : 'All discussed'}
						</button>
						<span class="checked-count">{discussedItems.size}/{allEntityIds.size}</span>
					{/if}
					<button class="done-btn" onclick={handleDone} title="Mark this meeting as done — stamps the current time so next session only shows changes">
						Done ✓
					</button>
				</div>
			</div>

			<!-- Summary strip -->
			{#if summaryBadges.overdue + summaryBadges.soon + summaryBadges.conflicts + summaryBadges.unscored + summaryBadges.changed > 0}
				<div class="summary-strip">
					{#if summaryBadges.overdue > 0}<span class="summary-pill overdue">{summaryBadges.overdue} overdue</span>{/if}
					{#if summaryBadges.soon > 0}<span class="summary-pill soon">{summaryBadges.soon} due soon</span>{/if}
					{#if summaryBadges.conflicts > 0}<span class="summary-pill conflict">{summaryBadges.conflicts} conflict{summaryBadges.conflicts !== 1 ? 's' : ''}</span>{/if}
					{#if summaryBadges.unscored > 0}<span class="summary-pill unscored">{summaryBadges.unscored} awaiting input</span>{/if}
					{#if summaryBadges.changed > 0}<span class="summary-pill changed">{summaryBadges.changed} changed</span>{/if}
				</div>
			{/if}

			{#if entityGroups.length === 0}
				<p class="empty-hint">Nothing to discuss — all clear with {selectedPerson}.</p>
			{/if}

			<!-- Talking points for stakeholders -->
			{#if talkingPoints.length > 0}
				<section class="talking-points-section">
					<h3 class="section-heading">Talking points</h3>
					<ul class="talking-points-list">
						{#each talkingPoints as point}
							<li>{point}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Entity-grouped agenda -->
			{#each entityGroups as group (group.id)}
				<div class="entity-card" class:discussed={isDiscussed(group.id)} class:expanded={expandedEntity === group.id}>
					<div class="entity-header">
						{@render checkBox(group.id)}
						<button class="entity-title" onclick={() => expandedEntity = expandedEntity === group.id ? null : group.id}>
							{group.title}
						</button>
						<span class="entity-meta">
							{#if group.type === 'opportunity' && group.stage}
								<span class="stage-badge">{stageLabel(group.stage)}</span>
							{/if}
							{#if group.type === 'opportunity'}
								{@const effort = opportunityEffort(group.id, deliverables, links)}
								{#if effort !== null}
									<span class="effort-tag" title="Estimated effort (median)">≈{formatDays(effort)}</span>
								{/if}
							{/if}
							{#if group.role}
								<span class="role-tag">{group.role}</span>
							{/if}
							{#if group.type === 'deliverable'}
								<span class="entity-type-tag">deliverable</span>
							{/if}
							<button class="open-link" onclick={() => group.type === 'opportunity' ? onSelectOpportunity(group.id) : onSelectDeliverable(group.id)} title="Open detail view">↗</button>
						</span>
					</div>

					<div class="entity-items">
						<!-- Changes -->
						{#each group.changes as change}
							<div class="sub-item change-item">
								<span class="change-badge">{change.description}</span>
							</div>
						{/each}

						<!-- Commitments -->
						{#each group.commitments as item}
							<div class="sub-item commitment-item" class:overdue={item.daysLeft < 0}>
								<span class="sub-label">→ Inform</span>
								<span class="sub-content">
									Reach <strong>{stageLabel(item.commitment.milestone)}</strong>
									{#if item.met}
										<span class="badge met">met</span>
									{:else if item.daysLeft < 0}
										<span class="badge overdue">{Math.abs(item.daysLeft)}d overdue</span>
									{:else if item.daysLeft <= 7}
										<span class="badge soon">{item.daysLeft}d left</span>
									{:else}
										<span class="badge">{item.daysLeft}d left</span>
									{/if}
								</span>
							</div>
						{/each}

						<!-- Conflicts -->
						{#each group.conflicts as conflict}
							<div class="sub-item conflict-item">
								<span class="sub-label">↔ Conflict</span>
								<span class="sub-content">
									<span class="perspective-tag">{PERSPECTIVE_LABELS[conflict.perspective]}</span>
									{SCORE_SYMBOL[conflict.theirScore.score]}
									vs.
									<span class="perspective-tag">{PERSPECTIVE_LABELS[conflict.conflictingPerspective]}</span>
									{SCORE_SYMBOL[conflict.conflictingScore.score]}
									at {stageLabel(conflict.stage)}
								</span>
								{#if conflict.theirScore.verdict}
									<span class="card-verdict">"{conflict.theirScore.verdict}"</span>
								{/if}
							</div>
						{/each}

						<!-- Unscored cells (inline scoring) -->
						{#each group.unscoredCells as cell}
							<div class="sub-item scoring-item">
								<span class="sub-label">← Need</span>
								<span class="sub-content">
									<span class="perspective-tag">{PERSPECTIVE_LABELS[cell.perspective]}</span>
									at {stageLabel(cell.stage)}
									{#if cell.daysAssigned > 0}
										<span class="days-ago">· {cell.daysAssigned}d ago</span>
									{/if}
								</span>
								<span class="card-question">{cell.question}</span>
								<div class="scoring-controls">
									<ScoreToggle
										score={getSignal(cell.opportunityId, cell.stage, cell.perspective).score}
										label="{PERSPECTIVE_LABELS[cell.perspective]} — {stageLabel(cell.stage)}"
										onScoreChange={(s) => updateSignal(cell.opportunityId, cell.stage, cell.perspective, 'score', s)}
									/>
									<input
										type="text"
										class="verdict-input"
										placeholder="Verdict…"
										value={getSignal(cell.opportunityId, cell.stage, cell.perspective).verdict}
										oninput={(e) => updateSignal(cell.opportunityId, cell.stage, cell.perspective, 'verdict', (e.target as HTMLInputElement).value)}
									/>
								</div>
							</div>
						{/each}

						<!-- Deliverable info -->
						{#if group.deliverable}
							{@const d = group.deliverable}
							<div class="sub-item deliverable-info">
								<span class="sub-content">
									<span class="role-tag">{d.role}</span>
									{#if d.size}<span class="size-tag">{d.size}</span>{/if}
									{#if d.certainty}<span class="certainty-dots">{'●'.repeat(d.certainty)}{'○'.repeat(5 - d.certainty)}</span>{/if}
								</span>
								{#if d.linkedOpportunityTitles.length > 0}
									<span class="card-links">→ {d.linkedOpportunityTitles.join(', ')}</span>
								{/if}
							</div>
						{/if}

						<!-- Nested deliverables (P2) -->
						{#each group.childDeliverables as child (child.id)}
							<div class="sub-item nested-deliverable" class:discussed={isDiscussed(child.id)}>
								<div class="nested-header">
									{@render checkBox(child.id)}
									<button class="nested-title" onclick={() => expandedEntity = expandedEntity === child.id ? null : child.id}>
										{child.title}
									</button>
									<span class="entity-type-tag">deliverable</span>
									<button class="open-link" onclick={() => onSelectDeliverable(child.id)} title="Open detail view">↗</button>
								</div>
								{#if child.deliverable}
									<span class="sub-content nested-meta">
										<span class="role-tag">{child.deliverable.role}</span>
										{#if child.deliverable.size}<span class="size-tag">{child.deliverable.size}</span>{/if}
										{#if child.deliverable.certainty}<span class="certainty-dots">{'●'.repeat(child.deliverable.certainty)}{'○'.repeat(5 - child.deliverable.certainty)}</span>{/if}
									</span>
								{/if}
								{#each child.changes as change}
									<span class="change-badge">{change.description}</span>
								{/each}
							</div>
						{/each}

						<!-- Inline detail (P3) -->
						{#if expandedEntity === group.id}
							{@const entity = group.type === 'opportunity' ? opportunities.find(o => o.id === group.id) : deliverables.find(d => d.id === group.id)}
							{#if entity}
								<div class="inline-detail">
									{#if group.type === 'opportunity' && 'description' in entity}
										{@const opp = entity as import('../lib/types').Opportunity}
										{#if opp.description}
											<p class="detail-description">{opp.description}</p>
										{/if}
										{#if opp.people.length > 0}
											<div class="detail-row">
												<span class="detail-label">People</span>
												<span class="detail-value">
													{#each opp.people as person}
														<span class="role-tag">{person.name} ({person.role})</span>
													{/each}
												</span>
											</div>
										{/if}
										{#if opp.origin}
											<div class="detail-row">
												<span class="detail-label">Origin</span>
												<span class="detail-value">{opp.origin}</span>
											</div>
										{/if}
										{#if opp.horizon}
											<div class="detail-row">
												<span class="detail-label">Horizon</span>
												<span class="detail-value">{opp.horizon}</span>
											</div>
										{/if}
									{:else if group.type === 'deliverable' && 'kind' in entity}
										{@const del = entity as import('../lib/types').Deliverable}
										<div class="detail-row">
											<span class="detail-label">Kind</span>
											<span class="detail-value">{del.kind}</span>
										</div>
										{#if del.externalUrl}
											<div class="detail-row">
												<span class="detail-label">Link</span>
												<span class="detail-value"><a href={del.externalUrl} target="_blank" rel="noopener">{del.externalUrl}</a></span>
											</div>
										{/if}
										{#if del.extraContributors.length > 0}
											<div class="detail-row">
												<span class="detail-label">Contributors</span>
												<span class="detail-value">{del.extraContributors.join(', ')}</span>
											</div>
										{/if}
										{#if del.extraConsumers.length > 0}
											<div class="detail-row">
												<span class="detail-label">Consumers</span>
												<span class="detail-value">{del.extraConsumers.join(', ')}</span>
											</div>
										{/if}
										{#if del.externalDependency}
											<div class="detail-row">
												<span class="detail-label">Dependency</span>
												<span class="detail-value">{del.externalDependency}</span>
											</div>
										{/if}
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}

			<!-- Past meetings -->
			{#if pastMeetings.length > 0}
				<section class="agenda-section past-meetings">
					<h3 class="section-heading context">Previous Meetings</h3>
					{#each pastMeetings as record}
						<div class="past-meeting-card">
							<span class="past-date">{formatDate(record.timestamp)}</span>
							<span class="past-summary">{record.summary.join(' · ')}</span>
						</div>
					{/each}
				</section>
			{/if}
		{:else}
			<div class="agenda-empty">
				<p>Select a person from the list to see what to discuss.</p>
				<p class="empty-hint">The agenda is built automatically from their assignments, commitments, and deliverables.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.meeting-view {
		display: flex;
		height: 100%;
		min-height: 0;
	}

	.meeting-sidebar {
		width: 240px;
		flex-shrink: 0;
		border-right: 1px solid var(--c-border-soft);
		padding: var(--sp-md);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		transition: width var(--tr-normal);
	}

	.meeting-sidebar.focused {
		width: 160px;
	}

	.focus-back {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: 0;
		text-align: left;
	}

	.focus-back:hover {
		color: var(--c-accent);
	}

	.focus-person-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.focus-last-met {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.focus-last-met.never {
		color: var(--c-warm);
	}

	.meeting-title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
	}

	.meeting-subtitle {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.role-filter {
		display: flex;
		gap: 1px;
		background: var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin-top: var(--sp-xs);
	}

	.role-filter-btn {
		flex: 1;
		padding: var(--sp-3xs) var(--sp-xs);
		font: inherit;
		font-size: var(--fs-xs);
		border: none;
		background: var(--c-surface);
		color: var(--c-text-muted);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.role-filter-btn:hover {
		background: var(--c-hover);
	}

	.role-filter-btn.active {
		background: var(--c-accent);
		color: var(--c-bg);
		font-weight: var(--fw-medium);
	}

	.talking-points-section {
		background: var(--c-surface-alt);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm) var(--sp-md);
	}

	.talking-points-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
		font-size: var(--fs-sm);
		color: var(--c-text);
		line-height: 1.4;
	}

	.person-list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.person-card {
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm);
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--c-text);
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: background var(--tr-fast), border-color var(--tr-fast);
	}

	.person-card:hover {
		background: var(--c-hover);
	}

	.person-card.selected {
		border-color: var(--c-accent);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), var(--c-surface));
	}

	.person-card.stakeholder {
		border-left: 3px solid var(--c-warm);
	}

	.person-card.stakeholder.selected {
		border-color: var(--c-accent);
		border-left-color: var(--c-warm);
	}

	.person-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}

	.item-count-badge {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		background: var(--c-neutral-bg);
		color: var(--c-text-muted);
		padding: 0 var(--sp-xs);
		border-radius: var(--radius-sm);
		margin-left: var(--sp-xs);
	}

	.person-meta {
		display: flex;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.person-stat {
		white-space: nowrap;
	}

	.commitment-badge {
		color: var(--c-warm);
	}

	.person-roles {
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
	}

	.last-met-tag {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
	}

	.last-met-tag.never {
		color: var(--c-warm);
	}

	.role-tag {
		font-size: var(--fs-2xs);
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
	}

	.stakeholder-badge {
		font-size: var(--fs-2xs);
		background: var(--c-warm-bg);
		color: var(--c-warm);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		margin-left: var(--sp-xs);
		font-weight: var(--fw-medium);
		letter-spacing: 0.02em;
	}

	/* ── Agenda ── */

	.meeting-agenda {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: var(--sp-lg);
		display: flex;
		flex-direction: column;
		gap: var(--sp-md);
	}

	.agenda-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-md);
	}

	.agenda-title {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
	}

	.agenda-actions {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		flex-shrink: 0;
	}

	.toggle-all-btn {
		background: none;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		padding: 2px var(--sp-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.toggle-all-btn:hover {
		background: var(--c-hover);
	}

	.checked-count {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		white-space: nowrap;
	}

	.done-btn {
		background: var(--c-green-signal);
		color: var(--c-surface);
		border: none;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		padding: var(--sp-xs) var(--sp-md);
		border-radius: var(--radius-sm);
		cursor: pointer;
		white-space: nowrap;
		transition: opacity var(--tr-fast);
	}

	.done-btn:hover {
		opacity: 0.85;
	}

	.agenda-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		text-align: center;
		gap: var(--sp-sm);
	}

	/* ── Summary strip ── */

	.summary-strip {
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
	}

	.summary-pill {
		font-size: var(--fs-2xs);
		padding: 2px var(--sp-sm);
		border-radius: var(--radius-sm);
		font-weight: var(--fw-medium);
	}

	.summary-pill.overdue { background: var(--c-red-bg); color: var(--c-red); }
	.summary-pill.soon { background: var(--c-warm-bg); color: var(--c-warm); }
	.summary-pill.conflict { background: var(--c-red-bg); color: var(--c-red); }
	.summary-pill.unscored { background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent); color: var(--c-accent); }
	.summary-pill.changed { background: var(--c-green-bg); color: var(--c-green-signal); }

	/* ── Entity cards ── */

	.entity-card {
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		overflow: hidden;
		transition: opacity var(--tr-fast);
	}

	.entity-card.discussed {
		opacity: 0.55;
	}

	.entity-card.expanded {
		border-color: var(--c-accent);
	}

	.open-link {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.entity-header:hover .open-link,
	.nested-header:hover .open-link,
	.open-link:focus-visible {
		opacity: 1;
	}

	.open-link:hover {
		color: var(--c-accent);
	}

	.entity-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-md);
	}

	.entity-title {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-accent);
		cursor: pointer;
		padding: 0;
		text-align: left;
		text-decoration: none;
		flex: 1;
		min-width: 0;
	}

	.entity-title:hover {
		text-decoration: underline;
	}

	.entity-meta {
		display: flex;
		gap: var(--sp-xs);
		flex-shrink: 0;
	}

	.entity-type-tag {
		font-size: var(--fs-2xs);
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
	}

	.entity-items {
		display: flex;
		flex-direction: column;
	}

	.sub-item {
		padding: var(--sp-xs) var(--sp-md) var(--sp-xs) calc(var(--sp-md) + 14px + var(--sp-sm));
		border-top: 1px solid var(--c-border-soft);
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--fs-xs);
	}

	.sub-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-ghost);
	}

	.sub-content {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-wrap: wrap;
		color: var(--c-text-muted);
	}

	.commitment-item.overdue {
		background: color-mix(in srgb, var(--c-red) 4%, transparent);
	}

	.change-item {
		background: color-mix(in srgb, var(--c-green-signal) 4%, transparent);
	}

	.conflict-item {
		background: color-mix(in srgb, var(--c-red) 4%, transparent);
	}

	/* ── Nested deliverables ── */

	.nested-deliverable {
		background: color-mix(in srgb, var(--c-accent) 3%, transparent);
		transition: opacity var(--tr-fast);
	}

	.nested-deliverable.discussed {
		opacity: 0.55;
	}

	.nested-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}

	.nested-title {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-accent);
		cursor: pointer;
		padding: 0;
		text-align: left;
		flex: 1;
		min-width: 0;
	}

	.nested-title:hover {
		text-decoration: underline;
	}

	.nested-meta {
		margin-left: calc(16px + var(--sp-sm));
	}

	/* ── Inline detail (P3) ── */

	.inline-detail {
		padding: var(--sp-sm) var(--sp-md);
		border-top: 1px solid var(--c-border-soft);
		background: color-mix(in srgb, var(--c-accent) 3%, var(--c-surface));
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.detail-description {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		line-height: var(--lh-relaxed);
	}

	.detail-row {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		font-size: var(--fs-xs);
	}

	.detail-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-ghost);
		flex-shrink: 0;
		min-width: 5em;
	}

	.detail-value {
		color: var(--c-text-muted);
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
	}

	.detail-value a {
		color: var(--c-accent);
		text-decoration: none;
	}

	.detail-value a:hover {
		text-decoration: underline;
	}

	/* ── Shared styles ── */

	.stage-badge {
		font-size: var(--fs-2xs);
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.effort-tag {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: var(--c-accent);
		background: var(--c-accent-bg, oklch(0.95 0.02 250));
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.size-tag {
		font-size: var(--fs-2xs);
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-weight: var(--fw-medium);
	}

	.certainty-dots {
		font-size: var(--fs-3xs);
		letter-spacing: 1px;
		color: var(--c-text-muted);
	}

	.perspective-tag {
		font-size: var(--fs-2xs);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		color: var(--c-accent);
		font-weight: var(--fw-medium);
	}

	.days-ago {
		color: var(--c-text-ghost);
	}

	.badge {
		font-size: var(--fs-2xs);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		background: var(--c-neutral-bg);
	}

	.badge.overdue {
		background: var(--c-red-bg);
		color: var(--c-red);
		font-weight: var(--fw-medium);
	}

	.badge.soon {
		background: var(--c-warm-bg);
		color: var(--c-warm);
	}

	.badge.met {
		background: var(--c-green-bg);
		color: var(--c-green-signal);
	}

	.change-badge {
		font-size: var(--fs-2xs);
		background: var(--c-green-bg);
		color: var(--c-green-signal);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-weight: var(--fw-medium);
	}

	.card-question {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.card-verdict {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-style: italic;
	}

	.card-links {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
	}

	.empty-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	/* ── Inline scoring ── */

	.scoring-controls {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-top: var(--sp-xs);
	}

	.verdict-input {
		font-family: var(--font-reading);
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
		padding: 1px 0;
		flex: 1;
		min-width: 0;
		transition: border-color var(--tr-fast);
	}

	.verdict-input:focus {
		outline: none;
		border-color: var(--c-accent);
	}

	/* ── Past meetings ── */

	.agenda-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}

	.section-heading {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-heading.context { color: var(--c-text-muted); }

	.past-meetings {
		opacity: 0.7;
		border-top: 1px solid var(--c-border-soft);
		padding-top: var(--sp-md);
	}

	.past-meeting-card {
		display: flex;
		gap: var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: var(--sp-xs) 0;
	}

	.past-date {
		font-weight: var(--fw-medium);
		white-space: nowrap;
		min-width: 4em;
	}

	.past-summary {
		color: var(--c-text-ghost);
	}

	/* ── Item checkboxes (left-aligned) ── */

	.item-check {
		display: flex;
		align-items: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.check-mark {
		width: 16px;
		height: 16px;
		border: 1px solid var(--c-border);
		border-radius: 3px;
		background: var(--c-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background var(--tr-fast), border-color var(--tr-fast);
	}

	.item-check[aria-checked="true"] .check-mark {
		background: var(--c-accent);
		border-color: var(--c-accent);
	}

	.item-check[aria-checked="true"] .check-mark::after {
		content: '✓';
		color: var(--c-surface);
		font-size: 11px;
		font-weight: bold;
		line-height: 1;
	}

	.item-check:focus-visible .check-mark {
		box-shadow: 0 0 0 2px var(--c-accent);
	}
</style>
