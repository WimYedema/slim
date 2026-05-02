<script lang="ts">
	interface Props {
		/** All known names from the board (pre-sorted, pre-deduped) */
		knownNames: string[]
		/** Optional badge text per name (e.g. "not in team") — keyed by lowercase name */
		annotations?: Map<string, string>
		/** Placeholder text for the input */
		placeholder?: string
		/** CSS class applied to the input element */
		inputClass?: string
		/** Called when the user commits a name (Enter or click suggestion) */
		onPick: (name: string) => void
	}

	let { knownNames, annotations, placeholder = 'Add someone…', inputClass = '', onPick }: Props = $props()

	let value = $state('')
	let focused = $state(false)
	let selectedIndex = $state(-1)

	const filtered = $derived.by(() => {
		const q = value.trim().toLowerCase()
		if (!q) return knownNames
		return knownNames.filter((n) => n.toLowerCase().includes(q))
	})

	const showSuggestions = $derived(focused && filtered.length > 0)

	function commit(name: string) {
		const trimmed = name.trim()
		if (!trimmed) return
		onPick(trimmed)
		value = ''
		selectedIndex = -1
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			if (showSuggestions) {
				selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1)
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			if (showSuggestions) {
				selectedIndex = Math.max(selectedIndex - 1, -1)
			}
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (showSuggestions && selectedIndex >= 0) {
				commit(filtered[selectedIndex])
			} else {
				commit(value)
			}
		} else if (e.key === 'Escape') {
			selectedIndex = -1
			;(e.currentTarget as HTMLElement).blur()
		} else {
			selectedIndex = -1
		}
	}
</script>

<div class="member-picker">
	<input
		type="text"
		class={inputClass}
		{placeholder}
		bind:value
		onkeydown={handleKeydown}
		onfocus={() => (focused = true)}
		onblur={() => setTimeout(() => (focused = false), 150)}
	/>
	{#if showSuggestions}
		<ul class="mp-suggestions" role="listbox">
			{#each filtered as name, i}
				<li
					class="mp-option"
					class:mp-selected={i === selectedIndex}
					role="option"
					aria-selected={i === selectedIndex}
					onpointerdown={(e) => { e.preventDefault(); commit(name) }}
				>
					{name}
					{#if annotations?.get(name.toLowerCase())}
						<span class="mp-badge">{annotations.get(name.toLowerCase())}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.member-picker {
		position: relative;
	}

	.mp-suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin: 0;
		padding: var(--sp-2xs) 0;
		list-style: none;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		z-index: 20;
		max-height: 10rem;
		overflow-y: auto;
	}

	.mp-option {
		padding: var(--sp-2xs) var(--sp-sm);
		font-size: var(--fs-sm);
		color: var(--c-text);
		cursor: pointer;
	}

	.mp-option:hover,
	.mp-selected {
		background: var(--c-accent-bg);
		color: var(--c-accent-text);
	}

	.mp-badge {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		margin-left: var(--sp-xs);
	}
</style>
