<template>
  <div id="app">
    <h1>FP&amp;A Re-Forecast Copilot</h1>
    <section class="identity">
      <label>
        API key
        <input v-model="apiKey" type="password" autocomplete="off" placeholder="API key" @input="onApiKey" />
      </label>
      <span class="hint">Every request acts as this key's holder; the API decides what that identity may see and do.</span>
    </section>
    <PlanLifecycle @plan-updated="onPlanUpdated" />
    <VarianceBridge :initial-plan-version-id="planVersionId" />
    <WorkflowProgress :initial-workflow-id="workflowId" />
    <CopilotQuery />
  </div>
</template>

<script>
import { setApiKey } from './api'
import PlanLifecycle from './components/PlanLifecycle.vue'
import VarianceBridge from './components/VarianceBridge.vue'
import WorkflowProgress from './components/WorkflowProgress.vue'
import CopilotQuery from './components/CopilotQuery.vue'

export default {
  name: 'App',
  components: {
    PlanLifecycle,
    VarianceBridge,
    WorkflowProgress,
    CopilotQuery,
  },
  data() {
    return {
      apiKey: '',
      planVersionId: '',
      workflowId: '',
    }
  },
  methods: {
    onApiKey() {
      setApiKey(this.apiKey)
    },
    onPlanUpdated(plan) {
      this.planVersionId = plan.id
      if (plan.recompute_workflow_id) this.workflowId = plan.recompute_workflow_id
    },
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  max-width: 900px;
  margin: 40px auto;
  padding: 0 1rem;
}
.identity {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.identity .hint {
  font-size: 0.85rem;
  color: #555;
}
</style>
