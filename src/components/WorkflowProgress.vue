<template>
  <section class="panel">
    <h2>Recompute Progress</h2>

    <div class="row">
      <input v-model="workflowId" placeholder="workflow id" class="wide" />
      <button @click="start" :disabled="polling">Watch</button>
      <button @click="stop" :disabled="!polling">Stop</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="progress">
      <p><strong>phase:</strong> {{ progress.phase }}</p>
      <div class="bar">
        <div class="bar-fill" :style="{ width: fraction + '%' }"></div>
      </div>
      <p>{{ fraction }}% of dirty set evaluated</p>
    </div>
  </section>
</template>

<script>
import { api } from '../api'

export default {
  name: 'WorkflowProgress',
  data() {
    return {
      workflowId: '',
      progress: null,
      error: null,
      polling: false,
      timer: null,
    }
  },
  computed: {
    fraction() {
      if (!this.progress) return 0
      return Math.round(this.progress.dirty_set_fraction_complete * 100)
    },
  },
  beforeUnmount() {
    this.stop()
  },
  methods: {
    start() {
      if (!this.workflowId) return
      this.polling = true
      this.poll()
      this.timer = setInterval(this.poll, 2000)
    },
    stop() {
      this.polling = false
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
    async poll() {
      this.error = null
      try {
        const resp = await api.get(`/workflows/${this.workflowId}/progress`)
        this.progress = resp.data
      } catch (e) {
        this.error = e.response ? JSON.stringify(e.response.data) : e.message
        this.stop()
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
.bar {
  background: #eee;
  border-radius: 4px;
  height: 12px;
  width: 100%;
  overflow: hidden;
}
.bar-fill {
  background: #2c6e49;
  height: 100%;
  transition: width 0.3s ease;
}
.error {
  color: #b00020;
}
</style>
