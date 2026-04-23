<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Stage,
		type Perspective,
		type Score,
		PERSPECTIVE_LABELS,
		SCORE_SYMBOL,
		SCORE_DISPLAY,
		STAGES,
		scoreClass,
		stageLabel,
	} from '../lib/types'
	import { collectPeople, buildMeetingAgenda, personUrgency, completeMeeting, type MeetingAgenda, type MeetingData } from '../lib/meeting'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		meetingData: MeetingData
		onSelectOpportunity: (id: string) => void
		onUpdateOpportunity: (updated: Opportunity) => void
		onUpdateMeetingData: (data: MeetingData) => void
	}

	let { opportunities, deliverables, links, meetingData, onSelectOpportunity, onUpdateOpportunity, onUpdateMeetingData }: Props = $props()

	let selectedPerson: string | null = $state(null)

	const peopleWithUrgency = $derived.by(() => {
		const map = collectPeople(opportunities, deliverables)
		const entries = [...map.values()].map((p) => ({
			...p,
			urgency: personUrgency(p.name, opportunities),
		}))
		// Sort: most urgent first, then by involvement, then alphabetical
		return entries.sort((a, b) =>
			a.urgency.score - b.urgency.score
			|| (b.opportunityIds.length + b.deliverableIds.length) - (a.opportunityIds.length + a.deliverableIds.length)
			|| a.name.localeCompare(b.name)
		)
	})

	const agenda: MeetingAgenda | null = $derived(
		selectedPerson
			? buildMeetingAgenda(selectedPerson, opportunities, deliverables, links, meetingData.lastDiscussed[selectedPerson] ?? null, meetingData.snapshots[selectedPerson] ?? null)
			: null,
	)

	const totalItems = $derived(
		agenda
			? agenda.commitments.length + agenda.unscoredCells.length + agenda.deliverables.length + agenda.conflicts.length + agenda.changes.length
			: 0,
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
	}



	function updateSignal(oppId: string, stage: Stage, perspective: Perspective, field: 'score' | 'verdict', value: string) {
		const opp = opportunities.find((o) => o.id === oppId)
		if (!opp) return
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
		if (!confirm(`Mark meeting with ${selectedPerson} as done? This stamps the current time for change tracking.`)) return
		const updated = completeMeeting(selectedPerson, agenda, meetingData, opportunities, deliverables, links)
		onUpdateMeetingData(updated)
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

<div class="meeting-view">
	<div class="meeting-sidebar">
		<h2 class="meeting-title">Meeting Prep</h2>
		<p class="meeting-subtitle">Select a person to build an agenda</p>

		<div class="person-list">
			{#each peopleWithUrgency as person}
				<button
					class="person-card"
					class:selected={selectedPerson === person.name}
					class:urgent={person.urgency.overdueCommitments > 0}
					class:attention={person.urgency.score < 0 && person.urgency.overdueCommitments === 0}
					onclick={() => selectPerson(person.name)}
				>
					<span class="person-name">
						{person.name}
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
				<p class="empty-hint">No people linked to opportunities or deliverables yet.</p>
			{/if}
		</div>
	</div>

	<div class="meeting-agenda">
		{#if agenda && selectedPerson}
			<div class="agenda-header">
				<div>
					<h2 class="agenda-title">Agenda: {selectedPerson}</h2>
					{#if agenda.lastMet}
						<p class="last-met">Last met: {formatDate(agenda.lastMet)} ({daysAgo(agenda.lastMet)})</p>
					{:else}
						<p class="last-met">Never met — showing all items</p>
					{/if}
				</div>
				<button class="done-btn" onclick={handleDone} title="Mark this meeting as done — stamps the current time so next session only shows changes">
					Done ✓
				</button>
			</div>

			{#if totalItems === 0}
				<p class="empty-hint">Nothing to discuss — all clear with {selectedPerson}.</p>
			{/if}

			<!-- Changes since last meeting -->
			{#if agenda.changes.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading changes">Changed Since Last Meeting</h3>
					{#each agenda.changes as change}
						<button class="agenda-card compact changed-card" onclick={() => onSelectOpportunity(change.entityId)}>
							<span class="card-title">{change.entityTitle}</span>
							<span class="card-detail">
								<span class="change-badge">{change.description}</span>
								<span class="entity-type">{change.entityType}</span>
							</span>
						</button>
					{/each}
				</section>
			{:else if agenda.lastMet !== null}
				<p class="no-changes-hint">No changes since last meeting</p>
			{/if}

			<!-- Commitments (Bring to them) -->
			{#if agenda.commitments.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading bring">Commitments</h3>
					<p class="section-hint">Promises made to {selectedPerson}</p>
					{#each agenda.commitments as item}
						<button class="agenda-card" class:overdue={item.daysLeft < 0} onclick={() => onSelectOpportunity(item.opportunityId)}>
							<span class="card-title">{item.opportunityTitle}</span>
							<span class="card-detail">
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
						</button>
					{/each}
				</section>
			{/if}

			<!-- Unscored cells (Gather from them) -->
			{#if agenda.unscoredCells.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading gather">Awaiting Input</h3>
					<p class="section-hint">Signal cells assigned to {selectedPerson} — not yet scored</p>
					{#each agenda.unscoredCells as cell}
						<div class="agenda-card scoring-card">
							<div class="scoring-header">
								<button class="card-title-link" onclick={() => onSelectOpportunity(cell.opportunityId)}>
									{cell.opportunityTitle}
								</button>
								<span class="card-detail">
									<span class="perspective-tag">{PERSPECTIVE_LABELS[cell.perspective]}</span>
									at {stageLabel(cell.stage)}
									{#if cell.daysAssigned > 0}
										<span class="days-ago">· {cell.daysAssigned}d ago</span>
									{/if}
								</span>
							</div>
							<span class="card-question">{cell.question}</span>
							<div class="scoring-controls">
								<div class="score-toggle" role="radiogroup" aria-label="{PERSPECTIVE_LABELS[cell.perspective]} — {stageLabel(cell.stage)}">
									{#each (['none', 'positive', 'uncertain', 'negative'] as const) as s}
										<button
											class="score-btn {scoreClass(s)}"
											class:active={getSignal(cell.opportunityId, cell.stage, cell.perspective).score === s}
											onclick={() => updateSignal(cell.opportunityId, cell.stage, cell.perspective, 'score', s)}
											title={SCORE_DISPLAY[s].label}
											aria-pressed={getSignal(cell.opportunityId, cell.stage, cell.perspective).score === s}
										>{SCORE_SYMBOL[s]}</button>
									{/each}
								</div>
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
				</section>
			{/if}

			<!-- Conflicts (Surface for discussion) -->
			{#if agenda.conflicts.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading discuss">Conflicting Signals</h3>
					<p class="section-hint">Perspectives that disagree at the same stage</p>
					{#each agenda.conflicts as conflict}
						<button class="agenda-card" onclick={() => onSelectOpportunity(conflict.opportunityId)}>
							<span class="card-title">{conflict.opportunityTitle}</span>
							<span class="card-detail">
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
						</button>
					{/each}
				</section>
			{/if}

			<!-- Deliverables -->
			{#if agenda.deliverables.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading deliverables">Deliverables</h3>
					<p class="section-hint">Work items {selectedPerson} is involved with</p>
					{#each agenda.deliverables as d}
						<div class="agenda-card" class:changed-card={d.changed}>
							<span class="card-title">
								{d.title}
								{#if d.changed}<span class="change-dot" title="Changed since last meeting">●</span>{/if}
							</span>
							<span class="card-detail">
								<span class="role-tag">{d.role}</span>
								{#if d.size}<span class="size-tag">{d.size}</span>{/if}
								{#if d.certainty}<span class="certainty-dots">{'●'.repeat(d.certainty)}{'○'.repeat(5 - d.certainty)}</span>{/if}
							</span>
							{#if d.linkedOpportunityTitles.length > 0}
								<span class="card-links">→ {d.linkedOpportunityTitles.join(', ')}</span>
							{/if}
						</div>
					{/each}
				</section>
			{/if}

			<!-- Opportunities summary -->
			{#if agenda.opportunities.length > 0}
				<section class="agenda-section">
					<h3 class="section-heading context">Linked Opportunities</h3>
					{#each agenda.opportunities as opp}
						<button class="agenda-card compact" class:changed-card={opp.changed} onclick={() => onSelectOpportunity(opp.id)}>
							<span class="card-title">
								{opp.title}
								{#if opp.changed}<span class="change-dot" title="Changed since last meeting">●</span>{/if}
							</span>
							<span class="card-detail">
								<span class="stage-badge">{stageLabel(opp.stage)}</span>
								<span class="role-tag">{opp.role}</span>
							</span>
						</button>
					{/each}
				</section>
			{/if}

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
	}

	.meeting-title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: 700;
	}

	.meeting-subtitle {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
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
		background: color-mix(in srgb, var(--c-accent) 8%, var(--c-surface));
	}

	.person-name {
		font-size: var(--fs-sm);
		font-weight: 600;
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

	.role-tag {
		font-size: 0.7rem;
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
	}

	/* ── Agenda ── */

	.meeting-agenda {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: var(--sp-lg);
		display: flex;
		flex-direction: column;
		gap: var(--sp-lg);
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
		font-weight: 700;
	}

	.last-met {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.last-met-tag {
		font-size: 0.65rem;
		color: var(--c-text-ghost);
	}

	.last-met-tag.never {
		color: var(--c-warm);
	}

	.done-btn {
		background: var(--c-green-signal);
		color: var(--c-surface);
		border: none;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 600;
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

	.agenda-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}

	.section-heading {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-heading.bring { color: var(--c-warm); }
	.section-heading.gather { color: var(--c-accent); }
	.section-heading.discuss { color: var(--c-red); }
	.section-heading.changes { color: var(--c-green-signal); }
	.section-heading.deliverables { color: var(--c-text-muted); }
	.section-heading.context { color: var(--c-text-muted); }

	.section-hint {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.agenda-card {
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm) var(--sp-md);
		display: flex;
		flex-direction: column;
		gap: 2px;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--c-text);
		transition: background var(--tr-fast);
	}

	.agenda-card:hover {
		background: var(--c-hover);
	}

	.agenda-card.compact {
		padding: var(--sp-xs) var(--sp-sm);
	}

	.agenda-card.overdue {
		border-left: 3px solid var(--c-red);
	}

	.card-title {
		font-size: var(--fs-sm);
		font-weight: 600;
	}

	.card-detail {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-wrap: wrap;
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
		font-size: 0.7rem;
		color: var(--c-text-ghost);
	}

	.perspective-tag {
		font-size: 0.7rem;
		background: color-mix(in srgb, var(--c-accent) 12%, transparent);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		color: var(--c-accent);
		font-weight: 600;
	}

	.stage-badge {
		font-size: 0.7rem;
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.size-tag {
		font-size: 0.7rem;
		background: var(--c-neutral-bg);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.certainty-dots {
		font-size: 0.6rem;
		letter-spacing: 1px;
		color: var(--c-text-muted);
	}

	.days-ago {
		color: var(--c-text-ghost);
	}

	.badge {
		font-size: 0.7rem;
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		background: var(--c-neutral-bg);
	}

	.badge.overdue {
		background: var(--c-red-bg);
		color: var(--c-red);
		font-weight: 600;
	}

	.badge.soon {
		background: var(--c-warm-bg);
		color: var(--c-warm);
	}

	.badge.met {
		background: var(--c-green-bg);
		color: var(--c-green-signal);
	}

	.empty-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	.no-changes-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
		margin: 0 0 var(--sp-sm);
	}

	/* ── Inline scoring ── */

	.scoring-card {
		cursor: default;
	}

	.scoring-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.card-title-link {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--c-accent);
		cursor: pointer;
		padding: 0;
		text-align: left;
		text-decoration: none;
	}

	.card-title-link:hover {
		text-decoration: underline;
	}

	.scoring-controls {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-top: var(--sp-xs);
	}

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

	.score-btn:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
	.score-btn:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
	.score-btn:not(:first-child) { border-left: none; }
	.score-btn:hover { background: color-mix(in srgb, var(--c-text) 6%, var(--c-surface)); }

	.score-btn.active.score-none { background: var(--c-neutral-bg); color: var(--c-text-muted); border-color: var(--c-text-ghost); }
	.score-btn.active.score-positive { background: var(--c-green-signal); color: var(--c-surface); border-color: var(--c-green-signal); }
	.score-btn.active.score-uncertain { background: var(--c-warm); color: var(--c-surface); border-color: var(--c-warm); }
	.score-btn.active.score-negative { background: var(--c-red); color: var(--c-surface); border-color: var(--c-red); }

	.verdict-input {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--c-border) 40%, transparent);
		padding: 1px 0;
		flex: 1;
		min-width: 0;
		transition: border-color var(--tr-fast);
	}

	.verdict-input:focus {
		outline: none;
		border-color: var(--c-accent);
	}

	/* ── Change detection ── */

	.changed-card {
		border-left: 3px solid var(--c-green-signal);
	}

	.change-dot {
		color: var(--c-green-signal);
		font-size: 0.6rem;
		margin-left: var(--sp-xs);
	}

	.change-badge {
		font-size: 0.7rem;
		background: var(--c-green-bg);
		color: var(--c-green-signal);
		padding: 1px var(--sp-xs);
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.entity-type {
		font-size: 0.7rem;
		color: var(--c-text-ghost);
	}

	/* ── Past meetings ── */

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
		font-weight: 600;
		white-space: nowrap;
		min-width: 4em;
	}

	.past-summary {
		color: var(--c-text-ghost);
	}
</style>
