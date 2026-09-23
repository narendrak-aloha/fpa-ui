<template>
  <section
    class="rounded-lg border bg-surface-white"
    v-bind:class="{ 'border-red-300': outcome.tone === 'bad' }"
    aria-live="polite"
  >
    <div class="space-y-3 p-4">
      <p class="text-sm text-ink-gray-5">You asked: "{{ query }}"</p>

      <p v-if="outcome.title" class="font-medium text-ink-gray-9">{{ outcome.title }}</p>
      <p v-if="text" class="whitespace-pre-line text-ink-gray-8">{{ text }}</p>
      <p v-if="note" class="text-sm text-red-600">{{ note }}</p>

      <div v-if="dsl">
        <p class="mb-1 text-sm font-medium text-ink-gray-7">FinOpsExpr</p>
        <pre class="overflow-x-auto rounded bg-surface-gray-2 p-3 text-sm text-ink-gray-8">{{ dsl }}</pre>
      </div>

      <p v-if="proposalNote" class="text-sm text-ink-gray-6">{{ proposalNote }}</p>
      <pre
        v-if="driftFlags"
        class="overflow-x-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7"
      >{{ driftFlags }}</pre>

      <Button v-bind:disabled="!hasBridge" v-on:click="$emit('bridge', dsl)">
        Run variance bridge from this DSL
      </Button>
    </div>

    <!-- The figures the narrative is allowed to cite, exactly as returned -->
    <div v-if="rows.length" class="border-t p-4">
      <p class="mb-2 text-sm font-medium text-ink-gray-7">Figures</p>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b text-ink-gray-5">
            <tr>
              <th
                v-for="(column, index) in columns"
                v-bind:key="column"
                class="px-2 py-2 font-medium"
                v-bind:class="{ 'text-right': numeric[index] }"
              >
                {{ niceName(column) }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y text-ink-gray-8">
            <tr v-for="(row, rowIndex) in rows" v-bind:key="rowIndex">
              <td
                v-for="(column, index) in columns"
                v-bind:key="column"
                class="whitespace-nowrap px-2 py-2"
                v-bind:class="{ 'text-right tabular-nums': numeric[index] }"
              >
                {{ formatCell(column, row[column], decimals[index]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="border-t p-4">
      <Button variant="ghost" v-on:click="explaining = !explaining">
        {{ explaining ? 'Hide explanation' : 'Explain this answer (debug)' }}
      </Button>
    </div>

    <!-- Every step between the question and the figures above -->
    <div v-if="explaining" class="divide-y border-t">
      <div class="p-4">
        <p class="font-medium text-ink-gray-8">1 · What was assumed</p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-gray-6">
          <li v-for="note in assumptions" v-bind:key="note">{{ note }}</li>
        </ul>
      </div>

      <div v-if="dsl" class="p-4">
        <p class="font-medium text-ink-gray-8">2 · How your question was understood</p>
        <p class="mb-2 text-sm text-ink-gray-5">The query that was written, clause by clause.</p>
        <pre class="overflow-x-auto rounded bg-surface-gray-2 p-3 text-sm text-ink-gray-8">{{ dsl }}</pre>
        <dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <template v-for="[label, description] in dslParts" v-bind:key="label + description">
            <dt class="text-ink-gray-5">{{ label }}</dt>
            <dd class="text-ink-gray-8">{{ description }}</dd>
          </template>
        </dl>
      </div>

      <div v-if="sql" class="p-4">
        <p class="font-medium text-ink-gray-8">3 · What was run on the database</p>
        <p class="mb-2 text-sm text-ink-gray-5">
          Every value is a parameter, and the company filter is added by the compiler from your token.
        </p>
        <pre class="overflow-x-auto whitespace-pre-wrap rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-8">{{ sql }}</pre>
        <div v-if="params.length" class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="[key, value] in params"
            v-bind:key="key"
            class="rounded bg-surface-gray-2 px-2 py-1 text-xs text-ink-gray-7"
          >
            <b>{{ key }} = </b>{{ Array.isArray(value) ? value.join(', ') : String(value) }}
          </span>
        </div>
      </div>

      <div class="p-4">
        <p class="font-medium text-ink-gray-8">4 · Details</p>
        <dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <template v-for="[label, value] in details" v-bind:key="label">
            <dt class="text-ink-gray-5">{{ label }}</dt>
            <dd class="text-ink-gray-8">{{ value }}</dd>
          </template>
        </dl>
        <details class="mt-3">
          <summary class="cursor-pointer text-sm text-ink-gray-6">Raw response</summary>
          <pre class="mt-2 max-h-96 overflow-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7">{{ raw }}</pre>
        </details>
      </div>
    </div>
  </section>
</template>

<script>
import { Button } from 'frappe-ui'
import {
  OUTCOME,
  PROVIDER_NAMES,
  describeDuration,
  explainDsl,
  formatCell,
  niceName,
} from '@/utils/dsl'

export default {
  name: 'AnswerPanel',

  components: { Button },

  props: {
    query: { type: String, required: true },
    result: { type: Object, required: true },
  },

  emits: ['bridge'],

  data() {
    return {
      explaining: false,
    }
  },

  computed: {
    answer() {
      return (
        this.result.agent_response || {
          execution_status: 'REQUEST_ERROR',
          error_message: this.result.error,
          cited_data_rows: [],
        }
      )
    },

    status() {
      return this.answer.execution_status || 'REQUEST_ERROR'
    },

    // mode "not_run" means the question never reached the data at all (no
    // provider configured, database down), which is not the same as a refusal.
    failed() {
      return this.result.mode === 'not_run' && this.status !== 'SUCCESS'
    },

    outcome() {
      if (this.failed) {
        return { tone: 'bad', title: "The question couldn't be answered right now." }
      }
      return OUTCOME[this.status] || OUTCOME.REQUEST_ERROR
    },

    rows() {
      return this.answer.cited_data_rows || []
    },

    columns() {
      if (this.result.columns && this.result.columns.length) return this.result.columns
      return this.rows[0] ? Object.keys(this.rows[0]) : []
    },

    numeric() {
      return this.columns.map((column) => this.rows.some((row) => typeof row[column] === 'number'))
    },

    decimals() {
      return this.columns.map((column) =>
        this.rows.some((row) => typeof row[column] === 'number' && !Number.isInteger(row[column]))
          ? 2
          : 0,
      )
    },

    text() {
      const narrative = this.answer.narrative_explanation || ''
      if (narrative) return narrative
      if (this.status !== 'SUCCESS') return ''
      return this.rows.length ? 'Here are the figures.' : 'No data matched your question.'
    },

    note() {
      return this.status === 'SUCCESS' ? '' : this.answer.error_message || ''
    },

    dsl() {
      return this.answer.generated_dsl || ''
    },

    hasBridge() {
      return /\bBRIDGE\b/i.test(this.dsl)
    },

    sql() {
      return this.result.sql || ''
    },

    params() {
      return Object.entries(this.result.params || {})
    },

    assumptions() {
      const assumptions = this.answer.assumptions || []
      return assumptions.length ? assumptions : ['Nothing needed to be assumed.']
    },

    dslParts() {
      return this.dsl ? explainDsl(this.dsl) : []
    },

    proposalNote() {
      return this.answer.proposal_id
        ? `Draft proposal: ${this.answer.proposal_id}. Use the proposal review controls below.`
        : ''
    },

    driftFlags() {
      return this.answer.drift_flags && this.answer.drift_flags.length
        ? `Recorded vintage drift:\n${JSON.stringify(this.answer.drift_flags, null, 2)}`
        : ''
    },

    // Which team member's output carried the executed DSL, by its stable id
    dslProducer() {
      const trace = this.answer.member_trace
      if (!trace?.produced_by?.id) return ''
      const { id, name } = trace.produced_by
      return name && name !== id ? `${name} (${id})` : id
    },

    // Leader, then each member it delegated to, with the tools each called
    delegation() {
      const trace = this.answer.member_trace
      if (!trace) return ''
      const step = (entry) =>
        `${entry.name || entry.id}${entry.tools?.length ? ` [${entry.tools.join(', ')}]` : ''}`
      return [trace.leader, ...(trace.members || [])].filter(Boolean).map(step).join(' → ')
    },

    details() {
      const mode = this.result.mode
      const answeredBy =
        mode === 'agno_team'
          ? `AI: ${PROVIDER_NAMES[this.result.provider] || this.result.provider}`
          : mode === 'direct_dsl'
            ? 'Query run directly, no AI used'
            : 'Not run'
      const duration = describeDuration(this.result.duration_ms)
      return [
        ['Answered by', answeredBy],
        ...(this.dslProducer ? [['DSL written by', this.dslProducer]] : []),
        ...(this.delegation ? [['Team trace', this.delegation]] : []),
        ['Result', this.status],
        ['Rows returned', String(this.rows.length)],
        ...(duration ? [['Time taken', duration]] : []),
        ...(this.answer.error_message ? [['Message', this.answer.error_message]] : []),
      ]
    },

    raw() {
      return JSON.stringify(this.result, null, 2)
    },
  },

  watch: {
    // A new answer collapses the explanation, as a fresh question should.
    result() {
      this.explaining = false
    },
  },

  methods: { formatCell, niceName },
}
</script>
