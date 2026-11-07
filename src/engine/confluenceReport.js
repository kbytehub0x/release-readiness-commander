import crypto from 'crypto';

/**
 * Generates Confluence Storage Format (XHTML) for an executive Release Readiness Brief.
 * 
 * @param {Object} data
 * @param {string} data.releaseVersion - e.g. "Release 25.11"
 * @param {string} data.projectName - e.g. "Core Platform"
 * @param {Object} data.evaluation - Output from calculateReadiness
 * @param {Object} data.securityGate - Output from scanSecurityGate
 * @param {Array} data.items - Scanned Jira issues
 * @returns {string} Confluence storage format body HTML
 */
export function buildConfluenceReportContent(data) {
  const { releaseVersion, projectName, evaluation, securityGate, items = [] } = data;

  // Generate SHA-256 Audit Signature of the evaluation
  const auditPayload = JSON.stringify({
    release: releaseVersion,
    score: evaluation.score,
    recommendation: evaluation.recommendation,
    reasons: evaluation.reasons,
    timestamp: evaluation.evaluatedAt
  });
  const auditHash = crypto.createHash('sha256').update(auditPayload).digest('hex').substring(0, 16);

  // Status macro color
  let statusColor = 'Red';
  let statusText = 'RELEASE BLOCKED (NO-GO)';
  if (evaluation.recommendation === 'GO') {
    statusColor = 'Green';
    statusText = 'READY TO SHIP (GO)';
  } else if (evaluation.recommendation === 'CONDITIONAL_GO') {
    statusColor = 'Yellow';
    statusText = 'CONDITIONAL GO (REVIEW REQUIRED)';
  }

  // Security Gate status color
  let secColor = 'Green';
  if (securityGate.status === 'BLOCKED') secColor = 'Red';
  else if (securityGate.status === 'REVIEW_REQUIRED') secColor = 'Yellow';

  // Build blockers HTML rows
  const blockersRows = (evaluation.counts.blockersCount > 0)
    ? items.filter(i => i.isBlocker).map(b => `
      <tr>
        <td><strong>${b.key}</strong></td>
        <td>${b.summary}</td>
        <td><span class="status-macro aui-lozenge aui-lozenge-error">BLOCKER</span></td>
        <td>${b.assignee || 'Unassigned'}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4"><em>No active blockers detected for this release.</em></td></tr>`;

  // Build security findings HTML rows
  const securityRows = (securityGate.findings && securityGate.findings.length > 0)
    ? securityGate.findings.map(f => `
      <tr>
        <td><strong>${f.issueKey}</strong></td>
        <td>${f.type}</td>
        <td><span class="status-macro aui-lozenge aui-lozenge-${f.severity === 'CRITICAL' ? 'error' : 'current'}">${f.severity}</span></td>
        <td>${f.sampleRedacted}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4"><em>Zero exposed credentials or sensitive PII detected.</em></td></tr>`;

  // Reasons list
  const reasonsList = evaluation.reasons.map(r => `<li>${r}</li>`).join('');

  return `
    <h2>Release Readiness Brief & Audit Sign-Off</h2>
    <p>This report was automatically evaluated by <strong>Release Readiness Commander (AI Gate)</strong>.</p>

    <table>
      <tbody>
        <tr>
          <th>Target Release</th>
          <td><strong>${releaseVersion}</strong> (${projectName})</td>
          <th>Readiness Score</th>
          <td><h2>${evaluation.score} / 100</h2></td>
        </tr>
        <tr>
          <th>Gate Decision</th>
          <td><span class="status-macro aui-lozenge aui-lozenge-${statusColor === 'Green' ? 'success' : statusColor === 'Yellow' ? 'current' : 'error'}">${statusText}</span></td>
          <th>Security Clearance</th>
          <td><span class="status-macro aui-lozenge aui-lozenge-${secColor === 'Green' ? 'success' : secColor === 'Yellow' ? 'current' : 'error'}">${securityGate.status}</span></td>
        </tr>
        <tr>
          <th>Audit Signature (SHA-256)</th>
          <td colspan="3"><code>sha256:${auditHash}</code> (Generated: ${evaluation.evaluatedAt})</td>
        </tr>
      </tbody>
    </table>

    <hr/>

    <h3>1. Gate Findings & Rationale</h3>
    <ul>
      ${reasonsList}
    </ul>

    <h3>2. Unresolved Blockers & Dependencies</h3>
    <table class="confluenceTable">
      <thead>
        <tr>
          <th>Issue Key</th>
          <th>Summary</th>
          <th>Priority</th>
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        ${blockersRows}
      </tbody>
    </table>

    <h3>3. Security Clearance Audit Log (Sanitized)</h3>
    <p><em>Notice: All secret tokens, bearer keys, and customer emails have been sanitized prior to publishing.</em></p>
    <table class="confluenceTable">
      <thead>
        <tr>
          <th>Source Issue</th>
          <th>Finding Type</th>
          <th>Severity</th>
          <th>Verification Status</th>
        </tr>
      </thead>
      <tbody>
        ${securityRows}
      </tbody>
    </table>

    <h3>4. Formal Sign-Off Checklist</h3>
    <ul class="inline-task-list" data-inline-tasks>
      <li data-inline-task-id="1"><span>[ ] Release Engineering Lead Sign-off</span></li>
      <li data-inline-task-id="2"><span>[ ] Product Manager Acceptance</span></li>
      <li data-inline-task-id="3"><span>[ ] Security Clearance Verified (No active secret exposures)</span></li>
    </ul>
  `;
}
