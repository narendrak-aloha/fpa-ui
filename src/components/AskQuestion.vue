<template>
  <section class="rounded-lg border bg-surface-white">
    <form class="space-y-4 p-4" v-on:submit.prevent="ask">
      <FormControl
        v-model="question"
        type="textarea"
        label="Your question"
        placeholder="e.g. What was services revenue by practice in Q2 2026?"
        v-bind:rows="3"
        v-bind:maxlength="8000"
        v-on:keydown="onKeydown"
      />

      <div class="flex flex-wrap items-end justify-between gap-3">
        <fieldset>
          <legend class="mb-1 text-sm font-medium text-ink-gray-7">Answered by</legend>
          <div class="flex flex-wrap gap-3">
            <label
              v-for="option in $root.config.PROVIDERS"
              v-bind:key="option.id"
              class="flex items-center gap-1.5 text-sm"
              v-bind:class="isConfigured(option.id) ? 'text-ink-gray-8' : 'text-ink-gray-4'"
              v-bind:title="isConfigured(option.id) ? option.title : 'Not set up on this server'"
            >
              <input type="radio" v-bind:value="option.id" v-model="provider" />
              {{ option.label }}
            </label>
          </div>
        </fieldset>

        <Button type="submit" variant="solid" v-bind:disabled="!canAsk" v-bind:loading="asking">
          Ask
        </Button>
      </div>

      <details>
        <summary class="cursor-pointer text-sm text-ink-gray-6">Narrow to certain companies</summary>
        <div class="mt-2">
          <FormControl
            v-model="companies"
            label="Company codes, comma-separated"
            placeholder="e.g. RTUS1, RTUK1"
          />
          <p class="mt-1 text-xs text-ink-gray-5">
            This can only narrow what your token already allows, never widen it.
          </p>
        </div>
      </details>
    </form>

    <div class="space-y-3 border-t p-4">
      <div>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">Try one of these</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="example in $root.config.EXAMPLES"
            v-bind:key="example"
            type="button"
            class="rounded-full border px-3 py-1 text-sm text-ink-gray-7 hover:bg-surface-gray-2"
            v-bind:disabled="asking"
            v-on:click="askThis(example)"
          >
            {{ example }}
          </button>
        </div>
      </div>
      <div>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
          Quick test, no AI needed
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="example in $root.config.DIRECT_EXAMPLES"
            v-bind:key="example"
            type="button"
            class="rounded-full border px-3 py-1 font-mono text-xs text-ink-gray-7 hover:bg-surface-gray-2"
            v-bind:disabled="asking"
            v-on:click="askThis(example)"
          >
            {{ example }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="asking" class="flex items-center gap-2 border-t p-4 text-sm text-ink-gray-6">
      <LoadingIndicator class="h-4 w-4" />
      Working on your answer. This usually takes 30–60 seconds.
    </p>
  </section>
</template>

<script>
import { Button, FormControl, LoadingIndicator } from 'frappe-ui'

export default {
  name: 'AskQuestion',

  components: { Button, FormControl, LoadingIndicator },

  emits: ['answered', 'asking'],

  data() {
    return {
      question: '',
      companies: '',
      provider: this.$root.config.PROVIDERS[0].id,
      // [{ id, configured }] from the server; an unconfigured provider is
      // greyed out rather than hidden, so it is clear why it is unavailable.
      providerStatus: [],
      asking: false,
    }
  },

  computed: {
    canAsk() {
      return this.question.trim().length > 0 && !this.asking
    },
  },

  mounted() {
    this.restoreProvider()
    this.loadProviders()
  },

  watch: {
    provider(value) {
      try {
        localStorage.setItem(this.$root.config.PROVIDER_STORAGE_KEY, value)
      } catch (e) {
        // storage unavailable; the choice lasts for this visit only
      }
    },
  },

  methods: {
    restoreProvider() {
      try {
        const saved = localStorage.getItem(this.$root.config.PROVIDER_STORAGE_KEY)
        if (saved && this.$root.config.PROVIDERS.some((p) => p.id === saved)) {
          this.provider = saved
        }
      } catch (e) {
        // storage unavailable; keep the default
      }
    },

    async loadProviders() {
      const response = await this.$root.api.getProviders()
      if (!response.error) {
        this.providerStatus = response.data
      }
    },

    isConfigured(id) {
      const found = this.providerStatus.find((p) => p.id === id)
      return found ? found.configured : true
    },

    askThis(example) {
      this.question = example
      this.ask()
    },

    onKeydown(event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        this.ask()
      }
    },

    async ask() {
      if (!this.canAsk) return
      const query = this.question.trim()
      this.asking = true
      this.$emit('asking')

      const response = await this.$root.callAuthenticatedEndpoint('askQuestion', {
        query,
        provider: this.provider,
        companies: this.companies.split(',').map((s) => s.trim()).filter(Boolean),
      })
      this.asking = false

      // A transport failure is shown in the same panel as a refusal, so the
      // page has one place where an answer appears, whatever happened.
      this.$emit('answered', {
        query,
        result: response.error
          ? {
              agent_response: {
                execution_status: 'REQUEST_ERROR',
                error_message: response.message,
                cited_data_rows: [],
              },
            }
          : response.data,
      })
    },
  },
}
</script>
