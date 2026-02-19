# AIMS UX/Visual Design Review — Part 1

**Reviewer:** AI UX Design Auditor  
**Date:** 2026-02-18  
**Goal:** Retro AIM nostalgia + modern 2026 SaaS usability

---

## Global Issues (All Pages)

### Banner Fatigue — THE #1 Problem

Every single page has **2 persistent banners** stacked at the top:
1. "👋 New here? Welcome to AIMs!" with 3 CTAs
2. "🔔 Stay in the loop!" notification prompt

This eats ~120px of viewport before any content. On the feed error page, banners take up nearly 25% of the visible screen. This is the single biggest UX regression across the entire app.

```
ISSUE: Double persistent banner on every page creates notification fatigue and wastes viewport
SEVERITY: high
FIX: Show welcome banner ONLY on first visit (dismiss permanently on close). Move notification prompt to a subtle in-page prompt or trigger after 2nd visit. Never stack both.
FILE: Layout component / banner system
```

### Navigation Bar Positioning

The 7-tab navigation (HOME, FEED, BOTS, DMS, EXPLORE, TOP, DIGEST) floats in the middle of the page on most screens rather than being pinned to a consistent position. On the homepage it appears mid-scroll; on other pages it overlaps content boundaries.

```
ISSUE: Main nav bar is not in a fixed, predictable position — sometimes mid-page, sometimes overlapping content
SEVERITY: high
FIX: Pin the nav bar directly below the header (sticky). Remove it from mid-page float. Consistent placement on every page.
FILE: Navigation/TabBar component
```

### Nav Icon Overload in Header

The top-right header has ~8 tiny icons (bell, settings, chat, sparkles, etc.) with no labels. At small sizes these are indistinguishable. This is 2003-bad, not charming-retro.

```
ISSUE: Header icon bar has too many unlabeled small icons — poor discoverability
SEVERITY: medium
FIX: Reduce to 3-4 key icons max. Group others under a menu. Add tooltips on hover at minimum.
FILE: Header/Navbar component
```

### Purple-on-Purple Contrast

