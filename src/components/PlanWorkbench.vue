<template>
  <section class="rounded-lg border bg-surface-white">
    <div class="border-b p-4">
      <h2 class="font-semibold text-ink-gray-9">Plan and re-forecast</h2>
      <p class="mt-1 text-sm text-ink-gray-6">
        Every action here is taken as whoever the current token is. What that person may
        do is decided by the governance store, not by this page.
      </p>
    </div>

    <!-- The plan version, its state, and the reviewed verdict on it -->
    <div class="space-y-3 border-b p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-64">
          <FormControl v-model="planCode" label="Plan version" />
        </div>
        <Button v-bind:loading="busy === 'load'" v-on:click="loadPlan">Load</Button>
        <Button v-bind:loading="busy === 'create'" v-on:click="createPlan">Create draft</Button>
      </div>

      <div class="w-full max-w-lg">
        <FormControl v-model="reviewNote" label="Review note" />
      </div>

      <div class="flex flex-wrap gap-2">
        <Button v-bind:loading="busy === 'covenant-pass'" v-on:click="recordCovenant(true)">
          Record covenant pass
        </Button>
        <Button v-bind:loading="busy === 'covenant-fail'" v-on:click="recordCovenant(false)">
          Record covenant breach
        </Button>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          v-for="transition in TRANSITIONS"
          v-bind:key="transition.state"
          v-bind:loading="busy === transition.state"
          v-on:click="transitionPlan(transition.state)"
        >
          {{ transition.label }}
        </Button>
      </div>

      <pre
        v-if="planState"
        class="max-h-72 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7"
      >{{ planState }}</pre>
    </div>

    <!-- Shock a driver: this starts the durable workflow -->
    <div class="space-y-3 border-b p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-48">
          <FormControl v-model="driverCode" label="Driver" />
        </div>
        <div class="w-36">
          <FormControl v-model="fromValue" type="number" step="0.01" label="Current value" />
        </div>
        <div class="w-36">
          <FormControl v-model="toValue" type="number" step="0.01" label="Proposed value" />
        </div>
        <Button variant="solid" v-bind:loading="busy === 'start'" v-on:click="startRun">
          Re-forecast
        </Button>
        <Button v-on:click="startWatching(planCode)">Watch progress</Button>
        <Button v-bind:disabled="!watching" v-on:click="stopWatching">Stop watching</Button>
      </div>

      <progress
        v-if="progress"
        class="w-full"
        v-bind:max="Math.max(1, progress.dirty_rows)"
        v-bind:value="progress.processed_rows"
      ></progress>
      <pre
        v-if="progressText"
        class="max-h-72 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7"
        aria-live="polite"
      >{{ progressText }}</pre>
    </div>

    <!-- The parked run waits here until a controller reviews and a CFO decides -->
    <div class="space-y-3 border-b p-4">
      <p class="text-sm text-ink-gray-6">
        Review the successor's covenant before approving the run. Load the successor below,
        record the verdict as a controller, then approve.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button v-bind:disabled="!successorCode" v-on:click="loadSuccessor">
          Load successor{{ successorCode ? ` (${successorCode})` : '' }}
        </Button>
        <Button variant="solid" v-bind:loading="busy === 'approve'" v-on:click="decideRun(true)">
          Approve run
        </Button>
        <Button v-bind:loading="busy === 'reject'" v-on:click="decideRun(false)">Reject run</Button>
        <Button v-bind:loading="busy === 'cancel'" v-on:click="cancelRun">Cancel run</Button>
      </div>
    </div>

    <!-- A paused agent run: proposed by a model, decided by a second human -->
    <div class="space-y-3 p-4">
      <h3 class="font-medium text-ink-gray-8">Agent proposal review</h3>
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-80">
          <FormControl v-model="proposalId" label="Proposal ID" />
        </div>
        <Button v-bind:loading="busy === 'proposal'" v-on:click="readProposal">Review draft</Button>
        <Button v-bind:loading="busy === 'proposal-yes'" v-on:click="decideProposal(true)">
          Approve proposal
        </Button>
        <Button v-bind:loading="busy === 'proposal-no'" v-on:click="decideProposal(false)">
          Reject proposal
        </Button>
      </div>
      <pre
        v-if="proposalDetails"
        class="max-h-72 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7"
      >{{ proposalDetails }}</pre>
    </div>

    <div v-if="actionStatus || errorMessage" class="border-t p-4">
      <ErrorMessage v-bind:message="errorMessage" />
      <p v-if="actionStatus" class="text-sm text-ink-gray-7">{{ actionStatus }}</p>
    </div>
  </section>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'

const TRANSITIONS = [
  { state: 'IN_REVIEW', label: 'Submit for review' },
  { state: 'APPROVED', label: 'Approve plan' },
  { state: 'REJECTED', label: 'Reject plan' },
  { state: 'LOCKED', label: 'Lock plan' },
]

