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
<div class="overlay qa-overlay" role="dialog" aria-label="Quick add" onclick={onClose}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dialog qa-dialog" onclick={(e) => e.stopPropagation()}>
		<div class="tab-bar">
			<button class="tab" class:active={mode === 'opportunity'} onclick={() => mode = 'opportunity'}>Opportunity</button>
			<button class="tab" class:active={mode === 'deliverable'} onclick={() => mode = 'deliverable'}>Deliverable</button>
			<span class="qa-hint">Tab to switch</span>
		</div>
		<input
			bind:this={inputEl}
			type="text"
			class="qa-input"
			placeholder={mode === 'opportunity' ? 'Add an idea or request…' : 'New deliverable title…'}
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
		align-items: flex-start;
		padding-top: 20vh;
		z-index: 800;
	}

	.qa-dialog {
		padding: var(--sp-md);
		max-width: 420px;
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
		line-height: var(--lh-normal);
	}
</style>
