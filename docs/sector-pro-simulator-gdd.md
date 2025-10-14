# Sector Pro Simulator – Game Design Document

## 1. Core Gameplay Summary
Sector Pro Simulator is a pausable real-time management game about orchestrating live event production. Players accept contracts, allocate staff and gear, and react to crises during execution. Systems emulate real-world production workflows while remaining approachable for players unfamiliar with industry jargon.

## 2. Systems Overview
### 2.1 Time & Structure
- **Calendar-Driven Progression:** The in-game calendar advances in days with adjustable speed controls. Events consume scheduled days; downtime enables hiring, maintenance, and upgrades.
- **Pausable Real-Time:** Planning occurs with time paused. During events, the clock continues, but players can pause, slow, or fast-forward to manage crises or skip uneventful periods.

### 2.2 Contracts & Events
- **Event Categories:**
  - **Gigs:** Single-day shows with straightforward staffing and limited gear needs.
  - **Tours:** Chains of gigs across multiple venues. Require travel planning, rotating crews, and consolidated equipment logistics.
  - **Festivals:** High-complexity, single-location events with multiple stages running concurrently.
- **Contract Negotiation:** Each offer outlines requirements, budget, and success metrics. Declining contracts carries no penalty but delays income. Accepting without adequate preparation risks failure.

### 2.3 Crew Management
- **Roles:** Sound, Lighting, Video, Stage/Rigging, Electricians, Drivers, and Production Leads.
- **Attributes:** Skill level, stamina, morale, certifications, and traits (e.g., "Calm Under Pressure").
- **Scheduling:** Drag-and-drop assignments with availability warnings. Overworking staff reduces stamina and increases error probability.
- **Progression:** Experience gained per event improves skills. Training programs unlock new competencies or cross-discipline abilities.
- **Events & Requests:** Crew may demand raises, call in sick, or clash with teammates, presenting narrative decision points.

### 2.4 Equipment & Logistics
- **Inventory Types:** Audio systems, lighting rigs, video walls, staging, power/generators, vehicles.
- **Ownership vs. Rental:** Owned gear has upfront cost and maintenance; rentals add per-event expenses but no upkeep.
- **Maintenance:** Scheduled servicing prevents breakdowns. Neglect increases failure rates during events.
- **Transport Planning:** Vehicles and routing influence travel time for tours and large gigs.

### 2.5 Economy & Progression
- **Financial Model:** Tracks income, payroll, rentals, maintenance, travel, and penalties. Bankruptcy occurs if negative cash persists beyond credit limits.
- **Reputation:** Unlocks higher-paying clients, larger venues, and sponsorship opportunities.
- **Upgrades:** Technology investments (automation software, AI rider analysis), facility improvements (warehouses, offices), and HR perks (break rooms) provide passive bonuses.

### 2.6 Live Event Phase
- **Isometric Visualization:** Displays venue layout, crew positions, and stage status indicators.
- **Alert & Crisis System:** Pop-up notifications for routine tasks; full-screen crisis dialogs for major issues with multiple resolution options.
- **Performance Metrics:** Sound quality, lighting impact, video fidelity, schedule adherence, safety compliance, and audience satisfaction feed into final scoring.

## 3. Game Modes
- **Career Mode:** Structured progression from local operator to international production house. Story beats and milestone contracts provide long-term goals.
- **Sandbox Mode:** Unlimited funds and unlocked events for experimentation. Difficulty modifiers allow custom stress levels.
- **Challenge Scenarios (Optional):** Curated situations such as "Disaster Festival" or "Revive a Failing Tour" with unique win conditions.

## 4. User Interface Design
### 4.1 Global Layout
- **Top Bar:** Date/time, funds, reputation, weather summary, notification icons.
- **Primary View Pane:** Switches between dashboard panels and isometric map.
- **Navigation Drawer:** Quick access to Crew, Calendar, Finances, Inventory, Upgrades, and Settings.

### 4.2 Key Screens
- **Overview Dashboard:** Upcoming events list, KPIs, alerts, and quick actions.
- **Calendar:** Weekly/monthly view with drag-to-assign functionality and travel indicators.
- **Event Detail:** Requirements checklist, crew/equipment assignment panels, budget summary, notes, and readiness status.
- **Festival Planner:** Map editor with stage placement, department overlays, and lineup scheduling.
- **Live Event HUD:** Timeline scrubber, queue of alerts, crisis buttons, and crew task panels.
- **Crew Roster:** Filters by role, fatigue, morale; individual profiles with history and training options.
- **Equipment Manager:** Inventory table with condition, location, and maintenance schedule; purchasing and rental marketplaces.
- **Finance Suite:** Profit & loss charts, cashflow ledger, loan management, sponsorship contracts.
- **Company Upgrades:** Tech tree style layout with prerequisites and passive bonuses.

### 4.3 UX Principles
- Consistent iconography across departments (audio, lighting, video).
- Contextual warnings before confirming risky actions (overbooking, underpowered generators).
- Tooltips explaining industry jargon to ease onboarding.
- Modular UI components supporting future feature additions.

## 5. Content Design
- **Venues:** Clubs, theaters, arenas, stadiums, outdoor fields; each with acoustics modifiers and logistical quirks.
- **Clients:** Bands, corporate events, festivals, each with different tolerance for delays, budgets, and rider complexity.
- **Crisis Library:** Technical failures, weather disruptions, artist issues, crew emergencies, and audience safety incidents. Each has probability weights tied to preparation quality.
- **Narrative Events:** Dialogue choices with consequences for morale, reputation, or finances (e.g., mediating crew disputes).

## 6. Technical Considerations
- **Engine:** Unity or Godot (final selection TBD) with focus on UI-heavy workflows and light-weight isometric scenes.
- **Data Management:** Scriptable data assets or JSON definitions for events, crew archetypes, and equipment catalogs to enable modding.
- **Simulation Layer:** Event resolution uses deterministic systems modified by random seeds and crew stats for replayability.
- **Localization:** UI designed to support multi-language text expansion.

## 7. Audio & Visual Direction
- **Visual Style:** Clean, modern interface combined with stylized isometric venues. Color coding differentiates departments.
- **Audio:** Ambient office sounds during planning, crowd and stage audio cues during events. UI feedback sounds reinforce actions and alerts.

## 8. Accessibility & Quality of Life
- Color-blind friendly palettes for department indicators.
- Scalable UI and customizable keybindings.
- Extensive tutorial tooltips, glossary, and contextual help overlay.
- Autosave before and after events.

## 9. Production Plan Snapshot
- **Pre-Production (2–3 months):** Prototype core loop, finalize art direction, design documentation.
- **Vertical Slice (3–4 months):** Implement MVP systems, deliver playable demo for feedback.
- **Alpha (4 months):** Complete major features, integrate tours/festivals, begin content authoring.
- **Beta (3 months):** Polish, balance economy, expand crisis library, optimize UI.
- **Launch Preparation (1 month):** Localization pass, marketing assets, final QA.

## 10. Risks & Mitigation
- **System Complexity:** Risk of overwhelming players; mitigate with layered tutorials and automation options.
- **Content Scope:** Tours and festivals are resource-intensive; mitigate by building reusable event templates and procedural variations.
- **Technical Debt:** UI-heavy projects can become unwieldy; mitigate with component-driven architecture and consistent style guidelines.

## 11. Future Opportunities
- Dynamic weather system, competitive AI companies, cooperative multiplayer, modding tools, and narrative campaign arcs. These features are candidates for post-launch expansions based on community feedback and resource availability.
