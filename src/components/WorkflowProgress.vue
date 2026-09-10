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
      <p><strong>requested by:</strong> {{ progress.requested_by }} &mdash; plan version {{ progress.plan_version_id }}, revision {{ progress.revision }}</p>
      <div class="bar">
        <div class="bar-fill" :style="{ width: fraction + '%' }"></div>
      </div>
      <p>{{ fraction }}% of dirty set evaluated</p>

      <div class="row">
        <input v-model="reason" placeholder="rejection reason (optional)" />
        <button @click="signal('approve')">Approve recompute</button>
        <button @click="signal('reject')">Reject recompute</button>
      </div>
      <p class="hint">
        Nothing publishes -- and no variance report is written -- until a controller other than the requester
        approves. The wait expires on a timeout.
      </p>
      <p v-if="actionError" class="error">{{ actionError }}</p>
      <p v-if="signalled" class="hint">signalled: {{ signalled }}</p>
    </div>
  </section>
</template>

<script>
import { api, errorText } from '../api'

export default {
  name: 'WorkflowProgress',
  props: {
    initialWorkflowId: { type: String, default: '' },
  },
  data() {
    return {
      workflowId: this.initialWorkflowId,
      reason: '',
      progress: null,
      error: null,
      actionError: null,
      signalled: null,
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
  watch: {
    initialWorkflowId(v) {
      if (!v) return
      this.stop()
      this.workflowId = v
      this.progress = null
      this.signalled = null
      this.error = null
      this.actionError = null
    },
  },
  beforeUnmount() {
    this.stop()
  },
  methods: {
    async signal(action) {
      this.actionError = null
      const body = action === 'reject' ? { reason: this.reason } : {}
      try {
        await api.post(`/workflows/${this.workflowId}/${action}`, body)
        this.signalled = action
        this.poll()
      } catch (e) {
        // Kept apart from the poll's error so the next successful poll
        // doesn't wipe the API's refusal off the screen.
        this.actionError = errorText(e)
      }
    },
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
      try {
        const resp = await api.get(`/workflows/${this.workflowId}/progress`)
        this.progress = resp.data
        this.error = null
        if (this.progress.phase === 'done') this.stop()
      } catch (e) {
        this.error = errorText(e)
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
.hint {
  font-size: 0.85rem;
  color: #555;
}
</style>
