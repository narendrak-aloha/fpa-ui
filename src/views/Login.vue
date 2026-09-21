<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-gray-1 px-4">
    <form
      class="w-full max-w-md space-y-4 rounded-lg border bg-surface-white p-6"
      v-on:submit.prevent="submit"
    >
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">
          {{ $root.config.APP_TITLE }}
        </h1>
        <p class="mt-1 text-sm text-ink-gray-6">
          Enter your bearer token. It identifies you to the API and decides which
          companies you can see. It is held in this tab only, never stored.
        </p>
      </div>

      <FormControl
        v-model="token"
        type="password"
        label="Bearer token"
        placeholder="Enter your token"
        autocomplete="off"
        required
      />

      <ErrorMessage v-bind:message="errorMessage" />

      <Button
        type="submit"
        variant="solid"
        class="w-full"
        v-bind:loading="submitting"
        v-bind:disabled="!token.trim()"
      >
        Check identity
      </Button>

      <div class="border-t pt-4">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
          Local demonstration identities
        </p>
        <ul class="space-y-1">
          <li v-for="identity in $root.config.DEV_TOKENS" v-bind:key="identity.token">
            <button
              type="button"
              class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-gray-2"
              v-on:click="use(identity.token)"
            >
              <span class="font-medium text-ink-gray-8">{{ identity.label }}</span>
              <span class="text-ink-gray-5"> — {{ identity.hint }}</span>
              <code class="ml-1 text-xs text-ink-gray-5">{{ identity.token }}</code>
            </button>
          </li>
        </ul>
      </div>
    </form>
  </div>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import PageTitle from '@/mixins/PageTitle'

export default {
  name: 'Login',

  components: { Button, ErrorMessage, FormControl },

  mixins: [PageTitle],

  data() {
    return {
      token: '',
      submitting: false,
      errorMessage: '',
    }
  },

  methods: {
    // Filling a token in submits it: there is nothing else to fill in.
    use(token) {
      this.token = token
      this.submit()
    },

    async submit() {
      if (!this.token.trim() || this.submitting) return
      this.submitting = true
      this.errorMessage = ''
      const error = await this.$root.handleLogin(this.token)
      this.submitting = false
      if (error) {
        this.errorMessage = error
      }
    },
  },
}
</script>
