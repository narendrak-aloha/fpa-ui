<template>
  <div class="min-h-screen bg-surface-gray-1">
    <AppHeader />

    <main class="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <AskQuestion v-on:asking="clear" v-on:answered="show" />

      <AnswerPanel
        v-if="asked"
        v-bind:query="asked.query"
        v-bind:result="asked.result"
        v-on:bridge="runBridge"
      />

      <BridgeReport v-if="bridgeRequest" v-bind:request="bridgeRequest" />

      <PlanWorkbench />
    </main>
  </div>
</template>

<script>
import AnswerPanel from '@/components/AnswerPanel.vue'
import AppHeader from '@/components/AppHeader.vue'
import AskQuestion from '@/components/AskQuestion.vue'
import BridgeReport from '@/components/BridgeReport.vue'
import PlanWorkbench from '@/components/PlanWorkbench.vue'
import PageTitle from '@/mixins/PageTitle'

export default {
  name: 'Home',

  components: { AnswerPanel, AppHeader, AskQuestion, BridgeReport, PlanWorkbench },

  mixins: [PageTitle],

  data() {
    return {
      // { query, result } — the last answer, kept whole so the explanation
      // panel can show exactly what the server returned.
      asked: null,
      // { dsl, nonce }: the nonce makes running the same DSL twice a new request
      bridgeRequest: null,
    }
  },

  methods: {
    clear() {
      this.asked = null
      this.bridgeRequest = null
    },

    show(answer) {
      this.asked = answer
    },

    runBridge(dsl) {
      this.bridgeRequest = { dsl, nonce: Date.now() }
    },
  },
}
</script>
