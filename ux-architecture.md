# AI Digital Twin Platform: Product Architecture & UX Design

## Overview
The **AI Digital Twin Platform** is a production-grade SaaS application designed for professional electronics engineers. It provides a robust suite of tools to visually design hardware architectures, stream live telemetry, run simulated failure scenarios, and leverage AI to detect anomalies and explain system behaviors.

The experience is modeled after industry standards like **Grafana, Datadog, and Figma**, emphasizing:
- High data density yet clean typography
- Responsive, real-time feedback loops
- Dark-mode optimized technical interfaces
- Intuitive drag-and-drop mechanics

---

## 1. Landing Page
The landing page serves as the marketing and entry point for the SaaS platform.

- **Hero Section**: 
  - Dynamic 3D or animated React Flow visualization of a circuit board translating into a digital twin.
  - Value proposition headline: *"Predict Component Failures Before They Happen."*
  - Primary CTA: **"Start Building Your Twin"** | Secondary: **"View Live Demo"**
- **Feature Highlights (Bento Grid)**:
  - Visual builder preview.
  - Telemetry simulation charts.
  - AI Anomaly Detection confidence scores.
- **Architecture Explainer**: A step-by-step interactive diagram showing Data Ingestion → AI Processing → Real-time Insight.
- **Footer**: Typical SaaS links (Docs, API, Status, Login).

---

## 2. Authentication System
A frictionless, secure entry point for engineers.

- **Login / Signup Pages**:
  - Split layout: Left side contains the form, right side features a dark-themed, abstract visualization of telemetry data or system glowing nodes.
  - Form: Email/Password login, with an integrated **"Continue with Google"** OAuth button for quick access.
- **Onboarding Flow**:
  - Upon first signup, the user is greeted by a short 3-step modal.
  - Step 1: Industry / Role selection (e.g., IoT Engineer, embedded systems).
  - Step 2: "Would you like to load a sample template (e.g., Smart Home Sensor Network) or start from scratch?"
  - Step 3: Redirects to the **Dashboard Page**.

---

## 3. Main Application Layout
A persistent, app-like shell providing global navigation.

- **Sidebar Navigation (Left)**:
  - Collapsible, minimal icons with labels.
  - Links: Dashboard, Systems, Telemetry, AI Insights, Alerts, Knowledge Base, Settings.
- **Top Navigation Bar**:
  - **Breadcrumbs**: e.g., `Systems / Home HVAC Monitor / Simulation`.
  - **Global Search**: `Cmd + K` palette to jump to specific components or alerts rapidly.
  - **Global Status**: WebSocket connection indicator (Green circle = Connected).
  - **Notification Bell**: Dropdown for realtime alerts.
  - **Profile Avatar**: Dropdown for account management and theme toggle (Dark/Light).
- **Layout Behavior**: Content area uses `flex-1 overflow-auto` for independent scrolling, maintaining a locked sidebar and header.

---

## 4. Dashboard Page
The command center giving a 10,000-foot view of all managed systems.

- **System Health Overview (Top Row)**:
  - 4 KPI styled standard widgets (ShadCN Cards):
    - Total Systems Monitored
    - Active Alerts (Critical / Warning)
    - AI Anomaly Rate (Last 24h)
    - Global Telemetry Throughput (req/sec)
- **Active Systems Grid**:
  - Cards for each system showing a miniature sparkline chart and a binary health status (Normal / Degraded).
- **Live Activity Feed (Right Column)**:
  - A chronological timeline of events (e.g., "System X simulation started", "AI detected voltage spike on Component Y").

---

## 5. Systems Management Page
The inventory of all digital twins.

- **List/Grid Toggle**: Allow users to view systems as dense table rows or expanded cards.
- **System Cards**: Display System Name, Last Updated, Component Count, and current Status.
- **Quick Actions**: Dropdown menu on each card (`Edit Architecture`, `Start Simulation`, `Delete`).
- **Create Flow**: Clicking "+ New System" opens a modal to define Name and Description, then routes directly to the **System Builder**.

---

## 6. System Builder (Core Feature)
A Figma-like canvas powered by **React Flow** for designing hardware topologies.

- **Left Panel (Library)**:
  - Accordion categories: Sensors (Temperature, Pressure), Microcontrollers (ESP32, Arduino), Actuators, Power Modules, Comm Modules.
  - Draggable items onto the canvas.
- **Center Canvas (Design Area)**:
  - Infinite panning and zooming grid.
  - Users drag wires (edges) between component nodes (e.g., Power Supply 5V out -> MCU Vin).
- **Right Panel (Properties)**:
  - Contextual. When a component is clicked, this panel updates.
  - Allows editing specific parameters: operating voltage, noise variance, custom labels.
- **Top Canvas Toolbar**:
  - Undo/Redo, Align, Save Layout, and a prominent **"Run Simulation"** button.

---

## 7. Simulation Page
Controls the virtual stress-testing and baseline generation.

