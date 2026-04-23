<script lang="ts">
	interface Props {
		onAddOpportunity: (title: string) => void
		onAddDeliverable: (title: string) => void
		onClose: () => void
	}

	let { onAddOpportunity, onAddDeliverable, onClose }: Props = $props()

	let title = $state('')
	let mode: 'opportunity' | 'deliverable' = $state('opportunity')
	let inputEl: HTMLInputElement | undefined = $state()

	$effect(() => {
		inputEl?.focus()
	})

	function handleSubmit() {
		const trimmed = title.trim()
		if (!trimmed) return
		if (mode === 'opportunity') {
			onAddOpportunity(trimmed)
		} else {
			onAddDeliverable(trimmed)
		}
		title = ''
		onClose()
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault()
			e.stopPropagation()
			onClose()
		} else if (e.key === 'Tab') {
			e.preventDefault()
			mode = mode === 'opportunity' ? 'deliverable' : 'opportunity'
		} else if (e.key === 'Enter') {
			e.preventDefault()
			handleSubmit()
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="qa-overlay" role="dialog" aria-label="Quick add" onclick={onClose}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="qa-dialog" onclick={(e) => e.stopPropagation()}>
		<div class="qa-mode-tabs">
			<button class="qa-tab" class:active={mode === 'opportunity'} onclick={() => mode = 'opportunity'}>Opportunity</button>
			<button class="qa-tab" class:active={mode === 'deliverable'} onclick={() => mode = 'deliverable'}>Deliverable</button>
			<span class="qa-hint">Tab to switch</span>
		</div>
		<input
			bind:this={inputEl}
			type="text"
			class="qa-input"
			placeholder={mode === 'opportunity' ? 'New opportunity title…' : 'New deliverable title…'}
			bind:value={title}
			onkeydown={handleKeydown}
		/>
		<div class="qa-footer">
			<span class="qa-shortcut"><kbd>Enter</kbd> add</span>
			<span class="qa-shortcut"><kbd>Esc</kbd> cancel</span>
		</div>
	</div>
</div>

<style>
	.qa-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 20vh;
		z-index: 800;
	}

	.qa-dialog {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.25));
		padding: var(--sp-md);
		width: min(420px, 90vw);
		font-family: var(--font);
	}

	.qa-mode-tabs {
		display: flex;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-sm);
		align-items: center;
	}

	.qa-tab {
		background: none;
		border: 1px solid var(--c-border-soft);
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		transition: background var(--tr-fast), color var(--tr-fast), border-color var(--tr-fast);
	}

	.qa-tab.active {
		color: var(--c-text);
		font-weight: 600;
		background: var(--c-hover);
		border-color: var(--c-accent);
	}

	.qa-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		margin-left: auto;
	}

	.qa-input {
		width: 100%;
		font: inherit;
		font-size: var(--fs-md, 1rem);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-sm);
		color: var(--c-text);
		outline: none;
		box-sizing: border-box;
	}

	.qa-input:focus {
		border-color: var(--c-accent);
	}

	.qa-footer {
		display: flex;
		gap: var(--sp-md);
		margin-top: var(--sp-xs);
	}

	.qa-shortcut {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	kbd {
		display: inline-block;
		font-family: var(--font);
		font-size: var(--fs-xs);
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border);
		border-radius: 3px;
		padding: 0 4px;
		line-height: 1.4;
	}
</style>
