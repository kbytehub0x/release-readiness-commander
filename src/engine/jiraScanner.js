import api, { route } from '@forge/api';
import { calculateReadiness } from './scoring';
import { scanSecurityGate } from './securityGate';

/**
 * Pre-release scenario dataset: Unresolved blockers, live-looking credentials, and open dependencies.
 */
export const SCENARIO_PRE_RELEASE = [
  {
    key: 'ENG-101',
    summary: 'Payment checkout timeout under concurrency spikes',
    priority: 'Highest',
    isBlocker: true,
    assignee: 'Alex Chen',
    description: 'Checkout API fails with 504 gateway timeout when concurrency exceeds 200 req/sec.',
    comments: [
      'Investigating connection pool starvation.',
      'Database connection leak in transaction handler requires fix.'
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
      'Unit test coverage at 92%. Verified in staging.'
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
      // Simulated exposed credentials to demonstrate the Security Clearance Gate!
      'Updated staging webhook credentials with AWS test key: AKIAIOSFODNN7EXAMPLE for dev testing.',
      'Temporary bearer token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN sampled for debug.'
    ]
  },
  {
    key: 'ENG-104',
    summary: 'Auth Service OAuth2 token introspector migration',
    priority: 'Medium',
    isBlocker: false,
    isDependency: true,
    dependencyStatus: 'In Progress',
    assignee: 'Core Security Team',
    description: 'Awaiting Auth Service deployment in production before enabling new token introspector.',
    comments: ['Teamwork Graph link: Depends on auth-service v3.2.0.']
  }
];

/**
 * Cleared / Post-Fix scenario dataset: Blockers fixed, credentials rotated, dependencies resolved!
 */
export const SCENARIO_POST_FIX = [
  {
    key: 'ENG-101',
    summary: 'Payment checkout timeout under concurrency spikes',
    priority: 'Medium',
    isBlocker: false,
    assignee: 'Alex Chen',
    description: 'Connection pool tuned; load testing passed at 500 req/sec.',
    comments: ['Verified fix in load cluster. Blocker cleared.']
  },
  {
    key: 'ENG-102',
    summary: 'Automated settlement worker reconciliation',
    priority: 'Low',
    isBlocker: false,
    assignee: 'Sarah Miller',
    description: 'Reconciles end-of-day bank transactions.',
    comments: ['Verified in staging. Ready.']
  },
  {
    key: 'ENG-103',
    summary: 'Staging webhook failure investigation',
    priority: 'Low',
    isBlocker: false,
    assignee: 'DevOps Lead',
    description: 'Credentials rotated into AWS Secrets Manager. Plaintext cleared.',
    comments: ['Secrets rotated and credentials removed. Clean.']
  },
  {
    key: 'ENG-104',
    summary: 'Auth Service OAuth2 token introspector migration',
    priority: 'Low',
    isBlocker: false,
    isDependency: true,
    dependencyStatus: 'Done',
    assignee: 'Core Security Team',
    description: 'Auth Service v3.2.0 deployed to production.',
    comments: ['Teamwork Graph link: Completed.']
  }
];

/**
 * Evaluates release readiness for a specific project and version.
 * 
 * @param {string} projectKey 
 * @param {string} versionName 
 * @param {string} scenario - 'active' (Pre-Release NO-GO) or 'cleared' (Post-Fix GO)
 */
export async function evaluateReleaseGate(projectKey = 'ENG', versionName = 'v2.4.0-RC1', scenario = 'active') {
  let issues = [];

  try {
    // If live Jira issues exist for this project, fetch them
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
    console.log('Querying live Jira resulted in fallback:', err.message);
  }

  // If new sandbox or scenario toggle is specified, use the realistic scenario dataset
  if (issues.length === 0 || scenario === 'cleared') {
    issues = (scenario === 'cleared') ? SCENARIO_POST_FIX : SCENARIO_PRE_RELEASE;
  }

  // 1. Run Security Clearance Gate Scanner
  const securityGate = scanSecurityGate(issues);

  // 2. Identify Blockers and Teamwork Graph Dependencies
  const blockers = issues.filter(i => i.isBlocker);
  const dependencies = issues.filter(i => i.isDependency || i.summary.toLowerCase().includes('dependency')).map(d => ({
    key: d.key,
    target: d.summary,
    status: d.dependencyStatus || 'In Progress',
    owner: d.assignee
  }));
  const severeDefects = issues.filter(i => (i.priority === 'Highest' || i.priority === 'High') && !i.isBlocker);

  // 3. Compute Deterministic Score & Explanations
  const evaluation = calculateReadiness({
    blockers,
    dependencies,
    securityGate,
    severeDefects,
    approvals: {
      qaApproved: scenario === 'cleared',
      securityApproved: securityGate.status !== 'BLOCKED'
    }
  });

  return {
    releaseVersion: versionName,
    projectKey,
    evaluation,
    securityGate,
    issues,
    scenario
  };
}
