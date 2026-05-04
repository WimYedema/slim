<script lang="ts">
	import type {
		Opportunity,
		Deliverable,
		OpportunityDeliverableLink,
	} from '../lib/types'
	import { stageLabel, SCORE_SYMBOL } from '../lib/types'
	import type { MeetingData } from '../lib/meeting'
	import {
		buildStakeholderSummaries,
		buildStakeholderProfile,
		buildTalkingPoints,
		type StakeholderProfile,
		type StakeholderSummary,
	} from '../lib/stakeholders'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		meetingData: MeetingData
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
	}

	let { opportunities, deliverables, links, meetingData, onSelectOpportunity, onSelectDeliverable }: Props = $props()

	let selectedName: string | null = $state(null)

	const summaries = $derived(
		buildStakeholderSummaries(opportunities, deliverables, links, meetingData.lastDiscussed)
	)

	const profile: StakeholderProfile | null = $derived(
		selectedName
			? buildStakeholderProfile(selectedName, opportunities, deliverables, links, meetingData.lastDiscussed[selectedName] ?? null)
			: null
	)

	const talkingPoints = $derived(profile ? buildTalkingPoints(profile) : [])

	function daysAgo(timestamp: number | null): string {
		if (!timestamp) return 'Never'
		const days = Math.floor((Date.now() - timestamp) / 86_400_000)
		if (days === 0) return 'Today'
		if (days === 1) return 'Yesterday'
		return `${days}d ago`
	}

	function scoreSymbol(score: string): string {
		return SCORE_SYMBOL[score as keyof typeof SCORE_SYMBOL] ?? '—'
	}
</script>

