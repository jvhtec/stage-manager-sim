# AI Competitors & Player Company Customization – Design Plan

This document captures the technical plan for the next staged implementation milestone referenced in the implementation roadmap. The focus is defining how rival production companies will operate in the shared calendar and how players can tailor their studio identity before a campaign begins. Both features must integrate with the existing systems for events, crew, equipment, finances, crises, and analytics that were introduced in prior iterations.

## Guiding Goals
- Preserve the contract → planning → execution → post-event loop while adding external pressure from competitors and personal agency via customization.
- Ensure new data structures extend the existing `GameState` without breaking current saves or UI surfaces.
- Deliver the features in incremental slices that can ship independently but compound into a richer simulation once combined.

## AI Competitor Companies

### Simulation Objectives
1. **Bid Pressure:** Competitors should contest high-value gigs and occasionally poach opportunities the player is targeting, forcing earlier decision-making.
2. **Calendar Conflict:** Rival bookings create staffing and equipment scarcity by locking in dates, making travel buffers and fatigue management more meaningful.
3. **Market Signaling:** The player should see how their reputation, pricing, and specialization compare to AI studios to inform strategic investments.

### Data Structures
Extend `src/types/game.ts` and `GameState` with a new `CompetitorCompany` interface:
```ts
interface CompetitorCompany {
  id: string;
  name: string;
  brandColor: string;
  specialties: Department[];
  reputation: number; // 0-100
  reliability: number; // influences cancellation odds
  baseRateModifier: number; // percentage applied to contract bids
  activeBids: string[]; // event IDs currently contested
  scheduledEvents: {
    eventId: string;
    status: 'pending' | 'booked' | 'completed';
    payout: number;
    scheduledOn: Date;
  }[];
  scoutingNotes: string[]; // surfaced in UI tooltips/ticker
}
```
Update `GameState` with:
```ts
competitors: CompetitorCompany[];
marketNews: MarketNewsItem[]; // optional dashboard ticker feed
```
`MarketNewsItem` is a lightweight struct capturing notable competitor moves, reused by the alert feed and dashboard ticker.

### Content Generation
- Seed 3–4 competitors at game start using templates that mirror the player company’s starting capabilities (e.g., audio specialist, lighting boutique, full-service rival).
- Templates define name pools, palette options, specialties, and baseline stats to ensure variety.

### Bidding & Scheduling Loop
Run a daily simulation step within `advanceDay` in `GameContext`:
1. **Contract Evaluation:** For each available event, calculate a desirability score using payout, department requirements, travel distance (once map data exists), and competitor specialties.
2. **Bid Decision:** Competitors decide to place or withdraw bids based on desirability, current workload (number of planned events within recovery windows), and balance thresholds.
3. **Resolution Timing:** Contracts auto-resolve on their accept-by date. If multiple bids exist, pick the highest reputation-adjusted offer. Losing bids feed morale/reputation adjustments back to the AI company to keep them dynamic.
4. **Scheduling Impact:** When a competitor wins, mark the event as unavailable to the player and add it to the competitor’s `scheduledEvents`. Also trigger market news entries and UI alerts.

### Reputation & Economics Feedback
- Winning high-tier contracts increases competitor reputation; failed events or cancellations reduce it.
- Track a simplified balance per competitor to limit runaway success and open windows for the player to capitalize on overextension.

### UI Integration
- **Dashboard ticker:** Show recent wins/losses and upcoming competitor events via `marketNews` entries.
- **Contract list overlay:** Add toggleable chips that reveal which competitors are bidding on an event, their specialty match, and projected quote.
- **Analytics view:** Reuse the financial trend components to chart player reputation vs. average competitor reputation over the last 30 in-game days.

### Implementation Phases
1. **Phase 1 – Data & Seeding:** Add types, initial competitor generation, and dashboard ticker stubs. Display static rival info without affecting gameplay.
2. **Phase 2 – Bidding Simulation:** Integrate the daily loop, adjust contract availability, and provide basic UI surfacing.
3. **Phase 3 – Reputation Feedback:** Hook in financial/reputation adjustments, add analytics comparisons, and expand crisis hooks so AI performance influences market conditions.
   - ✅ Daily schedule resolution now adjusts rival reputation, reliability, and pricing while emitting market headlines.
   - ✅ Reputation history powers a dashboard chart comparing the player to the field across a 30-day window.

## Player Company Customization

### Experience Goals
- Allow players to name their company, pick a color palette/logo accent, and choose a specialization perk before the first day.
- Make selections meaningful: specializations alter starting crew skills, equipment condition, or reputation modifiers.

### Data Model Changes
Augment the `Company` interface in `src/types/game.ts`:
```ts
interface Company {
  name: string;
  balance: number;
  reputation: number;
  level: number;
  brandColor: string;
  accentColor: string;
  specialization: 'audio' | 'lighting' | 'video' | 'stage' | 'balanced';
  tagline?: string;
}
```
Also add a lightweight `BrandingPreset` helper type to `src/lib/gameData.ts` for onboarding templates.

### Onboarding Flow
1. **Pre-Game Modal:** When a new game starts, surface a multi-step modal (or dedicated route) that captures company name, palette selection, specialization choice, and optional tagline.
2. **Real-Time Preview:** Mirror selections in a live preview card that uses existing dashboard components to ensure brand colors are WCAG-compliant.
3. **Confirmation:** On completion, write selections into the initial company record before the first contracts are generated.

### Systemic Effects
- **Specialization Perks:** Map each specialization to modifiers applied during `createInitialCompany`, `generateInitialCrew`, and `generateInitialEquipmentInventory`. Examples:
  - Audio: +1 skill to audio crew, slight discount on audio gear rentals.
  - Lighting: Start with higher-condition lighting rigs and slower wear decay.
  - Video: Unlock advanced crisis mitigation for visual systems (ties into crisis module).
  - Stage: Reduced fatigue accumulation for stage crew.
  - Balanced: +5 starting reputation and small cash bonus.
- **Brand Palette:** Feed `brandColor`/`accentColor` into dashboard headers, calendar badges, and financial charts.
- **Tagline:** Surface in the dashboard hero panel and event proposals for flavor.

### Persistence & Settings
- Extend save serialization utilities (when implemented) to include the new company fields.
- Allow palette/tagline edits later via a settings menu to accommodate rebranding mid-campaign (future milestone).

### Implementation Phases
1. **Phase 1 – UI & Storage:** Build the onboarding modal, update types, and ensure the new fields persist in state.
2. **Phase 2 – System Hooks:** Apply specialization modifiers to crew/equipment generation and integrate brand colors into core UI components.
3. **Phase 3 – Polish:** Add in-game rebranding tools, dynamic tutorial tips referencing the chosen specialization, and analytics filters.

## Risks & Mitigations
- **Complexity Overload:** Ship features in phases with feature flags to prevent destabilizing the existing loop.
- **UI Clutter:** Use progressive disclosure for competitor info and maintain clarity in the contract list with collapsible overlays.
- **Balance Drift:** Introduce tuning constants for AI aggressiveness and specialization perks; expose them via config for quick iteration.

## Next Steps Checklist
- [x] Document design requirements and phased implementation outline (this document).
- [x] Implement Phase 1 competitor data structures and dashboard surfacing.
- [x] Implement Phase 1 player customization onboarding and state wiring.
- [ ] Iterate on balance/UX based on playtesting feedback once features are interactive.