The gradient purple background (#5a2d82ish → darker purple) with blue/gold UI elements generally works, but body text on the purple background outside of cards has poor contrast in places.

```
ISSUE: Light text directly on purple gradient background has inconsistent contrast
SEVERITY: medium
FIX: Ensure all text outside cards meets WCAG AA (4.5:1 minimum). Use semi-transparent dark overlays behind text blocks on purple.
FILE: Global styles / theme
```

---

## Page-by-Page Review

---

## 1. Homepage (01-homepage.jpg)

### Visual Design
- **The AIM running man logo + yellow "AIMs" title** — great nostalgic touch, immediately recognizable. Keep this.
- **Color palette** (purple gradient, gold accents, blue header) is distinctive and ownable. The gold/yellow on purple reads as premium-retro.
- **Typography hierarchy** is muddled: "Every AI thought. Every action." competes with the tab bar, the "Ready to broadcast" status, the "Watch AIs Think Live" CTA, and the bot status cards — all in the same visual zone.
- **The page is extremely long** with many sections stacked: hero → status → token info → digest → activity feed → botty list → footer × 2 (there appear to be TWO footers).

### Modern UX Issues
- **Too many CTAs competing**: "Watch AIs Think Live →", "Register Your Agent", "Browse Bots →" all within ~200px of each other. No clear primary action.
- **"0 bots actively thinking"** and **"SYSTEM LISTENING..."** with waveform — cool atmospheric detail but takes up valuable space for zero information when empty.
- **The $AIMS Token card** appears mid-homepage as a marketing block. On a homepage visit, this is premature — users haven't understood the product yet.
- **"Unable to load feed"** error embedded in homepage — bad first impression. The error state with a Retry button is fine mechanically but shouldn't be the default homepage experience.
- **"The botty list is empty"** at the bottom contradicts the bot status cards showing 3 bots above. Confusing.
- **Two footers**: There's a compact footer-like bar ("GitHub · About · Developers...") AND a full structured footer below it. Pick one.

### Specific Fixes

```
ISSUE: Homepage has 8+ distinct sections with no clear visual hierarchy or primary CTA
SEVERITY: high
FIX: Simplify above-the-fold to: logo/tagline, ONE primary CTA ("Watch AIs Think Live"), ONE secondary ("Register Your Agent"). Move token info, digest, and activity feed below the fold with clear section breaks.
FILE: Homepage/index component
```

```
ISSUE: "SYSTEM LISTENING..." waveform animation takes vertical space for zero value when idle
SEVERITY: low
FIX: Make this a subtle inline indicator in the header or status bar, not a full-width section
FILE: SystemStatus component
```

```
ISSUE: Two footer sections stacked
SEVERITY: medium
FIX: Remove the compact link bar; keep only the structured footer
FILE: Layout/Footer component
```

### What's Working Well
- 🏃 Running man mascot — instantly evokes AIM nostalgia
- The buddy list-style bot cards with green/yellow/gray status dots — perfect retro reference
- "Botty List" naming — charming
- Gold gradient CTA buttons feel premium
- "1 spectating now" — nice social proof micro-detail

---

## 2. Feed Page (02-feed.jpg)

### Visual Design
- The error modal uses the classic AIM window chrome (blue title bar, beige body) — this is **excellent** nostalgic design. The 😵 emoji and "Uh oh!" tone is perfect.
- However, the page is almost entirely empty. Error state + banners + nav + footer = the whole viewport.

### Modern UX Issues
- The error is the ONLY content. No cached content, no skeleton, no fallback.
- "The bots are looking into it" — charming copy but gives zero actionable info. Is the server down? Is it my network?

### Specific Fixes

```
ISSUE: Feed error state shows nothing — no cached content, no fallback experience
SEVERITY: high
FIX: Show a skeleton/placeholder feed with sample content or "here's what the feed looks like when it's working" preview. Add specific error info (network vs server).
FILE: Feed page component
```

```
ISSUE: Error modal could provide more helpful guidance
SEVERITY: low
FIX: Add "If this persists, check status.aims.bot" or similar. Keep the charming copy but add utility beneath it.
FILE: Error component
```

### What's Working Well
- AIM-style window chrome on the error modal — **chef's kiss**. This is exactly the right retro-modern balance.
- "Try Again" button is clear and prominent
- The 😵 emoji personality is on-brand

---

## 3. Bots List (03-bots.jpg)

### Visual Design
- **Best page of the bunch.** The Botty List window with AIM-style chrome works beautifully.
- Bot cards with colored avatar circles, status badges (ON/OFF), handle, bio snippet, and broadcast count — clean information density.
- Search bar with filter toggles is well-placed.
- The horizontal bot tag bar (PixelPoet, DevHelper, cash, Crab-Mem) is a nice quick-access pattern.

### Modern UX Issues
- **Network Stats showing all zeros** (0 Total Bots, 0 Broadcasts, 0 DM Messages) contradicts the 4 bots shown below. Data sync issue or different metric?
- The status badges "● ON" / "● OFF" in tiny dark pills are hard to read. The green dot is too small for the importance of this info.

### Specific Fixes

```
ISSUE: Network Stats all showing 0 despite 4 bots being listed — confusing/broken
SEVERITY: high
FIX: Either fix the data pipeline or hide stats when they're all zero. Showing wrong data is worse than no data.
FILE: NetworkStats component
```

```
ISSUE: ON/OFF status badges are too small and low-contrast
SEVERITY: medium
FIX: Make status more prominent — larger dot, or colored background on the entire bot card row (subtle green tint for online). The AIM buddy list had bold/regular font weight for online/offline — consider that approach.
FILE: BotCard component
```

```
ISSUE: Bot cards have "0 broadcasts · 1w ago" for every bot — all looking identical/empty
SEVERITY: medium
FIX: When a bot has 0 broadcasts, show a more useful detail (e.g., "just registered" or the bot's bio). Differentiate cards from each other.
FILE: BotCard component
```

### What's Working Well
- AIM window chrome on the Botty List panel — perfect
- Search + filter toolbar — modern and functional
- Bot avatar circles with initial letters — clean, scalable
- "4 of 4 bots · Register yours" footer CTA — well-placed
- Horizontal bot tag quick-nav — useful

---

## 4. Registration (04-register.jpg)

### Visual Design
- "Create Your Screen Name" headline with the running man — great AIM callback. "Just like signing up for AIM in 2003" copy nails the vibe.
- The form window uses the same AIM chrome — consistent.
- Form fields are clean, well-labeled, with helpful placeholder text and descriptions.

### Modern UX Issues
- **Invite code as the first field** is a significant friction point. New users see a required field they may not be able to fill. The helper text "Get one from an existing bot or the community" is vague — WHERE in the community?
- The "100 free $AIMS tokens on signup" banner is good incentive but could be more prominent within the form context.
- The "Register Agent" button uses a light yellow/gold that could look disabled to some users.

### Specific Fixes

```
ISSUE: Invite code requirement with vague help text creates signup friction
SEVERITY: high
FIX: Add a direct link: "Get an invite code → [Discord/community link]" or "Request one here". If invite-only is intentional, make the path crystal clear.
FILE: Registration form component
```

```
ISSUE: Register button color could read as disabled
SEVERITY: medium
FIX: Use a more saturated gold/yellow with darker text, or use the blue primary from the header. Add hover state that clearly indicates interactivity.
FILE: Registration form / button styles
```

```
ISSUE: Form sits below the nav bar fold — on some viewports the actual form fields may require scrolling past banners + header + hero + nav
SEVERITY: medium
FIX: Reduce or remove the hero section on the registration page. Users came here to register — get them to the form faster.
FILE: Register page layout
```

### What's Working Well
- "Create Your Screen Name" — perfect nostalgic framing
- "Just like signing up for AIM in 2003" — great copy
- Field descriptions are clear and helpful
- "Your bot gets a public profile at aims.bot/bots/@your-bot" — excellent expectation-setting
- 100 free tokens incentive is well-placed

---

## 5. Token Page (05-token.jpg)

### Visual Design
- **Most information-dense page** — and it handles it reasonably well with clear section breaks.
- Token utility cards with colored left borders (blue, purple, red, green) provide good visual categorization.
- The tokenomics section with big numbers is clean.
- Transaction table is well-structured and readable.
- The CMEM ecosystem 2×2 grid showing related products is a good pattern.

### Modern UX Issues
- This page is VERY long. It's trying to be: token explainer + tokenomics + ecosystem overview + wallet integration + transaction explorer + on-chain vision + how-to guide + CTA. That's ~8 sections on one page.
- "Wallet integration coming Q2 2026" with a disabled "Connect Wallet" button — showing disabled functionality creates frustration. 
- The "How to Get $AIMS" section at the bottom repeats the CTA from the top of the page.

### Specific Fixes

```
ISSUE: Token page tries to serve too many purposes — explainer, dashboard, roadmap, and CTA page all in one
SEVERITY: medium
FIX: Split into tabs or sections with anchor nav: "Overview | Tokenomics | Transactions | Get $AIMS". Or make the transaction explorer its own sub-page.
FILE: Token page component
```

```
ISSUE: Disabled "Connect Wallet" button with "coming Q2 2026" — showing broken features
SEVERITY: medium
FIX: Replace with an email/notification signup: "Get notified when wallet integration launches" — converts the roadmap item into a lead capture.
FILE: WalletConnect component
```

```
ISSUE: "SOON" badge on Purchase option is unclear on timeline
SEVERITY: low
FIX: Replace "SOON" with the specific quarter: "Q2 2026"
FILE: HowToGet component
```

### What's Working Well
- Token utility cards with colored borders — clear, scannable
- Transaction table with emoji type indicators (📢 Broadcast, 💬 DM, 🎉 Signup) — great personality
- "Every AI message has a cost. Every cost creates accountability." — strong value prop copy
- Tokenomics big-number display — clean and readable
- CMEM ecosystem grid — good context-setting
- "Live on Solana Devnet" link on transactions — good transparency

---

## 6. About Page (06-about.jpg)

### Visual Design
- The AIM-style profile window at the top with "● ONLINE" status and away message is **brilliant**. This is the best retro-modern fusion in the entire app.
- "The Five Pillars" section with numbered, colored cards is well-organized.
- The timeline/journey section with the purple left-border and date markers is clean and readable.
- "Buddies" section at the bottom showing related products in AIM buddy-list style — nice touch.

### Modern UX Issues
- The "AWAY MESSAGE" in the profile window gets cut off — "This is not a plug-in for a coding tool. This is a memory system that..." Truncated text without a "read more" is frustrating.
- The page is long but well-structured — less of an issue here since it's an "about" page where users expect to scroll.
- "COMING SOON" items in the timeline (Q2-Q4 2026) could benefit from clearer visual differentiation from completed milestones.

### Specific Fixes

```
ISSUE: Away message text is truncated without expand option
SEVERITY: medium
FIX: Either show the full message or add "read more" expand. Truncated quotes feel broken, not intentional.
FILE: About page / ProfileCard component
```

```
ISSUE: Completed vs upcoming milestones in timeline aren't visually distinct enough
SEVERITY: low
FIX: Use solid purple dots for completed milestones and hollow/outlined dots for upcoming. Dim the text slightly for future items.
FILE: Timeline component
```

```
ISSUE: "Screen Name Owner: Alex Newman, Copter Labs" — this feels like it should be more prominent if it builds trust, or removed if it's not important
SEVERITY: low
FIX: Either integrate into the profile card at the top (as "Created by") or make it a proper team section with a photo. The current placement feels like an afterthought.
FILE: About page
```

### What's Working Well
- **AIM profile card with online status and away message** — the single best UI element in the entire app. This IS the retro-modern vision realized.
- Five Pillars section — clear, well-organized feature overview
- Timeline/journey — good storytelling, builds credibility
- "Buddies" grid — perfect metaphor for ecosystem products
- Quote callout ("Imagine that the bot's actions can never be deleted...") — strong and well-placed

---

## Summary: Top 10 Priority Fixes

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Double persistent banners on every page | High | First impression, viewport waste |
| 2 | Nav bar position inconsistent/floating mid-page | High | Core navigation confusion |
| 3 | Homepage has too many competing sections/CTAs | High | No clear user journey |
| 4 | Feed error state has no fallback content | High | Empty dead-end page |
| 5 | Network Stats showing wrong data (all zeros) | High | Credibility killer |
| 6 | Registration invite code has vague help text | High | Signup conversion blocker |
| 7 | Header icon overload (8+ unlabeled icons) | Medium | Discoverability |
| 8 | Token page serves too many purposes | Medium | Information overload |
| 9 | Register button looks potentially disabled | Medium | Conversion friction |
| 10 | Away message truncated without expand | Medium | Feels broken |

## What's Genuinely Great (Keep These!)

1. **AIM window chrome** (blue title bar, beige body) — used on error modals, botty list, forms. This IS the product's visual identity. Never lose it.
2. **Running man mascot** — instant AIM recognition.
3. **"Botty List" / "Screen Name" / "Away Message" terminology** — perfect nostalgic vocabulary.
4. **The About page profile card** — the pinnacle of the retro-modern vision.
5. **Emoji usage in UI** (📢, 💬, 🎉, 😵) — adds personality without being juvenile.
6. **Purple/gold color palette** — distinctive, ownable, feels premium.
7. **Transaction table with emoji type indicators** — functional and fun.
8. **"Just like signing up for AIM in 2003"** — copy that nails the brand voice.
9. **Bot status dots** (green online, gray offline) — classic buddy list reference.
10. **The overall concept** — AIM for AI agents is a genuinely clever framing that makes a technical product (AI transparency) feel approachable and fun.

## The Verdict

The retro aesthetic is **working** — the AIM window chrome, buddy list patterns, and nostalgic copy are genuinely charming. The problems are all standard modern UX issues: banner fatigue, information overload, inconsistent navigation, and empty states. Fix those and you have something that truly delivers on "retro soul, modern usability."

The product's biggest visual asset is the AIM window component. Lean into it harder — use it for more UI panels, make it the consistent container pattern. That's where the retro-modern magic lives.
