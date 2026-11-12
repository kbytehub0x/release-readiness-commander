import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSecurityGate } from '../src/engine/securityGate.js';

test('Security Gate - Detects AWS credentials and blocks clearance', () => {
  const issues = [
    {
      key: 'ENG-103',
      summary: 'Staging webhook failure',
      description: 'Test payload',
      comments: ['Testing with key AKIAIOSFODNN7EXAMPLE']
    }
  ];

  const result = scanSecurityGate(issues);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.criticalCount, 1);
  assert.equal(result.findings[0].issueKey, 'ENG-103');
  assert.equal(result.findings[0].type, 'AWS Access Key');
  assert.ok(result.findings[0].sampleRedacted.includes('AWS Access Key'));
});

test('Security Gate - Clean issues return CLEAR status', () => {
  const issues = [
    {
      key: 'ENG-102',
      summary: 'Standard settlement worker reconciliation',
      description: 'Reconciles bank transactions against internal ledger entries.',
      comments: ['Unit test coverage at 92%. Verified in staging.']
    }
  ];

  const result = scanSecurityGate(issues);
  assert.equal(result.status, 'CLEAR');
  assert.equal(result.criticalCount, 0);
  assert.equal(result.reviewCount, 0);
  assert.equal(result.findings.length, 0);
});

test('Security Gate - Detects GitHub PAT tokens and flags critical findings', () => {
  const issues = [
    {
      key: 'ENG-105',
      summary: 'CI webhook token configuration',
      description: 'Use token ghp_1234567890abcdefghijklmnopqrstuvwxyz1234',
      comments: []
    }
  ];

  const result = scanSecurityGate(issues);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some(f => f.type === 'GitHub Personal Access Token'));
});
