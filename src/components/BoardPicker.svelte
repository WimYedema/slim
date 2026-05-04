<script lang="ts">
	import type { BoardEntry } from '../lib/store'

	interface Props {
		boards: BoardEntry[]
		activeBoardId: string | null
		onSwitch: (id: string) => void
		onNew: () => void
		onRename: (id: string, name: string) => void
		onDelete: (id: string) => void
	}

	let { boards, activeBoardId, onSwitch, onNew, onRename, onDelete }: Props = $props()

	let open = $state(false)
	let editingId = $state(null as string | null)
	let editName = $state('')

	const activeBoard = $derived(boards.find(b => b.id === activeBoardId))

	function startRename(id: string, currentName: string) {
		editingId = id
		editName = currentName
	}

	function commitRename() {
		if (editingId && editName.trim()) {
			onRename(editingId, editName.trim())
		}
		editingId = null
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename()
		if (e.key === 'Escape') { editingId = null }
	}
</script>

<div class="bp-container">
	<button class="bp-trigger" onclick={() => open = !open} title="Switch board">
		<span class="bp-name">{activeBoard?.name ?? 'No board'}</span>
		<span class="bp-chevron">{open ? '▴' : '▾'}</span>
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bp-backdrop" onclick={() => { open = false; editingId = null }}></div>
		<div class="bp-dropdown">
			{#each boards as board (board.id)}
				<div class="bp-item" class:active={board.id === activeBoardId}>
					{#if editingId === board.id}
						<input
							class="bp-rename-input"
							bind:value={editName}
							onblur={commitRename}
							onkeydown={handleKeydown}
							autofocus
						/>
					{:else}
						<button
							class="bp-item-btn"
							onclick={() => { onSwitch(board.id); open = false }}
						>
							{board.name}
						</button>
						<button
							class="bp-action"
							title="Rename board"
							onclick={(e) => { e.stopPropagation(); startRename(board.id, board.name) }}
						>✎</button>
						{#if boards.length > 1}
							<button
								class="bp-action bp-action-delete"
								title="Delete board"
								onclick={(e) => { e.stopPropagation(); onDelete(board.id); }}
							>✕</button>
						{/if}
					{/if}
				</div>
			{/each}
			<button class="bp-new" onclick={() => { onNew(); open = false }}>
				+ New board
			</button>
		</div>
	{/if}
</div>

<style>
	.bp-container {
		position: relative;
	}

	.bp-trigger {
		display: flex;
		align-items: center;
		gap: var(--sp-2xs);
		background: none;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-2xs) var(--sp-xs);
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text);
		cursor: pointer;
		max-width: 12rem;
	}

	.bp-trigger:hover {
		border-color: var(--c-accent);
	}

	.bp-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bp-chevron {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.bp-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
	}

	.bp-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: var(--sp-2xs);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		z-index: 91;
		min-width: 14rem;
		max-width: 20rem;
		padding: var(--sp-xs) 0;
	}

	.bp-item {
		display: flex;
		align-items: center;
		gap: var(--sp-2xs);
		padding: var(--sp-2xs) var(--sp-sm);
	}

	.bp-item.active {
		background: var(--c-surface-alt);
	}

	.bp-item-btn {
		flex: 1;
		background: none;
		border: none;
		padding: var(--sp-2xs) var(--sp-xs);
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bp-item-btn:hover {
		color: var(--c-accent);
	}

	.bp-action {
		background: none;
		border: none;
		padding: var(--sp-2xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
	}

	.bp-action:hover {
		color: var(--c-accent);
		background: var(--c-bg-hover);
	}

	.bp-action-delete:hover {
		color: var(--c-red);
	}

	.bp-rename-input {
		flex: 1;
		font: inherit;
		font-size: var(--fs-sm);
		padding: var(--sp-2xs) var(--sp-xs);
		border: 1px solid var(--c-accent);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		outline: none;
	}

	.bp-new {
		display: block;
		width: 100%;
		background: none;
		border: none;
		border-top: 1px solid var(--c-border);
		padding: var(--sp-xs);
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-accent);
		cursor: pointer;
		text-align: left;
		margin-top: var(--sp-2xs);
	}

	.bp-new:hover {
		background: var(--c-bg-hover);
	}
</style>
