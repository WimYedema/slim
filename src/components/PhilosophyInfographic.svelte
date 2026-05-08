<script lang="ts">
	interface Props {
		compact?: boolean
	}

	let { compact = false }: Props = $props()
</script>

<div class="phi" class:compact>
	<!-- ── ACT 1: The world you know ── -->
	<section class="phi-section">
		<h2 class="phi-heading">You have ideas competing for attention</h2>
		<p class="phi-body">Feature requests from sales. A tech-debt spike the team keeps asking for. That CEO idea from the offsite. An incident that exposed a gap.</p>
		<p class="phi-body phi-muted">Today they live in spreadsheets, Jira backlogs, Confluence pages, and your head. You know some are worth pursuing — but which ones?</p>
	</section>

	<!-- ── ACT 2: The gap ── -->
	<section class="phi-section phi-section-accent">
		<h2 class="phi-heading">Most planning tools start at the sprint board</h2>
		<div class="phi-gap-row">
			<div class="phi-gap-before">
				<span class="phi-gap-label">Before the sprint</span>
				<div class="phi-gap-items">
					<span class="phi-gap-item">💡 Ideas</span>
					<span class="phi-gap-item">🤔 Maybe?</span>
					<span class="phi-gap-item">🙏 Requests</span>
					<span class="phi-gap-item">🔥 Incidents</span>
				</div>
				<span class="phi-gap-caption">No structure. No process. Good luck.</span>
			</div>
			<div class="phi-gap-arrow">→</div>
			<div class="phi-gap-after">
				<span class="phi-gap-label">In the sprint</span>
				<div class="phi-gap-items">
					<span class="phi-gap-item phi-gap-item-done">Todo</span>
					<span class="phi-gap-item phi-gap-item-done">Doing</span>
					<span class="phi-gap-item phi-gap-item-done">Done</span>
				</div>
				<span class="phi-gap-caption">Great tools. Wrong problem.</span>
			</div>
		</div>
		<p class="phi-body">The hardest decisions happen <em>before</em> work reaches the board. Which ideas deserve investment? What should you stop pursuing? Slim covers that gap — it works before your sprint board, not instead of it.</p>
	</section>

	<!-- ── ACT 3: Two kinds of things ── -->
	<section class="phi-section">
		<h2 class="phi-heading">Slim separates what you're chasing from what you're building</h2>
		<p class="phi-body">Most tools lump goals and tasks into one list. But "increase mobile retention" and "add push notifications" are fundamentally different things — one is a bet, the other is work. Mixing them hides whether you're building the right thing or just building things right.</p>
		<div class="phi-two-axes">
			<div class="phi-axis phi-axis-opp">
				<span class="phi-axis-icon">🎯</span>
				<div class="phi-axis-text">
					<strong>Opportunities</strong>
					<span>Goals, problems, and ideas — the <em>why</em></span>
				</div>
			</div>
			<div class="phi-axis-link">
				<svg viewBox="0 0 60 24" class="phi-link-svg" aria-hidden="true">
					<line x1="0" y1="12" x2="60" y2="12" stroke="var(--c-text-ghost)" stroke-width="1.5" stroke-dasharray="4 3" />
					<circle cx="10" cy="12" r="3" fill="var(--c-warm)" />
					<circle cx="30" cy="8" r="3" fill="var(--c-accent)" />
					<circle cx="30" cy="16" r="3" fill="var(--c-accent)" />
					<circle cx="50" cy="12" r="3" fill="var(--c-warm)" />
				</svg>
				<span class="phi-link-label">linked many-to-many</span>
			</div>
			<div class="phi-axis phi-axis-del">
				<span class="phi-axis-icon">🔨</span>
				<div class="phi-axis-text">
					<strong>Deliverables</strong>
					<span>Concrete work items — the <em>how</em></span>
				</div>
			</div>
		</div>
		<p class="phi-body phi-muted">One opportunity can need multiple deliverables. One deliverable can serve multiple opportunities. Slim tracks both sides and the connections between them.</p>
	</section>

	<!-- ── ACT 4: The funnel ── -->
	<section class="phi-section">
		<h2 class="phi-heading">Give every idea a journey — not just a priority number</h2>
		<p class="phi-body">Ideas move through five stages. Most won't make it, and that's the point — the funnel protects your team from building the wrong thing.</p>
		<div class="phi-funnel">
			<div class="phi-stage phi-stage-1">
				<div class="phi-stage-name">Explore</div>
				<div class="phi-stage-q">"Is this worth pursuing?"</div>
				<div class="phi-stage-cards">
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-green"></i><i class="dot dot-green"></i></span></div>
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-warm"></i><i class="dot dot-none"></i></span></div>
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-red"></i><i class="dot dot-green"></i></span></div>
					<div class="phi-card"></div>
				</div>
			</div>
			<div class="phi-stage-arrow">→</div>
			<div class="phi-stage phi-stage-2">
				<div class="phi-stage-name">Sketch</div>
				<div class="phi-stage-q">"What could this look like?"</div>
				<div class="phi-stage-cards">
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-green"></i><i class="dot dot-green"></i></span></div>
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-warm"></i><i class="dot dot-none"></i><i class="dot dot-none"></i></span></div>
					<div class="phi-card"></div>
				</div>
			</div>
			<div class="phi-stage-arrow">→</div>
			<div class="phi-stage phi-stage-3">
				<div class="phi-stage-name">Validate</div>
				<div class="phi-stage-q">"Does evidence support it?"</div>
				<div class="phi-stage-cards">
					<div class="phi-card"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-green"></i><i class="dot dot-warm"></i></span></div>
					<div class="phi-card"></div>
				</div>
			</div>
			<div class="phi-stage-arrow">→</div>
			<div class="phi-stage phi-stage-4">
				<div class="phi-stage-name">Decompose</div>
				<div class="phi-stage-q">"Break it into work"</div>
				<div class="phi-stage-cards">
					<div class="phi-card phi-card-pivot"><span class="phi-dots"><i class="dot dot-green"></i><i class="dot dot-green"></i><i class="dot dot-green"></i></span></div>
				</div>
			</div>
			<div class="phi-stage-arrow">→</div>
			<div class="phi-stage phi-stage-5">
				<div class="phi-stage-name">Deliver</div>
				<div class="phi-stage-q">"Keep the promise"</div>
				<div class="phi-stage-cards">
					<div class="phi-card phi-card-del"></div>
				</div>
			</div>
		</div>
		<div class="phi-stage-details">
			<div class="phi-stage-detail"><strong>Explore</strong> — Capture the raw idea. Is there a real need? Who has the problem? This is cheap: a few conversations, not a project.</div>
			<div class="phi-stage-detail"><strong>Sketch</strong> — Outline a rough shape. What might a solution look like? You're not committing to build anything yet — just making the idea concrete enough to evaluate.</div>
			<div class="phi-stage-detail"><strong>Validate</strong> — Stress-test with evidence. Talk to users, check competitors, run the numbers. This is where weak ideas get killed — intentionally and cheaply.</div>
			<div class="phi-stage-detail"><strong>Decompose</strong> — Break the validated opportunity into deliverables. Now you're planning real work — linking concrete tasks back to the goal they serve.</div>
			<div class="phi-stage-detail"><strong>Deliver</strong> — Execute and track promises. The opportunity is now a commitment with a deadline. When it ships, close the loop.</div>
		</div>
		<p class="phi-body phi-muted">The funnel narrows on purpose. Killing an idea in Explore costs a conversation; killing it in Deliver costs a quarter. Each stage is a checkpoint that earns the right to invest more.</p>
		<p class="phi-body phi-muted">You don't need to adopt all five stages on day one. Start with one idea and three questions. That's already more structure than most teams have before the sprint board.</p>
		<p class="phi-body phi-muted">And for leadership: the funnel is your portfolio view. At any moment you can see how many bets are progressing, which ones are stuck, and where the bottlenecks are — without asking anyone for a status update.</p>
	</section>

	<!-- ── ACT 5: How you decide ── -->
	<section class="phi-section">
		<h2 class="phi-heading">How do you decide? Three questions, not a score</h2>
		<p class="phi-body">At every stage, the same three perspectives weigh in. Not with numbers — with a simple signal.</p>
		<div class="phi-perspectives">
			<div class="phi-persp phi-persp-d">
				<span class="phi-persp-dot" style="background: var(--c-green-signal)"></span>
				<div>
					<strong>Desirability</strong>
					<span>Do users actually want this?</span>
				</div>
			</div>
			<div class="phi-persp phi-persp-f">
				<span class="phi-persp-dot" style="background: var(--c-accent)"></span>
				<div>
					<strong>Feasibility</strong>
					<span>Can we realistically build it?</span>
				</div>
			</div>
			<div class="phi-persp phi-persp-v">
				<span class="phi-persp-dot" style="background: var(--c-warm)"></span>
				<div>
					<strong>Viability</strong>
					<span>Is it worth the investment?</span>
				</div>
			</div>
		</div>
		<div class="phi-signals">
			<div class="phi-signal"><i class="dot dot-green dot-lg"></i> <span><strong>Consent</strong> — go ahead</span></div>
			<div class="phi-signal"><i class="dot dot-warm dot-lg"></i> <span><strong>Uncertain</strong> — concerns, but won't block</span></div>
			<div class="phi-signal"><i class="dot dot-red dot-lg"></i> <span><strong>Objection</strong> — this blocks progress</span></div>
			<div class="phi-signal"><i class="dot dot-none dot-lg"></i> <span><strong>Unheard</strong> — not yet evaluated</span></div>
		</div>
		<p class="phi-body phi-muted">All three perspectives must be heard. No objections means ready to advance. No weighted-priority spreadsheets. No MoSCoW debates.</p>
	</section>

	<!-- ── ACT 6: Two conversations ── -->
	<section class="phi-section">
		<h2 class="phi-heading">Your stakeholders speak goals. Your team speaks tasks.</h2>
		<p class="phi-body">"Your team shipped 14 features last quarter. Your stakeholder asks: <em>'So what happened with the mobile retention problem?'</em> And you're mentally reconstructing which of those 14 were supposed to help."</p>
		<p class="phi-body">This gap is where plans fall apart. The connections between <em>why</em> and <em>what</em> live in your head — and they break every time someone goes on holiday, changes teams, or just forgets.</p>

		<div class="phi-matrix">
			<!-- Column headers -->
			<div class="phi-matrix-corner">
				<span class="phi-corner-col">🎯 Opportunities →</span>
				<span class="phi-corner-row">🔨 Deliverables ↓</span>
			</div>
			<div class="phi-matrix-col-head phi-col-opp">Reduce churn</div>
			<div class="phi-matrix-col-head phi-col-opp">Mobile refresh</div>
			<div class="phi-matrix-col-head phi-col-opp phi-col-orphan">Enterprise SSO</div>

			<!-- Row 1: Onboarding wizard -->
			<div class="phi-matrix-row-head">Onboarding wizard</div>
			<div class="phi-matrix-cell phi-cell-full" title="full coverage"><span class="phi-link-dot"></span></div>
			<div class="phi-matrix-cell"></div>
			<div class="phi-matrix-cell"></div>

			<!-- Row 2: Push notifications -->
			<div class="phi-matrix-row-head">Push notifications</div>
			<div class="phi-matrix-cell phi-cell-partial" title="partial coverage"><span class="phi-link-dot phi-link-dot-partial"></span></div>
			<div class="phi-matrix-cell phi-cell-full" title="full coverage"><span class="phi-link-dot"></span></div>
			<div class="phi-matrix-cell"></div>

			<!-- Row 3: New nav bar -->
			<div class="phi-matrix-row-head">New nav bar</div>
			<div class="phi-matrix-cell"></div>
			<div class="phi-matrix-cell phi-cell-full" title="full coverage"><span class="phi-link-dot"></span></div>
			<div class="phi-matrix-cell"></div>

			<!-- Row 4: Admin dashboard (orphan) -->
			<div class="phi-matrix-row-head phi-row-orphan">Admin dashboard</div>
			<div class="phi-matrix-cell"></div>
			<div class="phi-matrix-cell"></div>
			<div class="phi-matrix-cell"></div>
		</div>

		<div class="phi-matrix-legend">
			<div class="phi-legend-item"><span class="phi-link-dot"></span> Linked</div>
			<div class="phi-legend-item"><span class="phi-link-dot phi-link-dot-partial"></span> Partial</div>
			<div class="phi-legend-item"><span class="phi-legend-dash"></span> No link — the gap</div>
		</div>

		<div class="phi-matrix-callouts">
			<div class="phi-callout phi-callout-warn">
				<span class="phi-callout-icon">⚠️</span>
				<div>
					<strong>Enterprise SSO</strong> has no deliverables.
					<span class="phi-callout-sub">It's a wish, not a plan.</span>
				</div>
			</div>
			<div class="phi-callout phi-callout-warn">
				<span class="phi-callout-icon">⚠️</span>
				<div>
					<strong>Admin dashboard</strong> serves no opportunity.
					<span class="phi-callout-sub">Work without purpose — why is it in the sprint?</span>
				</div>
			</div>
			<div class="phi-callout phi-callout-good">
				<span class="phi-callout-icon">💡</span>
				<div>
					<strong>Push notifications</strong> serves two goals.
					<span class="phi-callout-sub">Shared investment — now you can explain why it's worth the effort.</span>
				</div>
			</div>
		</div>

		<p class="phi-body phi-muted">Slim keeps both views and the links between them, so you always know which work serves which goal — and what's missing. Fix the plan before the sprint, not after the quarter.</p>
	</section>

	<!-- ── ACT 7: The promise ── -->
	<section class="phi-section phi-section-closing">
		<h2 class="phi-heading">Track promises, not points</h2>
		<p class="phi-body">When an opportunity reaches Deliver, you've made a promise to your stakeholders. Slim tracks whether that promise was kept — closing the loop from "good idea" to "shipped and proven."</p>
		<div class="phi-zero-friction">
			<div class="phi-friction-item">⚡ <strong>Nothing to install</strong> — it's a single HTML file</div>
			<div class="phi-friction-item">🔒 <strong>Your data stays yours</strong> — everything in your browser, no server</div>
			<div class="phi-friction-item">⏱️ <strong>Try it in 30 seconds</strong> — no account, no setup, no vendor lock-in</div>
		</div>
	</section>
