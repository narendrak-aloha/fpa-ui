<template>
  <header class="border-b bg-surface-white">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div>
        <h1 class="text-lg font-semibold text-ink-gray-9">{{ $root.config.APP_TITLE }} Query</h1>
        <!-- Who the token resolved to, and what it can see. This is the
             server's answer, not a claim the browser makes. -->
        <p class="text-sm text-ink-gray-6" role="status">{{ identity }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="ghost" v-on:click="$root.toggleTheme()">{{ themeLabel }}</Button>
        <Avatar v-bind:label="$root.user.fullName || ''" size="md" />
        <Button variant="ghost" v-bind:loading="loggingOut" v-on:click="handleLogout">
          Sign out
        </Button>
      </div>
    </div>
  </header>
</template>

<script>
import { Avatar, Button } from 'frappe-ui'

export default {
  name: 'AppHeader',

  components: { Avatar, Button },

  data() {
    return {
      loggingOut: false,
    }
  },

  computed: {
    identity() {
      return this.$root.user.describe()
    },

    themeLabel() {
      return this.$root.resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'
    },
  },

  methods: {
    async handleLogout() {
      this.loggingOut = true
      await this.$root.logout()
      this.loggingOut = false
    },
  },
}
</script>
