// Single service class for all HTTP calls. App.vue creates one instance and
// exposes it as this.$root.api.
//
// Every method is async and resolves to a normalized object (it never throws):
//   success: { error: false, status, data }
//   failure: { error: true,  status, message }
//
// The backend is the FastAPI app in fpa-project. Authentication is a bearer
// token the human pastes in: there is no login exchange, so the token itself is
// the credential, and GET /v1/me is what says whether it is a good one and what
// it can see. Scope is resolved from that token on the server for every
// request; nothing the browser sends can widen it.
export default class FpaApi {
  constructor() {
    this.urlBase = import.meta.env.VITE_API_BASE_URL || '/api/'
    // Held in memory only, never in localStorage/sessionStorage: the reference
    // page does the same, so a token cannot outlive the tab that typed it.
    this.token = null
  }

  setToken(token) {
    this.token = token || null
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  // Resolves with data: { user_id, display_name, roles, companies, is_human }
  getMe() {
    return this.request('v1/me')
  }

  // Resolves with data: [{ id, configured }], one per model provider
  getProviders() {
    return this.request('v1/providers')
  }

  // ---------------------------------------------------------------------------
  // Read path
  // ---------------------------------------------------------------------------

  // companies narrows the caller's own scope; it can never widen it.
  askQuestion({ query, provider, companies }) {
    return this.request('v1/query', 'POST', {
      body: { query, provider, companies: companies && companies.length ? companies : null },
    })
  }

  // dsl must end in COMPARE PLAN ... TO ACTUAL BRIDGE
  runBridge(dsl) {
    return this.request('v1/bridge', 'POST', { body: { dsl } })
  }

  getCitations(reportId, path, offset = 0) {
    return this.request(`v1/variance-reports/${encodeURIComponent(reportId)}/citations`, 'GET', {
      params: { path, offset, full_rows: 'true' },
    })
  }

  // ---------------------------------------------------------------------------
  // Plan versions and governance
  // ---------------------------------------------------------------------------

  // Every plan version, oldest first, each with the code of the version it
  // re-forecasts (supersedes_plan_version_code) when it is a successor.
  listPlanVersions() {
    return this.request('v1/plan-versions')
  }

  // The driver registry for the model: [{ driver_code, driver_name, status, ... }]
  listDrivers(modelCode = 'FPA-2026') {
    return this.request('v1/drivers', 'GET', { params: { model_code: modelCode } })
  }

  // For a re-forecast successor: the shocks, the planner's reasons, and the
  // bridge from the baseline to this revision. Read-only.
  getPlanImpact(code, scenario = 'base') {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/impact`, 'GET', {
      params: { scenario },
    })
  }

  getPlanVersion(code) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}`)
  }

  createPlanVersion(code) {
    return this.request('v1/plan-versions', 'POST', { body: { plan_version_code: code } })
  }

  // expectedVersion is the row_version last read: a stale one is refused, so
  // two people editing the same plan cannot silently overwrite each other.
  recordCovenant(code, { covenantOk, note, expectedVersion }) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/covenant`, 'PUT', {
      body: { covenant_ok: covenantOk, note, expected_version: expectedVersion },
    })
  }

  transitionPlan(code, { toState, note, expectedVersion }) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/transition`, 'POST', {
      body: { to_state: toState, note, expected_version: expectedVersion },
    })
  }

  // ---------------------------------------------------------------------------
  // Re-forecast (Temporal)
  // ---------------------------------------------------------------------------

  // reason is the planner's rationale; the server keeps it in the audit log for
  // the approver and leaves it out of the computation.
  startReforecast({ planVersionCode, driverCode, fromValue, toValue, reason = '' }) {
    return this.request('v1/reforecast', 'POST', {
      body: {
        plan_version_code: planVersionCode,
        driver_code: driverCode,
        from_value: fromValue,
        to_value: toValue,
        reason,
      },
    })
  }

  getProgress(code) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/progress`)
  }

  // Past and present runs from the durable record, newest first
  getRuns(code) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/runs`)
  }

  decideRun(code, { approved, comment }) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/decision`, 'POST', {
      body: { approved, comment },
    })
  }

  cancelRun(code) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/cancel`, 'POST')
  }

  // ---------------------------------------------------------------------------
  // Agent proposals (a paused agent run, awaiting a second human)
  // ---------------------------------------------------------------------------

  getProposal(proposalId) {
    return this.request(`v1/agent-proposals/${encodeURIComponent(proposalId)}`)
  }

  decideProposal(proposalId, approved) {
    return this.request(`v1/agent-proposals/${encodeURIComponent(proposalId)}/decision`, 'POST', {
      body: { approved },
    })
  }

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  async request(endpoint, method = 'GET', { params = null, body = null } = {}) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    const url = `${this.urlBase}${endpoint}${query}`

    let status = 0
    let json = {}
    try {
      const response = await fetch(url, this.prepareFetchInit(method, body))
      status = response.status
      json = await response.json().catch(() => ({}))
    } catch (err) {
      return { error: true, status, message: 'Server unavailable. Please try again.' }
    }

    if (status < 200 || status >= 300) {
      return { error: true, status, message: this.extractErrorMessage(json, status) }
    }
    return { error: false, status, data: json }
  }

  prepareFetchInit(method, body) {
    const headers = new Headers({ Accept: 'application/json' })
    if (this.token) {
      headers.append('Authorization', `Bearer ${this.token}`)
    }
    const init = { method, headers }
    if (body !== null) {
      headers.append('Content-Type', 'application/json')
      init.body = JSON.stringify(body)
    }
    return init
  }

  extractErrorMessage(json, status) {
    // FastAPI puts errors in "detail": a string, or a list of validation errors
    if (typeof json?.detail === 'string') return json.detail
    if (Array.isArray(json?.detail)) return json.detail.map((d) => d.msg).join('; ')
    if (json?.detail) return JSON.stringify(json.detail)
    if (status === 401 || status === 403) return 'That token is not accepted.'
    return json?.message || `Request failed (${status})`
  }
}
