---
name: frontend-guardrails
description: Enforceable guardrails for the fpa_fe Vue interface to the FP&A Re-Forecast Copilot (DSL beside answer, bridge waterfall with residual, drill-through to cube rows + vintage, live Temporal progress, Approve/Reject/Lock). Use when reviewing frontend code AND when adding or changing any component, view, API call, or state in fpa_fe — build to these rules instead of inventing new ones. Trigger on any work under fpa_fe/src, App.vue, api.js, or the components directory.
---

# Frontend guardrails

Two modes, same rules:

- **Reviewing** — walk the sections the diff touches, report each violation as `file:line` + which rule + what breaks. A rule with no violation is not worth mentioning.
- **Building** — these constrain the implementation. The most common violation is *building more than was asked for*; if a request implies scope beyond §1, say so before writing code.

---

## 1. Exactly five things — scope is the primary guardrail

This UI exists to demonstrate five capabilities, and nothing else:

1. **The DSL shown beside the answer** — the planner sees the query that produced the number.
2. **Bridge waterfall with the residual displayed** — every leg plus the residual.
3. **Drill-through** from a bridge line to the underlying cube rows **and the vintage they were read at**.
4. **Live Temporal progress** via the workflow's progress query.
5. **Approve / Reject / Lock** buttons calling the permission-checked API endpoints.

Anything else — dashboards, charts, filters, settings pages, auth screens, a design system, dark mode, animations — is out of scope. The backend variance bridge is where the evaluation weight sits; **frontend work must not consume time from it**. If a change doesn't serve one of the five, don't build it.

## 2. No business logic, no permission logic, in the UI

- The Approve/Reject/Lock buttons call the **same permission-checked endpoints the API enforces**. The UI must not implement its own version of who-can-do-what.
- Do not pre-hide or pre-disable an action based on UI-side reasoning about roles, actor identity, self-approval, covenant state, or legal state transitions. The API is the authority.
- **Surface the API's refusal.** A 403 (self-approval, covenant breach) or 409 (illegal transition) must be visible to the user with its message, not swallowed, not retried, not translated into a generic "something went wrong".
- Never reimplement state-machine rules (`Draft → In-Review → Approved → Locked`) client-side as validation. Render the state the API returns.

## 3. Never round, hide, or beautify the numbers

- **The residual is displayed, always, unrounded.** Never format it away, never collapse a small residual to zero, never hide it behind a toggle. It's the proof the bridge ties.
- Every bridge leg is shown even when it is small. A leg the UI omits is a leg nobody can tell is broken.
- **The vintage is displayed** wherever a bridge report or drill-through result is shown — vintage is part of the answer, not a database detail.
- Don't apply client-side arithmetic to server numbers (no re-summing legs, no deriving a total the API didn't send). Display what the API returned.

## 4. The API is the only data source

- All data comes from the backend HTTP API via `src/api.js`. No direct ClickHouse, no direct Postgres, no constructing SQL, no constructing DSL that bypasses an endpoint.
- API base URL comes from the environment (`VUE_APP_API_BASE`), never hardcoded to a host.
- **No secrets, API keys, or credentials in committed source.** The copilot API key is entered by the user at runtime; it is never a default value in code, and never logged.
- New backend capability needed? Add the endpoint on the backend and call it — don't work around a missing endpoint with client-side assembly of multiple calls into business logic.

## 5. Errors must stay diagnosable

- Show the backend's error text rather than a generic message. A real drill-through bug (a `FixedString` encoding mismatch) was only found because the UI surfaced the ClickHouse error verbatim.
- Handle the states each panel can actually be in: loading, empty (no reports for this plan), not-found (404 on an unknown workflow id), and failed. An unhandled 404 that renders as a blank panel is a violation.
- Don't catch-and-ignore. If a call fails, the user sees that it failed.

## 6. Keep the stack as-is

- Vue 3 via the existing `vue-cli` scaffold, `axios` for HTTP. That's the whole stack.
- No UI framework, no CSS framework, no state management library, no router unless one of the five things genuinely requires it. Styling is whatever makes the numbers readable — the brief explicitly doesn't grade CSS.
- Don't add dependencies to `package.json` without a reason tied to §1.
- Components stay flat under `src/components/`, one per capability, talking to `src/api.js`.

## 7. Verify in a real browser

- A frontend change is not done until it has been exercised in a browser against the running backend — golden path and the obvious edge cases (unknown id, empty result, a refused action).
- If it can't be verified that way in the current environment, say so explicitly rather than reporting success.
- When driving a headless browser for verification, always launch with an isolated `--user-data-dir` and a non-default `--remote-debugging-port`. Without them Chrome silently merges into the user's real running profile with their live tabs and sessions.
