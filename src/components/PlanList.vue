<template>
  <div v-if="loading" class="flex justify-center p-6">
    <LoadingIndicator class="h-5 w-5 text-ink-gray-6" />
  </div>
  <p v-else-if="plans.length === 0" class="p-6 text-center text-base text-ink-gray-6">
    No plans yet.
  </p>
  <ul v-else class="divide-y">
    <li
      v-for="plan in plans"
      v-bind:key="plan.name"
      class="flex items-center justify-between px-4 py-3"
    >
      <div>
        <p class="text-base font-medium text-ink-gray-8">{{ plan.plan_name }}</p>
        <p class="text-sm text-ink-gray-6">{{ plan.owner_team }}</p>
      </div>
      <Badge v-bind:label="plan.status" v-bind:theme="statusTheme(plan.status)" />
    </li>
  </ul>
</template>

<script>
import { Badge, LoadingIndicator } from 'frappe-ui'

export default {
  name: 'PlanList',

  components: { Badge, LoadingIndicator },

  props: {
    plans: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },

  methods: {
    statusTheme(status) {
      const { APPROVED, IN_REVIEW } = this.$root.config.PLAN_STATUS
      if (status === APPROVED) return 'green'
      if (status === IN_REVIEW) return 'orange'
      return 'gray'
    },
  },
}
</script>
