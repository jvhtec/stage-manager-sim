# Sector Pro Simulator – Implementation Plan

This plan turns the design documentation into a staged roadmap for the playable prototype and beyond. Milestones build on the "Minimum Viable Product" and "Version 1.0" scope outlined in the roadmap while anchoring features to the gameplay loop described in the docs.

## Guiding Principles
- Preserve the contract → planning → execution → post-mortem loop as the backbone of all work.
- Deliver vertical slices that feel complete even if systems are simplified, expanding depth over time.
- Keep data structures modular (events, crew, equipment, finances) so that later content drops are additive, not rewrites.

## Milestone Breakdown

### 1. Prototype & Vertical Slice Foundations
Focus on the MVP experience highlighted in the roadmap: single-day gigs, lightweight crew management, basic finances, and a proof-of-concept event execution screen.

**Core Tasks**
1. **State Architecture**
   - Expand the central `GameState` to track contracts, crew, finances, and calendar metadata required by the gameplay loop.
   - Establish transaction logging and bankruptcy rules so economic feedback matters immediately.
2. **Planning Interfaces**
   - Build dashboard, calendar, event detail, and crew roster panels that surface contract requirements and staffing gaps.
   - Implement drag/select assignment tools per department with validation against contract requirements.
3. **Execution Stub**
   - Provide a simplified "complete event" resolution flow with auto-calculated satisfaction and reputation adjustments.
4. **Feedback & Reports**
   - Add a financial summary (income vs. expenses), recent performance indicators, and post-event results to close the loop.

**Deliverable**: Repeatable gig flow where players review offers, staff them, complete execution, and view the resulting financial/reputation changes.

### 2. Systems Enrichment (Pre-Alpha)
Once the loop is stable, layer in depth aligned with the GDD and gameplay loop.

**Key Additions**
- **Scheduling Pressure**: Multiple concurrent events, travel buffers, and fatigue to force trade-offs.
- ✅ Implemented event time windows, travel buffers, and crew recovery locks to make overlapping gigs harder to staff.
- **Crew Progression**: Experience gains, certifications, and morale events that feed narrative choices.
- **Equipment Management**: Inventory ownership vs. rental, maintenance timers, and breakdown risks.
- **Risk & Crisis System**: Light-weight crisis prompts during planning/execution tied to preparation quality.

### 3. Feature Expansion for Tours & Festivals (Alpha)
Open up the event variety described in the GDD.

- Create tour chains with routing and rotation logic.
- Build a festival planner view with multi-stage scheduling and resource overlays.
- Introduce transport logistics (vehicles, travel time) that interact with staffing availability.

### 4. Production Polish (Beta → Launch)
- Replace placeholder UI/UX with final art, iconography, and audio as outlined in the GDD.
- Implement advanced analytics (P&L charts, reputation tracking), tutorials, and localization hooks.
- Harden simulation determinism, autosaves, and accessibility options.

## Immediate Next Steps
1. Implement the financial tracker and bankruptcy checks called out in the MVP scope.
2. Connect post-event completion to income/expense transactions and surface them in a dedicated Finances view.
3. Expose ledger data on the dashboard so the player can react to budget trends without leaving the core loop.

This staged plan ensures every iteration honors the authentic backstage management fantasy while keeping scope sustainable for a solo developer.
