<template>
  <section class="panel">
    <h2>Variance Bridge</h2>

    <div class="row">
      <input v-model="planVersionId" placeholder="plan version id" class="wide" />
      <button @click="load">Load reports</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-for="report in reports" :key="report.id" class="report">
      <p>
        <strong>{{ report.cut_label }}</strong> &mdash; vintage {{ report.vintage }} &mdash; {{ report.state }}
        <span v-if="report.materiality_flag" class="drift">material</span>
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
          <tr v-for="line in report.lines" :key="line.id">
            <td>{{ line.rollup_path }}</td>
            <td>{{ line.group_gap.toFixed(2) }}</td>
            <td v-for="leg in legNames" :key="leg">{{ line.legs[leg].toFixed(2) }}</td>
            <td :class="{ residual: true, breach: Math.abs(line.residual) >= line.tol }">
              {{ line.residual.toFixed(2) }}
            </td>
            <td>{{ line.tol.toFixed(2) }}</td>
            <td><button @click="drillThrough(line.id)">drill through</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="drill" class="drill-result">
      <h3>Drill-through (vintage {{ drill.vintage }})</h3>
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
      <p v-else>no cube rows cited</p>
    </div>
  </section>
</template>

<script>
import { api } from '../api'

const LEG_NAMES = ['price', 'volume', 'practice_mix', 'grade_mix', 'fx', 'rate', 'efficiency']

export default {
  name: 'VarianceBridge',
  props: {
    initialPlanVersionId: { type: String, default: '' },
  },
  data() {
    return {
      planVersionId: this.initialPlanVersionId,
      reports: [],
      drill: null,
      error: null,
      legNames: LEG_NAMES,
    }
  },
  watch: {
    initialPlanVersionId(v) {
      this.planVersionId = v
    },
  },
  methods: {
    async load() {
      this.error = null
      this.drill = null
      try {
        const resp = await api.get(`/variance-reports/${this.planVersionId}`)
        this.reports = resp.data
      } catch (e) {
        this.error = e.response ? JSON.stringify(e.response.data) : e.message
      }
    },
    async drillThrough(lineId) {
      this.error = null
      try {
        const resp = await api.get(`/variance-reports/lines/${lineId}/drill-through`)
        this.drill = resp.data
      } catch (e) {
        this.error = e.response ? JSON.stringify(e.response.data) : e.message
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
.residual.breach {
  color: #b00020;
  font-weight: bold;
}
.drift {
  color: #b00020;
  font-weight: bold;
}
.error {
  color: #b00020;
}
</style>
