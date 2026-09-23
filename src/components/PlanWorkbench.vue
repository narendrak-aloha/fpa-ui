<template>
  <section class="rounded-lg border bg-surface-white">
    <div class="border-b p-4">
      <h2 class="font-semibold text-ink-gray-9">Plan and re-forecast</h2>
      <p class="mt-1 text-sm text-ink-gray-6">
        Every action here is taken as whoever the current token is. Buttons you cannot use say
        why on hover; the governance store still has the final word.
      </p>
    </div>

    <!-- The plan version, its state, and the reviewed verdict on it -->
    <div class="space-y-3 border-b p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-64">
          <FormControl v-model="planCode" label="Plan version" />
        </div>
        <Button v-bind:loading="busy === 'load'" v-on:click="loadPlan">Load</Button>
        <GuardedButton
          v-bind:blocker="createBlocker"
          v-bind:loading="busy === 'create'"
          v-on:click="createPlan"
        >
          Create draft
        </GuardedButton>
      </div>

      <div v-if="currentPlan" class="flex flex-wrap items-center gap-2 text-sm text-ink-gray-7">
        <Badge v-bind:label="currentPlan.state" v-bind:theme="stateTheme(currentPlan.state)" />
        <Badge
          v-bind:label="currentPlan.covenant_ok ? 'Covenant passed' : 'Covenant not passed'"
          v-bind:theme="currentPlan.covenant_ok ? 'green' : 'orange'"
        />
        <span>requested by {{ currentPlan.requested_by }}</span>
        <span v-if="currentPlan.approved_by">· approved by {{ currentPlan.approved_by }}</span>
        <span>· revision {{ currentPlan.revision }}</span>
      </div>

      <div class="w-full max-w-lg">
        <FormControl v-model="reviewNote" label="Review note" />
      </div>

      <p v-if="!currentPlan" class="text-sm text-ink-gray-6">
        Load a plan to see what you can do with it.
      </p>
      <template v-else>
        <div class="flex flex-wrap gap-2">
          <GuardedButton
            v-bind:blocker="covenantBlocker(true)"
            v-bind:loading="busy === 'covenant-pass'"
            v-on:click="recordCovenant(true)"
          >
            Record covenant pass
          </GuardedButton>
          <GuardedButton
            v-bind:blocker="covenantBlocker(false)"
            v-bind:loading="busy === 'covenant-fail'"
            v-on:click="recordCovenant(false)"
          >
            Record covenant breach
          </GuardedButton>
        </div>

        <div class="flex flex-wrap gap-2">
          <GuardedButton
            v-for="transition in transitions"
            v-bind:key="transition.state"
            v-bind:blocker="transitionBlocker(transition)"
            v-bind:loading="busy === `transition-${transition.state}`"
            v-on:click="transitionPlan(transition.state)"
          >
            {{ transitionLabel(transition.state) }}
          </GuardedButton>
          <p v-if="!transitions.length" class="text-sm text-ink-gray-6">
            {{ currentPlan.state }} is a final state; nothing moves it on.
          </p>
        </div>
      </template>

      <details v-if="planState" class="text-xs text-ink-gray-6">
        <summary class="cursor-pointer">Raw plan record</summary>
        <pre class="mt-2 max-h-72 overflow-auto rounded bg-surface-gray-2 p-3 text-ink-gray-7">{{ planState }}</pre>
      </details>
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
        <GuardedButton
          variant="solid"
          v-bind:blocker="startBlocker"
          v-bind:loading="busy === 'start'"
          v-on:click="startRun"
        >
          Re-forecast
        </GuardedButton>
        <Button v-on:click="startWatching(watchTarget)">Watch {{ watchTarget }}</Button>
        <Button v-bind:disabled="!watching" v-on:click="stopWatching">Stop watching</Button>
      </div>

      <RunTracker
        v-if="progress"
        v-bind:run-code="runCode"
        v-bind:progress="progress"
        v-bind:successor="successor"
        v-bind:outcome="outcome"
      />
      <p v-else-if="progressText" class="text-sm text-ink-gray-6" aria-live="polite">
        {{ progressText }}
      </p>
    </div>

    <!-- The parked run waits here until a controller reviews and a CFO decides -->
    <div class="space-y-3 border-b p-4">
      <p class="text-sm text-ink-gray-6">
        Review the successor's covenant before approving the run. Load the successor, record the
        verdict as a controller, then approve as the CFO.
      </p>
      <div class="flex flex-wrap gap-2">
        <GuardedButton
          v-bind:blocker="successorCode ? '' : 'Watch a run until its successor is available'"
          v-on:click="loadSuccessor"
        >
          Load successor{{ successorCode ? ` (${successorCode})` : '' }}
        </GuardedButton>
        <GuardedButton
          variant="solid"
          v-bind:blocker="approveBlocker"
          v-bind:loading="busy === 'approve'"
          v-on:click="decideRun(true)"
        >
          Approve run
        </GuardedButton>
        <GuardedButton
          v-bind:blocker="rejectBlocker"
          v-bind:loading="busy === 'reject'"
          v-on:click="decideRun(false)"
        >
          Reject run
        </GuardedButton>
        <GuardedButton
          v-bind:blocker="cancelBlocker"
          v-bind:loading="busy === 'cancel'"
          v-on:click="cancelRun"
        >
          Cancel run
        </GuardedButton>
      </div>
    </div>

    <!-- A paused agent run: proposed by a model, decided by a second human -->
    <div class="space-y-3 p-4">
      <h3 class="font-medium text-ink-gray-8">Agent proposal review</h3>
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-80">
          <FormControl v-model="proposalId" label="Proposal ID" />
        </div>
        <GuardedButton
          v-bind:blocker="proposalId.trim() ? '' : 'Paste a proposal ID first'"
          v-bind:loading="busy === 'proposal'"
          v-on:click="readProposal"
        >
          Review draft
        </GuardedButton>
        <GuardedButton
          v-bind:blocker="proposalBlocker"
          v-bind:loading="busy === 'proposal-yes'"
          v-on:click="decideProposal(true)"
        >
          Approve proposal
        </GuardedButton>
        <GuardedButton
          v-bind:blocker="proposalBlocker"
          v-bind:loading="busy === 'proposal-no'"
          v-on:click="decideProposal(false)"
        >
          Reject proposal
        </GuardedButton>
      </div>
      <pre
        v-if="proposal"
        class="max-h-72 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7"
      >{{ JSON.stringify(proposal, null, 2) }}</pre>
    </div>

    <div v-if="actionStatus || errorMessage" class="border-t p-4">
      <ErrorMessage v-bind:message="errorMessage" />
      <p v-if="actionStatus" class="text-sm text-ink-gray-7">{{ actionStatus }}</p>
    </div>
  </section>
