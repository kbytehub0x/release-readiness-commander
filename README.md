# Release Readiness Commander 🚀

> **An evidence-backed AI Release Gate turning Jira issues, Teamwork Graph dependencies, and security signals into deterministic Go/No-Go decisions.**

[![Atlassian Forge](https://img.shields.io/badge/Atlassian-Forge%20Cloud-0052CC?logo=atlassian)](https://developer.atlassian.com/platform/forge/)
[![Rovo Agent](https://img.shields.io/badge/Atlassian-Rovo%20Agent-0052CC?logo=atlassian)](https://www.atlassian.com/software/rovo)
[![Runs on Atlassian](https://img.shields.io/badge/Runs%20on-Atlassian-blue.svg)](https://developer.atlassian.com/platform/forge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built for Codegeist](https://img.shields.io/badge/Codegeist-2026-orange)](https://codegeist2026.devpost.com/)

---

## 📌 About

**Release Readiness Commander** replaces stressful release meetings, subjective gut calls, and messy Slack threads with an intelligent, auditable **AI Release Gate**. 

Operating natively within Jira and Confluence via **Atlassian Forge** and **Atlassian Rovo**, it **assesses on demand** software releases across three critical pillars:
1. **Jira Release Context**: Unresolved blockers, Sev-1/Sev-2 defect spikes, and QA/approval tracking.
2. **Teamwork Graph Dependencies**: Cross-project and cross-service dependency chains preventing deployment failure.
3. **Security Clearance Gate**: Non-destructive scanning for hardcoded AWS keys, GitHub tokens, JWTs, private keys, database connection strings, and sensitive PII.

Instead of an opaque black-box LLM number, Release Readiness Commander computes a **deterministic, auditable readiness score (0–100)** with itemized point deductions, linked evidence, responsible owners, and precise remediation actions.

---

## 🌐 Live Demo & Testing Environment

For judges evaluating the live environment:

| Property | Value / Reference |
|---|---|
| **Installed Atlassian Site** | `https://ghost-dev.atlassian.net` |
| **Target Project** | Engineering Service (`ENG` / `DEMO`) |
| **Demo Release Key** | `v2.4.0-RC1` |
| **Rovo Agent Name** | `Release Readiness Commander` (`release-readiness-commander-agent`) |
| **App ARI** | `ari:cloud:ecosystem::app/5c1b3b3c-0be8-4cf1-a15b-9550459dc6d0` |
| **Jira Cockpit Location** | Jira Project Sidebar → **Release Readiness Cockpit** (or Top Nav **Apps** → **Release Readiness Cockpit**) |

![Release Readiness Cockpit - Live Jira Installation](docs/images/cockpit-live-view.png)

---

## ⚡ The Problem

* **Fragmented Release Evidence**: Release managers scramble across dozens of Jira epics, Confluence notes, and PRs right before deployment.
* **Hidden Cross-Team Blockers**: Teams ship services unaware that a downstream dependency is still in progress.
* **Accidental Secret Leaks**: Developers paste debug logs, test API tokens, and credentials into ticket descriptions and comments.
* **Lack of Auditability**: Post-mortems struggle to determine why a high-risk release was approved without documented waivers.

---

## 💡 The Solution

Release Readiness Commander turns scattered context into an **evidence-backed release decision in under 60 seconds**:

```
+-------------------------------------------------------------------------------------------------+
|                                 RELEASE READINESS COMMANDER                                     |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   +-----------------------+     +------------------------+     +----------------------------+   |
|   |   JIRA RELEASE DATA   |     |     TEAMWORK GRAPH     |     |   SECURITY CLEARANCE GATE  |   |
|   |  Blockers, Sev-1 Bugs |     | Upstream / Downstream  |     |  API Keys, Tokens, PII     |   |
|   |  QA & Waivers         |     | Service Dependencies   |     |  Zero-mutation in Jira     |   |
|   +-----------+-----------+     +-----------+------------+     +-------------+--------------+   |
|               |                             |                                |                  |
|               +-----------------------------+--------------------------------+                  |
|                                             |                                                   |
|                                             v                                                   |
|                      +---------------------------------------------+                            |
|                      |         DETERMINISTIC SCORING ENGINE        |                            |
|                      |   Score = 100 - Wb(B) - Wd(D) - Ws(S) - Wq(Q)  |                         |
|                      +----------------------+----------------------+                            |
|                                             |                                                   |
|                         +-------------------+-------------------+                               |
|                         |                                       |                               |
|                         v                                       v                               |
|             +-----------------------+               +-----------------------+                   |
|             |  NATIVE JIRA COCKPIT  |               |  ATLASSIAN ROVO AGENT |                   |
|             |  Live Gauge, Lozenge, |               |  Natural Language Q&A |                   |
|             |  Audit Deductions Tab |               |  Modular Rovo Skills  |                   |
|             +-----------+-----------+               +-----------+-----------+                   |
|                         |                                       |                               |
|                         +-------------------+-------------------+                               |
|                                             |                                                   |
|                                             v                                                   |
|                      +---------------------------------------------+                            |
|                      |        CONFLUENCE SIGN-OFF BRIEF            |                            |
|                      |  Sanitized Redaction + SHA-256 Fingerprint  |                            |
|                      +---------------------------------------------+                            |
+-------------------------------------------------------------------------------------------------+
```

---

## 🏗️ Architecture & Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Release Lead
    participant Rovo as Atlassian Rovo Agent
    participant Cockpit as Jira Native Cockpit (UI Kit)
    participant Forge as Forge Backend Resolvers
    participant JiraAPI as Jira REST API / Graph
    participant ConfAPI as Confluence REST API

    alt Conversational Inquiries via Rovo
        User->>Rovo: "Is release v2.4.0-RC1 ready to ship?"
        Rovo->>Forge: Invoke evaluateReleaseReadiness action
        Forge->>JiraAPI: Query fixVersion, blockers, issue links
        Forge-->>Rovo: Return deterministic score (8/100, NO-GO)
        User->>Rovo: "Why is it No-Go? Explain the score"
        Rovo->>Forge: Invoke explainScore action
        Forge-->>Rovo: Itemized deductions (PAY-482, billing-service-v2, AWS key)
    else Visual Cockpit in Jira
        User->>Cockpit: Open Release Readiness Cockpit
        Cockpit->>Forge: Request getReleaseReadiness(version)
        Forge->>JiraAPI: Scan blockers, dependencies, secrets
        Forge-->>Cockpit: Score, lozenge badge, auditable rule table
        User->>Cockpit: Click "Publish Confluence Sign-off Brief"
        Cockpit->>Forge: publishConfluenceReport(payload)
        Forge->>ConfAPI: Create sanitized page with SHA-256 content fingerprint
        ConfAPI-->>Cockpit: Page published confirmation & URL
    end
```

### Component Boundaries
1. **Forge Cloud Backend (Node.js 24 runtime)**:
   - Runs deterministic scoring engine (`src/engine/scoring.js`).
   - Runs sensitive data scanner (`src/engine/securityGate.js`).
   - Generates Confluence storage format XHTML with SHA-256 integrity hash (`src/engine/confluenceReport.js`).
2. **Jira REST API & Teamwork Graph**:
   - Accessed securely via `@forge/api` using user context (`.asUser()`).
   - Retrieves linked issue keys, issue types, resolution statuses, and dependency links.
3. **Rovo Agent Actions (`rovo:agent`)**:
   - Manifest-defined AI teammate executing three modular skills: `evaluateReleaseReadiness`, `explainScore`, and `scanReleaseSecurity`.
4. **Native UI Kit Frontend (`@forge/react`)**:
   - Server-rendered directly inside Jira project pages and global top-navigation.

---

## 🎯 Key Features

### 1. 🧮 Explainable, Deterministic Scoring Model
No hallucinations or arbitrary AI percentages. The score is computed using an auditable formula:

$$\text{Readiness Score} = 100 - (W_b \times B) - (W_d \times D) - (W_s \times S) - (W_q \times Q)$$

* **$B$ (Unresolved Blockers)**: Sev-1/Sev-2 issues, critical bugs ($W_b = 25$)
* **$D$ (Cross-Team Dependencies)**: In-progress or blocked upstream services ($W_d = 20$)
* **$S$ (Security Clearance Findings)**: Exposed credentials and sensitive data ($W_s = 20$)
* **$Q$ (Quality & Approvals)**: Missing release owner sign-off or QA clearance ($W_q = 10$)

#### Auditable Rule Deductions
Every deduction links directly to an affected ticket key, responsible owner, and required remediation:

| Rule ID | Category | Description | Penalty | Remediation Action |
|---|---|---|---|---|
| `RULE-BLK-01` | Release Blockers | Unresolved Sev-1/Sev-2 defect | -25 pts | Resolve defect or obtain documented VP waiver |
| `RULE-DEP-02` | Teamwork Graph | Downstream service dependency in progress | -20 pts | Wait for dependency release or decouple feature flag |
| `RULE-SEC-01` | Security Gate | Critical secret / API token exposed | -20 pts | Revoke token, sanitize Jira, and rotate credential |
| `RULE-QAL-01` | QA Hygiene | Incomplete regression test suite | -15 pts | Execute automated suite or attach QA sign-off |
| `RULE-APV-01` | Governance | Missing Release Owner sign-off | -10 pts | Obtain documented approval before shipping |
| `RULE-APV-02` | Governance | Missing Security Lead sign-off | -10 pts | Obtain documented security approval |

---

### 2. 🛡️ Release Security Clearance Gate
A non-destructive sensitive data scanner operating on release-linked issue descriptions, comments, and Confluence pages.

* **Classifications**:
  * 🔴 **BLOCKED**: Active AWS keys (`AKIA...`), GitHub personal access tokens (`ghp_...`), JWT tokens, RSA private keys (`-----BEGIN PRIVATE KEY-----`), database URIs with passwords.
  * 🟡 **REVIEW REQUIRED**: Ambiguous bearer tokens, unverified secrets, sensitive customer PII (Social Security, credit card patterns).
  * 🟢 **CLEAR**: No exposed secrets or all findings verified and waived.
* **Zero-Mutation Guarantee**: Never mutates or deletes original Jira tickets. Redaction is applied strictly to the generated Confluence sign-off brief (`AKIA****************WXYZ`).

---

### 3. 🤖 Atlassian Rovo Agent & Reusable Skills
Native AI teammate integration providing conversational release intelligence:

* **Prompt-as-Code Agent**: `release-readiness-commander-agent` registered in Forge manifest.
* **Modular Rovo Skills**:
  * `evaluateReleaseReadiness`: Computes live Go / Conditional Go / No-Go score.
  * `explainScore`: Explains itemized deductions with owner and remediation steps.
  * `scanReleaseSecurity`: Returns sensitive data findings with evidence links.
* **Conversation Starters**:
  * *"Is release v2.4.0-RC1 ready to ship?"*
  * *"Why is this release No-Go? Explain the score"*
  * *"Scan release tickets for sensitive data and credential leaks"*
  * *"Show open Teamwork Graph dependencies holding up the release"*

---

### 4. 📊 Native Jira Release Cockpit
Built with `@forge/react` UI Kit:
* **Dynamic Score Meter**: Circular progress gauge with status badge (`🔴 NO-GO`, `🟡 CONDITIONAL GO`, `🟢 READY TO SHIP`).
* **Auditable Deductions Table**: Itemized rules, affected issues, owners, point deductions, and remediation links.
* **Teamwork Graph Tab**: Visual list of cross-service blocker relationships and upstream teams.
* **Security Clearance Tab**: Real-time summary of credential scans and PII findings.
* **1-Click Simulation Toggle**: Instant toggle between active blocked state and cleared ready-to-ship state for live demos.

![Release Readiness Cockpit UI Breakdown](docs/images/cockpit-live-view.png)

---

### 5. 📄 Cryptographic Confluence Sign-off Brief
One-click generation of an executive release audit report published directly into Confluence:
* Automatically redacted sensitive data.
* Structured sign-off checklist for Engineering Lead, QA Lead, and Security Lead.
* **SHA-256 Content-Integrity Fingerprint**: Every generated brief includes a tamper-resistant hash `sha256:7f4a...` ensuring post-release integrity.

---

## 🔒 Security & Privacy

* **Least-Privilege Scopes**: The app only requests the minimum scopes required for Jira issue evaluation and Confluence page drafting (`read:jira-work`, `write:jira-work`, `read:space:confluence`, `read:page:confluence`, `write:page:confluence`).
* **Runs 100% on Atlassian Cloud**: Fully hosted in Atlassian Forge's secure container sandbox. Customer code and ticket data never egress to third-party cloud servers or external databases.
* **Zero Persistent Data Storage**: Assessments are performed ephemerally in-memory at evaluation time; no ticket data is cached or stored outside Atlassian.
* **Read-Only Inspection**: The security clearance gate never deletes or modifies original Jira ticket descriptions or comments, eliminating the risk of data loss or corrupted tickets.
* **Automated Redaction Policy**: All credentials, private tokens, and PII are masked in generated Confluence briefs before publishing.

---

## ⚠️ Limitations & Scope

* **Dependency Graph Data**: While cross-project issue links are supported, deep multi-tier service dependency analysis utilizes simulated Teamwork Graph link relationships if upstream team projects do not have link permissions enabled.
* **Scanner False Positives**: Pattern recognition may occasionally flag high-entropy mock tokens or test fixtures present in automated test tickets. These can be cleared via human waiver.
* **Human-in-the-Loop Governance**: Release Readiness Commander is an advisory decision-support tool. It does not auto-deploy code or replace designated engineering leads; final sign-off is always human-controlled.
* **No Automatic Credential Revocation**: Discovered secrets are flagged and masked in reports, but the app does not automatically revoke keys against third-party providers (e.g., AWS IAM) to avoid unintentional production outages.

---

## 🏆 Codegeist 2026 Alignment

| Track / Bonus | How Release Readiness Commander Qualifies |
|---|---|
| **Software Teams Track** | Primary submission: automates Jira release gating, cross-project dependencies, and QA hygiene. |
| **Best Rovo Agent** | Full `rovo:agent` module with prompt-as-code and reusable `action` skills (`evaluateReleaseReadiness`, `explainScore`, `scanReleaseSecurity`). |
| **Teamwork Graph** | Maps cross-service dependencies between Jira issues, components, and upstream teams to surface hidden delivery risks. |
| **Runs on Atlassian** | 100% hosted and executed on Atlassian Forge Cloud infrastructure (ARM64 Node runtime, zero external hosting dependencies). |

---

## 🛠️ Project Structure

```
release-readiness-commander/
├── manifest.yml                # Forge manifest registering Rovo agent, Jira pages, actions & scopes
├── package.json                # Dependencies (@forge/react, @forge/api, @forge/resolver)
├── LICENSE                     # MIT License (kbytehub0x)
├── README.md                   # Complete documentation and architecture guide
├── docs/
│   └── images/                 # Architecture diagrams and UI screenshots
└── src/
    ├── index.js                # Forge backend resolvers & Rovo action handlers
    ├── frontend/
    │   └── index.jsx           # Native UI Kit Jira Release Cockpit
    └── engine/
        ├── scoring.js          # Deterministic readiness scoring engine & rule matrix
        ├── securityGate.js     # Sensitive data & credential leak scanner
        ├── confluenceReport.js # Storage format report generator with SHA-256 hash
        └── jiraScanner.js      # Jira API data provider with demo scenarios
```

---

## 🚀 Installation & Local Development

### Prerequisites
* Node.js v20+
* Atlassian Forge CLI (`@forge/cli@^14.2.0`)
* Atlassian Cloud Developer Site with Jira and Confluence

### 1. Clone the repository
```bash
git clone https://github.com/kbytehub0x/release-readiness-commander.git
cd release-readiness-commander
```

### 2. Install dependencies
```bash
npm install
```

### 3. Deploy to Forge
```bash
forge deploy
```

### 4. Install onto your Atlassian site
```bash
forge install
```

Select your Jira Cloud site (e.g., `<your-site>.atlassian.net`) and authorize the required permissions.

---

## 🎬 Demo Walkthrough

1. **Open Jira Project Page**: Navigate to **Release Readiness Cockpit** from the project sidebar or top navigation.
2. **Review Initial State (NO-GO: 8/100)**:
   * View the circular gauge showing a critical blocker score.
   * Review the **Auditable Deductions Table**: -25 pts for Sev-1 defect `PAY-482`, -20 pts for downstream dependency `billing-service-v2`, and -20 pts for exposed AWS credential in ticket comments.
3. **Ask Rovo Agent**:
   * Open Atlassian Rovo and ask: *"Why is release v2.4.0-RC1 No-Go? Explain the score."*
   * Rovo executes the `explainScore` action and returns the exact rule deductions and remediation actions.
4. **Simulate Remediation**:
   * Click **"Simulate Remediation (All Gates Cleared)"** in the Cockpit.
   * Watch the score jump to **95/100 (READY TO SHIP)** with a green Lozenge.
5. **Publish to Confluence**:
   * Click **"Publish Confluence Sign-off Brief"**.
   * Open Confluence to inspect the newly published page containing sanitized findings, an approval matrix, and the SHA-256 content-integrity fingerprint.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 **kbytehub0x**
