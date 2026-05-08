<script lang="ts">
	import {
		type Deliverable,
		type OpportunityDeliverableLink,
		type Opportunity,
		type Coverage,
		type TShirtSize,
		type Certainty,
		linksForDeliverable,
		linksForOpportunity,
		opportunityEffort,
		STAGES,
		stageIndex,
		TSHIRT_SIZES,
		SIZE_ROW_HEIGHT,
		UNESTIMATED_ROW_HEIGHT,
		inheritedPeople,
		effectiveSize,
		effectiveCertainty,
		formatEstimateDays,
	} from '../lib/types'

	interface Props {
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		opportunities: Opportunity[]
		selectedId: string | null
		onAdd: (title: string) => Deliverable
		onUpdate: (deliverable: Deliverable) => void
		onRemove: (id: string) => void
		onLink: (opportunityId: string, deliverableId: string, coverage: Coverage) => void
		onUnlink: (opportunityId: string, deliverableId: string) => void
		onUpdateCoverage: (opportunityId: string, deliverableId: string, coverage: Coverage) => void
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
		orderedIds?: string[]
		estimationRoom?: string
		estimationBusy?: boolean
		estimationMessage?: string
		estimationError?: string
		onPushDeliverables?: () => void
		onPullEstimates?: () => void
		onShowImport?: () => void
	}

	let { deliverables, links, opportunities, selectedId, onAdd, onUpdate, onRemove, onLink, onUnlink, onUpdateCoverage, onSelectOpportunity, onSelectDeliverable, orderedIds = $bindable([]), estimationRoom, estimationBusy = false, estimationMessage = '', estimationError = '', onPushDeliverables, onPullEstimates, onShowImport }: Props = $props()

	let newTitle = $state('')

	function handleAdd() {
		const t = newTitle.trim()
		if (!t) return
		onAdd(t)
		newTitle = ''
	}

	/** Active vs archived split */
	const activeDeliverables = $derived(deliverables.filter((d) => d.status === 'active'))
	const archivedDeliverables = $derived(deliverables.filter((d) => d.status !== 'active'))

	/** Orphan deliverables — linked to no opportunity */
	const orphanCount = $derived(activeDeliverables.filter((d) => linksForDeliverable(links, d.id).length === 0).length)

	// ── Contributor columns ──

	/** All contributors for a deliverable: inherited experts + extras */
	function allContributors(deliverableId: string): Set<string> {
		const names = new Set<string>(inheritedPeople(deliverableId, 'contributors', links, opportunities))
		const d = deliverables.find((d) => d.id === deliverableId)
		if (d) for (const n of d.extraContributors) names.add(n)
		return names
	}

	/** Unique contributor names across all deliverables, sorted by assignment count descending */
	const contributorColumns = $derived.by(() => {
		const counts = new Map<string, number>()
		for (const d of deliverables) {
			for (const name of allContributors(d.id)) {
				counts.set(name, (counts.get(name) ?? 0) + 1)
			}
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, count }))
	})

	/** Toggle contributor assignment on a deliverable */
	function toggleContributor(deliverable: Deliverable, name: string) {
		const inherited = inheritedPeople(deliverable.id, 'contributors', links, opportunities)
		if (inherited.includes(name)) return // can't toggle inherited
		if (deliverable.extraContributors.includes(name)) {
			onUpdate({ ...deliverable, extraContributors: deliverable.extraContributors.filter((n) => n !== name) })
		} else {
			onUpdate({ ...deliverable, extraContributors: [...deliverable.extraContributors, name] })
		}
	}

	// ── Matrix view data ──

	/** Find link between an opportunity and deliverable, if any */
	function findLink(opportunityId: string, deliverableId: string): OpportunityDeliverableLink | undefined {
		return links.find((l) => l.opportunityId === opportunityId && l.deliverableId === deliverableId)
	}

	/** Toggle link in matrix: no link → partial, partial → full, full → unlink */
	function cycleMatrixCell(opportunityId: string, deliverableId: string) {
		const existing = findLink(opportunityId, deliverableId)
		if (!existing) {
			onLink(opportunityId, deliverableId, 'partial')
		} else if (existing.coverage === 'partial') {
			onUpdateCoverage(opportunityId, deliverableId, 'full')
		} else {
			onUnlink(opportunityId, deliverableId)
		}
	}

	/** Is an opportunity fully covered? decompositionComplete + all links full */
	function isFullyCovered(opp: Opportunity): boolean {
		if (!opp.decompositionComplete) return false
		const oppLinks = linksForOpportunity(links, opp.id)
		return oppLinks.length > 0 && oppLinks.every((l) => l.coverage === 'full')
	}

	/** Funnel summary: total active opportunities vs those in the matrix */
	const activeOpportunityCount = $derived(opportunities.filter((o) => !o.discontinuedAt).length)

	/** Opportunities in the matrix with zero linked deliverables */
	function hasNoLinks(opp: Opportunity): boolean {
		return linksForOpportunity(links, opp.id).length === 0
	}

	/** Row status: orphan (no links), partial-only (has links but none full), ok */
	function rowStatus(deliverableId: string): 'orphan' | 'partial-only' | 'ok' {
		const dLinks = linksForDeliverable(links, deliverableId)
		if (dLinks.length === 0) return 'orphan'
		if (dLinks.every((l) => l.coverage !== 'full')) return 'partial-only'
		return 'ok'
	}

	/** Stage maturity weight: later stages = higher confidence in value */
	const STAGE_WEIGHT: Record<string, number> = { explore: 0.25, sketch: 0.5, validate: 0.75, decompose: 1.0, deliver: 1.0 }

	/** Leverage score: sum of linked opportunity maturity weights / effort. Higher = do first. */
	function leverageScore(deliverableId: string): number {
		const dLinks = linksForDeliverable(links, deliverableId)
		if (dLinks.length === 0) return 0
		const valueSum = dLinks.reduce((sum, link) => {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) return sum
			const weight = STAGE_WEIGHT[opp.stage] ?? 0.5
			const coverageBonus = link.coverage === 'full' ? 1.0 : 0.6
			return sum + weight * coverageBonus
		}, 0)
		const d = deliverables.find((d) => d.id === deliverableId)
		const sizeIdx = d?.size ? TSHIRT_SIZES.indexOf(d.size) + 1 : 3 // unestimated = M
		return valueSum / sizeIdx
	}

	/** Cycle T-shirt size: null → XS → S → M → L → XL → null */
	function cycleSize(deliverable: Deliverable) {
		const current = deliverable.size
		if (!current) {
			onUpdate({ ...deliverable, size: 'XS' })
		} else {
			const idx = TSHIRT_SIZES.indexOf(current)
			const next = idx < TSHIRT_SIZES.length - 1 ? TSHIRT_SIZES[idx + 1] : null
			onUpdate({ ...deliverable, size: next })
		}
	}

	/** Cycle certainty: null → 1 → 2 → 3 → 4 → 5 → null */
	function cycleCertainty(deliverable: Deliverable) {
		const current = deliverable.certainty
		if (!current) {
			onUpdate({ ...deliverable, certainty: 1 })
		} else {
			const next = current < 5 ? (current + 1) as Certainty : null
			onUpdate({ ...deliverable, certainty: next })
		}
	}

	/** Row height based on size */
	function rowHeight(size: TShirtSize | null): number {
		return size ? SIZE_ROW_HEIGHT[size] : UNESTIMATED_ROW_HEIGHT
	}

	// ── Drag reorder state ──
	let rowOrder: string[] = $state([])
	let dragRowId: string | null = $state(null)
	let dropTargetRow: string | null = $state(null)
	let vZoom: number = $state(1.0)

	/** Which early-stage groups are expanded in the matrix */
	let sketchExpanded = $state(false)
	let exploreExpanded = $state(false)

	/** Leverage-sorted row IDs (used for initial order and re-sort) */
	function leverageSortedIds(): string[] {
		return [...activeDeliverables].sort((a, b) => leverageScore(b.id) - leverageScore(a.id)).map((d) => d.id)
	}

	/** Seed row order from leverage sort on first render; keep stable after that */
	$effect(() => {
		const activeIds = new Set(activeDeliverables.map((d) => d.id))
		if (rowOrder.length === 0 && activeIds.size > 0) {
			// First render: initialize from leverage sort
			rowOrder = leverageSortedIds()
		} else {
			// Drop removed, append new
			const kept = rowOrder.filter((id) => activeIds.has(id))
			const keptSet = new Set(kept)
			const added = activeDeliverables.filter((d) => !keptSet.has(d.id)).map((d) => d.id)
			if (kept.length !== rowOrder.length || added.length > 0) {
				rowOrder = [...kept, ...added]
			}
		}
	})

	/** Re-sort rows by leverage (explicit user action) */
	function resortRows() {
		rowOrder = leverageSortedIds()
	}

	/** Primary columns: Validate + Decompose, or any stage with existing links */
	const primaryOpportunityIds = $derived(
		opportunities
			.filter((o) => !o.discontinuedAt && (stageIndex(o.stage) >= 2 || linksForOpportunity(links, o.id).length > 0))
			.map((o) => o.id)
	)

	/** Early-stage groups (no links required — these are purely stage-based) */
	const sketchOpps = $derived(
		opportunities.filter((o) => !o.discontinuedAt && o.stage === 'sketch' && !primaryOpportunityIds.includes(o.id))
	)
	const exploreOpps = $derived(
		opportunities.filter((o) => !o.discontinuedAt && o.stage === 'explore' && !primaryOpportunityIds.includes(o.id))
	)

	/** Default column order: sorted by horizon (natural sort), then stage maturity within horizon */
	const horizonSortedColIds = $derived(() => {
		const stageOrder: Record<string, number> = { decompose: 0, validate: 1, sketch: 2, explore: 3 }
		return [...primaryOpportunityIds].sort((aId, bId) => {
			const a = opportunities.find((o) => o.id === aId)!
			const b = opportunities.find((o) => o.id === bId)!
			const hCmp = a.horizon.localeCompare(b.horizon, undefined, { numeric: true })
			if (hCmp !== 0) return hCmp
			return (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99)
		})
	})

	/** Ordered primary columns — horizon-sorted (no manual drag) */
	const orderedCols = $derived(
		horizonSortedColIds().map((id) => opportunities.find((o) => o.id === id)!).filter(Boolean)
	)

	/** Horizon groups derived from ordered columns — for group headers and border placement */
	const horizonGroups = $derived(() => {
		const groups: Array<{ horizon: string; span: number; lastId: string }> = []
		for (const opp of orderedCols) {
			const last = groups[groups.length - 1]
			if (last && last.horizon === opp.horizon) {
				last.span++
				last.lastId = opp.id
			} else {
				groups.push({ horizon: opp.horizon, span: 1, lastId: opp.id })
			}
		}
		return groups
	})

	/** Set of opportunity IDs that are the last column in their horizon group */
	const horizonLastIds = $derived(new Set(horizonGroups().map((g) => g.lastId)))

	/** Get horizon color for a horizon string */
	function horizonColor(horizon: string | null): string {
		if (!horizon) return 'var(--c-structure)'
		const groups = horizonGroups()
		for (let gi = 0; gi < groups.length; gi++) {
			if (groups[gi].horizon === horizon) return `var(--c-horizon-${gi % 4})`
		}
		return 'var(--c-structure)'
	}

	/** Colspan for a horizon label: 3 fixed cols + opportunity cols through that horizon's last column */
	function horizonLabelColspan(horizon: string | null): number {
		if (!horizon) return 4
		let cols = 4 // name, size, cert, est
		for (const g of horizonGroups()) {
			cols += g.span
			if (g.horizon === horizon) break
		}
		return cols
	}

	/** Horizon groups after a given horizon — for rendering trailing thick-border cells in separator rows */
	function trailingHorizonGroups(horizon: string | null): Array<{ horizon: string; span: number }> {
		const groups = horizonGroups()
		if (!horizon) return groups.map((g) => ({ horizon: g.horizon, span: g.span }))
		let found = false
		const result: Array<{ horizon: string; span: number }> = []
		for (const g of groups) {
			if (found) result.push({ horizon: g.horizon, span: g.span })
			if (g.horizon === horizon) found = true
		}
		return result
	}

	/** Ordered matrix rows — follows stable rowOrder (set on mount, drag, or explicit re-sort) */
	const orderedRows = $derived(
		rowOrder.map((id) => activeDeliverables.find((d) => d.id === id)!).filter(Boolean)
	)

	// Expose visual row order to parent for keyboard navigation
	$effect(() => {
		orderedIds = orderedRows.map(d => d.id)
	})

	function moveItem(order: string[], fromId: string, toId: string): string[] {
		const arr = [...order]
		const fromIdx = arr.indexOf(fromId)
		const toIdx = arr.indexOf(toId)
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return arr
		arr.splice(fromIdx, 1)
		arr.splice(toIdx, 0, fromId)
		return arr
	}

	function handleRowDragStart(id: string, e: DragEvent) {
		dragRowId = id
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', id)
		}
	}
	function handleRowDragOver(id: string, e: DragEvent) {
		if (!dragRowId || dragRowId === id) return
		e.preventDefault()
		dropTargetRow = id
	}
	function handleRowDrop(id: string, e: DragEvent) {
		e.preventDefault()
		if (dragRowId && dragRowId !== id) {
			rowOrder = moveItem(orderedRows.map((d) => d.id), dragRowId, id)
		}
		dragRowId = null
		dropTargetRow = null
	}
	function handleRowDragEnd() {
		dragRowId = null
		dropTargetRow = null
	}

	/** Derived horizon for a deliverable: earliest horizon among linked opportunities, or null */
	function derivedHorizon(deliverableId: string): string | null {
		const dLinks = linksForDeliverable(links, deliverableId)
		if (dLinks.length === 0) return null
		const horizons = dLinks
			.map((l) => opportunities.find((o) => o.id === l.opportunityId))
			.filter((o): o is Opportunity => !!o && !o.discontinuedAt)
			.map((o) => o.horizon)
		if (horizons.length === 0) return null
		horizons.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
		return horizons[0]
	}

	/** All pipeline horizons in natural sort order */
	const pipelineHorizons = $derived(() => {
		const set = new Set<string>()
		for (const opp of opportunities) {
			if (!opp.discontinuedAt) set.add(opp.horizon)
		}
		return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	})

	/** Opening horizon label (before first row): earliest pipeline horizon with deliverables */
	const openingHorizon = $derived(() => {
		const present = new Set<string>()
		for (const d of orderedRows) {
			const h = derivedHorizon(d.id)
			if (h) present.add(h)
		}
		return pipelineHorizons().find((h) => present.has(h)) ?? null
	})

	/** Row indices AFTER which a horizon transition label appears.
	 *  Walks pipeline horizons in order; for each, finds its last row
	 *  and places the next horizon's label after it. */
	const horizonLabelAfter = $derived(() => {
		const result = new Map<number, string>()
		const present = new Set<string>()
		for (const d of orderedRows) {
			const h = derivedHorizon(d.id)
			if (h) present.add(h)
		}
		const presentHorizons = pipelineHorizons().filter((h) => present.has(h))
		for (let hi = 0; hi < presentHorizons.length - 1; hi++) {
			const currentH = presentHorizons[hi]
			const nextH = presentHorizons[hi + 1]
			// Find last row belonging to currentH
			for (let ri = orderedRows.length - 1; ri >= 0; ri--) {
				if (derivedHorizon(orderedRows[ri].id) === currentH) {
					result.set(ri, nextH)
					break
				}
			}
		}
		return result
	})

	/** Band index per row — increments at each horizon label boundary for alternating backgrounds */
	/** Section horizon for each row — determined by which label precedes it */
	const rowSectionHorizon = $derived(() => {
		const sections = new Map<number, string | null>()
		let current = openingHorizon()
		for (let i = 0; i < orderedRows.length; i++) {
			sections.set(i, current)
			const next = horizonLabelAfter().get(i)
			if (next) current = next
		}
		return sections
	})

	/** Check whether a horizon group's thick border should show at a given row index.
	 *  Only borders for horizons >= the current section's horizon (in pipeline order) are visible. */
	function isHorizonBorderActive(ri: number, horizonGroupHorizon: string): boolean {
		const sectionH = rowSectionHorizon().get(ri)
		if (!sectionH) return true
		const ph = pipelineHorizons()
		return ph.indexOf(horizonGroupHorizon) >= ph.indexOf(sectionH)
	}

	/** Pipeline horizons not represented by any deliverable in the table */
	const missingHorizons = $derived(() => {
		const present = new Set<string>()
		for (const d of orderedRows) {
			const h = derivedHorizon(d.id)
			if (h) present.add(h)
		}
		return pipelineHorizons().filter((h) => !present.has(h))
	})

	// Scroll selected row into view on keyboard navigation
	$effect(() => {
		if (!selectedId) return
		requestAnimationFrame(() => {
			const row = document.querySelector('.matrix-table tr.row-selected') as HTMLElement | null
			row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		})
	})