</div>

<style>
	.phi {
		width: 100%;
		max-width: 40rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xl);
	}

	.phi-section {
		text-align: left;
	}

	.phi-section-accent {
		background: var(--c-surface-alt);
		border-radius: var(--radius-md);
		padding: var(--sp-xl);
		border: 1px solid var(--c-border-soft);
	}

	.phi-section-closing {
		text-align: center;
		padding: var(--sp-xl) 0;
		border-top: 1px solid var(--c-border-soft);
	}

	.phi-zero-friction {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		margin: var(--sp-lg) auto 0;
		max-width: 24rem;
		text-align: left;
	}

	.phi-friction-item {
		font-size: var(--fs-sm);
		color: var(--c-text);
		line-height: 1.5;
	}

	.phi-heading {
		font-size: var(--fs-lg);
		font-weight: 600;
		color: var(--c-text);
		margin: 0 0 var(--sp-sm);
		line-height: var(--lh-tight);
	}

	.phi-body {
		font-size: var(--fs-sm);
		line-height: 1.6;
		color: var(--c-text);
		margin: var(--sp-sm) 0 0;
	}

	.phi-muted {
		color: var(--c-text-muted);
	}

	/* ── Gap illustration ── */
	.phi-gap-row {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin: var(--sp-lg) 0;
	}

	.phi-gap-before,
	.phi-gap-after {
		flex: 1;
		text-align: center;
	}

	.phi-gap-label {
		display: block;
		font-size: var(--fs-xs);
		font-weight: 600;
		color: var(--c-text);
		margin-bottom: var(--sp-xs);
	}

	.phi-gap-items {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-xs);
	}

	.phi-gap-item {
		font-size: var(--fs-2xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		border: 1px dashed var(--c-border);
		color: var(--c-text-muted);
	}

	.phi-gap-item-done {
		border-style: solid;
		border-color: var(--c-accent-border);
		background: var(--c-accent-bg);
		color: var(--c-accent);
	}

	.phi-gap-caption {
		display: block;
		font-size: var(--fs-2xs);
		color: var(--c-text-faint);
		margin-top: var(--sp-xs);
	}

	.phi-gap-arrow {
		font-size: var(--fs-xl);
		color: var(--c-text-ghost);
		flex-shrink: 0;
	}

	/* ── Two axes ── */
	.phi-two-axes {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin: var(--sp-lg) 0;
	}

	.phi-axis {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-md);
		border-radius: var(--radius-md);
	}

	.phi-axis-opp {
		background: var(--c-warm-bg);
		border: 1px solid var(--c-warm-border);
	}

	.phi-axis-del {
		background: var(--c-accent-bg);
		border: 1px solid var(--c-accent-border);
	}

	.phi-axis-icon {
		font-size: var(--fs-xl);
		flex-shrink: 0;
	}

	.phi-axis-text {
		display: flex;
		flex-direction: column;
		font-size: var(--fs-xs);
		color: var(--c-text);
		line-height: 1.4;
	}

	.phi-axis-text strong {
		font-size: var(--fs-sm);
	}

	.phi-axis-link {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		gap: 2px;
	}

	.phi-link-svg {
		width: 60px;
		height: 24px;
	}

	.phi-link-label {
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
		white-space: nowrap;
	}

	/* ── Funnel ── */
	.phi-funnel {
		display: flex;
		align-items: flex-start;
		gap: 0;
		margin: var(--sp-lg) 0;
		overflow-x: auto;
	}

	.phi-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm) var(--sp-xs);
		flex: 1;
		min-width: 0;
	}

	.phi-stage-5 {
		background: var(--c-accent-bg);
		border-color: var(--c-accent-border);
	}

	.phi-stage-name {
		font-size: var(--fs-xs);
		font-weight: 600;
		color: var(--c-text);
	}

	.phi-stage-q {
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		text-align: center;
		margin-top: 2px;
	}

	.phi-stage-cards {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: var(--sp-xs);
		width: 100%;
	}

	.phi-card {
		height: 14px;
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 3px;
	}

	.phi-card-pivot {
		border-color: var(--c-warm-border);
	}

	.phi-card-del {
		background: var(--c-accent-bg);
		border-color: var(--c-accent-border);
	}

	.phi-stage-arrow {
		flex-shrink: 0;
		color: var(--c-text-ghost);
		font-size: var(--fs-sm);
		padding: var(--sp-lg) 2px 0;
	}

	.phi-dots {
		display: flex;
		gap: 2px;
	}

	/* ── Dots (shared) ── */
	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-lg {
		width: 10px;
		height: 10px;
	}

	.dot-green { background: var(--c-green-signal); }
	.dot-warm { background: var(--c-warm); }
	.dot-red { background: var(--c-red); }
	.dot-none { background: var(--c-text-ghost); }

	/* ── Perspectives ── */
	.phi-perspectives {
		display: flex;
		gap: var(--sp-md);
		margin: var(--sp-lg) 0;
	}

	.phi-persp {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: var(--sp-sm);
		padding: var(--sp-sm);
		border-radius: var(--radius-sm);
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border-soft);
	}

	.phi-persp-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 3px;
	}

	.phi-persp div {
		display: flex;
		flex-direction: column;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		line-height: 1.4;
	}

	.phi-persp strong {
		font-size: var(--fs-xs);
		color: var(--c-text);
	}

	/* ── Signals ── */
	.phi-signals {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-sm) var(--sp-lg);
		margin: var(--sp-md) 0;
	}

	.phi-signal {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text);
	}

	/* ── Matrix ── */
	.phi-matrix {
		display: grid;
		grid-template-columns: minmax(6rem, auto) repeat(3, 1fr);
		gap: 1px;
		margin: var(--sp-lg) 0;
		background: var(--c-border-soft);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		overflow: hidden;
		font-size: var(--fs-2xs);
	}

	.phi-matrix-corner {
		background: var(--c-surface-alt);
		padding: var(--sp-xs);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 2px;
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		line-height: 1.3;
	}

	.phi-corner-col {
		text-align: right;
	}

	.phi-corner-row {
		text-align: left;
	}

	.phi-matrix-col-head {
		background: var(--c-warm-bg);
		color: var(--c-text);
		font-weight: 600;
		padding: var(--sp-xs) var(--sp-sm);
		text-align: center;
		line-height: 1.3;
		border-bottom: 2px solid var(--c-warm-border);
	}

	.phi-col-orphan {
		background: var(--c-surface-alt);
		color: var(--c-text-muted);
		font-style: italic;
		border-bottom-color: var(--c-border-soft);
	}

	.phi-matrix-row-head {
		background: var(--c-surface-alt);
		color: var(--c-text);
		font-weight: 600;
		padding: var(--sp-xs) var(--sp-sm);
		display: flex;
		align-items: center;
		border-left: 2px solid var(--c-accent);
	}

	.phi-row-orphan {
		background: var(--c-surface-alt);
		color: var(--c-text-muted);
		font-style: italic;
		border-left-color: var(--c-border-soft);
	}

	.phi-matrix-cell {
		background: var(--c-surface);
		padding: var(--sp-xs);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.phi-link-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c-accent);
	}

	.phi-link-dot-partial {
		background: transparent;
		border: 2px solid var(--c-accent);
	}

	/* ── Matrix legend ── */
	.phi-matrix-legend {
		display: flex;
		gap: var(--sp-md);
		justify-content: center;
		margin: var(--sp-sm) 0;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.phi-legend-item {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.phi-legend-dash {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 1px dashed var(--c-text-ghost);
		border-radius: 50%;
	}

	/* ── Callouts ── */
	.phi-matrix-callouts {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
		margin: var(--sp-md) 0;
	}

	.phi-callout {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-md);
		border-radius: var(--radius-sm);
		font-size: var(--fs-xs);
		line-height: 1.4;
	}

	.phi-callout-warn {
		background: var(--c-warm-bg);
		border: 1px solid var(--c-warm-border);
	}

	.phi-callout-good {
		background: var(--c-green-bg);
		border: 1px solid var(--c-green-border);
	}

	.phi-callout-icon {
		flex-shrink: 0;
		font-size: var(--fs-sm);
	}

	.phi-callout-sub {
		display: block;
		color: var(--c-text-muted);
		font-size: var(--fs-2xs);
	}

	/* ── Stage details ── */
	.phi-stage-details {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		margin: var(--sp-lg) 0 0;
		padding: var(--sp-md);
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
	}

	.phi-stage-detail {
		font-size: var(--fs-xs);
		line-height: 1.5;
		color: var(--c-text-muted);
	}

	.phi-stage-detail strong {
		color: var(--c-text);
	}

	@media (max-width: 640px) {
		.phi-two-axes {
			flex-direction: column;
		}

		.phi-perspectives {
			flex-direction: column;
		}

		.phi-gap-row {
			flex-direction: column;
		}

		.phi-gap-arrow {
			transform: rotate(90deg);
		}
	}
</style>
