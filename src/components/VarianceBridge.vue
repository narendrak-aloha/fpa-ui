<template>
  <section class="panel">
    <h2>Variance Bridge</h2>

    <div class="row">
      <input v-model="planVersionId" placeholder="plan version id" class="wide" />
      <button @click="load" :disabled="loading">{{ loading ? 'Loading...' : 'Load reports' }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loaded && !reports.length" class="hint">No variance reports for this plan version yet.</p>

    <div v-for="report in reports" :key="report.id" class="report">
      <p>
        <strong>{{ report.cut_label }}</strong> &mdash; vintage {{ report.vintage }} &mdash; {{ report.state }}
        <span v-if="report.materiality_flag" class="flag">material</span>
      </p>

      <table>
        <thead>
          <tr>
            <th>rollup path</th>
            <th>group gap</th>
            <th v-for="leg in legNames" :key="leg">{{ leg }}</th>
            <th>residual</th>
            <th>tol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in report.lines" :key="line.id" :class="{ selected: selected && selected.id === line.id }">
            <td>{{ line.rollup_path }}</td>
            <td>{{ line.group_gap.toFixed(2) }}</td>
            <td v-for="leg in legNames" :key="leg">{{ line.legs[leg].toFixed(2) }}</td>
            <td :class="{ residual: true, breach: Math.abs(line.residual) >= line.tol }">{{ line.residual }}</td>
            <td>{{ line.tol.toFixed(2) }}</td>
            <td><button @click="select(report, line)">waterfall &amp; rows</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selected" class="waterfall">
      <h3>Waterfall &mdash; {{ selected.rollup_path }} (gap {{ selected.group_gap.toFixed(2) }})</h3>
      <div v-for="step in selected.waterfall" :key="step.label" class="wf-row">
        <span class="wf-label">{{ step.label }}</span>
        <div class="wf-track">
          <div class="wf-zero" :style="{ left: pct(0) + '%' }"></div>
          <div
            class="wf-bar"
            :class="{ down: step.end < step.start, residual: step.label === 'residual' }"
            :style="barStyle(step)"
          ></div>
        </div>
        <span class="wf-value">{{ step.label === 'residual' ? selected.residual : selected.legs[step.label].toFixed(2) }}</span>
      </div>
    </div>

    <div v-if="drill" class="drill-result">
      <h3>Drill-through (vintage {{ drill.vintage }})</h3>
      <p v-if="drill.truncated" class="hint">
        Sample of {{ drill.rows.length }} rows from {{ drill.cited_row_count }} cited
        dimension signatures -- not the full citation set.
      </p>
      <table v-if="drill.rows && drill.rows.length">
        <thead>
          <tr><th v-for="col in drill.columns" :key="col">{{ col }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in drill.rows" :key="i">
            <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="hint">No cube rows within your scope for this line.</p>
    </div>
  </section>
</template>

<script>
import { api, errorText } from '../api'

const LEG_NAMES = ['volume', 'practice_mix', 'grade_mix', 'price', 'efficiency', 'rate', 'fx']

export default {
  name: 'VarianceBridge',
  props: {
    initialPlanVersionId: { type: String, default: '' },
  },
  data() {
    return {
      planVersionId: this.initialPlanVersionId,
      reports: [],
      loaded: false,
      loading: false,
      selected: null,
      drill: null,
      error: null,
      legNames: LEG_NAMES,
    }
  },
  computed: {
    // Presentation only: the span every bar is drawn against.
    range() {
      if (!this.selected) return { lo: 0, hi: 1 }
      const points = this.selected.waterfall.flatMap((s) => [s.start, s.end]).concat(0)
      const lo = Math.min(...points)
      const hi = Math.max(...points)
      return { lo, hi: hi === lo ? lo + 1 : hi }
    },
  },
  watch: {
    initialPlanVersionId(v) {
      this.planVersionId = v
    },
  },
  methods: {
    pct(value) {
      return ((value - this.range.lo) / (this.range.hi - this.range.lo)) * 100
    },
    barStyle(step) {
      const left = this.pct(Math.min(step.start, step.end))
      const width = this.pct(Math.max(step.start, step.end)) - left
      return { left: left + '%', width: `max(${width}%, 1px)` }
    },
    async load() {
      this.error = null
      this.drill = null
      this.selected = null
      this.loaded = false
      this.loading = true
      try {
        const resp = await api.get(`/variance-reports/${this.planVersionId}`)
        this.reports = resp.data
        this.loaded = true
      } catch (e) {
        this.reports = []
        this.error = errorText(e)
      } finally {
        this.loading = false
      }
    },
    async select(report, line) {
      this.selected = line
      this.error = null
      this.drill = null
      try {
        const resp = await api.get(`/variance-reports/lines/${line.id}/drill-through`)
        this.drill = resp.data
      } catch (e) {
        this.error = errorText(e)
      }
    },
  },
}
</script>

<style scoped>
.panel {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  text-align: left;
}
.row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.wide {
  flex: 1;
  min-width: 300px;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}
th, td {
  border: 1px solid #eee;
  padding: 0.25rem 0.5rem;
  text-align: right;
}
th:first-child, td:first-child {
  text-align: left;
}
tr.selected {
  background: #f3f7f4;
}
.residual.breach {
  color: #b00020;
  font-weight: bold;
}
.flag {
  color: #b00020;
  font-weight: bold;
}
.waterfall {
  margin-bottom: 1rem;
}
.wf-row {
  display: grid;
  grid-template-columns: 7rem 1fr 9rem;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  margin-bottom: 0.2rem;
}
.wf-track {
  position: relative;
  height: 14px;
  background: #fafafa;
}
.wf-zero {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #999;
}
.wf-bar {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: #2c6e49;
}
.wf-bar.down {
  background: #b00020;
}
.wf-bar.residual {
  background: #888;
}
.wf-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.error {
  color: #b00020;
}
.hint {
  font-size: 0.85rem;
  color: #555;
}
</style>
