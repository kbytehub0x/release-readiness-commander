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
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  const loadEvaluation = async () => {
    setLoading(true);
    setPublishResult(null);
    try {
      const result = await invoke('getReleaseReadiness', {
        projectKey: 'ENG',
        versionName: 'v2.4.0-RC1'
      });
      setData(result);
    } catch (err) {
      console.error('Failed to load release readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluation();
  }, []);

  const handlePublishReport = async () => {
    setPublishing(true);
    try {
      const res = await invoke('publishConfluenceReport', {
        releaseVersion: data?.releaseVersion || 'v2.4.0-RC1',
        projectKey: data?.projectKey || 'ENG'
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
          <Text>Evaluating release readiness & scanning security gates...</Text>
        </Inline>
      </Box>
    );
  }

  const evalData = data?.evaluation || { score: 0, reasons: [] };
  const secGate = data?.securityGate || { status: 'CLEAR', findings: [] };
  const issues = data?.issues || [];

  // Table configuration for Blockers
  const blockerRows = issues.filter(i => i.isBlocker).map(b => ({
    key: b.key,
    cells: [
      { key: 'key', content: <Strong>{b.key}</Strong> },
      { key: 'summary', content: <Text>{b.summary}</Text> },
      { key: 'priority', content: <Lozenge appearance="removed">{b.priority}</Lozenge> },
      { key: 'assignee', content: <Text>{b.assignee}</Text> }
    ]
  }));

  // Table configuration for Security Findings
  const securityRows = (secGate.findings || []).map((f, idx) => ({
    key: `sec-${idx}`,
    cells: [
      { key: 'issue', content: <Strong>{f.issueKey}</Strong> },
      { key: 'type', content: <Text>{f.type}</Text> },
      { key: 'severity', content: <Lozenge appearance={f.severity === 'CRITICAL' ? 'removed' : 'inprogress'}>{f.severity}</Lozenge> },
      { key: 'status', content: <Text>{f.sampleRedacted}</Text> }
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
              <Badge appearance="primary">AI Gate</Badge>
            </Inline>
            <Text>Target Release: <Strong>{data?.releaseVersion}</Strong> | Project: <Strong>{data?.projectKey}</Strong></Text>
          </Stack>

          <ButtonGroup>
            <Button appearance="subtle" onClick={loadEvaluation}>Re-scan Gate</Button>
            <Button appearance="primary" onClick={handlePublishReport} isLoading={publishing}>
              Publish Confluence Brief
            </Button>
          </ButtonGroup>
        </Inline>

        {publishResult && (
          <SectionMessage
            appearance={publishResult.success ? 'success' : 'error'}
            title={publishResult.success ? 'Confluence Release Brief Published' : 'Publishing Error'}
          >
            <Text>{publishResult.message}</Text>
          </SectionMessage>
        )}

        {/* Score & Gate Recommendation Card */}
        <Box padding="space.200" backgroundColor="elevation.surface.raised">
          <Inline spread="space-between" alignBlock="center">
            <Stack space="space.050">
              <Text>Readiness Score</Text>
              <Heading as="h1">{evalData.score} / 100</Heading>
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

        {/* Active Gate Reasons */}
        <SectionMessage
          appearance={evalData.recommendation === 'GO' ? 'success' : evalData.recommendation === 'CONDITIONAL_GO' ? 'warning' : 'error'}
          title="Gate Evaluation Rationale"
        >
          {evalData.reasons.map((r, i) => (
            <Text key={i}>• {r}</Text>
          ))}
        </SectionMessage>

        {/* Tabs for Details */}
        <Tabs id="readiness-tabs">
          <TabList>
            <Tab>Unresolved Blockers ({blockerRows.length})</Tab>
            <Tab>Security Clearance ({securityRows.length})</Tab>
            <Tab>Score Breakdown</Tab>
          </TabList>

          {/* Blockers Tab */}
          <TabPanel>
            <Box padding="space.100">
              {blockerRows.length > 0 ? (
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'key', content: 'Issue Key' },
                      { key: 'summary', content: 'Summary' },
                      { key: 'priority', content: 'Priority' },
                      { key: 'assignee', content: 'Owner' }
                    ]
                  }}
                  rows={blockerRows}
                />
              ) : (
                <Text>No active blockers for this release version.</Text>
              )}
            </Box>
          </TabPanel>

          {/* Security Gate Tab */}
          <TabPanel>
            <Box padding="space.100">
              <Stack space="space.100">
                <Text><Em>Zero-Trust Policy: Flagged secrets are never modified in Jira; they are sanitized exclusively in published Confluence briefs.</Em></Text>
                {securityRows.length > 0 ? (
                  <DynamicTable
                    head={{
                      cells: [
                        { key: 'issue', content: 'Source Issue' },
                        { key: 'type', content: 'Finding Type' },
                        { key: 'severity', content: 'Severity' },
                        { key: 'status', content: 'Verification Details' }
                      ]
                    }}
                    rows={securityRows}
                  />
                ) : (
                  <Text>Zero exposed secrets or sensitive PII detected.</Text>
                )}
              </Stack>
            </Box>
          </TabPanel>

          {/* Score Breakdown Tab */}
          <TabPanel>
            <Box padding="space.100">
              <Stack space="space.100">
                <Text>Deterministic Formula: <Strong>Score = 100 - (W_b * B) - (W_d * D) - (W_s * S) - (W_q * Q)</Strong></Text>
                <TagGroup>
                  <Tag text={`Blocker Penalty: -${evalData.breakdown?.blockerDeduction || 0} pts`} />
                  <Tag text={`Dependency Penalty: -${evalData.breakdown?.dependencyDeduction || 0} pts`} />
                  <Tag text={`Security Gate Penalty: -${evalData.breakdown?.securityDeduction || 0} pts`} />
                  <Tag text={`Defect Penalty: -${evalData.breakdown?.defectDeduction || 0} pts`} />
                </TagGroup>
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
