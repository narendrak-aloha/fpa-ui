// Why an action is unavailable to the signed-in user, worked out in the
// browser so a button can say so before it is pressed.
//
// Every function returns '' when the action looks allowed, or a sentence a
// person can act on. None of this is a permission: the API, the workflow and
// the database still decide, and a refusal from them is shown as usual. These
// rules mirror the seeded governance store (plan_state_transition, the
// covenant field guard, the run approval activity); where the server knows
// better, it wins.

// Phases after which a run no longer takes a cancel: the publish has started
const PAST_CANCELLING = ['PUBLISHING', 'COMMITTING', 'COMPENSATING', 'VARIANCE', 'DONE', 'FAILED']

export const RUN_PHASES = [
  { phase: 'SNAPSHOT', label: 'Snapshot' },
  { phase: 'RESOLVING_DIRTY_SET', label: 'Dirty set' },
  { phase: 'RECOMPUTING', label: 'Recompute' },
  { phase: 'SAVING_DRAFT', label: 'Save draft' },
  { phase: 'AWAITING_APPROVAL', label: 'Approval' },
  { phase: 'PUBLISHING', label: 'Publish' },
  { phase: 'COMMITTING', label: 'Commit' },
  { phase: 'VARIANCE', label: 'Variance' },
  { phase: 'DONE', label: 'Done' },
]

// DONE covers every ending (completed, rejected, expired, cancelled); FAILED
// is the one the workflow reports separately.
export function isFinished(phase) {
  return phase === 'DONE' || phase === 'FAILED'
}

function needsRole(user, roles) {
  if (roles.some((role) => user.hasRole(role))) return ''
  return `Needs the ${roles.join(' or ')} role`
}

function isRequester(user, requestedBy) {
  return Boolean(requestedBy) && user.userId === requestedBy
}

export function createPlanBlocker(user) {
  return needsRole(user, ['planner'])
}

// plan.transitions is the server's list of { to_state, role_code } moves out
// of the current state; one target can appear once per role that may make it.
export function planTransitions(plan) {
  const byState = new Map()
  for (const { to_state: state, role_code: role } of plan?.transitions || []) {
    if (!byState.has(state)) byState.set(state, [])
    byState.get(state).push(role)
  }
  return [...byState].map(([state, roles]) => ({ state, roles }))
}

export function transitionBlocker(user, plan, { state, roles }) {
  const missingRole = needsRole(user, roles)
  if (missingRole) return missingRole
  if (state === 'APPROVED') {
    if (isRequester(user, plan.requested_by)) {
      return 'You requested this plan, so someone else must approve it'
    }
    if (!plan.covenant_ok) return 'A controller must record a covenant pass first'
  }
  return ''
}

export function covenantBlocker(user, plan, covenantOk) {
  if (!plan) return 'Load a plan first'
  const missingRole = needsRole(user, ['controller'])
  if (missingRole) return missingRole
  if (plan.state === 'LOCKED') return 'The plan is locked'
  if (!covenantOk && plan.state === 'APPROVED') {
    return 'An approved plan cannot carry a covenant breach'
  }
  return ''
}

export function startRunBlocker(user, plan) {
  const missingRole = needsRole(user, ['planner', 'controller', 'cfo'])
  if (missingRole) return missingRole
  if (plan && !['APPROVED', 'LOCKED'].includes(plan.state)) {
    return `The plan is ${plan.state}; a re-forecast needs an APPROVED or LOCKED plan`
  }
  return ''
}

// successor: the describe() of the version the run drafted into, if loaded.
// One approval takes it IN_REVIEW -> APPROVED -> LOCKED, so the approver needs
// a role for each move: controller and cfo.
export function approveRunBlocker(user, progress, successor) {
  if (progress?.phase !== 'AWAITING_APPROVAL') return 'The run is not waiting for approval'
  if (!user.hasRole('controller') || !user.hasRole('cfo')) {
    return 'Needs both the controller and cfo roles'
  }
  if (isRequester(user, successor?.requested_by)) {
    return 'You started this re-forecast, so someone else must decide it'
  }
  if (successor && !successor.covenant_ok) {
    return 'A controller must record a covenant pass on the successor first'
  }
  return ''
}

export function rejectRunBlocker(user, progress, successor) {
  if (progress?.phase !== 'AWAITING_APPROVAL') return 'The run is not waiting for approval'
  const missingRole = needsRole(user, ['controller'])
  if (missingRole) return missingRole
  if (isRequester(user, successor?.requested_by)) {
    return 'You started this re-forecast, so someone else must decide it'
  }
  return ''
}

export function cancelRunBlocker(progress) {
  if (!progress) return 'Watch a run first'
  if (progress.approval_state === 'CANCELLED') return 'Cancellation already sent'
  if (PAST_CANCELLING.includes(progress.phase)) return `Too late to cancel: the run is at ${progress.phase}`
  return ''
}

export function decideProposalBlocker(user, proposal) {
  if (!proposal) return 'Review the draft first'
  const missingRole = needsRole(user, ['controller', 'cfo'])
  if (missingRole) return missingRole
  if (isRequester(user, proposal.requested_by)) {
    return 'You asked for this proposal, so someone else must decide it'
  }
  if (proposal.state !== 'PENDING') return `Already ${proposal.state.toLowerCase()}`
  return ''
}
