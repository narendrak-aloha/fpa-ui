<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-medium text-ink-gray-7">
        Plan versions
        <span class="font-normal text-ink-gray-6">
          · {{ needingMe.length }} need{{ needingMe.length === 1 ? 's' : '' }} you
        </span>
      </p>
      <div class="flex items-center gap-2">
        <Button v-bind:variant="onlyMine ? 'solid' : 'subtle'" v-on:click="onlyMine = !onlyMine">
          {{ onlyMine ? 'Showing what needs me' : 'Show only what needs me' }}
        </Button>
        <Button v-bind:loading="loading" v-on:click="$emit('refresh')">Refresh</Button>
      </div>
    </div>

    <ErrorMessage v-bind:message="errorMessage" />

    <p v-if="!loading && !errorMessage && rows.length === 0" class="text-sm text-ink-gray-6">
      {{ onlyMine ? 'Nothing is waiting on you.' : 'No plan versions yet.' }}
    </p>

    <div v-else-if="rows.length" class="max-h-72 overflow-auto rounded border">
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 bg-surface-gray-2 text-ink-gray-6">
          <tr>
            <th class="px-3 py-2 font-medium">Code</th>
            <th class="px-3 py-2 font-medium">State</th>
            <th class="px-3 py-2 font-medium">Re-forecast of</th>
            <th class="px-3 py-2 font-medium">Requested by</th>
            <th class="px-3 py-2 font-medium">Covenant</th>
            <th class="px-3 py-2 font-medium">Needs you</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr
            v-for="plan in rows"
            v-bind:key="plan.plan_version_code"
            class="cursor-pointer hover:bg-surface-gray-1"
            v-bind:class="{ 'bg-surface-gray-2': plan.plan_version_code === selectedCode }"
            tabindex="0"
            v-on:click="$emit('select', plan.plan_version_code)"
            v-on:keydown.enter="$emit('select', plan.plan_version_code)"
          >
            <td class="px-3 py-2 font-medium text-ink-gray-8">{{ plan.plan_version_code }}</td>
            <td class="px-3 py-2">
              <Badge v-bind:label="plan.state" v-bind:theme="stateTheme(plan.state)" />
            </td>
            <td class="px-3 py-2 text-ink-gray-7">{{ plan.supersedes_plan_version_code || '—' }}</td>
            <td class="px-3 py-2 text-ink-gray-7">{{ plan.requested_by }}</td>
            <td class="px-3 py-2 text-ink-gray-7">{{ plan.covenant_ok ? 'Passed' : 'Not passed' }}</td>
            <td class="px-3 py-2 text-ink-gray-8">{{ attention(plan) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { Badge, Button, ErrorMessage } from 'frappe-ui'
import { planAttention } from '@/utils/workflowRules'

const STATE_THEMES = {
  DRAFT: 'gray',
  IN_REVIEW: 'orange',
  APPROVED: 'blue',
  LOCKED: 'green',
  REJECTED: 'red',
  SUPERSEDED: 'gray',
}

export default {
  name: 'PlanList',

  components: { Badge, Button, ErrorMessage },

  props: {
    plans: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    selectedCode: { type: String, default: '' },
  },

  emits: ['select', 'refresh'],

  data() {
    return { onlyMine: false }
  },

  computed: {
    needingMe() {
      return this.plans.filter((plan) => this.attention(plan))
    },

    // What needs this user first, then newest first
    rows() {
      const list = this.onlyMine ? this.needingMe : this.plans
      return [...list].sort((a, b) => {
        const byAttention = Number(Boolean(this.attention(b))) - Number(Boolean(this.attention(a)))
        return byAttention || String(b.created_at).localeCompare(String(a.created_at))
      })
    },
  },

  methods: {
    attention(plan) {
      return planAttention(this.$root.user, plan)
    },

    stateTheme(state) {
      return STATE_THEMES[state] || 'gray'
    },
  },
}
</script>
