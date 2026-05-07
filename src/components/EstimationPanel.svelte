<script lang="ts">
	interface Props {
		roomCode?: string
		deliverableCount: number
		busy: boolean
		message: string
		error: string
		onCreateAndPublish: () => void
		onDisconnect: () => void
	}

	let {
		roomCode,
		deliverableCount,
		busy,
		message,
		error,
		onCreateAndPublish,
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
			<button
				class="btn-solid"
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
			<p class="ep-hint">Share this room code with the team to start a Skatting estimation session.</p>
			<div class="ep-room-row">
				<button class="ep-room-code" onclick={copyCode} title="Copy room code">
					{roomCode}
					<span class="ep-copy">{copied ? '✓ Copied' : 'Copy'}</span>
				</button>
			</div>
		</div>
		<div class="ep-section">
			<button class="btn-ghost ep-danger" disabled={busy} onclick={onDisconnect}>
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

	.ep-danger {
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		padding: var(--sp-xs) 0;
	}

	.ep-danger:hover:not(:disabled) {
		color: var(--c-red);
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
