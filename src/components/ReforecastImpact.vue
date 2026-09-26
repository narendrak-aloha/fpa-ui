<template>
  <div class="space-y-3 rounded border bg-surface-gray-1 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-medium text-ink-gray-8">
        What this re-forecast does to {{ impact?.source_plan_version_code || 'the plan' }}
      </p>
      <div class="flex items-center gap-2">
        <div class="w-36">
          <FormControl
            v-model="scenario"
            type="select"
            v-bind:options="scenarioOptions"
            aria-label="Scenario"
          />
        </div>
        <Button v-bind:loading="loading" v-on:click="load">Refresh</Button>
      </div>
    </div>

    <ErrorMessage v-bind:message="errorMessage" />

    <template v-if="impact">
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p class="font-medium text-ink-gray-7">Driver moves in revision {{ impact.revision }}</p>
          <ul v-if="impact.shocks.length" class="mt-1 space-y-0.5 text-ink-gray-8">
            <li v-for="shock in impact.shocks" v-bind:key="shock.driver_code">
              <code>{{ shock.driver_code }}</code>: {{ shock.from_value }} → {{ shock.to_value }}
            </li>
          </ul>
          <p v-else class="mt-1 text-ink-gray-6">No shocks recorded for this revision.</p>
          <p class="mt-1 text-xs text-ink-gray-6">
            Requested by {{ impact.requested_by }} · publication {{ impact.publication_state || 'not reserved' }}
          </p>
        </div>
        <div>
          <p class="font-medium text-ink-gray-7">Why, in the planner's words</p>
          <ul v-if="impact.reasons.length" class="mt-1 space-y-1 text-ink-gray-8">
            <li v-for="(reason, index) in impact.reasons" v-bind:key="index">
              “{{ reason.reason }}”
              <span class="text-xs text-ink-gray-6">— {{ reason.by }}, {{ reason.at }}</span>
            </li>
          </ul>
          <p v-else class="mt-1 text-ink-gray-6">No reason was given with these shocks.</p>
        </div>
      </div>

      <p v-if="impact.note" class="text-sm text-ink-gray-6">{{ impact.note }}</p>
      <BridgeReport
        v-if="impact.bridge"
        v-bind:preloaded="impact.bridge"
        title="Plan impact · baseline to re-forecast · USD"
        v-bind:anchors="['Baseline', 'Re-forecast']"
      />
    </template>
  </div>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import BridgeReport from '@/components/BridgeReport.vue'

export default {
  name: 'ReforecastImpact',

  components: { BridgeReport, Button, ErrorMessage, FormControl },

  props: {
    // A successor version code (PV-…-R<n>)
    planCode: { type: String, required: true },
    // Bumped by the parent when the plan changes state, to read again
    refreshKey: { type: [Number, String], default: 0 },
  },

  data() {
    return {
      scenario: 'base',
      scenarioOptions: [
        { label: 'Base', value: 'base' },
        { label: 'Stretch', value: 'stretch' },
        { label: 'Downside', value: 'downside' },
      ],
      impact: null,
      loading: false,
      errorMessage: '',
    }
  },

  watch: {
    planCode: { immediate: true, handler: 'load' },
    refreshKey: 'load',
    scenario: 'load',
  },

  methods: {
    async load() {
      const code = this.planCode
      this.loading = true
      this.errorMessage = ''
      const response = await this.$root.callAuthenticatedEndpoint('getPlanImpact', code, this.scenario)
      // A reply for a plan that is no longer shown is dropped
      if (code !== this.planCode) return
      this.loading = false
      if (response.error) {
        this.impact = null
        this.errorMessage = response.message
        return
      }
      this.impact = response.data
    },
  },
}
</script>