export default {
  name: 'PlanWorkbench',

  components: { Button, ErrorMessage, FormControl },

  data() {
    return {
      TRANSITIONS,
      planCode: this.$root.config.DEFAULT_PLAN_CODE,
      reviewNote: '',
      driverCode: 'utilisation',
      fromValue: 0.75,
      toValue: 0.74,
      proposalId: '',

      // The plan as last read. Its row_version is sent back with every write,
      // so an edit made against a stale copy is refused rather than silently
      // overwriting someone else's.
      loadedPlan: null,
      planState: '',

      runCode: null,
      successorCode: null,
      progress: null,
      progressText: '',
      watchTimer: null,
      // Bumped on every stop/start so a reply from an abandoned poll is dropped
      watchGeneration: 0,

      proposalDetails: '',
      actionStatus: '',
      errorMessage: '',
      busy: '',
    }
  },

  computed: {
    watching() {
      return this.watchTimer !== null
    },
  },

  beforeUnmount() {
    this.stopWatching()
  },

  methods: {
    // Every call goes through here so one place reports failure and clears the
    // busy state, whichever button was pressed.
    async run(key, endpoint, ...args) {
      this.busy = key
      this.errorMessage = ''
      const response = await this.$root.callAuthenticatedEndpoint(endpoint, ...args)
      this.busy = ''
      if (response.error) {
        this.errorMessage = response.message
        return null
      }
      return response.data
    },

    async loadPlan() {
      const plan = await this.run('load', 'getPlanVersion', this.planCode)
      if (!plan) return
      this.loadedPlan = plan
      this.planState = JSON.stringify(plan, null, 2)
    },

    async createPlan() {
      if (await this.run('create', 'createPlanVersion', this.planCode)) {
        await this.loadPlan()
      }
    },

    // Refuses locally when the loaded copy is for a different plan: sending a
    // row_version from another plan would be refused by the server anyway, but
    // the message here says what to do about it.
    requireLoadedPlan(message) {
      if (!this.loadedPlan || this.loadedPlan.plan_version_code !== this.planCode) {
        this.errorMessage = message
        return false
      }
      return true
    },

    async recordCovenant(covenantOk) {
      if (!this.requireLoadedPlan('Load the plan before reviewing its covenant.')) return
      const done = await this.run(
        covenantOk ? 'covenant-pass' : 'covenant-fail',
        'recordCovenant',
        this.planCode,
        { covenantOk, note: this.reviewNote, expectedVersion: this.loadedPlan.row_version },
      )
      if (done) await this.loadPlan()
    },

    async transitionPlan(toState) {
      if (!this.requireLoadedPlan('Load this plan before changing its state.')) return
      const done = await this.run('transition', 'transitionPlan', this.planCode, {
        toState,
        note: this.reviewNote,
        expectedVersion: this.loadedPlan.row_version,
      })
      if (done) {
        this.actionStatus = 'Plan transition recorded.'
        await this.loadPlan()
      }
    },

    async startRun() {
      const response = await this.run('start', 'startReforecast', {
        planVersionCode: this.planCode,
        driverCode: this.driverCode,
        fromValue: Number(this.fromValue),
        toValue: Number(this.toValue),
      })
      if (!response) return
      this.actionStatus = JSON.stringify(response)
      this.startWatching(this.planCode)
    },

    startWatching(code) {
      this.stopWatching()
      this.runCode = code
      this.watchProgress(++this.watchGeneration)
    },

    stopWatching() {
      clearTimeout(this.watchTimer)
      this.watchTimer = null
      this.watchGeneration += 1
    },

    // Polls rather than streams: the progress query is answered by whichever
    // worker is alive, so a gap here is exactly what a dead worker looks like.
    async watchProgress(generation) {
      if (!this.runCode) return
      const response = await this.$root.callAuthenticatedEndpoint('getProgress', this.runCode)
      if (generation !== this.watchGeneration) return

      if (response.error) {
        this.progressText = response.message
        return
      }
      this.progress = response.data
      this.successorCode = response.data.target_version_code
      this.progressText = JSON.stringify(response.data, null, 2)
      if (response.data.phase !== 'DONE') {
        this.watchTimer = setTimeout(
          () => this.watchProgress(generation),
          this.$root.config.PROGRESS_POLL_INTERVAL,
        )
      } else {
        this.watchTimer = null
      }
    },

    async loadSuccessor() {
      if (!this.successorCode) {
        this.errorMessage = 'Watch a run until its successor is available.'
        return
      }
      this.planCode = this.successorCode
      await this.loadPlan()
    },

    async decideRun(approved) {
      if (!this.runCode) {
        this.errorMessage = "Watch the originating plan's run first."
        return
      }
      const done = await this.run(approved ? 'approve' : 'reject', 'decideRun', this.runCode, {
        approved,
        comment: this.reviewNote,
      })
      if (done) {
        // The API acknowledges the signal; governance decides whether it is
        // accepted, and progress is where that shows.
        this.actionStatus = 'Decision sent. Progress shows whether governance accepted it.'
      }
    },

    async cancelRun() {
      if (!this.runCode) {
        this.errorMessage = 'Watch the run first.'
        return
      }
      if (await this.run('cancel', 'cancelRun', this.runCode)) {
        this.actionStatus = 'Cancellation sent.'
      }
    },

    async readProposal() {
      const proposal = await this.run('proposal', 'getProposal', this.proposalId.trim())
      if (proposal) this.proposalDetails = JSON.stringify(proposal, null, 2)
    },

    async decideProposal(approved) {
      const result = await this.run(
        approved ? 'proposal-yes' : 'proposal-no',
        'decideProposal',
        this.proposalId.trim(),
        approved,
      )
      if (result) this.proposalDetails = JSON.stringify(result, null, 2)
    },
  },
}
</script>
