<script lang="ts">
	interface Props {
		onSampleData: () => void
		onEmptyBoard: () => void
		onJoinRoom: () => void
	}

	let { onSampleData, onEmptyBoard, onJoinRoom }: Props = $props()

	let heroBtn = $state<HTMLButtonElement>()
	$effect(() => { heroBtn?.focus() })
</script>

<div class="welcome">
	<div class="welcome-content">
		<h1 class="welcome-title">Slim</h1>
		<p class="welcome-subtitle">What to build next — and why it matters</p>
		<p class="welcome-desc">Track opportunities from first spark to fulfilled promise. All data stays in your browser.</p>

		<!-- Abstract pipeline illustration — visual scent of the product -->
		<svg class="welcome-illustration" viewBox="0 0 280 56" aria-hidden="true">
			<!-- Stage columns — tapering funnel -->
			<rect x="0" y="0" width="64" height="56" rx="4" fill="var(--c-surface-alt)" />
			<rect x="70" y="6" width="58" height="44" rx="4" fill="var(--c-surface-alt)" />
			<rect x="134" y="12" width="52" height="32" rx="4" fill="var(--c-surface-alt)" />
			<rect x="192" y="16" width="46" height="24" rx="4" fill="var(--c-surface-alt)" />
			<!-- Opportunity cards inside stages -->
			<rect x="6" y="6" width="52" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="6" y="18" width="52" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="6" y="30" width="52" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="6" y="42" width="52" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="76" y="14" width="46" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="76" y="26" width="46" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="76" y="38" width="46" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="140" y="18" width="40" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="140" y="30" width="40" height="8" rx="2" fill="var(--c-surface)" />
			<rect x="198" y="22" width="34" height="8" rx="2" fill="var(--c-surface)" />
			<!-- Signal dots — 3 perspectives per card (only on some cards) -->
			<!-- Explore card 1: all green -->
			<circle cx="46" cy="10" r="2" fill="var(--c-green-signal)" />
			<circle cx="52" cy="10" r="2" fill="var(--c-green-signal)" />
			<circle cx="58" cy="10" r="2" fill="var(--c-green-signal)" />
			<!-- Explore card 2: mixed -->
			<circle cx="46" cy="22" r="2" fill="var(--c-green-signal)" />
			<circle cx="52" cy="22" r="2" fill="var(--c-warm)" />
			<circle cx="58" cy="22" r="2" fill="var(--c-text-ghost)" />
			<!-- Explore card 3: one negative -->
			<circle cx="46" cy="34" r="2" fill="var(--c-green-signal)" />
			<circle cx="52" cy="34" r="2" fill="var(--c-red)" />
			<circle cx="58" cy="34" r="2" fill="var(--c-green-signal)" />
			<!-- Sketch card 1: all green -->
			<circle cx="110" cy="18" r="2" fill="var(--c-green-signal)" />
			<circle cx="116" cy="18" r="2" fill="var(--c-green-signal)" />
			<circle cx="122" cy="18" r="2" fill="var(--c-green-signal)" />
			<!-- Sketch card 2: pending -->
			<circle cx="110" cy="30" r="2" fill="var(--c-warm)" />
			<circle cx="116" cy="30" r="2" fill="var(--c-text-ghost)" />
			<circle cx="122" cy="30" r="2" fill="var(--c-text-ghost)" />
			<!-- Validate card: mixed -->
			<circle cx="168" cy="22" r="2" fill="var(--c-green-signal)" />
			<circle cx="174" cy="22" r="2" fill="var(--c-green-signal)" />
			<circle cx="180" cy="22" r="2" fill="var(--c-warm)" />
			<!-- Decompose card: done -->
			<circle cx="220" cy="26" r="2" fill="var(--c-green-signal)" />
			<circle cx="226" cy="26" r="2" fill="var(--c-green-signal)" />
			<circle cx="232" cy="26" r="2" fill="var(--c-green-signal)" />
			<!-- Stage labels -->
			<text x="32" y="55" text-anchor="middle" font-size="5" fill="var(--c-text-faint)" font-family="system-ui, sans-serif">explore</text>
			<text x="99" y="49" text-anchor="middle" font-size="5" fill="var(--c-text-faint)" font-family="system-ui, sans-serif">sketch</text>
			<text x="160" y="43" text-anchor="middle" font-size="5" fill="var(--c-text-faint)" font-family="system-ui, sans-serif">validate</text>
			<text x="215" y="39" text-anchor="middle" font-size="5" fill="var(--c-text-faint)" font-family="system-ui, sans-serif">decompose</text>
		</svg>

		<div class="welcome-paths">
			<div class="welcome-card welcome-card-hero">
				<div class="welcome-card-body">
					<h2 class="welcome-card-title welcome-card-title-hero">Start planning</h2>
					<p class="welcome-card-text">Track goals (opportunities) through validation stages and link them to work items (deliverables)</p>
				</div>
				<button class="welcome-btn" bind:this={heroBtn} onclick={onEmptyBoard}>Create your board</button>
			</div>

			<div class="welcome-secondary">
				<div class="welcome-card">
					<div class="welcome-card-body">
						<h2 class="welcome-card-title">Join your team</h2>
						<p class="welcome-card-text">Got a room code from your PO? Join to score on user, technical, and business perspectives</p>
					</div>
					<button class="welcome-btn welcome-btn-secondary" onclick={onJoinRoom}>Join a team room</button>
				</div>

				<div class="welcome-card">
					<div class="welcome-card-body">
						<h2 class="welcome-card-title">See how it works</h2>
						<p class="welcome-card-text">Explore a sample board with 8 opportunities, deliverables, and team signals</p>
					</div>
					<button class="welcome-btn welcome-btn-secondary" onclick={onSampleData}>Explore a demo board</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.welcome {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		padding: var(--sp-xl);
		overflow-y: auto;
	}

	.welcome-content {
		max-width: 40rem;
		width: 100%;
		text-align: center;
	}

	.welcome-title {
		font-size: var(--fs-2xl);
		font-weight: 700;
		color: var(--c-text);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.welcome-subtitle {
		font-size: var(--fs-lg);
		color: var(--c-text-muted);
		margin: var(--sp-xs) 0 0;
	}

	.welcome-desc {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: var(--sp-md) auto 0;
		line-height: 1.5;
	}

	.welcome-illustration {
		display: block;
		margin: var(--sp-xl) auto var(--sp-2xl);
		width: 280px;
		height: auto;
		opacity: 0.7;
	}

	.welcome-paths {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xl);
	}

	.welcome-card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		padding: var(--sp-xl);
		background: var(--c-surface);
		text-align: left;
	}

	.welcome-card-hero {
		border-color: var(--c-warm-border);
		background: var(--c-surface-alt);
	}

	.welcome-secondary {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--sp-xl);
	}

	@media (max-width: 640px) {
		.welcome-secondary {
			grid-template-columns: 1fr;
		}
	}

	.welcome-card-body {
		flex: 1;
	}

	.welcome-card-title {
		font-size: var(--fs-lg);
		font-weight: 600;
		color: var(--c-text);
		margin: 0 0 var(--sp-sm);
	}

	.welcome-card-title-hero {
		font-size: var(--fs-xl);
	}

	.welcome-card-text {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		line-height: 1.5;
		margin: 0 0 var(--sp-lg);
	}

	.welcome-btn {
		width: 100%;
		padding: var(--sp-sm) var(--sp-md);
		border: 1px solid var(--c-accent);
		border-radius: var(--radius-sm);
		background: var(--c-accent);
		color: white;
		font-size: var(--fs-sm);
		font-weight: 500;
		cursor: pointer;
		transition: opacity var(--tr-fast, 0.1s);
	}

	.welcome-btn:hover {
		opacity: 0.9;
	}

	.welcome-btn:focus-visible {
		outline: 2px solid var(--c-accent);
		outline-offset: 2px;
	}

	.welcome-btn-secondary {
		background: transparent;
		color: var(--c-accent);
		border-color: var(--c-accent-border);
	}

	.welcome-btn-secondary:hover {
		background: var(--c-accent-bg);
		opacity: 1;
	}
</style>
