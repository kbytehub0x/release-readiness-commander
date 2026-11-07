import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Heading,
  Text,
  Badge,
  Lozenge,
  Button,
  ButtonGroup,
  Box,
  Stack,
  Inline,
  SectionMessage,
  DynamicTable,
  ProgressBar,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Tag,
  TagGroup,
  Spinner,
  Strong,
  Em
} from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [scenario, setScenario] = useState('active'); // 'active' (NO-GO) or 'cleared' (GO)
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  const loadEvaluation = async (simScenario = scenario) => {
    setLoading(true);
    setPublishResult(null);
    try {
      const result = await invoke('getReleaseReadiness', {
        projectKey: 'ENG',
        versionName: 'v2.4.0-RC1',
        scenario: simScenario
      });
      setData(result);
    } catch (err) {
      console.error('Failed to load release readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluation(scenario);
  }, [scenario]);

  const toggleScenario = () => {
    const nextScenario = scenario === 'active' ? 'cleared' : 'active';
    setScenario(nextScenario);
    loadEvaluation(nextScenario);
  };

  const handlePublishReport = async () => {
    setPublishing(true);
    try {
      const res = await invoke('publishConfluenceReport', {
        releaseVersion: data?.releaseVersion || 'v2.4.0-RC1',
        projectKey: data?.projectKey || 'ENG',
        scenario
      });
      setPublishResult(res);
    } catch (err) {
      setPublishResult({ success: false, message: err.message });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <Box padding="space.300">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" />
          <Text>Running Release Gate & Teamwork Graph dependency audit...</Text>
        </Inline>
      </Box>
    );
  }

  const evalData = data?.evaluation || { score: 0, reasons: [], auditDeductions: [] };
  const secGate = data?.securityGate || { status: 'CLEAR', findings: [] };
  const issues = data?.issues || [];
  const deductions = evalData.auditDeductions || [];

  // Table 1: Itemized Auditable Deductions
  const deductionRows = deductions.map((d, idx) => ({
    key: `ded-${idx}`,
    cells: [
      { key: 'rule', content: <Lozenge appearance="removed">-{d.pointsDeducted} pts</Lozenge> },
      { key: 'target', content: <Strong>{d.affectedKey}</Strong> },
      { key: 'ruleName', content: <Text>{d.ruleName}</Text> },
      { key: 'owner', content: <Text>{d.owner}</Text> },
      { key: 'action', content: <Text>{d.actionRequired}</Text> }
    ]
  }));

  // Table 2: Teamwork Graph Dependencies
  const dependencies = issues.filter(i => i.isDependency || i.summary.toLowerCase().includes('dependency'));
  const dependencyRows = dependencies.map((dep, idx) => ({
    key: `dep-${idx}`,
    cells: [
      { key: 'key', content: <Strong>{dep.key}</Strong> },
      { key: 'target', content: <Text>{dep.summary}</Text> },
      { key: 'status', content: <Lozenge appearance={dep.dependencyStatus === 'Done' ? 'success' : 'inprogress'}>{dep.dependencyStatus || 'In Progress'}</Lozenge> },
      { key: 'owner', content: <Text>{dep.assignee || 'Core Services Team'}</Text> },
      { key: 'graph', content: <Badge appearance="primary">Teamwork Graph</Badge> }
    ]
  }));

  // Table 3: Security Clearance Gate
  const securityRows = (secGate.findings || []).map((f, idx) => ({
    key: `sec-${idx}`,
    cells: [
      { key: 'issue', content: <Strong>{f.issueKey}</Strong> },
      { key: 'type', content: <Text>{f.type}</Text> },
      { key: 'severity', content: <Lozenge appearance={f.severity === 'CRITICAL' ? 'removed' : 'inprogress'}>{f.severity}</Lozenge> },
      { key: 'evidence', content: <Text>{f.sampleRedacted}</Text> }
    ]
  }));

  return (
    <Box padding="space.300">
      <Stack space="space.200">
        {/* Cockpit Header */}
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.050">
            <Inline space="space.100" alignBlock="center">
              <Heading as="h1">Release Readiness Commander</Heading>
              <Badge appearance="primary">AI Release Gate</Badge>
              <Tag text="Teamwork Graph Connected" />
            </Inline>
            <Text>Target Release: <Strong>{data?.releaseVersion}</Strong> | Project: <Strong>{data?.projectKey}</Strong></Text>
          </Stack>

          <ButtonGroup>
            <Button
              appearance={scenario === 'active' ? 'warning' : 'subtle'}
              onClick={toggleScenario}
            >
              {scenario === 'active' ? 'Simulate: Resolve Blockers (Go)' : 'Simulate: Pre-Release (No-Go)'}
            </Button>
            <Button appearance="primary" onClick={handlePublishReport} isLoading={publishing}>
              Publish Confluence Sign-off Brief
            </Button>
          </ButtonGroup>
        </Inline>

        {publishResult && (
          <SectionMessage
            appearance={publishResult.success ? 'success' : 'error'}
            title={publishResult.success ? 'Confluence Release Brief Created' : 'Publishing Error'}
          >
            <Text>{publishResult.message}</Text>
          </SectionMessage>
        )}

        {/* Score & Gate Decision Card */}
        <Box padding="space.200" backgroundColor="elevation.surface.raised">
          <Inline spread="space-between" alignBlock="center">
            <Stack space="space.050">
              <Text>Readiness Score (Deterministic)</Text>
              <Inline space="space.100" alignBlock="baseline">
                <Heading as="h1">{evalData.score} / 100</Heading>
                <Text>({evalData.reasons.length} active policy signals)</Text>
              </Inline>
              <ProgressBar value={evalData.score / 100} />
            </Stack>

            <Stack space="space.100" alignInline="end">
              <Inline space="space.100" alignBlock="center">
                <Text>Gate Decision:</Text>
                <Lozenge appearance={evalData.recommendation === 'GO' ? 'success' : evalData.recommendation === 'CONDITIONAL_GO' ? 'inprogress' : 'removed'}>
                  {evalData.recommendationLabel}
                </Lozenge>
              </Inline>

              <Inline space="space.100" alignBlock="center">
                <Text>Security Clearance:</Text>
                <Lozenge appearance={secGate.status === 'CLEAR' ? 'success' : secGate.status === 'REVIEW_REQUIRED' ? 'inprogress' : 'removed'}>
                  {secGate.status}
                </Lozenge>
              </Inline>
            </Stack>
          </Inline>
        </Box>

        {/* Active Policy Deductions */}
        <SectionMessage
          appearance={evalData.recommendation === 'GO' ? 'success' : evalData.recommendation === 'CONDITIONAL_GO' ? 'warning' : 'error'}
          title="Gate Evaluation Rationale"
        >
          {evalData.reasons.map((r, i) => (
            <Text key={i}>• {r}</Text>
          ))}
        </SectionMessage>

        {/* Navigation Tabs */}
        <Tabs id="readiness-tabs">
          <TabList>
            <Tab>Auditable Deductions ({deductionRows.length})</Tab>
            <Tab>Teamwork Graph Dependencies ({dependencyRows.length})</Tab>
            <Tab>Security Readiness Gate ({securityRows.length})</Tab>
          </TabList>

          {/* Tab 1: Itemized Deductions */}
          <TabPanel>
            <Box padding="space.100">
              {deductionRows.length > 0 ? (
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'rule', content: 'Penalty' },
                      { key: 'target', content: 'Source Key' },
                      { key: 'ruleName', content: 'Policy Rule' },
                      { key: 'owner', content: 'Owner' },
                      { key: 'action', content: 'Remediation Action' }
                    ]
                  }}
                  rows={deductionRows}
                />
              ) : (
                <Text>Zero policy deductions. All release readiness criteria satisfied.</Text>
              )}
            </Box>
          </TabPanel>

          {/* Tab 2: Teamwork Graph Dependencies */}
          <TabPanel>
            <Box padding="space.100">
              <Stack space="space.100">
                <Text><Em>Mapped across cross-team Jira tickets and services via Atlassian Teamwork Graph.</Em></Text>
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'key', content: 'Dependency Ticket' },
                      { key: 'target', content: 'Dependent Service / Capability' },
                      { key: 'status', content: 'Status' },
                      { key: 'owner', content: 'Owning Team' },
                      { key: 'graph', content: 'Source' }
                    ]
                  }}
                  rows={dependencyRows}
                />
              </Stack>
            </Box>
          </TabPanel>

          {/* Tab 3: Security Clearance Gate */}
          <TabPanel>
            <Box padding="space.100">
              <Stack space="space.100">
                <Text><Em>Security Policy: Scans issue descriptions and comments for credentials and PII. Original Jira data remains untouched; sanitization is applied only when compiling Confluence briefs.</Em></Text>
                {securityRows.length > 0 ? (
                  <DynamicTable
                    head={{
                      cells: [
                        { key: 'issue', content: 'Source Ticket' },
                        { key: 'type', content: 'Credential / PII Type' },
                        { key: 'severity', content: 'Clearance Level' },
                        { key: 'evidence', content: 'Evidence' }
                      ]
                    }}
                    rows={securityRows}
                  />
                ) : (
                  <Text>Zero exposed secrets or sensitive PII detected. Security clearance is CLEAR.</Text>
                )}
              </Stack>
            </Box>
          </TabPanel>
        </Tabs>
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
