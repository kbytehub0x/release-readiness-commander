import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReadiness } from '../src/engine/scoring.js';

test('Scoring Engine - Perfect release returns 100 and GO recommendation', () => {
  const result = calculateReadiness({
    blockers: [],
    dependencies: [],
    securityGate: { status: 'CLEAR', criticalCount: 0, reviewCount: 0, findings: [] },
    severeDefects: [],
    approvals: { qaApproved: true, securityApproved: true }
  });

  assert.equal(result.score, 100);
  assert.equal(result.recommendation, 'GO');
  assert.equal(result.recommendationLabel, 'Ready to Ship');
  assert.equal(result.totalDeductions, 0);
  assert.equal(result.auditDeductions.length, 0);
});

test('Scoring Engine - Unresolved blocker applies RULE-BLK-01 penalty', () => {
  const blockers = [
    { key: 'ENG-101', summary: 'Payment checkout timeout', priority: 'Highest', assignee: 'Alex Chen' }
  ];

  const result = calculateReadiness({
    blockers,
    dependencies: [],
    securityGate: { status: 'CLEAR', criticalCount: 0, reviewCount: 0, findings: [] },
    severeDefects: [],
    approvals: { qaApproved: true, securityApproved: true }
  });

  assert.equal(result.score, 85); // 100 - 15 (weights.blocker is 15)
  assert.equal(result.recommendation, 'NO_GO');
  const deduction = result.auditDeductions.find(d => d.ruleId === 'RULE-BLK-01');
  assert.ok(deduction);
  assert.equal(deduction.pointsDeducted, 15);
  assert.equal(deduction.affectedKey, 'ENG-101');
  assert.equal(deduction.owner, 'Alex Chen');
});

test('Scoring Engine - Security findings trigger RULE-SEC-01 and block release', () => {
  const result = calculateReadiness({
    blockers: [],
    dependencies: [],
    securityGate: {
      status: 'BLOCKED',
      criticalCount: 1,
      reviewCount: 0,
      findings: [{ issueKey: 'ENG-103', type: 'AWS Access Key', severity: 'CRITICAL', sampleRedacted: 'AKIA...XYZ' }]
    },
    severeDefects: [],
    approvals: { qaApproved: true, securityApproved: false }
  });

  assert.equal(result.recommendation, 'NO_GO');
  const secDeduction = result.auditDeductions.find(d => d.ruleId === 'RULE-SEC-01');
  assert.ok(secDeduction);
  assert.equal(secDeduction.pointsDeducted, 25);
});

test('Scoring Engine - Score clamps to 0 minimum and never goes negative', () => {
  const manyBlockers = Array.from({ length: 10 }, (_, i) => ({
    key: `ENG-${i}`,
    summary: `Blocker ${i}`,
    priority: 'Highest',
    assignee: 'Dev'
  }));

  const result = calculateReadiness({
    blockers: manyBlockers,
    dependencies: [{ key: 'DEP-1', target: 'Service', status: 'In Progress', owner: 'Dev' }],
    securityGate: { status: 'BLOCKED', criticalCount: 5, reviewCount: 2, findings: [] },
    severeDefects: [],
    approvals: { qaApproved: false, securityApproved: false }
  });

  assert.equal(result.score, 0);
  assert.equal(result.recommendation, 'NO_GO');
});
