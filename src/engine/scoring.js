/**
 * Release Readiness Scoring Engine
 * 
 * Deterministic and explainable scoring model:
 * Readiness = 100 - (W_b * B) - (W_d * D) - (W_s * S) - (W_q * Q)
 * 
 * Where:
 * - B = Unresolved release blockers
 * - D = Unresolved cross-team dependencies (Teamwork Graph linked)
 * - S = Security Readiness Gate findings (Critical credentials / PII)
 * - Q = Quality defects (Sev-1/2 defects, unverified tests, missing sign-offs)
 */

export const DEFAULT_WEIGHTS = {
  blocker: 15,          // Per open blocker ticket
  dependency: 12,       // Per unresolved cross-team link
  securityCritical: 25, // Critical credential / private key leak
  securityReview: 10,   // Sensitive token or PII review required
  severityDefect: 15,   // Sev-1 / Sev-2 unverified defect
  missingApproval: 10   // Missing QA / Security sign-off
};

/**
 * Evaluates readiness signals and computes an auditable score, breakdown, and remediation plan.
 */
export function calculateReadiness(signals, customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  const blockers = signals.blockers || [];
  const dependencies = signals.dependencies || [];
  const securityFindings = (signals.securityGate && signals.securityGate.findings) || [];
  const severeDefects = signals.severeDefects || [];
  const approvals = signals.approvals || { qaApproved: true, securityApproved: true };

  const auditDeductions = [];

  // 1. Blocker Deductions (B)
  for (const b of blockers) {
    auditDeductions.push({
      ruleId: 'RULE-BLK-01',
      ruleName: 'Unresolved Release Blocker',
      pointsDeducted: weights.blocker,
      affectedKey: b.key,
      summary: b.summary,
      owner: b.assignee || 'Unassigned',
      actionRequired: 'Resolve ticket or obtain documented waiver from release manager.',
      evidence: `Priority: ${b.priority}`
    });
  }

  // 2. Cross-Team Dependency Deductions (D - Teamwork Graph)
  for (const d of dependencies) {
    if (d.status !== 'Done' && d.status !== 'Resolved') {
      auditDeductions.push({
        ruleId: 'RULE-DEP-02',
        ruleName: 'Pending Cross-Team Dependency',
        pointsDeducted: weights.dependency,
        affectedKey: d.key,
        summary: d.target,
        owner: d.owner || 'Core Services Team',
        actionRequired: 'Coordinate with owning team to verify deployment completion.',
        evidence: `Dependency Status: ${d.status} (Teamwork Graph linked)`
      });
    }
  }

  // 3. Security Readiness Gate Deductions (S)
  for (const f of securityFindings) {
    const isCritical = f.severity === 'CRITICAL';
    auditDeductions.push({
      ruleId: isCritical ? 'RULE-SEC-01' : 'RULE-SEC-02',
      ruleName: isCritical ? 'Critical Credential Exposure' : 'Sensitive Data / PII Review Required',
      pointsDeducted: isCritical ? weights.securityCritical : weights.securityReview,
      affectedKey: f.issueKey,
      summary: f.type,
      owner: 'Security & Dev Lead',
      actionRequired: isCritical ? 'Rotate compromised secret immediately; purge plaintext from history.' : 'Review data classification and verify redaction.',
      evidence: f.sampleRedacted
    });
  }

  // 4. Quality & Defect Deductions (Q)
  for (const def of severeDefects) {
    auditDeductions.push({
      ruleId: 'RULE-QAL-01',
      ruleName: 'Unresolved High-Severity Defect',
      pointsDeducted: weights.severityDefect,
      affectedKey: def.key,
      summary: def.summary,
      owner: def.assignee || 'QA Team',
      actionRequired: 'Fix defect and pass regression test suite.',
      evidence: `Severity: ${def.priority}`
    });
  }

  if (!approvals.qaApproved) {
    auditDeductions.push({
      ruleId: 'RULE-APV-01',
      ruleName: 'Missing QA Lead Approval',
      pointsDeducted: weights.missingApproval,
      affectedKey: 'QA-SIGNOFF',
      summary: 'Formal QA sign-off missing',
      owner: 'QA Lead',
      actionRequired: 'Complete test run verification and submit sign-off.',
      evidence: 'QA approval status: Pending'
    });
  }

  if (!approvals.securityApproved) {
    auditDeductions.push({
      ruleId: 'RULE-APV-02',
      ruleName: 'Missing Security Sign-off',
      pointsDeducted: weights.missingApproval,
      affectedKey: 'SEC-SIGNOFF',
      summary: 'Security Clearance Gate blocked',
      owner: 'Security Lead',
      actionRequired: 'Review flagged credentials and clear gate.',
      evidence: 'Security clearance: Held'
    });
  }

  // Compute Total Score
  const totalDeductions = auditDeductions.reduce((sum, item) => sum + item.pointsDeducted, 0);
  const rawScore = 100 - totalDeductions;
  const finalScore = Math.max(0, Math.min(100, rawScore));

  // Determine Recommendation
  const criticalSecCount = securityFindings.filter(f => f.severity === 'CRITICAL').length;
  let recommendation = 'GO';
  let recommendationLabel = 'Ready to Ship';

  if (criticalSecCount > 0 || blockers.length > 0 || finalScore < 70) {
    recommendation = 'NO_GO';
    recommendationLabel = 'Release Blocked (NO-GO)';
  } else if (finalScore < 90 || securityFindings.length > 0 || !approvals.qaApproved || !approvals.securityApproved) {
    recommendation = 'CONDITIONAL_GO';
    recommendationLabel = 'Conditional Go (Review Required)';
  }

  // Reasons list for concise summaries
  const reasons = auditDeductions.map(d => `-${d.pointsDeducted} pts [${d.ruleId}]: ${d.affectedKey} (${d.ruleName}) -> ${d.actionRequired}`);

  if (reasons.length === 0) {
    reasons.push('All release gates cleared: 0 blockers, 0 dependencies pending, security clearance verified.');
  }

  return {
    score: finalScore,
    rawScore,
    totalDeductions,
    recommendation,
    recommendationLabel,
    auditDeductions,
    counts: {
      blockersCount: blockers.length,
      dependenciesCount: dependencies.length,
      criticalSecurityCount: criticalSecCount,
      reviewSecurityCount: securityFindings.filter(f => f.severity === 'REVIEW').length,
      severeDefectsCount: severeDefects.length
    },
    reasons,
    evaluatedAt: new Date().toISOString()
  };
}
