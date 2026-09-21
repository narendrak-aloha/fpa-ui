<template>
  <div class="rounded-lg border bg-surface-white p-4">
    <p class="text-sm text-ink-gray-6">{{ label }}</p>
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="text-2xl font-semibold text-ink-gray-9">{{ displayValue }}</span>
      <Badge v-if="change" v-bind:label="change" v-bind:theme="badgeTheme" variant="subtle" />
    </div>
  </div>
</template>

<script>
import { Badge } from 'frappe-ui'
import { formatValue } from '@/utils/formatters'

const TREND_THEMES = { up: 'green', warn: 'orange', down: 'red' }

export default {
  name: 'StatCard',

  components: { Badge },

  props: {
    label: { type: String, required: true },
    value: { type: [Number, String], default: '' },
    // "currency" | "percent" | ""
    format: { type: String, default: '' },
    change: { type: String, default: '' },
    // "up" | "warn" | "down"
    trend: { type: String, default: '' },
  },

  computed: {
    displayValue() {
      return formatValue(this.value, this.format)
    },

    badgeTheme() {
      return TREND_THEMES[this.trend] || 'gray'
    },
  },
}
</script>