</script>

<div class="deliverables-view">

	<div class="toolbar dv-toolbar">
		{#if onShowImport}
			<button class="btn-solid" onclick={onShowImport}>Import…</button>
		{/if}
		{#if orderedRows.length > 0}
			<label class="dv-toolbar-zoom" title="Vertical zoom">
				<span class="dv-toolbar-label">Zoom</span>
				<input type="range" min="0.4" max="2" step="0.1" bind:value={vZoom} />
			</label>
		{/if}
		{#if estimationRoom}
			<span class="toolbar-sep"></span>
			<span class="dv-toolbar-label">Skatting: <code>{estimationRoom}</code></span>
			<button class="btn-solid" disabled={estimationBusy} onclick={onPushDeliverables}>Push deliverables</button>
			<button class="btn-solid" disabled={estimationBusy} onclick={onPullEstimates}>Pull estimates</button>
			{#if estimationMessage}<span class="dv-est-msg">{estimationMessage}</span>{/if}
			{#if estimationError}<span class="dv-est-err">{estimationError}</span>{/if}
		{/if}
	</div>

	{#if orderedCols.length === 0}
			<div class="dv-empty">
				{#if deliverables.length === 0 && opportunities.length === 0}
					<p class="dv-empty-title">Map opportunities to deliverables</p>
					<p>This view connects work items to goals. Add opportunities in the Pipeline first, then come back here to plan deliverables. Press <kbd>n</kbd> to quick-add from anywhere.</p>
				{:else if deliverables.length === 0}
					<p class="dv-empty-title">No deliverables yet</p>
					<p>Add deliverables below, or use <kbd>n</kbd> then <kbd>Tab</kbd> to quick-add from anywhere.</p>
				{:else}
					<p class="dv-empty-title">No opportunities in the matrix yet</p>
					<p>Opportunities appear as columns once they reach Validate or Decompose stages, or when manually linked to a deliverable.</p>
				{/if}
			</div>
		{:else}
			<div class="matrix-wrapper">
				<table class="matrix-table">
					<thead>
						{#if horizonGroups().length > 0}
						<tr class="horizon-group-row">
							<th colspan="4"></th>
							{#each horizonGroups() as group, ghi}
								<th colspan={group.span} class="horizon-group-label" class:horizon-last={ghi < horizonGroups().length - 1} style="--hz-color: {horizonColor(group.horizon)}">{group.horizon}</th>
							{/each}
						</tr>
						{/if}
						<tr>
							<th class="matrix-corner" style="--hz-opening: {horizonColor(openingHorizon())}">
								<button class="corner-resort" onclick={resortRows} title="Re-sort rows by leverage score">↕ Sort</button>
								{#if orphanCount > 0}<span class="corner-orphan" title="{orphanCount} deliverable{orphanCount !== 1 ? 's' : ''} not linked to any opportunity">{orphanCount} orphan{orphanCount !== 1 ? 's' : ''}</span>{/if}
							</th>
							<th class="matrix-col-label" style="--hz-opening: {horizonColor(openingHorizon())}">Size</th>
							<th class="matrix-col-label" style="--hz-opening: {horizonColor(openingHorizon())}">Cert.</th>
							<th class="matrix-col-label" style="--hz-opening: {horizonColor(openingHorizon())}">Est.</th>
							{#each orderedCols as opp (opp.id)}
								{@const covered = isFullyCovered(opp)}
								{@const empty = hasNoLinks(opp)}
								{@const oppLinks = linksForOpportunity(links, opp.id)}
								{@const fullCount = oppLinks.filter(l => l.coverage === 'full').length}
								{@const earlyStage = stageIndex(opp.stage) < 2}
								{@const effort = opportunityEffort(opp.id, deliverables, links)}
								<th
									class="matrix-opp-header"
									class:covered
									class:empty-col={empty}
									class:early-stage={earlyStage}
									class:horizon-last={horizonLastIds.has(opp.id)}
									style="--hz-color: {horizonColor(opp.horizon)}; --hz-opening: {horizonColor(openingHorizon())}"
								>
									<button class="matrix-opp-title" onclick={() => onSelectOpportunity(opp.id)} title={opp.title}>
										{opp.title}
									</button>
									<span class="matrix-opp-stage">
										{STAGES.find((s) => s.key === opp.stage)?.label ?? opp.stage}
									</span>
									<span class="matrix-opp-coverage" title="{fullCount} full, {oppLinks.length - fullCount} partial of {oppLinks.length} linked">
										{oppLinks.length === 0 ? '' : `${fullCount}/${oppLinks.length}`}
									</span>
									{#if effort != null}
										<span class="matrix-opp-effort" title="Estimated effort from linked deliverables">{effort < 10 ? effort.toFixed(1) : Math.round(effort)}d</span>
									{/if}
									{#if empty}
										<span class="matrix-gap-badge" title="No deliverables linked yet">gap</span>
									{/if}
								</th>
							{/each}
							{#if sketchOpps.length > 0}
								{#if sketchExpanded}
									<th class="matrix-section-divider"></th>
									{#each sketchOpps as opp (opp.id)}
										<th class="matrix-opp-header early-stage">
											<button class="matrix-opp-title" onclick={() => onSelectOpportunity(opp.id)} title={opp.title}>{opp.title}</button>
											<span class="matrix-opp-stage">Sketch</span>
										</th>
									{/each}
									<th class="stage-group-collapse" onclick={() => sketchExpanded = false} title="Collapse Sketch columns">‹</th>
								{:else}
									<th class="stage-group-header" onclick={() => sketchExpanded = true} title="Expand {sketchOpps.length} Sketch opportunities">
										<span class="stage-group-label">Sketch</span>
										<span class="stage-group-count">{sketchOpps.length}</span>
									</th>
								{/if}
							{/if}
							{#if exploreOpps.length > 0}
								{#if exploreExpanded}
									<th class="matrix-section-divider"></th>
									{#each exploreOpps as opp (opp.id)}
										<th class="matrix-opp-header early-stage">
											<button class="matrix-opp-title" onclick={() => onSelectOpportunity(opp.id)} title={opp.title}>{opp.title}</button>
											<span class="matrix-opp-stage">Explore</span>
										</th>
									{/each}
									<th class="stage-group-collapse" onclick={() => exploreExpanded = false} title="Collapse Explore columns">‹</th>
								{:else}
									<th class="stage-group-header" onclick={() => exploreExpanded = true} title="Expand {exploreOpps.length} Explore opportunities">
										<span class="stage-group-label">Explore</span>
										<span class="stage-group-count">{exploreOpps.length}</span>
									</th>
								{/if}
							{/if}
							{#if contributorColumns.length > 0}
								<th class="matrix-section-divider"></th>
								{#each contributorColumns as col (col.name)}
									<th class="matrix-contributor-header">
										<span class="matrix-contributor-name">{col.name}</span>
										<span class="matrix-contributor-count">({col.count})</span>
									</th>
								{/each}
							{/if}
						</tr>
					</thead>
					<tbody>
						{#if orderedRows.length > 0 && openingHorizon()}
							<tr class="horizon-separator-row">
								<td class="horizon-separator-label" colspan={horizonLabelColspan(openingHorizon())} style="--hz-color: {horizonColor(openingHorizon())}">{openingHorizon()}</td>
								{#each trailingHorizonGroups(openingHorizon()) as tg}
									<td class="horizon-separator-gap" colspan={tg.span} style="--hz-color: {horizonColor(tg.horizon)}"></td>
								{/each}
							</tr>
						{/if}
						{#each orderedRows as deliverable, ri (deliverable.id)}
							{@const status = rowStatus(deliverable.id)}
							{@const h = rowHeight(effectiveSize(deliverable)) * vZoom}
							{@const lev = leverageScore(deliverable.id)}
							{@const cert = effectiveCertainty(deliverable)}
							<tr
								class:dragging-row={dragRowId === deliverable.id}
								class:drag-over-row={dropTargetRow === deliverable.id}
								class:row-orphan={status === 'orphan'}
								class:row-partial={status === 'partial-only'}
								class:row-unestimated={!deliverable.size}
								class:row-size-xs={deliverable.size === 'XS'}
								class:row-selected={selectedId === deliverable.id}
								style="height: {h}px"
									draggable="true"
									onclick={() => onSelectDeliverable(deliverable.id)}
									ondragstart={(e: DragEvent) => handleRowDragStart(deliverable.id, e)}
									ondragover={(e: DragEvent) => handleRowDragOver(deliverable.id, e)}
									ondrop={(e: DragEvent) => handleRowDrop(deliverable.id, e)}
									ondragend={handleRowDragEnd}
								>
									<td class="matrix-del-name">
										<span class="drag-handle" title="Drag to reorder">⠿</span>
										{deliverable.title}
										{#if deliverable.kind === 'discovery'}<span class="matrix-row-badge discovery-badge" title="Discovery — learning, not building">discovery</span>{/if}
										{#if deliverable.externalUrl}
											<a class="matrix-del-link" href={deliverable.externalUrl} target="_blank" rel="noopener">↗</a>
										{/if}
										{#if status === 'orphan'}
											<span class="matrix-row-badge orphan-badge" title="Not linked to any opportunity">orphan</span>
										{:else if status === 'partial-only'}
											<span class="matrix-row-badge partial-badge" title="All links partial — none fully covered">partial only</span>
										{/if}
										{#if lev > 0}<span class="leverage-score" title="Leverage score: opportunity value ÷ size. Higher = do first.">▴{lev.toFixed(1)}</span>{/if}
									</td>
									<td class="matrix-size-cell">
										<button class="btn-ghost size-btn" class:from-estimate={!!deliverable.estimate} onclick={() => cycleSize(deliverable)} title="{deliverable.estimate ? 'Estimated: ' + deliverable.estimate.snappedValue : 'Click to cycle size'}">
											{effectiveSize(deliverable) ?? '—'}
										</button>
									</td>
									<td class="matrix-certainty-cell">
										<button class="btn-ghost certainty-btn" class:from-estimate={!!deliverable.estimate} onclick={() => cycleCertainty(deliverable)} title="Confidence: {cert ? '~' + cert * 20 + '%' : 'unset'}" aria-label="Confidence: {cert ? '~' + cert * 20 + '%' : 'unset'}">
											{cert ? '~' + cert * 20 + '%' : '–'}
										</button>
									</td>
									<td class="matrix-estimate-cell">
										{#if deliverable.estimate}
											<span class="estimate-value" title="{deliverable.estimate.n} estimator{deliverable.estimate.n !== 1 ? 's' : ''} · {new Date(deliverable.estimate.estimatedAt).toLocaleDateString()}">{deliverable.estimate.snappedValue}</span>
										{:else}
											<span class="estimate-empty">–</span>
										{/if}
									</td>
									{#each orderedCols as opp (opp.id)}
										{@const link = findLink(opp.id, deliverable.id)}
										<td class="matrix-cell" class:early-stage={stageIndex(opp.stage) < 2} class:horizon-last={horizonLastIds.has(opp.id) && isHorizonBorderActive(ri, opp.horizon)} style="--hz-color: {horizonColor(opp.horizon)}">
											<button
												class="matrix-dot"
												class:full={link?.coverage === 'full'}
												class:partial={link?.coverage === 'partial'}
												class:discovery={deliverable.kind === 'discovery'}
												onclick={() => cycleMatrixCell(opp.id, deliverable.id)}
												title={link ? (link.coverage === 'full' ? 'Full coverage' : 'Partial coverage') : 'Not linked'}
												aria-label="{deliverable.title} × {opp.title}: {link ? link.coverage : 'none'}"
											></button>
										</td>
									{/each}
									{#if sketchOpps.length > 0}
										{#if sketchExpanded}
											<td class="matrix-section-divider"></td>
											{#each sketchOpps as opp (opp.id)}
												{@const link = findLink(opp.id, deliverable.id)}
												<td class="matrix-cell early-stage">
													<button
														class="matrix-dot"
														class:full={link?.coverage === 'full'}
														class:partial={link?.coverage === 'partial'}
														class:discovery={deliverable.kind === 'discovery'}
														onclick={() => cycleMatrixCell(opp.id, deliverable.id)}
														title={link ? (link.coverage === 'full' ? 'Full coverage' : 'Partial coverage') : 'Not linked'}
														aria-label="{deliverable.title} × {opp.title}: {link ? link.coverage : 'none'}"
													></button>
												</td>
											{/each}
											<td class="stage-group-collapse-cell"></td>
										{:else}
											{@const sketchLinkCount = sketchOpps.filter(o => findLink(o.id, deliverable.id)).length}
											<td class="stage-group-cell" class:has-links={sketchLinkCount > 0}>
												{#if sketchLinkCount > 0}<span class="stage-group-link-count">{sketchLinkCount}</span>{/if}
											</td>
										{/if}
									{/if}
									{#if exploreOpps.length > 0}
										{#if exploreExpanded}
											<td class="matrix-section-divider"></td>
											{#each exploreOpps as opp (opp.id)}
												{@const link = findLink(opp.id, deliverable.id)}
												<td class="matrix-cell early-stage">
													<button
														class="matrix-dot"
														class:full={link?.coverage === 'full'}
														class:partial={link?.coverage === 'partial'}
														class:discovery={deliverable.kind === 'discovery'}
														onclick={() => cycleMatrixCell(opp.id, deliverable.id)}
														title={link ? (link.coverage === 'full' ? 'Full coverage' : 'Partial coverage') : 'Not linked'}
														aria-label="{deliverable.title} × {opp.title}: {link ? link.coverage : 'none'}"
													></button>
												</td>
											{/each}
											<td class="stage-group-collapse-cell"></td>
										{:else}
											{@const exploreLinkCount = exploreOpps.filter(o => findLink(o.id, deliverable.id)).length}
											<td class="stage-group-cell" class:has-links={exploreLinkCount > 0}>
												{#if exploreLinkCount > 0}<span class="stage-group-link-count">{exploreLinkCount}</span>{/if}
											</td>
										{/if}
									{/if}
									{#if contributorColumns.length > 0}
										{@const contribs = allContributors(deliverable.id)}
										{@const inherited = new Set(inheritedPeople(deliverable.id, 'contributors', links, opportunities))}
										<td class="matrix-section-divider"></td>
										{#each contributorColumns as col (col.name)}
											{@const assigned = contribs.has(col.name)}
											{@const isInherited = inherited.has(col.name)}
											<td class="matrix-cell matrix-contributor-cell">
												<button
													class="matrix-contributor-dot"
													class:assigned
													class:inherited={isInherited}
													onclick={() => toggleContributor(deliverable, col.name)}
													title={isInherited ? `${col.name} (inherited from opportunity)` : assigned ? `${col.name} — click to unassign` : `Click to assign ${col.name}`}
												></button>
											</td>
										{/each}
									{/if}
									{#if deliverable.externalDependency}
										<td class="matrix-external-cell" title={deliverable.externalDependency}>⚠</td>
									{/if}
								</tr>
							{#if horizonLabelAfter().has(ri)}
								{@const nextH = horizonLabelAfter().get(ri)!}
								<tr class="horizon-separator-row">
									<td class="horizon-separator-label" colspan={horizonLabelColspan(nextH)} style="--hz-color: {horizonColor(nextH)}">{nextH}</td>
									{#each trailingHorizonGroups(nextH) as tg}
										<td class="horizon-separator-gap" colspan={tg.span} style="--hz-color: {horizonColor(tg.horizon)}"></td>
									{/each}
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				{#if missingHorizons().length > 0}
					<div class="missing-horizons">
						No deliverables planned for {missingHorizons().join(', ')}
					</div>
				{/if}
			</div>
		{/if}

	<div class="dv-inline-add">
		<input
			type="text"
			class="dv-inline-input"
			placeholder="+ Add deliverable…"
			bind:value={newTitle}
			onkeydown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { newTitle = ''; (e.target as HTMLInputElement).blur() } }}
		/>
	</div>

	{#if orderedRows.length > 0}
		<div class="matrix-legend">
			<span class="legend-item"><span class="legend-dot legend-empty"></span> not linked</span>
			<span class="legend-item"><span class="legend-dot legend-partial"></span> partial</span>
			<span class="legend-item"><span class="legend-dot legend-full"></span> full</span>
			<span class="legend-sep">·</span>
			<span class="legend-item"><span class="legend-dot legend-discovery"></span> discovery</span>
			<span class="legend-sep">·</span>
			<span class="legend-item">click to cycle</span>
			<span class="legend-sep">·</span>
			<span class="legend-item">sorted by leverage (value ÷ effort)</span>
		</div>
	{/if}

	{#if archivedDeliverables.length > 0}
		<details class="dv-archive">
			<summary class="dv-archive-summary">{archivedDeliverables.length} archived</summary>
			<ul class="dv-archive-list">
				{#each archivedDeliverables as del (del.id)}
					<li class="dv-archive-item">
						<button class="dv-archive-name" onclick={() => onSelectDeliverable(del.id)}>{del.title}</button>
						<span class="dv-archive-status" class:status-done={del.status === 'done'} class:status-dropped={del.status === 'dropped'}>{del.status}</span>
						{#if del.kind === 'discovery'}<span class="dv-archive-kind">discovery</span>{/if}
						{#if del.dropReason}<span class="dv-archive-reason" title={del.dropReason}>— {del.dropReason}</span>{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.deliverables-view {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-sm) 0;
	}

	.dv-toolbar {
		margin: 0 var(--sp-sm) var(--sp-sm);
		min-height: 28px;
	}

	.dv-toolbar-label {
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.dv-toolbar-label code {
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
	}

	.dv-toolbar-zoom {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		cursor: pointer;
	}

	.dv-toolbar-zoom input[type="range"] {
		width: 60px;
		accent-color: var(--c-accent);
	}

	.dv-est-msg {
		color: var(--c-green);
		font-size: var(--fs-xs);
	}

	.dv-est-err {
		color: var(--c-red);
		font-size: var(--fs-xs);
	}

	.dv-empty {
		text-align: center;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		padding: var(--sp-2xl) var(--sp-lg);
	}

	.dv-empty p {
		margin: var(--sp-xs) 0;
	}

	.dv-empty-title {
		font-size: var(--fs-base);
		font-weight: var(--fw-medium);
		color: var(--c-text-soft);
		margin-bottom: var(--sp-sm) !important;
	}

	.dv-empty kbd {
		font-family: var(--font-mono, monospace);
		font-size: var(--fs-2xs);
		padding: 1px 4px;
		border: 1px solid var(--c-border);
		border-radius: 3px;
		background: var(--c-surface);
	}

	/* --- Inline add (bottom) --- */
	.dv-inline-add {
		padding: var(--sp-sm) var(--sp-sm) var(--sp-lg);
	}

	.dv-inline-input {
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: color-mix(in srgb, var(--c-text) 3%, transparent);
		border: none;
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		width: 100%;
		transition: background var(--tr-fast), box-shadow var(--tr-fast);
	}

	.dv-inline-input:focus {
		outline: none;
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
		box-shadow: 0 0 0 1px var(--c-accent);
	}

	.dv-inline-input::placeholder {
		color: var(--c-text-ghost);
	}

	/* Matrix view */
	.matrix-wrapper {
		overflow-x: auto;
		padding: 0 var(--sp-sm);
	}

	.matrix-table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: var(--fs-xs);
	}

	.matrix-table th,
	.matrix-table td {
		padding: var(--sp-xs) var(--sp-sm);
	}

	/* ── Header row ── */
	.matrix-corner {
		background: var(--c-bg);
		position: sticky;
		left: 0;
		z-index: 2;
		vertical-align: bottom;
		padding: var(--sp-xs) var(--sp-sm) var(--sp-xs) 0 !important;
		border-bottom: 2px solid var(--hz-opening, var(--c-structure));
	}

	.corner-resort {
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		background: none;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-xs);
		cursor: pointer;
		white-space: nowrap;
		margin-bottom: 2px;
	}

	.corner-resort:hover {
		color: var(--c-accent);
		border-color: var(--c-accent);
	}

	.corner-orphan {
		font-size: var(--fs-3xs);
		color: var(--c-warm);
		white-space: nowrap;
	}

	.matrix-opp-header {
		background: var(--c-bg);
		vertical-align: bottom;
		padding: var(--sp-sm) 2px var(--sp-xs) 2px !important;
		border-bottom: 2px solid var(--hz-opening, var(--c-structure));
	}

	.matrix-opp-header.horizon-last {
		border-right: 2px solid var(--hz-color, var(--c-structure));
	}

	.horizon-group-row th {
		padding: 0 !important;
		border: none !important;
		background: var(--c-bg);
	}

	.horizon-group-label {
		font-size: var(--fs-2xs);
		font-weight: 700;
		color: var(--c-text-soft);
		text-align: center;
		letter-spacing: 0.04em;
		padding: 2px var(--sp-xs) 0 !important;
		border-bottom: none !important;
	}

	.horizon-group-label.horizon-last {
		border-right: 2px solid var(--hz-color, var(--c-structure)) !important;
	}

	.matrix-cell.horizon-last {
		border-right: 2px solid var(--hz-color, var(--c-structure));
	}

	.matrix-opp-header.covered {
		border-bottom-color: var(--c-green-signal);
	}

	.matrix-opp-title {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
		cursor: pointer;
		padding: 2px;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		max-height: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	.matrix-opp-title:hover {
		color: var(--c-accent);
	}

	.matrix-opp-stage {
		display: block;
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-faint);
		margin-top: var(--sp-xs);
	}



	.matrix-opp-coverage {
		display: block;
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-normal);
	}

	.matrix-gap-badge {
		display: block;
		margin-top: 3px;
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-red);
		font-weight: var(--fw-medium);
	}

	.empty-col {
		border-bottom-color: var(--c-red-border) !important;
	}

	/* ── Body rows ── */
	.matrix-table tbody tr {
		transition: background 0.1s ease;
	}

	.matrix-table tbody tr:hover {
		background: var(--c-neutral-bg-light);
	}

	.matrix-table tbody tr.row-selected {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), var(--c-bg));
	}

	.matrix-table tbody tr.row-selected td:first-child {
		box-shadow: inset 3px 0 0 var(--c-accent);
	}

	.matrix-table tbody tr:not(:last-child) td {
		border-bottom: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-table tbody tr:first-child td {
		border-top: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-table tbody tr:last-child td {
		border-bottom: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-del-name {
		background: inherit;
		position: sticky;
		left: 0;
		z-index: 1;
		white-space: nowrap;
		font-weight: var(--fw-medium);
		color: var(--c-text);
		padding-right: var(--sp-md) !important;
	}

	.leverage-score {
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
		margin-left: var(--sp-sm);
		font-weight: var(--fw-normal);
	}

	.matrix-del-link {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		text-decoration: none;
		margin-left: var(--sp-xs);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.matrix-table tbody tr:hover .matrix-del-link {
		opacity: 1;
	}

	.matrix-del-link:hover {
		color: var(--c-accent);
	}

	.matrix-row-badge {
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: var(--fw-medium);
		margin-left: var(--sp-sm);
		padding: 0 3px;
		border-radius: 2px;
	}

	.orphan-badge {
		color: var(--c-text-muted);
		background: var(--c-neutral-bg);
	}

	.partial-badge {
		color: var(--c-warm);
		background: var(--c-warm-bg);
	}

	.discovery-badge {
		color: var(--c-text-muted);
		background: var(--c-neutral-bg);
	}

	.matrix-opp-effort {
		font-size: var(--fs-xs);
		color: var(--c-accent);
		font-weight: var(--fw-semibold);
	}

	.from-estimate {
		color: var(--c-accent);
		font-style: italic;
	}

	.row-orphan .matrix-del-name {
		color: var(--c-text-muted);
		font-style: italic;
	}

	/* Strip vertical padding on XS rows so they can actually be thin */
	.row-size-xs td {
		padding-top: 0;
		padding-bottom: 0;
	}
	.row-size-xs .size-btn,
	.row-size-xs .certainty-btn {
		padding-top: 0;
		padding-bottom: 0;
	}

	/* ── Dot cells ── */
	.matrix-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0 !important;
	}

	.matrix-dot {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		line-height: var(--lh-tight);
		border-radius: var(--radius-sm);
		transition: background 0.1s ease;
	}

	.matrix-dot::after {
		content: '';
		display: block;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
	}

	.matrix-dot:hover {
		background: var(--c-neutral-bg);
	}

	.matrix-dot:hover::after {
		border-color: var(--c-text-muted);
	}

	.matrix-dot.partial::after {
		background: var(--c-green-border);
		border-color: var(--c-green-border);
		clip-path: inset(0 50% 0 0);
	}

	.matrix-dot.full::after {
		background: var(--c-green-signal);
		border-color: var(--c-green-signal);
	}

	/* Discovery deliverables use diamond shapes instead of circles */
	.matrix-dot.discovery::after {
		border-radius: 1px;
		transform: rotate(45deg);
	}

	.matrix-dot.discovery.partial::after {
		background: var(--c-green-border);
		border-color: var(--c-green-border);
		clip-path: inset(0 50% 0 0);
	}

	.matrix-dot.discovery.full::after {
		background: var(--c-green-signal);
		border-color: var(--c-green-signal);
	}

	/* ── Drag reorder ── */
	.drag-handle {
		color: var(--c-text-faint);
		cursor: grab;
		margin-right: var(--sp-xs);
		font-size: var(--fs-2xs);
		user-select: none;
		opacity: 0;
		transition: opacity 0.1s ease;
	}

	.matrix-table tbody tr:hover .drag-handle {
		opacity: 1;
	}

	.dragging-row {
		opacity: 0.4;
	}

	.drag-over-row td {
		box-shadow: 0 -2px 0 0 var(--c-accent) inset;
	}

	.horizon-separator-row {
		height: 24px !important;
	}

	.horizon-separator-row:hover {
		background: none !important;
	}

	.horizon-separator-label {
		font-size: var(--fs-2xs);
		font-weight: 700;
		color: var(--c-text-soft);
		letter-spacing: 0.04em;
		padding: 2px var(--sp-sm) !important;
		border-top: 2px solid var(--hz-color, var(--c-structure));
		border-right: 2px solid var(--hz-color, var(--c-structure));
		background: var(--c-neutral-bg);
	}

	.horizon-separator-gap {
		border-top: 2px solid var(--hz-color, var(--c-structure));
		border-right: 2px solid var(--hz-color, var(--c-structure));
		padding: 0 !important;
	}



	.missing-horizons {
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		letter-spacing: 0.04em;
		padding: var(--sp-xs) var(--sp-sm);
		opacity: 0.7;
	}

	/* ── Early-stage column hint ── */
	.early-stage {
		opacity: 0.55;
	}

	/* ── Collapsed stage group columns ── */
	.stage-group-header {
		width: 28px;
		min-width: 28px;
		max-width: 28px;
		vertical-align: bottom;
		padding: var(--sp-xs) 2px !important;
		cursor: pointer;
		border-bottom: 2px solid var(--c-border);
		background: var(--c-bg);
		position: relative;
		opacity: 0.6;
		transition: opacity var(--tr-fast);
	}

	.stage-group-header:hover {
		opacity: 1;
	}

	.stage-group-label {
		writing-mode: vertical-lr;
		text-orientation: mixed;
		font-size: var(--fs-3xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-text-muted);
		display: block;
		text-align: left;
	}

	.stage-group-count {
		display: block;
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
		text-align: center;
		margin-top: var(--sp-xs);
	}

	.stage-group-cell {
		width: 28px;
		min-width: 28px;
		max-width: 28px;
		text-align: center;
		vertical-align: middle;
		border-right: 1px solid var(--c-border-soft);
	}

	.stage-group-link-count {
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
	}

	.stage-group-cell.has-links .stage-group-link-count {
		color: var(--c-accent);
	}

	.stage-group-collapse {
		width: 16px;
		min-width: 16px;
		max-width: 16px;
		vertical-align: bottom;
		padding: var(--sp-xs) 0 !important;
		cursor: pointer;
		border-bottom: 2px solid var(--c-border);
		background: var(--c-bg);
		font-size: var(--fs-xs);
		color: var(--c-text-faint);
		text-align: center;
	}

	.stage-group-collapse:hover {
		color: var(--c-text-muted);
	}

	.stage-group-collapse-cell {
		width: 16px;
		min-width: 16px;
		max-width: 16px;
	}

	/* ── Size + Certainty column headers ── */
	.matrix-col-label {
		background: var(--c-bg);
		font-size: var(--fs-3xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
		text-align: center;
		vertical-align: bottom;
		padding: var(--sp-xs) 4px !important;
		border-bottom: 2px solid var(--hz-opening, var(--c-structure));
	}

	/* ── Size + Certainty + Estimate cells ── */
	.matrix-size-cell,
	.matrix-certainty-cell,
	.matrix-estimate-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0 2px !important;
	}

	.estimate-value {
		color: var(--c-accent);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		cursor: default;
	}

	.estimate-empty {
		color: var(--c-text-ghost);
		font-size: var(--fs-xs);
	}

	.size-btn {
		color: var(--c-text);
		min-width: 28px;
	}

	.size-btn:hover {
		background: var(--c-neutral-bg);
	}

	.certainty-btn {
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		min-width: 32px;
	}

	.certainty-btn:hover {
		background: var(--c-neutral-bg);
	}

	/* ── Variable row height + unestimated blur ── */
	.row-unestimated td {
		border-top: 1px solid transparent;
		border-bottom: 1px solid transparent;
		border-image: linear-gradient(to right, transparent, var(--c-border-soft) 30%, var(--c-border-soft) 70%, transparent) 1;
	}

	/* ── Contributor columns ── */
	.matrix-section-divider {
		width: 8px;
		border: none !important;
		background: none;
	}

	.matrix-contributor-header {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		white-space: nowrap;
		vertical-align: bottom;
		text-align: left;
		padding: var(--sp-xs) 2px var(--sp-sm) 2px;
		font-weight: var(--fw-normal);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		border-bottom: 2px solid var(--c-border);
		background: color-mix(in srgb, var(--c-text) 3%, transparent);
	}

	.matrix-contributor-cell {
		background: color-mix(in srgb, var(--c-text) 2%, transparent);
	}

	.matrix-contributor-name {
		display: inline;
	}

	.matrix-contributor-count {
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
	}

	.matrix-contributor-dot {
		display: block;
		width: var(--dot-size-md);
		height: var(--dot-size-md);
		border-radius: 50%;
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
		cursor: pointer;
		padding: 0;
		margin: 0 auto;
		transition: background var(--tr-fast), border-color var(--tr-fast);
	}

	.matrix-contributor-dot.assigned {
		background: var(--c-accent);
		border-color: var(--c-accent);
	}

	.matrix-contributor-dot.inherited {
		background: var(--c-text-muted);
		border-color: var(--c-text-muted);
		cursor: default;
		opacity: 0.6;
	}

	.matrix-contributor-dot:not(.assigned):hover {
		border-color: var(--c-accent);
	}

	.matrix-external-cell {
		text-align: center;
		font-size: var(--fs-2xs);
		color: var(--c-warm);
		cursor: help;
		border: none !important;
		padding-left: 4px;
	}

	/* ── Legend ── */
	.matrix-legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-sm) 0;
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.legend-dot {
		display: inline-block;
		width: var(--dot-size-xs);
		height: var(--dot-size-xs);
		border-radius: var(--radius-full);
	}

	.legend-empty {
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
	}

	.legend-partial {
		background: var(--c-green-border);
		clip-path: inset(0 50% 0 0);
		border: 1.5px solid var(--c-green-border);
	}

	.legend-full {
		background: var(--c-green-signal);
	}

	.legend-discovery {
		background: var(--c-green-signal);
		border-radius: 1px;
		transform: rotate(45deg);
	}

	.legend-sep {
		color: var(--c-border-soft);
	}

	/* ── Archive section ── */
	.dv-archive {
		margin-top: var(--sp-md);
		padding: 0 var(--sp-sm);
	}

	.dv-archive-summary {
		font-size: var(--fs-xs);
		color: var(--c-text-faint);
		cursor: pointer;
		user-select: none;
	}

	.dv-archive-summary:hover {
		color: var(--c-text-muted);
	}

	.dv-archive-list {
		list-style: none;
		margin: var(--sp-xs) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dv-archive-item {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 2px 0;
	}

	.dv-archive-name {
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		color: var(--c-text-muted);
		padding: 0;
		text-align: left;
	}

	.dv-archive-name:hover {
		color: var(--c-accent-text);
		text-decoration: underline;
	}

	.dv-archive-status {
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 3px;
		border-radius: 2px;
	}

	.status-done {
		color: var(--c-green-signal);
		background: color-mix(in srgb, var(--c-green-signal) 10%, transparent);
	}

	.status-dropped {
		color: var(--c-text-faint);
		background: var(--c-neutral-bg);
	}

	.dv-archive-kind {
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
		background: var(--c-neutral-bg);
		padding: 0 3px;
		border-radius: 2px;
	}

	.dv-archive-reason {
		color: var(--c-text-faint);
		font-style: italic;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300px;
	}
</style>
