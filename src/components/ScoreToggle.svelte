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
		expanded?: boolean
	}

	let { score, label, onScoreChange, expanded = false }: Props = $props()

	const OPTS = ['none', 'positive', 'uncertain', 'negative'] as const
	const ACTION_OPTS = ['positive', 'uncertain', 'negative'] as const

	const ACTION_LABELS: Record<string, string> = {
		positive: 'Go ahead',
		uncertain: 'Concern',
		negative: 'Object',
	}

	const ACTION_FEEDBACK: Record<string, string> = {
		positive: 'OK to proceed',
		uncertain: 'Noted, won\'t block',
		negative: 'Must resolve before advancing',
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
		e.preventDefault()
		if (expanded) {
			const cur = ACTION_OPTS.indexOf(score as typeof ACTION_OPTS[number])
			const idx = cur === -1 ? 0 : (e.key === 'ArrowRight' ? (cur + 1) % 3 : (cur + 2) % 3)
			onScoreChange(ACTION_OPTS[idx]);
			(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.score-btn')[idx]?.focus()
		} else {
			const cur = OPTS.indexOf(score)
			const next = e.key === 'ArrowRight' ? (cur + 1) % 4 : (cur + 3) % 4
			onScoreChange(OPTS[next]);
			(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.score-btn')[next]?.focus()
		}
	}
</script>

{#if expanded}
<div class="score-toggle expanded" role="radiogroup" aria-label={label} onkeydown={handleKeydown}>
	{#each ACTION_OPTS as s, i}
		<button
			class="score-btn-action {scoreClass(s)}"
			class:active={score === s}
			role="radio"
			aria-checked={score === s}
			tabindex={score === s || (score === 'none' && i === 0) ? 0 : -1}
			onclick={() => onScoreChange(s)}
		><span class="action-radio">{score === s ? '●' : '○'}</span>{ACTION_LABELS[s]}</button>
	{/each}
	{#if score !== 'none'}
		<button class="score-clear" onclick={() => onScoreChange('none')}>clear</button>
	{/if}
</div>
{#if score !== 'none'}
	<span class="score-feedback {scoreClass(score)}">{ACTION_FEEDBACK[score]}</span>
{/if}
{:else}
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
{/if}

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

	/* Expanded mode: option C — action pills with post-click feedback */
	.score-toggle.expanded {
		display: flex;
		gap: var(--sp-sm);
		align-items: center;
	}

	.score-btn-action {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-xs);
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: var(--sp-xs) 0;
		transition: color var(--tr-fast);
	}

	.score-btn-action:hover { color: var(--c-text); }

	.score-btn-action:focus-visible {
		outline: none;
		text-decoration: underline;
		text-decoration-color: var(--c-accent);
		text-underline-offset: 2px;
	}

	.action-radio {
		font-size: var(--fs-2xs);
		line-height: 1;
	}

	.score-btn-action.active.score-positive { color: var(--c-green-signal); font-weight: var(--fw-bold); }
	.score-btn-action.active.score-uncertain { color: var(--c-warm); font-weight: var(--fw-bold); }
	.score-btn-action.active.score-negative { color: var(--c-red); font-weight: var(--fw-bold); }

	.score-clear {
		background: none;
		border: none;
		font-family: var(--font);
		font-size: var(--fs-3xs);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0;
		margin-left: auto;
	}

	.score-clear:hover { color: var(--c-text-muted); text-decoration: underline; }

	.score-feedback {
		font-family: var(--font);
		font-size: var(--fs-3xs);
		font-style: italic;
	}

	.score-feedback.score-positive { color: var(--c-green-signal); }
	.score-feedback.score-uncertain { color: var(--c-warm); }
	.score-feedback.score-negative { color: var(--c-red); }
</style>
