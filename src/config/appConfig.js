// App-wide constants. Loaded into this.$root.config by App.vue
const appConfig = {
  APP_TITLE: 'FP&A',

  // true: routes need a token. The FastAPI backend refuses every request
  // without one either way, so turning this off only hides the token screen.
  AUTH_ENABLED: true,

  // How often the re-forecast progress query is polled while a run is going
  PROGRESS_POLL_INTERVAL: 2000,

  // Local demonstration identities, offered on the token screen. Each is a real
  // row in the governance store; what each may do is decided there, not here.
  DEV_TOKENS: [
    { token: 'tok-analyst-pl', label: 'Poland analyst', hint: 'reads Poland only' },
    { token: 'tok-planner', label: 'Planner', hint: 'authors plans, starts a re-forecast' },
    { token: 'tok-controller', label: 'Controller', hint: 'records covenant verdicts, approves plans' },
    { token: 'tok-cfo', label: 'CFO', hint: 'locks plans, decides a parked run' },
  ],

  // Model providers, in the order they are offered
  PROVIDERS: [
    { id: 'claude-code', label: 'Claude (subscription)', title: 'Uses your Claude Code login, no API key needed' },
    { id: 'claude-api', label: 'Claude API key', title: 'Needs ANTHROPIC_API_KEY' },
    { id: 'gemini', label: 'Gemini', title: 'Needs GOOGLE_API_KEY' },
  ],

  // Questions offered as one-click examples
  EXAMPLES: [
    'What was services revenue by practice in Q2 2026?',
    'Show gross margin % by geo region for 2026-Q2',
    'Delivery cost by country for Q2 2026',
    'Compare base plan vs actual services revenue by company for 2026-Q2',
  ],

  // Runs straight through the compiler, with no model involved
  DIRECT_EXAMPLES: ['SELECT services_revenue BY company FOR PERIOD 2026-Q2'],

  DEFAULT_PLAN_CODE: 'PV-2026-0001',

  // Remembered between visits; the token never is
  PROVIDER_STORAGE_KEY: 'fpa-provider',
}

export default appConfig
