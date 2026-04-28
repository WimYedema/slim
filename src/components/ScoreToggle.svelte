<script lang="ts">
	import {
		type Score,
		SCORE_SYMBOL,
		SCORE_DISPLAY,
		scoreClass,
	} from '../lib/types'

	interface Props {
		score: Score
		label: string
		onScoreChange: (score: Score) => void
	}

	let { score, label, onScoreChange }: Props = $props()

	const OPTS = ['none', 'positive', 'uncertain', 'negative'] as const

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
		e.preventDefault()
		const cur = OPTS.indexOf(score)
		const next = e.key === 'ArrowRight' ? (cur + 1) % 4 : (cur + 3) % 4
		onScoreChange(OPTS[next]);
		(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.score-btn')[next]?.focus()
	}
</script>

<div class="score-toggle" role="radiogroup" aria-label={label} onkeydown={handleKeydown}>
	{#each OPTS as s, i}
		<button
			class="score-btn {scoreClass(s)}"
			class:active={score === s}
			role="radio"
			aria-checked={score === s}
			tabindex={score === s || (score === 'none' && i === 0) ? 0 : -1}
			onclick={() => onScoreChange(s)}
			title={SCORE_DISPLAY[s].label}
		>{SCORE_SYMBOL[s]}</button>
	{/each}
</div>

<style>
	.score-toggle {
		display: inline-flex;
		gap: 1px;
		flex-shrink: 0;
	}

	.score-btn {
		width: 20px;
		height: 18px;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--fs-3xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-ghost);
		line-height: var(--lh-tight);
		padding: 0;
		transition: background var(--tr-fast), color var(--tr-fast), border-color var(--tr-fast);
	}

	.score-btn:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
	.score-btn:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
	.score-btn:not(:first-child) { border-left: none; }
	.score-btn:hover { background: color-mix(in srgb, var(--c-text) var(--opacity-subtle), var(--c-surface)); }

	.score-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--c-accent);
		z-index: 1;
	}

	.score-btn.active.score-none { background: var(--c-neutral-bg); color: var(--c-text-muted); border-color: var(--c-text-ghost); }
	.score-btn.active.score-positive { background: var(--c-green-signal); color: var(--c-surface); border-color: var(--c-green-signal); }
	.score-btn.active.score-uncertain { background: var(--c-warm); color: var(--c-surface); border-color: var(--c-warm); }
	.score-btn.active.score-negative { background: var(--c-red); color: var(--c-surface); border-color: var(--c-red); }
</style>
