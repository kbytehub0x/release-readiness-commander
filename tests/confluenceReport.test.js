import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfluenceReportContent } from '../src/engine/confluenceReport.js';

test('Confluence Report - Generates valid storage format XHTML with SHA-256 fingerprint', () => {
  const reportHtml = buildConfluenceReportContent({
    releaseVersion: 'v2.4.0-RC1',
    projectName: 'ENG',
    evaluation: {
      score: 95,
      recommendation: 'GO',
      recommendationLabel: 'Ready to Ship',
      evaluatedAt: new Date().toISOString(),
      counts: { blockersCount: 0, dependenciesCount: 0, criticalDefectsCount: 0 },
      reasons: ['All critical quality gates passed.'],
      auditDeductions: []
    },
    securityGate: {
      status: 'CLEAR',
      criticalCount: 0,
      reviewCount: 0,
      findings: []
    },
    items: []
  });

  assert.ok(reportHtml.includes('v2.4.0-RC1'));
  assert.ok(reportHtml.includes('sha256:'));
  assert.ok(reportHtml.includes('Security Clearance Audit Log'));
  assert.ok(reportHtml.includes('Formal Sign-Off Checklist'));
});
