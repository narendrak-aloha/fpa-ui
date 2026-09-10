<template>
  <section class="panel">
    <h2>Plan Version</h2>

    <div class="row">
      <input v-model="planCode" placeholder="plan code, e.g. PV-2026-Q2" />
      <input v-model="requestedBy" placeholder="requested by" />
      <button @click="create">Create</button>
    </div>

    <div v-if="plan" class="plan-summary">
      <p><strong>id:</strong> {{ plan.id }}</p>
      <p><strong>state:</strong> {{ plan.state }}</p>
      <p><strong>requested_by:</strong> {{ plan.requested_by }}</p>
      <p v-if="plan.approved_by"><strong>approved_by:</strong> {{ plan.approved_by }}</p>

      <div class="row">
        <input v-model="actor" placeholder="acting as" />
        <button @click="act('submit')" :disabled="plan.state !== 'Draft'">Submit</button>
        <button @click="act('approve')" :disabled="plan.state !== 'In-Review'">Approve</button>
        <button @click="act('reject')" :disabled="plan.state !== 'In-Review'">Reject</button>
        <button @click="act('lock')" :disabled="plan.state !== 'Approved'">Lock</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script>
import { api } from '../api'

export default {
  name: 'PlanLifecycle',
  emits: ['plan-updated'],
  data() {
    return {
      planCode: '',
      requestedBy: 'alice',
      actor: 'bob',
      plan: null,
      error: null,
    }
  },
  methods: {
    async create() {
      this.error = null
      try {
        const resp = await api.post('/plan-versions', {
          plan_code: this.planCode,
          requested_by: this.requestedBy,
        })
        this.plan = resp.data
        this.$emit('plan-updated', this.plan)
      } catch (e) {
        this.error = e.response ? e.response.data.detail : e.message
      }
    },
    async act(action) {
      this.error = null
      try {
        const resp = await api.post(`/plan-versions/${this.plan.id}/${action}`, {
          actor: this.actor,
        })
        this.plan = resp.data
        this.$emit('plan-updated', this.plan)
      } catch (e) {
        this.error = e.response ? e.response.data.detail : e.message
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
.error {
  color: #b00020;
}
</style>