</template>

<script>
import { Badge, Button, ErrorMessage, FormControl } from 'frappe-ui'
import GuardedButton from '@/components/GuardedButton.vue'
import RunTracker from '@/components/RunTracker.vue'
import {
  approveRunBlocker,
  cancelRunBlocker,
  covenantBlocker,
  createPlanBlocker,
  decideProposalBlocker,
  isFinished,
  planTransitions,
  rejectRunBlocker,
  startRunBlocker,
  transitionBlocker,
} from '@/utils/workflowRules'

const TRANSITION_LABELS = {
  IN_REVIEW: 'Submit for review',
  APPROVED: 'Approve plan',
  REJECTED: 'Reject plan',
  LOCKED: 'Lock plan',
  SUPERSEDED: 'Mark superseded',
  DRAFT: 'Back to draft',
}

const STATE_THEMES = {
  DRAFT: 'gray',
  IN_REVIEW: 'orange',
  APPROVED: 'blue',
  LOCKED: 'green',
  REJECTED: 'red',
  SUPERSEDED: 'gray',
}

export default {
  name: 'PlanWorkbench',

  components: { Badge, Button, ErrorMessage, FormControl, GuardedButton, RunTracker },

  data() {
    return {
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

      // runCode is the plan the run was started on (the workflow's key);
      // successorCode is the version it drafts into. They differ, and the
      // run is only ever addressed by the first.
      runCode: null,
      successorCode: null,
      successor: null,
      progress: null,
      progressText: '',
      outcome: '',
      watchTimer: null,
      // Bumped on every stop/start so a reply from an abandoned poll is dropped
      watchGeneration: 0,
      // Set when a run decision is sent: how many refusals the run had then,
      // so the next poll can tell whether this one was refused.
      pendingDecision: null,

      proposal: null,
      actionStatus: '',
      errorMessage: '',
      busy: '',
    }
  },

  computed: {
    user() {
      return this.$root.user
    },

    watching() {
      return this.watchTimer !== null
    },

    // The loaded plan, only while it is the one named in the field
    currentPlan() {
      return this.loadedPlan?.plan_version_code === this.planCode ? this.loadedPlan : null
    },

    transitions() {
      return planTransitions(this.currentPlan)
    },

    // After "Load successor" the field names the successor, which has no run
    // of its own; watching should stay on the run that produced it.
    watchTarget() {
      if (this.runCode && this.planCode === this.successorCode) return this.runCode
      return this.planCode
    },

    createBlocker() {
      return createPlanBlocker(this.user)
    },

    startBlocker() {
      return startRunBlocker(this.user, this.currentPlan)
    },

    approveBlocker() {
      return approveRunBlocker(this.user, this.progress, this.successor)
    },

    rejectBlocker() {
      return rejectRunBlocker(this.user, this.progress, this.successor)
    },

    cancelBlocker() {
      return cancelRunBlocker(this.progress)
    },

    proposalBlocker() {
      return decideProposalBlocker(this.user, this.proposal)
    },
  },

  watch: {
    // A proposal read for another ID must not decide which buttons this one gets
    proposalId() {
      this.proposal = null
    },
  },

  beforeUnmount() {
    this.stopWatching()
  },

  methods: {
    transitionLabel(state) {
      return TRANSITION_LABELS[state] || `Move to ${state}`
    },

    stateTheme(state) {
      return STATE_THEMES[state] || 'gray'
    },

    transitionBlocker(transition) {
      // The governance store would take the move, but a successor parked in a
      // run is the workflow's to decide: moving it here leaves the run waiting
      // on a version that has already left IN_REVIEW.
      if (
        this.currentPlan?.plan_version_code === this.successorCode &&
        this.progress?.phase === 'AWAITING_APPROVAL'
      ) {
        return 'This version belongs to the parked run; decide it with Approve run / Reject run'
      }
      return transitionBlocker(this.user, this.currentPlan, transition)
    },

    covenantBlocker(covenantOk) {
      return covenantBlocker(this.user, this.currentPlan, covenantOk)
    },

    // Every call goes through here so one place reports failure and clears the
    // busy state, whichever button was pressed.
    async run(key, endpoint, ...args) {
      this.busy = key
      this.errorMessage = ''
      this.actionStatus = ''
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
      if (plan.plan_version_code === this.successorCode) this.successor = plan
    },

    async createPlan() {
      if (await this.run('create', 'createPlanVersion', this.planCode)) {
        await this.loadPlan()
        this.actionStatus = `Draft ${this.planCode} created.`
      }
    },

    async recordCovenant(covenantOk) {
      const done = await this.run(
        covenantOk ? 'covenant-pass' : 'covenant-fail',
        'recordCovenant',
        this.planCode,
        { covenantOk, note: this.reviewNote, expectedVersion: this.currentPlan.row_version },
      )
      if (done) {
        await this.loadPlan()
        this.actionStatus = covenantOk ? 'Covenant pass recorded.' : 'Covenant breach recorded.'
      }
    },

    async transitionPlan(toState) {
      const done = await this.run(`transition-${toState}`, 'transitionPlan', this.planCode, {
        toState,
        note: this.reviewNote,
        expectedVersion: this.currentPlan.row_version,
      })
      if (done) {
        await this.loadPlan()
        this.actionStatus = `Plan moved to ${toState}.`
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
      // FOLDED_IN: a run was already going and its update handler took the
      // shock; detail says how. STARTED on a shock already applied finishes
      // at once with the earlier revision, which the tracker then shows.
      this.actionStatus =
        response.action === 'FOLDED_IN'
          ? `Folded into the running re-forecast: ${response.detail.join('; ')}`
          : 'Re-forecast started.'
      if (response.action === 'STARTED') this.runCode = null
      this.startWatching(this.planCode)
    },

    startWatching(code) {
      this.stopWatching()
      if (code !== this.runCode) {
        // A different run: nothing from the last one applies to it
        this.progress = null
        this.successor = null
        this.successorCode = null
        this.pendingDecision = null
      }
      this.runCode = code
      this.outcome = ''
      this.progressText = 'Waiting for the first progress report…'
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
        this.progress = null
        this.progressText = response.message
        this.watchTimer = null
        return
      }
      const progress = response.data
      this.progress = progress
      this.progressText = ''
      this.successorCode = progress.target_version_code || null
      this.noticeDecisionOutcome(progress)

      const finished = isFinished(progress.phase)
      // The checklist needs the successor's covenant verdict and requester,
      // which only its plan record has; while parked, a controller may be
      // recording it in another window.
      if (this.successorCode && (progress.phase === 'AWAITING_APPROVAL' || finished || !this.successor)) {
        await this.refreshSuccessor()
      }
      if (generation !== this.watchGeneration) return

      if (finished) {
        this.watchTimer = null
        await this.loadOutcome()
        return
      }
      // Holds the slot so `watching` reads true until the timeout fires
      this.watchTimer = setTimeout(
        () => this.watchProgress(generation),
        this.$root.config.PROGRESS_POLL_INTERVAL,
      )
    },

    async refreshSuccessor() {
      const response = await this.$root.callAuthenticatedEndpoint('getPlanVersion', this.successorCode)
      if (!response.error) this.successor = response.data
    },

    // Progress says DONE for every ending; the durable record says which
    async loadOutcome() {
      const response = await this.$root.callAuthenticatedEndpoint('getRuns', this.runCode)
      if (response.error || !response.data.length) return
      this.outcome = response.data[0].state
      if (this.pendingDecision) {
        this.actionStatus = `Run finished: ${this.outcome}.`
        this.pendingDecision = null
      }
    },

    // The decision endpoint only says the signal was sent; whether governance
    // accepted it shows up here, as a new refusal or as the run moving on.
    noticeDecisionOutcome(progress) {
      if (!this.pendingDecision) return
      if (progress.refusals.length > this.pendingDecision.refusalsBefore) {
        this.errorMessage = `Refused: ${progress.refusals[progress.refusals.length - 1]}`
        this.actionStatus = ''
        this.pendingDecision = null
      } else if (progress.phase !== 'AWAITING_APPROVAL') {
        // Kept until the run finishes, so loadOutcome can report how it ended
        this.actionStatus = `Decision accepted; the run is at ${progress.phase}.`
      }
    },

    async loadSuccessor() {
      this.planCode = this.successorCode
      await this.loadPlan()
    },

    async decideRun(approved) {
      const refusalsBefore = this.progress.refusals.length
      const done = await this.run(approved ? 'approve' : 'reject', 'decideRun', this.runCode, {
        approved,
        comment: this.reviewNote,
      })
      if (!done) return
      this.actionStatus = 'Decision sent; waiting for governance to accept it…'
      this.pendingDecision = { refusalsBefore }
      if (!this.watching) this.startWatching(this.runCode)
    },

    async cancelRun() {
      if (await this.run('cancel', 'cancelRun', this.runCode)) {
        this.actionStatus = 'Cancellation sent.'
        if (!this.watching) this.startWatching(this.runCode)
      }
    },

    async readProposal() {
      const proposal = await this.run('proposal', 'getProposal', this.proposalId.trim())
      if (proposal) this.proposal = proposal
    },

    async decideProposal(approved) {
      const result = await this.run(
        approved ? 'proposal-yes' : 'proposal-no',
        'decideProposal',
        this.proposalId.trim(),
        approved,
      )
      if (!result) return
      // The decision reply leaves out who asked and when; keep those from the read
      this.proposal = { ...this.proposal, ...result }
      this.actionStatus = `Proposal ${result.state.toLowerCase()}; the agent run continued.`
    },
  },
}
</script>
