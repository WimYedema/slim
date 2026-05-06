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

<div class="ep">
	{#if !roomCode}
		<div class="ep-section">
			<h3>Estimate deliverables</h3>
			<p class="ep-hint">Send your deliverables to a Skatting room for team estimation. Estimates flow back automatically.</p>
			<button
				class="ep-btn primary"
				disabled={busy || deliverableCount === 0}
				onclick={onCreateAndPublish}
			>
				Create estimation room
			</button>
			{#if deliverableCount === 0}
				<p class="ep-hint">Add deliverables first.</p>
			{/if}
		</div>
	{:else}
		<div class="ep-section">
			<h3>Estimation room</h3>
			<div class="ep-room-row">
				<button class="ep-room-code" onclick={copyCode} title="Copy to clipboard">
					{roomCode}
					<span class="ep-copy">{copied ? '✓' : '⎘'}</span>
				</button>
			</div>
			<p class="ep-hint">Share this code with the team to join in Skatting.</p>
		</div>
		<div class="ep-section">
			<div class="ep-actions">
				<button class="ep-btn" disabled={busy} onclick={onRepublish} title="Re-send the current deliverable list">
					Republish
				</button>
				<button class="ep-btn primary" disabled={busy} onclick={onPullVerdicts}>
					Pull estimates
				</button>
			</div>
		</div>
		<div class="ep-section">
			<button class="ep-btn danger" disabled={busy} onclick={onDisconnect}>
				Disconnect
			</button>
		</div>
	{/if}

	{#if message}
		<p class="ep-message">{message}</p>
	{/if}
	{#if error}
		<p class="ep-error">{error}</p>
	{/if}
	{#if busy}
		<p class="ep-busy">Working…</p>
	{/if}
</div>

<style>
	.ep {
		padding: var(--sp-md);
		display: flex;
		flex-direction: column;
	}

	.ep-section {
		padding: var(--sp-xs) 0;
	}

	.ep-section + .ep-section {
		border-top: 1px solid var(--c-border-soft);
	}

	.ep-section h3 {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}

	.ep-hint {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.ep-room-row {
		margin-bottom: var(--sp-sm);
	}

	.ep-room-code {
		font-family: monospace;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.1em;
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--sp-xs);
		color: var(--c-text);
		transition: background var(--tr-fast);
	}

	.ep-room-code:hover {
		background: var(--c-hover);
	}

	.ep-copy {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.ep-actions {
		display: flex;
		gap: var(--sp-xs);
		padding: var(--sp-xs) 0;
	}

	.ep-btn {
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
		background: none;
		color: var(--c-text);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.ep-btn:hover:not(:disabled) {
		background: var(--c-hover);
	}

	.ep-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ep-btn.primary {
		background: var(--c-accent);
		color: var(--c-accent-text);
		border-color: var(--c-accent);
	}

	.ep-btn.primary:hover:not(:disabled) {
		background: var(--c-accent-hover);
	}

	.ep-btn.danger {
		border: none;
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		padding: var(--sp-xs) 0;
	}

	.ep-btn.danger:hover:not(:disabled) {
		color: var(--c-red);
		background: none;
	}

	.ep-message {
		font-size: var(--fs-xs);
		color: var(--c-positive);
		margin: var(--sp-xs) 0 0;
	}

	.ep-error {
		font-size: var(--fs-xs);
		color: var(--c-negative);
		margin: var(--sp-xs) 0 0;
	}

	.ep-busy {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		margin: var(--sp-xs) 0 0;
		font-style: italic;
	}
</style>
