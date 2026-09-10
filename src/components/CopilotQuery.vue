<template>
  <section class="panel">
    <h2>Copilot</h2>

    <div class="row">
      <input v-model="apiKey" placeholder="API key" />
      <input v-model="question" placeholder="e.g. What was Q2 revenue for Poland?" class="wide" />
      <button @click="ask" :disabled="loading">{{ loading ? 'Asking...' : 'Ask' }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="answer" class="answer-layout">
      <div class="answer">
        <h3>Answer</h3>
        <p>{{ answer.answer }}</p>
        <p v-if="answer.drift_flag" class="drift">⚠ vintage drift detected</p>
      </div>
      <div class="citations">
        <h3>DSL / citations</h3>
        <div v-for="(c, i) in answer.citations" :key="i" class="citation">
          <code>{{ c.dsl }}</code>
          <pre>{{ c.row }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { api } from '../api'

export default {
  name: 'CopilotQuery',
  data() {
    return {
      apiKey: 'pl-planner-key',
      question: '',
      answer: null,
      error: null,
      loading: false,
    }
  },
  methods: {
    async ask() {
      this.error = null
      this.loading = true
      try {
        const resp = await api.post(
          '/copilot/query',
          { question: this.question },
          { headers: { 'x-api-key': this.apiKey } }
        )
        this.answer = resp.data
      } catch (e) {
        this.error = e.response ? JSON.stringify(e.response.data) : e.message
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
}
.answer {
  flex: 1;
}
.citations {
  flex: 1;
  max-height: 300px;
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
.drift {
  color: #b00020;
  font-weight: bold;
}
.error {
  color: #b00020;
}
</style>
