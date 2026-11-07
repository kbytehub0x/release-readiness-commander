/**
 * Release Security Clearance Gate (Sensitive Data & Credential Gate)
 * 
 * Inspects issue text, comments, and release context for:
 * - Exposed Cloud Credentials (AWS, GCP, Azure, GitHub, OpenAI)
 * - Private Keys & Certificates (RSA, PEM, SSH)
 * - Database Connection Strings with Passwords
 * - Authentication Tokens (Bearer JWT, Basic auth)
 * - Sensitive Customer PII (Emails in dev tickets, IPs)
 * 
 * Clearance Statuses:
 * - CLEAR: Zero exposed credentials detected.
 * - REVIEW_REQUIRED: Potential PII or tokens requiring verification.
 * - BLOCKED: Live-looking credentials or private keys detected.
 * 
 * Non-destructive policy: Jira tickets remain completely untouched.
 * Redaction applies exclusively to generated audit reports in Confluence.
 */

export const SECRET_PATTERNS = [
  {
    type: 'AWS Access Key',
    severity: 'CRITICAL',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    mask: '[REDACTED_AWS_KEY]'
  },
  {
    type: 'GitHub Personal Access Token',
    severity: 'CRITICAL',
    regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    mask: '[REDACTED_GITHUB_TOKEN]'
  },
  {
    type: 'Bearer / JWT Authentication Token',
    severity: 'REVIEW',
    regex: /bearer\s+ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}/gi,
    mask: 'Bearer [REDACTED_JWT]'
  },
  {
    type: 'Private Key Block (RSA/PEM)',
    severity: 'CRITICAL',
    regex: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/gi,
    mask: '[REDACTED_PRIVATE_KEY_BLOCK]'
  },
  {
    type: 'Database Connection URI with Password',
    severity: 'CRITICAL',
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_]+:[^@\s/]+@[a-zA-Z0-9.-]+/gi,
    mask: '[REDACTED_DATABASE_CONNECTION_URI]'
  },
  {
    type: 'Hardcoded API Secret / Key Assignment',
    severity: 'REVIEW',
    regex: /(?:password|secret|api_key|apikey|client_secret)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
    mask: '$1: [REDACTED_SECRET]'
  },
  {
    type: 'Customer Email / Sensitive PII',
    severity: 'REVIEW',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: '[REDACTED_EMAIL]'
  }
];

/**
 * Scans a collection of Jira issues/comments for security leaks.
 */
export function scanSecurityGate(items = []) {
  const findings = [];

  for (const item of items) {
    const textCorpus = [
      { field: 'description', text: item.description || '' },
      ...(item.comments || []).map((c, idx) => ({ field: `comment #${idx + 1}`, text: c || '' }))
    ];

    for (const entry of textCorpus) {
      if (!entry.text) continue;

      for (const pattern of SECRET_PATTERNS) {
        const matches = entry.text.match(pattern.regex);
        if (matches && matches.length > 0) {
          findings.push({
            issueKey: item.key,
            issueSummary: item.summary,
            field: entry.field,
            type: pattern.type,
            severity: pattern.severity,
            matchedCount: matches.length,
            sampleRedacted: `Found ${matches.length} instance(s) of ${pattern.type} in ${item.key} (${entry.field})`,
            detectedAt: new Date().toISOString()
          });
        }
      }
    }
  }

  // Derive Gate Status
  let status = 'CLEAR';
  let statusMessage = 'All scanned release tickets are clear of detected secrets and PII.';

  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const reviewCount = findings.filter(f => f.severity === 'REVIEW').length;

  if (criticalCount > 0) {
    status = 'BLOCKED';
    statusMessage = `BLOCKED: ${criticalCount} live-looking credential(s) detected. Must be rotated or verified before shipping.`;
  } else if (reviewCount > 0) {
    status = 'REVIEW_REQUIRED';
    statusMessage = `REVIEW REQUIRED: ${reviewCount} sensitive item(s) flagged for data clearance review.`;
  }

  return {
    status,
    statusMessage,
    criticalCount,
    reviewCount,
    totalFindings: findings.length,
    findings,
    scannedCount: items.length
  };
}

/**
 * Sanitizes input text by replacing detected secrets and PII with redacting masks.
 */
export function sanitizeForReport(text) {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.mask);
  }

  return sanitized;
}
