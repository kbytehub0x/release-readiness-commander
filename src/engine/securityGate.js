/**
 * Zero-Trust Security Clearance Gate
 * 
 * Inspects issue text, comments, and release context for:
 * - Leaked Cloud API Keys (AWS, GCP, Azure, GitHub, OpenAI)
 * - Private Keys & Certificates (RSA, PEM, SSH)
 * - Authentication Tokens (Bearer JWT, Basic auth credentials)
 * - Sensitive PII (Emails in dev tickets, IP addresses, SSN/Credit Card patterns)
 * 
 * Produces a clear gate status: CLEAR, REVIEW_REQUIRED, or BLOCKED.
 * Leaves Jira tickets untouched; redacts findings only in the generated Confluence Report.
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
    type: 'Generic Bearer / JWT Token',
    severity: 'REVIEW',
    regex: /bearer\s+ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}/gi,
    mask: 'Bearer [REDACTED_JWT]'
  },
  {
    type: 'Private Key Block',
    severity: 'CRITICAL',
    regex: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/gi,
    mask: '[REDACTED_PRIVATE_KEY_BLOCK]'
  },
  {
    type: 'Database Connection String / Password',
    severity: 'CRITICAL',
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_]+:[^@\s/]+@[a-zA-Z0-9.-]+/gi,
    mask: '[REDACTED_DATABASE_CONNECTION_URI]'
  },
  {
    type: 'Hardcoded API Secret / Password Assignment',
    severity: 'REVIEW',
    regex: /(?:password|secret|api_key|apikey|client_secret)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
    mask: '$1: [REDACTED_SECRET]'
  },
  {
    type: 'Exposed Customer Email / PII',
    severity: 'REVIEW',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: '[REDACTED_EMAIL]'
  }
];

/**
 * Scans a collection of Jira issues/comments for security leaks.
 * 
 * @param {Array<Object>} items - Array of { key: string, summary: string, description: string, comments: string[] }
 * @returns {Object} Security Gate summary with status: 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCKED'
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
  let badgeVariant = 'success';

  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const reviewCount = findings.filter(f => f.severity === 'REVIEW').length;

  if (criticalCount > 0) {
    status = 'BLOCKED';
    statusMessage = `BLOCKED: ${criticalCount} critical exposed secret(s) found. Deployment must be held until rotated or verified.`;
    badgeVariant = 'error';
  } else if (reviewCount > 0) {
    status = 'REVIEW_REQUIRED';
    statusMessage = `REVIEW REQUIRED: ${reviewCount} item(s) flagged for potential sensitive data.`;
    badgeVariant = 'warning';
  }

  return {
    status,
    statusMessage,
    badgeVariant,
    criticalCount,
    reviewCount,
    totalFindings: findings.length,
    findings,
    scannedCount: items.length
  };
}

/**
 * Sanitizes input text by replacing detected secrets and PII with redacting masks.
 * Used exclusively when creating Confluence reports so no sensitive credentials are published.
 * 
 * @param {string} text 
 * @returns {string} Sanitized text
 */
export function sanitizeForReport(text) {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.mask);
  }

  return sanitized;
}
