<template>
  <section class="panel">
    <h2>Copilot</h2>

    <div class="row">
      <input v-model="question" placeholder="e.g. Why did Poland miss its services revenue in Q2 2026?" class="wide" />
      <button @click="ask" :disabled="loading">{{ loading ? 'Asking...' : 'Ask' }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="result">
      <div v-if="result.status === 'paused'" class="paused">
        <strong>Paused for human confirmation.</strong> Nothing has been recorded yet.
        <div v-for="(p, i) in result.pending_confirmations" :key="i">
          {{ p.member_id }} wants to call <code>{{ p.tool }}</code> with <code>{{ JSON.stringify(p.arguments) }}</code>
        </div>
      </div>

      <div class="answer-layout">
        <div v-if="result.answer" class="answer">
          <h3>Answer</h3>
          <p>{{ result.answer.answer }}</p>
          <p v-if="result.answer.drift_flag" class="drift">⚠ vintage drift detected</p>
        </div>
        <div class="dsl">
          <h3>DSL the agent ran</h3>
          <p v-if="!result.trace.length" class="hint">No query was run.</p>
          <div v-for="(t, i) in result.trace" :key="'t' + i" class="citation">
            <span class="meta">{{ t.member_id }} &middot; vintage {{ t.vintage === null ? 'latest' : t.vintage }} &middot; {{ t.row_count }} rows</span>
            <code>{{ t.dsl }}</code>
          </div>
          <template v-if="result.answer && result.answer.citations.length">
            <h3>Cited rows</h3>
            <div v-for="(c, i) in result.answer.citations" :key="'c' + i" class="citation">
              <code>{{ c.dsl }}</code>
              <pre>{{ c.row }}</pre>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { api, errorText } from '../api'

export default {
  name: 'CopilotQuery',
  data() {
    return {
      question: '',
      result: null,
      error: null,
      loading: false,
    }
  },
  methods: {
    async ask() {
      this.error = null
      this.result = null
      this.loading = true
      try {
        const resp = await api.post('/copilot/query', { question: this.question })
        this.result = resp.data
      } catch (e) {
        this.error = errorText(e)
      } finally {
        this.loading = false
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
.answer-layout {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}
.answer {
  flex: 1;
  min-width: 250px;
}
.dsl {
  flex: 1;
  min-width: 250px;
  max-height: 360px;
  overflow-y: auto;
}
.citation {
  border-bottom: 1px solid #eee;
  padding: 0.3rem 0;
}
.citation code {
  display: block;
  font-size: 0.85rem;
}
.citation pre {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
}
.meta {
  font-size: 0.8rem;
  color: #555;
}
.paused {
  background: #fff8e1;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}
.drift {
  color: #b00020;
  font-weight: bold;
}
.error {
  color: #b00020;
}
.hint {
  font-size: 0.85rem;
  color: #555;
}
</style>
