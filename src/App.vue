<template>
  <div id="app">
    <h1>FP&amp;A Re-Forecast Copilot</h1>
    <PlanLifecycle @plan-updated="onPlanUpdated" />
    <VarianceBridge :initial-plan-version-id="planVersionId" />
    <WorkflowProgress />
    <CopilotQuery />
  </div>
</template>

<script>
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
      planVersionId: '',
    }
  },
  methods: {
    onPlanUpdated(plan) {
      this.planVersionId = plan.id
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
</style>
