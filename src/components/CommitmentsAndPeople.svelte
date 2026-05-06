<script lang="ts">
	import {
		type Opportunity,
		type Commitment,
		type PersonLink,
		type PersonRole,
		type Stage,
		STAGES,
		PERSON_ROLES,
		stageIndex,
		formatDaysLeft,
	} from '../lib/types'
	import MemberPicker from './MemberPicker.svelte'

	interface Props {
		opportunity: Opportunity
		knownNames?: string[]
		nameAnnotations?: Map<string, string>
		onUpdate: (opportunity: Opportunity) => void
	}

	let { opportunity, knownNames = [], nameAnnotations, onUpdate }: Props = $props()

	// Commitment state
	let showAddCommitment = $state(false)
	let commitTo = $state('')
	let commitMilestone: Stage = $state('sketch')
	let commitByDate = $state('')

	function addCommitment() {
		const trimmed = commitTo.trim()
		if (!trimmed || !commitByDate) return
		const commitment: Commitment = {
			id: crypto.randomUUID(),
			to: trimmed,
			milestone: commitMilestone,
			by: new Date(commitByDate).getTime(),
		}
		onUpdate({ ...opportunity, commitments: [...opportunity.commitments, commitment] })
		commitTo = ''
		commitByDate = ''
		showAddCommitment = false
	}

	function removeCommitment(id: string) {
		onUpdate({ ...opportunity, commitments: opportunity.commitments.filter((c) => c.id !== id) })
	}

	// People state
	let addingPerson = $state(false)

	function addPersonWithRole(name: string, role: PersonRole) {
		const trimmed = name.trim()
		if (!trimmed) return
		if (opportunity.people.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return
		const person: PersonLink = {
			id: crypto.randomUUID(),
			name: trimmed,
			role,
			perspectives: [],
		}
		onUpdate({ ...opportunity, people: [...opportunity.people, person] })
	}

	function removePersonById(id: string) {
		onUpdate({ ...opportunity, people: opportunity.people.filter(p => p.id !== id) })
	}

	function changePersonRole(id: string, role: PersonRole) {
		onUpdate({
			...opportunity,
			people: opportunity.people.map(p => p.id === id ? { ...p, role } : p),
		})
	}
</script>

<div id="commitments-section" class="commitments-section">
	<div class="commitments-header">
		<span class="section-label">Promises</span>
		<span class="commitment-count">{opportunity.commitments.length}</span>
	</div>
	{#each opportunity.commitments as c (c.id)}
		{@const si = stageIndex(opportunity.stage)}
		{@const met = stageIndex(c.milestone) < si}
		{@const daysLeft = Math.ceil((c.by - Date.now()) / 86_400_000)}
		<div class="commitment-row" class:met class:overdue={!met && daysLeft < 0} class:urgent={!met && daysLeft >= 0 && daysLeft <= 7}>
			<span class="commitment-text">
				{STAGES.find((s) => s.key === c.milestone)?.label} for {c.to}
			</span>
			<span class="commitment-deadline">
				{#if met}
					✓ met
				{:else}
					{formatDaysLeft(daysLeft)}
				{/if}
			</span>
			<button class="commitment-remove" onclick={() => removeCommitment(c.id)} aria-label="Remove commitment">×</button>
		</div>
	{/each}
	{#if showAddCommitment}
	<div class="commitment-add-form">
			<input type="text" class="commitment-input" placeholder="Promised to…" bind:value={commitTo} list="known-names-list" />
			<datalist id="known-names-list">
				{#each knownNames as name}
					<option value={name} />
				{/each}
			</datalist>
			<select class="commitment-select" bind:value={commitMilestone}>
				{#each STAGES as stage}
					<option value={stage.key}>{stage.label}</option>
				{/each}
			</select>
			<input type="date" class="commitment-date" bind:value={commitByDate} />
			<button class="commitment-save" onclick={addCommitment} disabled={!commitTo.trim() || !commitByDate}>✓</button>
			<button class="commitment-cancel" onclick={() => { showAddCommitment = false; commitTo = ''; commitByDate = '' }}>×</button>
		</div>
	{:else}
		<button class="btn-ghost add-commitment-btn" onclick={() => showAddCommitment = true}>+ promise</button>
	{/if}
</div>

<div class="people-section">
	<div class="people-header">
		<span class="section-label">Inform</span>
		<span class="commitment-count">{opportunity.people.length}</span>
	</div>
	{#each opportunity.people as person (person.id)}
		<div class="people-row">
			<span class="people-name">{person.name}</span>
			<select
				class="people-role-select"
				value={person.role}
				onchange={(e) => changePersonRole(person.id, (e.target as HTMLSelectElement).value as PersonRole)}
			>
				{#each PERSON_ROLES as role}
					<option value={role.key}>{role.label}</option>
				{/each}
			</select>
			<button class="commitment-remove" onclick={() => removePersonById(person.id)} aria-label="Remove person">×</button>
		</div>
	{/each}
	{#if addingPerson}
		<div class="people-add-row">
			<MemberPicker
				{knownNames}
				annotations={nameAnnotations}
				placeholder="Name…"
				inputClass="people-name-input"
				onPick={(name) => { addPersonWithRole(name, 'stakeholder'); addingPerson = false }}
			/>
			<button class="commitment-cancel" onclick={() => addingPerson = false}>×</button>
		</div>
	{:else}
		<button class="btn-ghost add-commitment-btn" onclick={() => addingPerson = true}>+ person</button>
	{/if}
</div>

<style>
	.section-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
	}

	/* --- Commitments --- */

	.commitments-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.commitments-header {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.commitment-count {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
	}

	.commitment-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.commitment-row.urgent {
		background: color-mix(in srgb, var(--c-warm) var(--opacity-moderate), transparent);
	}

	.commitment-row.overdue {
		background: color-mix(in srgb, var(--c-red) var(--opacity-moderate), transparent);
	}

	.commitment-row.met {
		color: var(--c-text-ghost);
		text-decoration: line-through;
	}

	.commitment-text {
		flex: 1;
		color: var(--c-text);
	}

	.commitment-deadline {
		font-family: var(--font);
		font-weight: var(--fw-medium);
		white-space: nowrap;
		color: var(--c-text-muted);
	}

	.commitment-row.urgent .commitment-deadline {
		color: var(--c-warm);
	}

	.commitment-row.overdue .commitment-deadline {
		color: var(--c-red);
	}

	.commitment-remove {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
		opacity: 0;
		transition: opacity var(--tr-fast);
	}

	.commitment-row:hover .commitment-remove,
	.people-row:hover .commitment-remove {
		opacity: 1;
	}

	.commitment-add-form {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-xs);
	}

	.commitment-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--c-border);
		padding: 1px 2px;
		width: 7em;
	}

	.commitment-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.commitment-select {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.commitment-date {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.commitment-save, .commitment-cancel {
		font-size: var(--fs-xs);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 2px;
	}

	.commitment-save {
		color: var(--c-green-signal);
	}

	.commitment-save:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.commitment-cancel {
		color: var(--c-text-ghost);
	}

	.add-commitment-btn {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		align-self: flex-start;
		transition: color var(--tr-fast);
	}

	.add-commitment-btn:hover {
		color: var(--c-accent);
	}

	/* --- People (Voices) section --- */

	.people-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.people-header {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.people-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.people-row:hover {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
	}

	.people-name {
		flex: 1;
		color: var(--c-text);
	}

	.people-role-select {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: 1px 4px;
	}

	.people-add-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-xs);
	}

	:global(.people-name-input) {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--c-border);
		padding: 1px 2px;
		width: 10em;
	}

	:global(.people-name-input:focus) {
		outline: none;
		border-bottom-color: var(--c-accent);
	}
</style>
