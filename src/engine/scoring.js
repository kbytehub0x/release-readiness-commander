/**
 * Release Readiness Scoring Engine
 * 
 * Deterministic and explainable scoring model:
 * Readiness = 100 - (W_b * B) - (W_d * D) - (W_s * S) - (W_q * Q)
 * 
 * Where:
 * - B = Unresolved release blockers
 * - D = Unresolved cross-team dependencies
 * - S = Security gate findings (critical/review)
 * - Q = Open Sev-1/Sev-2 defects or missing QA approvals
 */

// Configurable policy weights
export const DEFAULT_WEIGHTS = {
  blocker: 15,          // Per open blocker ticket
  dependency: 12,       // Per unresolved cross-team link
  securityCritical: 25, // Critical credential / private key leak
  securityReview: 10,   // Sensitive token or PII review required
  severityDefect: 15,   // Sev-1 / Sev-2 unverified defect
  missingApproval: 10   // Missing QA / Security sign-off
};

/**
 * Evaluates readiness signals and computes a deterministic score and recommendation.
 * 
 * @param {Object} signals
 * @param {Array} signals.blockers - Array of unresolved blocker issues [{key, summary, priority}]
 * @param {Array} signals.dependencies - Array of external dependency items [{key, target, status}]
 * @param {Object} signals.securityGate - Security scan output {status, findings: [{type, severity, sourceKey, snippet}]}
 * @param {Array} signals.severeDefects - Open Sev-1 or Sev-2 bugs [{key, summary, severity}]
 * @param {Object} signals.approvals - Sign-off flags {qaApproved: boolean, securityApproved: boolean}
 * @param {Object} [customWeights] - Optional custom weights
 * @returns {Object} Full explainable evaluation
 */
export function calculateReadiness(signals, customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  const blockers = signals.blockers || [];
  const dependencies = signals.dependencies || [];
  const securityFindings = (signals.securityGate && signals.securityGate.findings) || [];
  const severeDefects = signals.severeDefects || [];
  const approvals = signals.approvals || { qaApproved: true, securityApproved: true };

  // Breakdown calculations
  const blockerDeduction = blockers.length * weights.blocker;
  const dependencyDeduction = dependencies.filter(d => d.status !== 'Done' && d.status !== 'Resolved').length * weights.dependency;

  let securityDeduction = 0;
  const criticalSecurity = securityFindings.filter(f => f.severity === 'CRITICAL');
  const reviewSecurity = securityFindings.filter(f => f.severity === 'REVIEW');
  securityDeduction += criticalSecurity.length * weights.securityCritical;
  securityDeduction += reviewSecurity.length * weights.securityReview;

  const defectDeduction = severeDefects.length * weights.severityDefect;

  let approvalDeduction = 0;
  if (!approvals.qaApproved) approvalDeduction += weights.missingApproval;
  if (!approvals.securityApproved) approvalDeduction += weights.missingApproval;

  const totalDeductions = blockerDeduction + dependencyDeduction + securityDeduction + defectDeduction + approvalDeduction;
  const rawScore = 100 - totalDeductions;
  const finalScore = Math.max(0, Math.min(100, rawScore));

  // Determine Recommendation
  // Hard gates: Any CRITICAL security finding or any Blocker forces NO-GO
  let recommendation = 'GO';
  let recommendationLabel = 'Ready to Ship';
  let recommendationVariant = 'success';

  if (criticalSecurity.length > 0 || blockers.length > 0 || finalScore < 70) {
    recommendation = 'NO_GO';
    recommendationLabel = 'Release Blocked';
    recommendationVariant = 'error';
  } else if (finalScore < 90 || reviewSecurity.length > 0 || !approvals.qaApproved || !approvals.securityApproved) {
    recommendation = 'CONDITIONAL_GO';
    recommendationLabel = 'Conditional Go (Review Required)';
    recommendationVariant = 'warning';
  }

  // Generate Human-Readable Explanations for the Rovo Agent & Cockpit
  const reasons = [];

  if (blockers.length > 0) {
    reasons.push(`${blockers.length} unresolved release blocker(s): ${blockers.map(b => b.key).join(', ')}`);
  }
  if (dependencies.length > 0) {
    const pendingDeps = dependencies.filter(d => d.status !== 'Done');
    if (pendingDeps.length > 0) {
      reasons.push(`${pendingDeps.length} open cross-team dependency link(s) pending resolution`);
    }
  }
  if (criticalSecurity.length > 0) {
    reasons.push(`SECURITY GATE BLOCKED: ${criticalSecurity.length} critical exposed secret(s) detected`);
  } else if (reviewSecurity.length > 0) {
    reasons.push(`Security Gate Notice: ${reviewSecurity.length} finding(s) require review (redacted in report)`);
  }
  if (severeDefects.length > 0) {
    reasons.push(`${severeDefects.length} open Sev-1/Sev-2 defect(s) pending resolution`);
  }
  if (!approvals.qaApproved) {
    reasons.push('Missing QA lead sign-off approval');
  }
  if (!approvals.securityApproved) {
    reasons.push('Missing Security lead sign-off approval');
  }

  if (reasons.length === 0) {
    reasons.push('All readiness gates passed with zero unresolved blockers or security issues.');
  }

  return {
    score: finalScore,
    recommendation,
    recommendationLabel,
    recommendationVariant,
    breakdown: {
      blockerDeduction,
      dependencyDeduction,
      securityDeduction,
      defectDeduction,
      approvalDeduction
    },
    counts: {
      blockersCount: blockers.length,
      dependenciesCount: dependencies.length,
      criticalSecurityCount: criticalSecurity.length,
      reviewSecurityCount: reviewSecurity.length,
      severeDefectsCount: severeDefects.length
    },
    reasons,
    evaluatedAt: new Date().toISOString()
  };
}
