<template>
  <section class="panel">
    <h2>Plan Version</h2>

    <div class="row">
      <input v-model="planCode" placeholder="plan code, e.g. PV-2026-0001" />
      <button @click="create">Create</button>
    </div>

    <div v-if="plan" class="plan-summary">
      <p><strong>id:</strong> {{ plan.id }}</p>
      <p><strong>state:</strong> {{ plan.state }} (revision {{ plan.revision }})</p>
      <p><strong>requested_by:</strong> {{ plan.requested_by }}</p>
      <p v-if="plan.approved_by"><strong>approved_by:</strong> {{ plan.approved_by }}</p>
      <p v-if="plan.recompute_workflow_id">
        <strong>recompute workflow:</strong> <code>{{ plan.recompute_workflow_id }}</code>
      </p>

      <div class="row">
        <button @click="act('submit')">Submit</button>
        <button @click="act('approve')">Approve</button>
        <button @click="act('reject')">Reject</button>
        <button @click="act('lock')">Lock</button>
      </div>
      <p class="hint">You act as the API key's holder. The API decides whether that identity may make the move.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script>
import { api, errorText } from '../api'

export default {
  name: 'PlanLifecycle',
  emits: ['plan-updated'],
  data() {
    return {
      planCode: '',
      plan: null,
      error: null,
    }
  },
  methods: {
    async create() {
      this.error = null
      try {
        const resp = await api.post('/plan-versions', { plan_code: this.planCode })
        this.plan = resp.data
        this.$emit('plan-updated', this.plan)
      } catch (e) {
        this.error = errorText(e)
      }
    },
    async act(action) {
      this.error = null
      try {
        const resp = await api.post(`/plan-versions/${this.plan.id}/${action}`)
        this.plan = resp.data
        this.$emit('plan-updated', this.plan)
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
input {
  padding: 0.3rem;
}
.hint {
  font-size: 0.85rem;
  color: #555;
}
.error {
  color: #b00020;
}
</style>
