<script lang="ts">
	import PhilosophyInfographic from './PhilosophyInfographic.svelte'

	interface Props {
		onSampleData: () => void
		onEmptyBoard: () => void
		onJoinRoom: () => void
		onImportFile: () => void
	}

	let { onSampleData, onEmptyBoard, onJoinRoom, onImportFile }: Props = $props()

	let heroBtn = $state<HTMLButtonElement>()
	$effect(() => { heroBtn?.focus() })
</script>

<div class="welcome">
	<div class="welcome-content">
		<h1 class="welcome-title">Slim</h1>
		<p class="welcome-subtitle">What to build next — and why it matters</p>
		<p class="welcome-desc">Track opportunities from first spark to fulfilled promise. All data stays in your browser.</p>

		<div class="welcome-shortcuts">
			<button class="welcome-shortcut welcome-shortcut-primary" bind:this={heroBtn} onclick={onEmptyBoard}>Start planning →</button>
			<button class="welcome-shortcut" onclick={onImportFile}>Import from file</button>
			<button class="welcome-shortcut" onclick={onJoinRoom}>Join a team room</button>
			<button class="welcome-shortcut" onclick={onSampleData}>Explore a demo</button>
		</div>

		<PhilosophyInfographic />

		<div class="welcome-paths">
			<div class="welcome-card welcome-card-hero">
				<div class="welcome-card-body">
					<h2 class="welcome-card-title welcome-card-title-hero">Start planning</h2>
					<p class="welcome-card-text">Track goals (opportunities) through validation stages and link them to work items (deliverables)</p>
				</div>
				<button class="welcome-btn" onclick={onEmptyBoard}>Create your board</button>
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
		align-items: flex-start;
		justify-content: center;
		flex: 1;
		padding: var(--sp-2xl) var(--sp-xl);
		overflow-y: auto;
	}

	.welcome-content {
		max-width: 48rem;
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

	.welcome-shortcuts {
		display: flex;
		justify-content: center;
		gap: var(--sp-sm);
		margin: var(--sp-xl) 0;
	}

	.welcome-shortcut {
		padding: var(--sp-xs) var(--sp-md);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		font-weight: 500;
		cursor: pointer;
		transition: border-color var(--tr-fast, 0.1s), color var(--tr-fast, 0.1s);
	}

	.welcome-shortcut:hover {
		border-color: var(--c-accent-border);
		color: var(--c-accent-text);
	}

	.welcome-shortcut:focus-visible {
		outline: 2px solid var(--c-accent);
		outline-offset: 2px;
	}

	.welcome-shortcut-primary {
		background: var(--c-accent);
		border-color: var(--c-accent);
		color: white;
	}

	.welcome-shortcut-primary:hover {
		opacity: 0.9;
		color: white;
	}

	.welcome-paths {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xl);
		margin-top: var(--sp-2xl);
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
