<script lang="ts">
	interface Props {
		onClose: () => void
	}

	let { onClose }: Props = $props()
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="kb-overlay" role="dialog" aria-label="Keyboard shortcuts" onclick={onClose}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="kb-dialog" role="document" onclick={(e) => e.stopPropagation()}>
		<header class="kb-header">
			<h2>Keyboard shortcuts</h2>
			<button class="kb-close" onclick={onClose}>×</button>
		</header>
		<div class="kb-columns">
			<section class="kb-section">
				<h3>Navigation</h3>
				<dl class="kb-list">
					<div class="kb-row"><dt><kbd>j</kbd> / <kbd>↓</kbd></dt><dd>Next item</dd></div>
					<div class="kb-row"><dt><kbd>k</kbd> / <kbd>↑</kbd></dt><dd>Previous item</dd></div>
					<div class="kb-row"><dt><kbd>Enter</kbd></dt><dd>Edit selected title</dd></div>
					<div class="kb-row"><dt><kbd>Escape</kbd></dt><dd>Close pane / dialog</dd></div>
				</dl>
			</section>
			<section class="kb-section">
				<h3>Views</h3>
				<dl class="kb-list">
					<div class="kb-row"><dt><kbd>1</kbd></dt><dd>Opportunities</dd></div>
					<div class="kb-row"><dt><kbd>2</kbd></dt><dd>Deliverables</dd></div>
					<div class="kb-row"><dt><kbd>3</kbd></dt><dd>Roadmap</dd></div>
					<div class="kb-row"><dt><kbd>4</kbd></dt><dd>Meetings</dd></div>
				</dl>
			</section>
			<section class="kb-section">
				<h3>Actions</h3>
				<dl class="kb-list">
					<div class="kb-row"><dt><kbd>n</kbd></dt><dd>New opportunity / deliverable</dd></div>
					<div class="kb-row"><dt><kbd>/</kbd></dt><dd>Focus add input</dd></div>
					<div class="kb-row"><dt><kbd>e</kbd></dt><dd>Edit selected title</dd></div>
					<div class="kb-row"><dt><kbd>a</kbd></dt><dd>Advance selected stage</dd></div>
					<div class="kb-row"><dt><kbd>x</kbd></dt><dd>Exit / discontinue selected</dd></div>
					<div class="kb-row"><dt><kbd>Ctrl+Z</kbd></dt><dd>Undo</dd></div>
				</dl>
			</section>
			<section class="kb-section">
				<h3>Help</h3>
				<dl class="kb-list">
					<div class="kb-row"><dt><kbd>?</kbd></dt><dd>Show this dialog</dd></div>
				</dl>
			</section>
		</div>
	</div>
</div>

<style>
	.kb-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 900;
	}

	.kb-dialog {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.25));
		padding: var(--sp-lg);
		max-width: 640px;
		width: 90vw;
		font-family: var(--font);
	}

	.kb-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--sp-md);
	}

	.kb-header h2 {
		margin: 0;
		font-size: var(--fs-lg);
	}

	.kb-close {
		background: none;
		border: none;
		font-size: var(--fs-lg);
		cursor: pointer;
		color: var(--c-text-muted);
		padding: var(--sp-xs);
		line-height: var(--lh-tight);
	}

	.kb-columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--sp-md);
	}

	.kb-section h3 {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.kb-list {
		margin: 0;
		padding: 0;
	}

	.kb-row {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: 3px 0;
	}

	.kb-row dt {
		flex-shrink: 0;
		display: flex;
		gap: 3px;
	}

	.kb-row dd {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	kbd {
		display: inline-block;
		font-family: var(--font);
		font-size: var(--fs-xs);
		background: var(--c-surface-alt);
		border: 1px solid var(--c-border);
		border-radius: 3px;
		padding: 1px 5px;
		min-width: 1.4em;
		text-align: center;
		line-height: var(--lh-normal);
	}
</style>