<div class="sh-container">
	{#if summaries.length === 0}
		<div class="sh-empty">
			<p class="sh-empty-title">No stakeholders yet</p>
			<p class="sh-empty-hint">Add people with the <strong>Stakeholder</strong> role on opportunities, or add <strong>consumers</strong> on deliverables.</p>
		</div>
	{:else}
		<div class="sh-layout">
			<!-- Left: stakeholder list -->
			<div class="sh-list">
				<div class="sh-list-header">
					<h2 class="sh-heading">Stakeholders</h2>
					<span class="sh-count">{summaries.length}</span>
				</div>

				{#each summaries as s (s.name)}
					<button
						class="sh-card"
						class:active={selectedName === s.name}
						class:attention={s.attention}
						onclick={() => selectedName = selectedName === s.name ? null : s.name}
					>
						<div class="sh-card-top">
							<span class="sh-card-name">{s.name}</span>
							{#if s.attention}
								<span class="sh-badge sh-badge-attention" title="Needs attention">!</span>
							{/if}
						</div>
						<div class="sh-card-stats">
							<span title="Opportunities">{s.opportunityCount} opp{s.opportunityCount !== 1 ? 's' : ''}</span>
							{#if s.commitmentCount > 0}
								<span class="sh-stat-sep">·</span>
								<span title="Commitments">{s.commitmentCount} commitment{s.commitmentCount !== 1 ? 's' : ''}</span>
							{/if}
							{#if s.overdueCount > 0}
								<span class="sh-stat-sep">·</span>
								<span class="sh-overdue" title="Overdue commitments">{s.overdueCount} overdue</span>
							{/if}
						</div>
						<div class="sh-card-meta">
							{#if s.inputNeededCount > 0}
								<span class="sh-input-needed">{s.inputNeededCount} input needed</span>
							{/if}
							<span class="sh-last-contact">{daysAgo(s.lastDiscussed)}</span>
						</div>
					</button>
				{/each}
			</div>

			<!-- Right: stakeholder detail -->
			<div class="sh-detail">
				{#if profile}
					<div class="sh-detail-inner">
						<h2 class="sh-detail-name">{profile.name}</h2>
						<p class="sh-detail-contact">Last discussed: {daysAgo(profile.lastDiscussed)}</p>

						<!-- Talking points -->
						{#if talkingPoints.length > 0}
							<section class="sh-section">
								<h3 class="sh-section-title">Talking points</h3>
								<ul class="sh-talking-points">
									{#each talkingPoints as point}
										<li>{point}</li>
									{/each}
								</ul>
							</section>
						{/if}

						<!-- Commitments -->
						{#if profile.commitments.length > 0}
							<section class="sh-section">
								<h3 class="sh-section-title">Commitments</h3>
								{#each profile.commitments as c}
									<button class="sh-commitment" class:overdue={c.overdue} class:met={c.met}
										onclick={() => onSelectOpportunity(c.opportunityId)}>
										<span class="sh-commitment-opp">{c.opportunityTitle}</span>
										<span class="sh-commitment-milestone">→ {stageLabel(c.commitment.milestone)}</span>
										<span class="sh-commitment-deadline">
											{#if c.met}
												✓ met
											{:else if c.overdue}
												{Math.abs(c.daysLeft)}d overdue
											{:else}
												{c.daysLeft}d left
											{/if}
										</span>
									</button>
								{/each}
							</section>
						{/if}

						<!-- Input needed -->
						{#if profile.inputNeeded.length > 0}
							<section class="sh-section">
								<h3 class="sh-section-title">Input needed</h3>
								{#each profile.inputNeeded as item}
									<button class="sh-input-item" onclick={() => onSelectOpportunity(item.opportunityId)}>
										<span class="sh-input-opp">{item.opportunityTitle}</span>
										<span class="sh-input-cell">{stageLabel(item.stage)} · {item.perspective}</span>
									</button>
								{/each}
							</section>
						{/if}

						<!-- Their opportunities -->
						{#if profile.opportunities.length > 0}
							<section class="sh-section">
								<h3 class="sh-section-title">Opportunities</h3>
								{#each profile.opportunities as opp}
									<button class="sh-opp-row" onclick={() => onSelectOpportunity(opp.id)}>
										<span class="sh-opp-title">{opp.title}</span>
										{#if opp.horizon}
											<span class="sh-horizon">{opp.horizon}</span>
										{/if}
										<span class="sh-opp-stage">{stageLabel(opp.stage)}</span>
										<span class="sh-opp-signals">
											<span class="sh-signal score-positive">{opp.signalSummary.positive}{scoreSymbol('positive')}</span>
											<span class="sh-signal score-uncertain">{opp.signalSummary.uncertain}{scoreSymbol('uncertain')}</span>
											<span class="sh-signal score-negative">{opp.signalSummary.negative}{scoreSymbol('negative')}</span>
										</span>
										{#if opp.needsInput}
											<span class="sh-needs-input-dot" title="Desirability unscored">●</span>
										{/if}
									</button>
								{/each}
							</section>
						{/if}

						<!-- Their deliverables -->
						{#if profile.deliverables.length > 0}
							<section class="sh-section">
								<h3 class="sh-section-title">Deliverables they receive</h3>
								{#each profile.deliverables as d}
									<button class="sh-del-row" onclick={() => onSelectDeliverable(d.id)}>
										<span class="sh-del-title">{d.title}</span>
										{#if d.horizon}
											<span class="sh-horizon">{d.horizon}</span>
										{/if}
										{#if d.size}
											<span class="sh-del-size">{d.size}</span>
										{/if}
										{#if d.linkedOpportunityTitles.length > 0}
											<span class="sh-del-linked">← {d.linkedOpportunityTitles.join(', ')}</span>
										{/if}
									</button>
								{/each}
							</section>
						{/if}
					</div>
				{:else}
					<div class="sh-detail-empty">
						<p>Select a stakeholder to see their profile</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.sh-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sh-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: var(--sp-sm);
		color: var(--c-text-muted);
		padding: var(--sp-xl);
		text-align: center;
	}

	.sh-empty-title {
		font-size: var(--fs-lg);
		font-weight: 600;
		color: var(--c-text);
		margin: 0;
	}

	.sh-empty-hint {
		font-size: var(--fs-sm);
		max-width: 24rem;
		margin: 0;
	}

	.sh-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* ── List panel ── */

	.sh-list {
		width: 18rem;
		flex-shrink: 0;
		border-right: 1px solid var(--c-border);
		overflow-y: auto;
		padding: var(--sp-sm);
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.sh-list-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		padding-bottom: var(--sp-xs);
		border-bottom: 1px solid var(--c-border);
	}

	.sh-heading {
		font-size: var(--fs-md);
		font-weight: 600;
		margin: 0;
		color: var(--c-text);
	}

	.sh-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.sh-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3xs);
		padding: var(--sp-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		font: inherit;
		width: 100%;
		transition: var(--tr-fast);
	}

	.sh-card:hover {
		border-color: var(--c-accent);
	}

	.sh-card.active {
		border-color: var(--c-accent);
		background: var(--c-surface-alt);
	}

	.sh-card.attention {
		border-left: 3px solid var(--c-red);
	}

	.sh-card-top {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.sh-card-name {
		font-weight: 600;
		font-size: var(--fs-sm);
		color: var(--c-text);
	}

	.sh-badge {
		font-size: var(--fs-2xs);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
		font-weight: 700;
	}

	.sh-badge-attention {
		background: var(--c-red);
		color: white;
	}

	.sh-card-stats {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		display: flex;
		align-items: center;
		gap: var(--sp-3xs);
		flex-wrap: wrap;
	}

	.sh-stat-sep {
		color: var(--c-border);
	}

	.sh-overdue {
		color: var(--c-red);
		font-weight: 600;
	}

	.sh-card-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.sh-input-needed {
		color: var(--c-accent);
	}

	.sh-last-contact {
		margin-left: auto;
	}

	/* ── Detail panel ── */

	.sh-detail {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-md);
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	.sh-detail-inner {
		width: 100%;
		max-width: 40rem;
		display: flex;
		flex-direction: column;
		gap: var(--sp-md);
	}

	.sh-detail-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
	}

	.sh-detail-name {
		font-size: var(--fs-xl);
		font-weight: 600;
		margin: 0;
		color: var(--c-text);
	}

	.sh-detail-contact {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0;
	}

	/* ── Sections ── */

	.sh-section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.sh-section-title {
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--c-text);
		margin: 0;
		padding-bottom: var(--sp-2xs);
		border-bottom: 1px solid var(--c-border);
	}

	/* ── Talking points ── */

	.sh-talking-points {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: var(--c-surface-alt);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm);
	}

	.sh-talking-points li {
		line-height: 1.4;
	}

	/* ── Commitments ── */

	.sh-commitment {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.sh-commitment:hover {
		border-color: var(--c-accent);
	}

	.sh-commitment.overdue {
		border-left: 3px solid var(--c-red);
	}

	.sh-commitment.met {
		opacity: 0.6;
	}

	.sh-commitment-opp {
		flex: 1;
		color: var(--c-text);
	}

	.sh-commitment-milestone {
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
	}

	.sh-commitment-deadline {
		font-size: var(--fs-xs);
		font-weight: 600;
	}

	.sh-commitment.overdue .sh-commitment-deadline {
		color: var(--c-red);
	}

	/* ── Input needed ── */

	.sh-input-item {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.sh-input-item:hover {
		border-color: var(--c-accent);
	}

	.sh-input-opp {
		flex: 1;
		color: var(--c-text);
	}

	.sh-input-cell {
		color: var(--c-accent);
		font-size: var(--fs-xs);
	}

	/* ── Opportunity rows ── */

	.sh-opp-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.sh-opp-row:hover {
		border-color: var(--c-accent);
	}

	.sh-opp-title {
		flex: 1;
		color: var(--c-text);
	}

	.sh-opp-stage {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.sh-opp-signals {
		display: flex;
		gap: var(--sp-2xs);
		font-size: var(--fs-xs);
	}

	.sh-signal {
		font-weight: 600;
	}

	.sh-signal.score-positive { color: var(--c-green-signal); }
	.sh-signal.score-uncertain { color: var(--c-warm); }
	.sh-signal.score-negative { color: var(--c-red); }

	.sh-needs-input-dot {
		color: var(--c-accent);
		font-size: var(--fs-xs);
	}

	/* ── Deliverable rows ── */

	.sh-del-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.sh-del-row:hover {
		border-color: var(--c-accent);
	}

	.sh-del-title {
		flex: 1;
		color: var(--c-text);
	}

	.sh-del-size {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: var(--c-bg-hover);
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
	}

	.sh-del-linked {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 12rem;
	}

	.sh-horizon {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: var(--c-bg-hover);
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}
</style>
