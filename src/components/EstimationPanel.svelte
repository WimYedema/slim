<script lang="ts">
	interface Props {
		roomCode?: string
		deliverableCount: number
		busy: boolean
		message: string
		error: string
		onCreateAndPublish: () => void
		onRepublish: () => void
		onPullVerdicts: () => void
		onDisconnect: () => void
	}

	let {
		roomCode,
		deliverableCount,
		busy,
		message,
		error,
		onCreateAndPublish,
		onRepublish,
		onPullVerdicts,
		onDisconnect,
	}: Props = $props()

	let copied = $state(false)

	function copyCode() {
		if (!roomCode) return
		navigator.clipboard.writeText(roomCode)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}
</script>

<div class="estimation-panel">
	<div class="estimation-header">
		<span class="estimation-icon">⚡</span>
		<span class="estimation-title">Estimation</span>
	</div>

	{#if !roomCode}
		<p class="estimation-hint">Send deliverables to a Skatting room for team estimation.</p>
		<button
			class="estimation-btn primary"
			disabled={busy || deliverableCount === 0}
			onclick={onCreateAndPublish}
		>
			Create estimation room
		</button>
	{:else}
		<div class="room-code-row">
			<span class="room-code-label">Room code</span>
			<button class="room-code" onclick={copyCode} title="Copy to clipboard">
				{roomCode}
				<span class="copy-icon">{copied ? '✓' : '⎘'}</span>
			</button>
		</div>
		<p class="estimation-hint">Share this code with the team to join in Skatting.</p>
		<div class="estimation-actions">
			<button
				class="estimation-btn"
				disabled={busy}
				onclick={onRepublish}
				title="Re-send the current deliverable list"
			>
				Republish
			</button>
			<button
				class="estimation-btn primary"
				disabled={busy}
				onclick={onPullVerdicts}
			>
				Pull estimates
			</button>
		</div>
		<button
			class="estimation-btn disconnect"
			disabled={busy}
			onclick={onDisconnect}
		>
			Disconnect
		</button>
	{/if}

	{#if message}
		<p class="estimation-message">{message}</p>
	{/if}
	{#if error}
		<p class="estimation-error">{error}</p>
	{/if}
	{#if busy}
		<p class="estimation-busy">Working…</p>
	{/if}
</div>

<style>
	.estimation-panel {
		padding: var(--sp-3) var(--sp-4);
		border-top: 1px solid var(--c-border);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.estimation-header {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.estimation-icon {
		font-size: var(--fs-lg);
	}

	.estimation-title {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
	}

	.estimation-hint {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0;
	}

	.estimation-btn {
		padding: var(--sp-1) var(--sp-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
		background: var(--c-bg);
		color: var(--c-text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.estimation-btn:hover:not(:disabled) {
		background: var(--c-bg-hover);
	}

	.estimation-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.estimation-btn.primary {
		background: var(--c-accent);
		color: var(--c-accent-text);
		border-color: var(--c-accent);
	}

	.estimation-btn.primary:hover:not(:disabled) {
		background: var(--c-accent-hover);
	}

	.estimation-btn.disconnect {
		background: none;
		border: none;
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		padding: var(--sp-1) 0;
		text-decoration: underline;
		align-self: flex-start;
	}

	.estimation-actions {
		display: flex;
		gap: var(--sp-2);
	}

	.room-code-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.room-code-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.room-code {
		font-family: monospace;
		font-size: var(--fs-base);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.1em;
		background: var(--c-bg-sunken);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-1) var(--sp-2);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--c-text);
	}

	.room-code:hover {
		background: var(--c-bg-hover);
	}

	.copy-icon {
		font-size: var(--fs-xs);
		opacity: 0.6;
	}

	.estimation-message {
		font-size: var(--fs-sm);
		color: var(--c-positive);
		margin: 0;
	}

	.estimation-error {
		font-size: var(--fs-sm);
		color: var(--c-negative);
		margin: 0;
	}

	.estimation-busy {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0;
		font-style: italic;
	}
</style>
