<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-sm text-ink-gray-7">
      <span class="font-medium text-ink-gray-8">Run on {{ runCode }}</span>
      <span v-if="progress.revision">· revision {{ progress.revision }}</span>
      <span v-if="progress.continued_runs">· continued {{ progress.continued_runs }}×</span>
      <Badge v-bind:label="statusLabel" v-bind:theme="statusTheme" />
    </div>

    <!-- Phase timeline: done steps filled, the current one outlined -->
    <ol class="flex flex-wrap gap-1" aria-label="Run phases">
      <li
        v-for="(step, index) in RUN_PHASES"
        v-bind:key="step.phase"
        class="rounded px-2 py-1 text-xs"
        v-bind:class="stepClass(index)"
        v-bind:aria-current="index === currentIndex ? 'step' : undefined"
      >
        {{ step.label }}
      </li>
    </ol>

    <div v-if="progress.dirty_rows" class="space-y-1">
      <div class="flex justify-between text-xs text-ink-gray-6">
        <span>
          {{ progress.processed_rows.toLocaleString() }} /
          {{ progress.dirty_rows.toLocaleString() }} rows
        </span>
        <span v-if="progress.partitions_total">
          partitions {{ progress.partitions_done }} / {{ progress.partitions_total }}
        </span>
        <span>{{ percent }}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded bg-surface-gray-3">
        <div class="h-full bg-surface-gray-7 transition-all" v-bind:style="{ width: `${percent}%` }"></div>
      </div>
    </div>

    <ul v-if="progress.shocks.length" class="text-xs text-ink-gray-7">
      <li v-for="[driver, from, to] in progress.shocks" v-bind:key="driver">
        {{ driver }}: {{ from }} → {{ to }} ({{ change(from, to) }})
      </li>
    </ul>

    <!-- What still stands between the parked run and a publish -->
    <div v-if="progress.phase === 'AWAITING_APPROVAL'" class="rounded border p-3 text-sm">
      <p class="mb-2 font-medium text-ink-gray-8">
        Waiting for approval of {{ progress.target_version_code }}
      </p>
      <ul class="space-y-1 text-ink-gray-7">
        <li>
          {{ successor?.covenant_ok ? '☑' : '☐' }} Covenant pass recorded on the successor
          <span class="text-ink-gray-5">(controller)</span>
        </li>
        <li>
          ☐ Approved and locked
          <span class="text-ink-gray-5">(CFO, not {{ successor?.requested_by || 'the requester' }})</span>
        </li>
      </ul>
    </div>

    <div v-if="progress.refusals.length" class="space-y-1" role="alert">
      <p class="text-sm font-medium text-ink-red-4">
        {{ progress.phase === 'AWAITING_APPROVAL' ? 'Decisions governance refused' : 'Decisions refused earlier in this run' }}
      </p>
      <ul class="list-disc pl-5 text-sm text-ink-red-4">
        <li v-for="(refusal, index) in progress.refusals" v-bind:key="index">{{ refusal }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { Badge } from 'frappe-ui'
import { RUN_PHASES, isFinished } from '@/utils/workflowRules'

// The durable record's run state, once the workflow reports DONE
const OUTCOME_THEMES = {
  COMPLETED: 'green',
  REJECTED: 'orange',
  EXPIRED: 'orange',
  CANCELLED: 'gray',
  COMPENSATED: 'red',
  FAILED: 'red',
}

export default {
  name: 'RunTracker',

  components: { Badge },

  props: {
    runCode: { type: String, required: true },
    // The workflow's progress query, as the API returns it
    progress: { type: Object, required: true },
    // describe() of the successor version, when it has been read
    successor: { type: Object, default: null },
    // The latest recompute_run.state, read once the run is finished
    outcome: { type: String, default: '' },
  },

  data() {
    return { RUN_PHASES }
  },

  computed: {
    currentIndex() {
      return RUN_PHASES.findIndex((step) => step.phase === this.progress.phase)
    },

    finished() {
      return isFinished(this.progress.phase)
    },

    statusLabel() {
      if (this.progress.phase === 'FAILED') return 'FAILED'
      if (this.finished) return this.outcome || 'DONE'
      if (this.progress.approval_state === 'CANCELLED') return 'CANCELLING'
      return this.progress.phase
    },

    statusTheme() {
      if (this.progress.phase === 'FAILED') return 'red'
      if (this.finished) return OUTCOME_THEMES[this.outcome] || 'gray'
      if (this.progress.phase === 'AWAITING_APPROVAL') return 'orange'
      return 'blue'
    },

    percent() {
      const { dirty_rows: total, processed_rows: done } = this.progress
      return total ? Math.min(100, Math.round((done / total) * 100)) : 0
    },
  },

  methods: {
    stepClass(index) {
      const filled = 'bg-surface-gray-7 text-ink-white'
      const empty = 'bg-surface-gray-2 text-ink-gray-5'
      // A run that ended early (rejected, expired, cancelled) also reports
      // DONE without passing the publish steps, and progress does not say
      // where it stopped; only a completed one lights the whole line.
      if (this.finished) return this.outcome === 'COMPLETED' ? filled : empty
      if (index === this.currentIndex) return 'border border-outline-gray-4 font-medium text-ink-gray-9'
      return index < this.currentIndex ? filled : empty
    },

    change(from, to) {
      const delta = ((to - from) / from) * 100
      return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    },
  },
}
</script>
