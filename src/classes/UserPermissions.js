// Holds the signed-in human's session. App.vue creates one instance and
// exposes it as this.$root.user.
//
// There is no login exchange: the human pastes a bearer token and the server
// says who that is (GET /v1/me). Roles and companies are kept for display
// only — the API re-resolves scope from the token on every request, so nothing
// here is a permission, just a label.
//
// The token lives in memory. It is deliberately not persisted: a refresh means
// entering it again, and a token cannot be left behind in browser storage for
// the next person at this machine.
export default class UserPermissions {
  token = null
  userId = null
  fullName = null
  roles = []
  companies = []

  constructor(api) {
    // api: the shared FpaApi instance
    this.api = api
  }

  // Resolves to { error: false } when the token is accepted, or
  // { error: true, message } when it is not. A rejected token is discarded.
  async authenticate(token) {
    const trimmed = (token || '').trim()
    if (!trimmed) {
      return { error: true, message: 'Enter your bearer token first.' }
    }
    this.api.setToken(trimmed)
    const response = await this.api.getMe()
    if (response.error) {
      this.clear()
      return response
    }
    this.token = trimmed
    this.setupUser(response.data)
    return response
  }

  // data: the /v1/me response
  setupUser({ user_id, display_name, roles, companies }) {
    this.userId = user_id
    this.fullName = display_name
    this.roles = roles || []
    this.companies = companies || []
  }

  async logout() {
    // Nothing to tell the server: the token is the whole session, and dropping
    // it here ends it for this tab.
    this.clear()
  }

  isAuthenticated() {
    return this.token !== null
  }

  hasRole(role) {
    return this.roles.includes(role)
  }

  // The identity line the header shows, in the same shape as the reference page
  describe() {
    if (!this.isAuthenticated()) return ''
    return [this.fullName, this.roles.join(', '), this.companies.join(', ')]
      .filter(Boolean)
      .join(' · ')
  }

  clear() {
    this.token = null
    this.userId = null
    this.fullName = null
    this.roles = []
    this.companies = []
    this.api.setToken(null)
  }
}