- **Header Controls**:
  - Play, Pause, Stop buttons.
  - Simulation Speed multiplier (1x, 2x, 5x).
- **Configuration Panel**:
  - Define environment variables (e.g., simulate an environment temperature drop).
- **Failure Injection Interface**:
  - A table of components with a "Trigger Failure" dropdown (e.g., select Motor -> Inject "Overheating").
- **Live Output**:
  - A streaming log terminal showing raw WebSocket output (JSON strings) for developer transparency.

---

## 8. Telemetry Monitoring Page
A Grafana-style dashboard dedicated to high-frequency signal analysis.

- **Time-series Graphs**:
  - Utilizes **Recharts** to plot multiple synchronized line charts.
  - E.g., Chart 1: Voltage over time. Chart 2: Temperature over time.
- **Toolbar**:
  - Time window selector (Last 5 mins, 1 Hour, 24 Hours).
  - Component multi-select dropdown to overlay specific signal paths.
- **Signal Comparison**:
  - Ability to drag two metrics onto the same Y-axis or split them into stacked charts to visually correlate events.

---

## 9. System Visualization Page
The functional view of the digital twin acting in real-time.

- **Canvas View**: 
  - Reuses the React Flow layout, but locked for editing.
- **Dynamic Indicators**:
  - Wires between components animate based on data flow / power active.
  - Nodes pulse or glow based on telemetry.
  - **Health Indicators**: A green badge turns to orange or red if the AI backend detects an anomaly on that specific component node.
- **Popovers**: Hovering over a component reveals a dense tooltip showing its exact live metrics (e.g., `Current: 4.2mA`).

---

## 10. AI Insights Page
The predictive and analytical brain of the platform.

- **Anomaly Reports List**:
  - Table of historical anomalous events detected by the Isolation Forest / SVM models.
- **Report Detail View**:
  - **Failure Prediction**: A gauge chart showing the probability of complete failure within the next X hours.
  - **Root Cause Analysis (LLM Generated)**: A clear, human-readable paragraph explaining *why* the anomaly occurred based on the data signature.
  - **Recommendations**: Bulleted actionable steps (e.g., "Decrease input voltage on component PSU-1", "Inspect cooling logic on MCU").

---

## 11. Alerts Page
Operational response center for engineering teams.

- **Alert Log**:
  - Table sortable by Severity (Critical, High, Low), Time, and Source Component.
- **Quick Actions**:
  - Click to "Acknowledge" (mutes notifications) or "Resolve" (closes the alert).
  - Ability to attach notes to an alert for team visibility.

---

## 12. Knowledge Base Page
An interactive RAG (Retrieval-Augmented Generation) chat interface.

- **Chat Interface**: 
  - Similar to ChatGPT.
- **Capabilities**:
  - Engineer asks: *"Why is the ESP32 connection failing during the power drop simulation?"*
  - The AI queries the Vector Database (Pinecone) containing hardware datasheets and platform simulation histories to generate a highly technical, context-aware answer.
- **Suggested Queries**:
  - Quick chips at the bottom: "Diagnose latest anomaly", "Explain Isolation Forest logic."

---

## 13. Settings Page
Global configuration and account management.

- **Sidebar Navigation (Nested)**:
  - Account, Organization, API Keys, Simulation Limits, Alerting Rules.
- **Alert Thresholds**:
  - Global sliders or input boxes to define what constitutes a critical anomaly score vs a warning.
- **Data Retention**:
  - Options to configure how many days of high-fidelity telemetry are kept in PostgreSQL/Redis before aggregation.

---

## 14. UI Technology Stack
- **Frontend Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS + standard variables in `globals.css` (Tailwind v4 native).
- **Component Library**: **ShadCN UI** (Radix primitives for accessible, unstyled functionality wrapped in Tailwind).
- **Visual Builder**: `reactflow` for the node/edge architectural canvas.
- **Data Visualization**: `recharts` for responsive, animated time-series SVGs.
- **Realtime**: `socket.io-client` syncing with Node.js backend.
- **State Management**: `zustand` for handling complex drag-and-drop global state without context drilling.

---

## 15. UX and Product Design Patterns
- **High-Density Data**: Professional tools prioritize information density over whitespace. Use small text (`text-sm`, `text-xs`) with high contrast.
- **Dark Mode First**: Technical tools (IDE, Grafana) are overwhelmingly used in dark mode. Heavy use of neutral grays (`bg-neutral-900`, `bg-neutral-950`) with vivid accent colors (Cyan for data, Emerald for health, Rose for alerts).
- **Loading States**: Skeletons for charts and metrics to prevent layout shift.
- **Error Handling**: Graceful degradation. If a WebSocket disconnects, show a clear un-intrusive banner ("Reconnecting...") rather than a full page block.
- **Real-Time Ethos**: Wherever possible, values should increment or tick visually rather than requiring manual page refreshes.
