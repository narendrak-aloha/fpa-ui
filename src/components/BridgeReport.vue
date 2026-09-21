<template>
  <section class="rounded-lg border bg-surface-white">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <h2 class="font-semibold text-ink-gray-9">Variance bridge · USD</h2>
      <p class="text-sm text-ink-gray-6">{{ statusLine }}</p>
    </div>

    <div v-if="loading" class="flex items-center gap-2 p-4 text-sm text-ink-gray-6">
      <LoadingIndicator class="h-4 w-4" />
      Decomposing the difference.
    </div>

    <ErrorMessage class="p-4" v-bind:message="errorMessage" />

    <template v-if="report">
      <!-- Plan, then one bar per effect, then actual. A bar's height is its
           contribution; the last bar must land on actual, which is what
           "ties" asserts. -->
      <div class="overflow-x-auto p-4">
        <svg
          v-bind:viewBox="`0 0 ${bars.length * 99 + 20} 255`"
          role="img"
          aria-label="Variance waterfall from plan to actual, in USD"
          class="min-w-[640px]"
        >
          <g v-for="(bar, index) in bars" v-bind:key="bar.label">
            <rect
              v-bind:x="10 + index * 99"
              v-bind:width="78"
              v-bind:y="Math.min(bar.yFrom, bar.yTo)"
              v-bind:height="Math.max(1, Math.abs(bar.yFrom - bar.yTo))"
              v-bind:fill="bar.fill"
            />
            <text v-bind:x="10 + index * 99" y="215" font-size="11" fill="currentColor">
              {{ bar.label }}
            </text>
            <text v-bind:x="10 + index * 99" y="235" font-size="11" fill="currentColor">
              {{ bar.value }}
            </text>
          </g>
        </svg>
        <p class="mt-2 text-sm text-ink-gray-6">
          Residual: {{ selectedNode.residual }} USD · tolerance: {{ selectedNode.tolerance }} ·
          ties: {{ selectedNode.ties }}
        </p>
      </div>

      <div class="border-t p-4">
        <p class="mb-2 text-sm font-medium text-ink-gray-7">Every level, and whether it ties</p>
        <BridgeNode
          v-bind:node="report.root"
          v-bind:selected-path="selectedPath"
          v-on:select="select"
        />
      </div>

      <div v-if="citations" class="border-t p-4">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium text-ink-gray-7">
            Source rows for {{ selectedNode.path.join(' / ') || 'Total' }}
          </p>
          <Button
            v-bind:disabled="nextOffset === null || loadingRows"
            v-bind:loading="loadingRows"
            v-on:click="loadCitations(selectedNode)"
          >
            {{ nextOffset === null ? 'All rows shown' : 'Show next source rows' }}
          </Button>
        </div>
        <pre class="max-h-96 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7">{{ citations }}</pre>
      </div>
    </template>
  </section>
</template>

<script>
import { Button, ErrorMessage, LoadingIndicator } from 'frappe-ui'
import BridgeNode from '@/components/BridgeNode.vue'
import { niceName } from '@/utils/dsl'

const LEGS = ['price', 'volume', 'mix', 'fx', 'rate', 'efficiency']

export default {
  name: 'BridgeReport',

  components: { BridgeNode, Button, ErrorMessage, LoadingIndicator },

  props: {
    // { dsl, nonce }: nonce changes even when the same DSL is run again
    request: { type: Object, required: true },
  },

  data() {
    return {
      report: null,
      selectedNode: null,
      citations: '',
      nextOffset: 0,
      loading: false,
      loadingRows: false,
      errorMessage: '',
    }
  },

  computed: {
    statusLine() {
      if (!this.report) return ''
      const vintage = this.report.vintage || {}
      return `${this.report.status} · vintage ${vintage.vintage} · ${vintage.closed_at} · all levels tie: ${this.report.ties}`
    },

    selectedPath() {
      return this.selectedNode ? this.selectedNode.path.join('|') : ''
    },

    // Bar geometry for the selected node, in the SVG's own coordinates
    bars() {
      const node = this.selectedNode
      if (!node) return []
      let running = Number(node.plan_amount)
      const steps = [{ label: 'Plan', from: 0, to: running, value: node.plan_amount }]
      for (const leg of LEGS) {
        const next = running + Number(node[leg])
        steps.push({ label: niceName(leg), from: running, to: next, value: node[leg] })
        running = next
      }
      steps.push({ label: 'Actual', from: 0, to: Number(node.actual_amount), value: node.actual_amount })

      const bounds = steps.flatMap((step) => [step.from, step.to])
      const min = Math.min(0, ...bounds)
      const max = Math.max(0, ...bounds)
      const y = (value) => 190 - ((value - min) / (max - min || 1)) * 145
      return steps.map((step, index) => ({
        ...step,
        yFrom: y(step.from),
        yTo: y(step.to),
        // Plan and actual are the anchors; the legs between them are coloured
        // by direction.
        fill:
          index === 0 || index === steps.length - 1
            ? '#2B4C7E'
            : Number(step.value) < 0
              ? '#9A3B26'
              : '#2F6B4F',
      }))
    },
  },

  watch: {
    request: {
      immediate: true,
      handler(request) {
        if (request && request.dsl) this.load(request.dsl)
      },
    },
  },

  methods: {
    async load(dsl) {
      this.loading = true
      this.errorMessage = ''
      this.report = null
      this.citations = ''
      const response = await this.$root.callAuthenticatedEndpoint('runBridge', dsl)
      this.loading = false
      if (response.error) {
        this.errorMessage = response.message
        return
      }
      this.report = response.data
      this.selectedNode = response.data.root
    },

    select(node) {
      this.selectedNode = node
      this.citations = ''
      this.nextOffset = 0
      this.loadCitations(node)
    },

    // Paged: a node can stand on thousands of ledger lines.
    async loadCitations(node) {
      if (this.nextOffset === null) return
      this.loadingRows = true
      const response = await this.$root.callAuthenticatedEndpoint(
        'getCitations',
        this.report.report_id,
        node.path.join('|'),
        this.nextOffset,
      )
      this.loadingRows = false
      if (response.error) {
        this.citations = response.message
        return
      }
      this.citations = JSON.stringify(
        { citations: response.data.rows, ledger: response.data.source_rows },
        null,
        2,
      )
      this.nextOffset = response.data.next_offset
    },
  },
}
</script>
