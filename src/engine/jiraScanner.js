import api, { route } from '@forge/api';
import { calculateReadiness } from './scoring';
import { scanSecurityGate } from './securityGate';

/**
 * Demo sample dataset used when testing without live Jira tickets or for immediate demo playback.
 */
export const SAMPLE_RELEASE_DATA = {
  version: 'v2.4.0-RC1',
  project: 'ENG',
  items: [
    {
      key: 'ENG-101',
      summary: 'Payment checkout timeout under load',
      priority: 'Highest',
      isBlocker: true,
      assignee: 'Alex Chen',
      description: 'Checkout API fails with 504 gateway timeout when concurrency exceeds 200 req/sec.',
      comments: [
        'Investigating connection pool starvation.',
        'Possible db connection leak in transaction handler.'
      ]
    },
    {
      key: 'ENG-102',
      summary: 'Automated settlement worker reconciliation',
      priority: 'High',
      isBlocker: false,
      assignee: 'Sarah Miller',
      description: 'Reconciles end-of-day bank transactions against internal ledger entries.',
      comments: [
        'Unit test coverage at 92%. Ready for release.'
      ]
    },
    {
      key: 'ENG-103',
      summary: 'Staging webhook failure investigation',
      priority: 'High',
      isBlocker: false,
      assignee: 'DevOps Lead',
      description: 'Webhook testing environment setup for Stripe/PayPal payment callbacks.',
      comments: [
        // Simulated exposed AWS key and bearer token to demonstrate Security Gate detection & redaction!
        'Updated staging webhook credentials with AWS test key: AKIAIOSFODNN7EXAMPLE for dev testing.',
        'Temporary bearer token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN sampled for debug.'
      ]
    },
    {
      key: 'ENG-104',
      summary: 'Cross-team dependency: Auth Service OAuth2 migration',
      priority: 'Medium',
      isBlocker: false,
      isDependency: true,
      dependencyStatus: 'In Progress',
      assignee: 'Core Security Team',
      description: 'Awaiting Auth Service deployment in production before enabling new token introspector.',
      comments: ['Targeted for deployment this Friday.']
    }
  ]
};

/**
 * Evaluates release readiness for a specific project and version.
 * If live Jira data exists, it fetches via REST; otherwise, it provides a realistic demo sample.
 */
export async function evaluateReleaseGate(projectKey = 'ENG', versionName = 'v2.4.0-RC1') {
  let issues = [];

  try {
    // Attempt to query live Jira Cloud issues if accessible
    const jql = `project = "${projectKey}" ORDER BY priority DESC`;
    const response = await api.asUser().requestJira(route`/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=25&fields=summary,priority,status,description,comment,issuelinks,assignee`);

    if (response.ok) {
      const data = await response.json();
      if (data.issues && data.issues.length > 0) {
        issues = data.issues.map(iss => {
          const descText = iss.fields.description ? JSON.stringify(iss.fields.description) : '';
          const comments = (iss.fields.comment && iss.fields.comment.comments) 
            ? iss.fields.comment.comments.map(c => JSON.stringify(c.body || '')) 
            : [];
          const priority = (iss.fields.priority && iss.fields.priority.name) || 'Medium';
          const isBlocker = priority === 'Highest' || priority === 'Blocker';

          return {
            key: iss.key,
            summary: iss.fields.summary || '',
            priority,
            isBlocker,
            assignee: (iss.fields.assignee && iss.fields.assignee.displayName) || 'Unassigned',
            description: descText,
            comments
          };
        });
      }
    }
  } catch (err) {
    console.log('Using sample dataset for evaluation demonstration:', err.message);
  }

  // If no live issues found or brand-new sandbox project, use the high-fidelity demo dataset
  if (issues.length === 0) {
    issues = SAMPLE_RELEASE_DATA.items;
  }

  // 1. Run Security Gate Scanner
  const securityGate = scanSecurityGate(issues);

  // 2. Identify Blockers and Dependencies
  const blockers = issues.filter(i => i.isBlocker);
  const dependencies = issues.filter(i => i.isDependency || i.summary.toLowerCase().includes('dependency')).map(d => ({
    key: d.key,
    target: d.summary,
    status: d.dependencyStatus || 'In Progress'
  }));
  const severeDefects = issues.filter(i => (i.priority === 'Highest' || i.priority === 'High') && !i.isBlocker);

  // 3. Compute Deterministic Readiness Score
  const evaluation = calculateReadiness({
    blockers,
    dependencies,
    securityGate,
    severeDefects,
    approvals: {
      qaApproved: true,
      securityApproved: securityGate.status !== 'BLOCKED'
    }
  });

  return {
    releaseVersion: versionName,
    projectKey,
    evaluation,
    securityGate,
    issues
  };
}
