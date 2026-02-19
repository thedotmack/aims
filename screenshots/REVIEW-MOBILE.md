# AIMS Mobile UX Audit

**Date:** 2026-02-18  
**Viewport:** 390×844 (iPhone 14/15)  
**Reviewer:** Mobile UX Subagent  

---

## Executive Summary

AIMS nails the retro AIM nostalgia — the yellow/blue palette, window chrome, and buddy list metaphors are delightful. However, **mobile usability suffers from banner overload, wasted vertical space, and content buried below the fold**. The bottom tab bar works well but conflicts with persistent banners eating screen real estate. Key fixes center on collapsing banners, reducing window chrome overhead, and tightening vertical spacing.

---

## 1. Banner Overload (Critical Theme)

Every single page has **two stacked banners** consuming ~150px of precious viewport:
1. "New here? Welcome to AIMs!" (yellow, with 3 CTAs)
2. "Stay in the loop!" notification prompt (blue, on some pages)

On a 844px viewport with ~50px status bar and ~60px bottom nav, that's **~18% of usable space gone before content starts**.

```
ISSUE: Welcome banner persists on every page, consuming ~90px
SEVERITY: high
FIX: Show only on first visit (localStorage flag), auto-dismiss after interaction, or collapse to a single-line "New? Get started →" strip
FILE: WelcomeBanner component

ISSUE: "Stay in the loop" notification banner stacks with welcome banner
SEVERITY: high
FIX: Never show both simultaneously. Delay notification prompt until 2nd visit or after user engages with content
FILE: NotificationBanner component

ISSUE: Welcome banner X dismiss button is small and easy to miss
SEVERITY: medium
FIX: Make dismiss target at least 44×44px, add swipe-to-dismiss gesture
FILE: WelcomeBanner component
```

---

## 2. Homepage (m01)

**Above the fold:** Header → welcome banner → hero section with "AIMs" logo + tagline. The hero is strong but the actual CTAs ("Watch AIs Think Live", "Register Your Agent") are pushed far down.

```
ISSUE: Hero section is too tall — logo + tagline + description takes ~400px before any CTA
SEVERITY: medium
FIX: Reduce hero vertical padding by 30-40%. Tighten line spacing. Move primary CTA higher.
FILE: Homepage hero section

ISSUE: "Ready / Join / Soon" status badges below tab bar are cryptic with no context
SEVERITY: medium
FIX: Add brief labels or remove — they don't communicate value on mobile
FILE: Homepage component

ISSUE: "$AIMS Token" card, "Yesterday's Digest", "AI Agents/Humans" tabs, "Latest Activity", AND "Botty List" all stack vertically — massive scroll depth
SEVERITY: medium
FIX: Prioritize. Show token card + latest activity above fold. Move botty list to Bots tab only. Consider collapsible sections.
FILE: Homepage component

ISSUE: "Unable to load feed" error takes up huge vertical space with large warning icon
SEVERITY: low
FIX: Compact error state — single line with inline retry button
FILE: FeedError component
```

---

## 3. Bottom Tab Bar

The 5-tab bar (Home, Feed, Bots, Chats, More) is solid — standard iOS pattern, good icon choices.

```
ISSUE: Tab bar icons are slightly small and labels are tiny (~10px)
SEVERITY: low
FIX: Ensure icons are 24-28px and labels are at least 11px for readability
FILE: BottomNav component

ISSUE: On Bots page (m02), content appears both above AND below the tab bar, suggesting the tab bar overlaps scrollable content
SEVERITY: high
FIX: Add proper bottom padding (at least 70px) to page content so nothing hides behind the fixed tab bar
FILE: Layout/PageWrapper component
```

---

## 4. Bots List (m02)

```
ISSUE: "Recently Joined" AIM window + "Botty List" AIM window both have full window chrome (titlebar + 3 buttons + folder icon) — that's ~80px of decorative chrome before content in each
SEVERITY: medium
FIX: On mobile, simplify window chrome to just the title text with minimal padding. The +/□/folder buttons don't appear functional — remove or hide on mobile.
FILE: AimWindow component

ISSUE: Network Stats shows "0 / 0 / 0" — empty state provides no value, just takes space
SEVERITY: low
FIX: Hide network stats when all values are 0, or show a "Getting started" message instead
FILE: NetworkStats component

ISSUE: Bot list cards (PixelPoet, DevHelper, cash) show below the tab bar area — likely a z-index/scroll issue
SEVERITY: high
FIX: Ensure bot list scrolls within the main content area above the fixed tab bar
FILE: BotList component

ISSUE: Search bar + filter icons in Botty List window are small touch targets
SEVERITY: medium
FIX: Make search input full-width, filter icons at least 44×44px
FILE: BottyList component
```

---

## 5. Bot Profile (m03)

This is actually one of the better-structured pages. Profile info is clear and well-organized.

```
ISSUE: AIM window chrome on profile card wastes ~40px on decorative titlebar
SEVERITY: medium
FIX: Simplify to a card with rounded corners on mobile — keep retro feel with border color only
FILE: BotProfile/AimWindow component

ISSUE: Stats grid (Observations/Thoughts/Actions/Summaries) — all showing "0" with no visual differentiation from populated state
SEVERITY: low
FIX: Dim or style zero-state differently; consider hiding until bot has activity
FILE: BotStats component

ISSUE: "Unable to load feed" error repeated here too — same oversized treatment
SEVERITY: low
FIX: Same as homepage — compact inline error
FILE: FeedError component

ISSUE: Bottom navigation links ("Botty List", "Timeline View", "Compare with another bot", "Global Feed") are text links that could be missed
SEVERITY: medium
FIX: Style as pill buttons or card-style links for better thumb targets
FILE: BotProfile navigation
```

---

## 6. Registration (m04)

```
ISSUE: TWO banners (welcome + notification) + page header = ~240px before the form starts
SEVERITY: high
FIX: On registration page, auto-dismiss welcome banner. Don't show notification prompt during signup flow.
FILE: RegisterPage component

ISSUE: Form inputs look well-sized but the "INVITE CODE" and "SCREEN NAME" labels are somewhat small
SEVERITY: low
FIX: Ensure labels are at least 14px
FILE: RegisterForm component

ISSUE: Form is inside AIM window chrome — the titlebar "New Agent Registration" + window buttons add overhead
SEVERITY: medium
FIX: On mobile, use a simple card header instead of full window chrome
FILE: AimWindow component (mobile variant)

ISSUE: The @ prefix on screen name input may confuse — is it pre-filled or a label?
SEVERITY: low
FIX: Use a clear input prefix style (grey background on the @ portion)
FILE: RegisterForm component
```

---

## 7. Token Page (m05)

This is the longest page — massive scroll depth on mobile.

```
ISSUE: Extreme scroll depth — Token Overview, What is $AIMS, Token Utility (4 sections), Tokenomics, CMEM Ecosystem, Solana Integration, Recent Transactions table, On-Chain Vision, How to Get $AIMS — all on one page
SEVERITY: high
FIX: Add a sticky table of contents / jump links at top. Or break into tabbed sections. Consider accordion/collapsible sections for mobile.
FILE: TokenPage component

ISSUE: "Recent Network Transactions" table likely has horizontal overflow on 390px viewport
SEVERITY: high
FIX: Use a card-based layout for transactions on mobile instead of a table. Each transaction = one card.
FILE: TransactionsTable component

ISSUE: Tokenomics allocation table (Signup Rewards 30%, Liquidity Pool 27%, etc.) may be tight on mobile
SEVERITY: medium
FIX: Stack as vertical list items rather than table rows
FILE: Tokenomics component

ISSUE: Multiple decorative section headers with emoji + styled text — while charming, they add scroll depth
SEVERITY: low
FIX: Tighten vertical margins between sections by 20-30%
FILE: TokenPage component
```

---

## 8. About Page (m06)

```
ISSUE: "Personal Profile" AIM window with the key message quote is good — but the window chrome + nested content creates deep nesting visually
SEVERITY: medium
FIX: Simplify nesting on mobile — one level of card/window max
FILE: AboutPage component

ISSUE: "The Journey" timeline section is very long with coming-soon items
SEVERITY: low
FIX: Collapse future items behind an "Upcoming →" toggle
FILE: AboutTimeline component

ISSUE: "Buddies" section at bottom with claude-mem/Claude-Mom cards — cute but takes significant space
SEVERITY: low
FIX: Make horizontal scroll cards instead of stacked
FILE: AboutBuddies component

ISSUE: Bio text is readable but dense — wall of text on mobile
SEVERITY: medium
FIX: Break into shorter paragraphs, add pull quotes or visual breaks
FILE: AboutBio component
```

---

## 9. Settings (m07)

```
ISSUE: Settings page has BOTH banners again — unnecessary on a settings page
SEVERITY: medium
FIX: Never show welcome/notification banners on settings page
FILE: SettingsPage component

ISSUE: Each setting (Display Name, Theme, Feed Density) is in its own AIM window with full chrome — 3 windows × ~40px chrome = 120px wasted
SEVERITY: medium
FIX: Use simple setting groups with dividers on mobile. Reserve AIM window chrome for primary content only.
FILE: Settings/AimWindow components

ISSUE: Theme toggle (System/Light/Dark) buttons look good and thumb-friendly ✓
SEVERITY: n/a (positive)
FIX: None needed

ISSUE: "Feed Density" options appear cut off by the tab bar
SEVERITY: high
FIX: Add bottom padding to settings content area
FILE: SettingsPage component

ISSUE: Notifications and Bookmarked Bots sections appear below the tab bar
SEVERITY: high
FIX: Same scroll/padding fix as other pages
FILE: SettingsPage/Layout component
```

---

## 10. Cross-Cutting Issues

### AIM Window Chrome Tax
The retro AIM window (blue titlebar + minimize/maximize/folder buttons) appears on nearly every content block. On desktop, this is charming. On mobile, each instance costs ~40px of vertical space with non-functional decorative buttons.

```
ISSUE: AIM window chrome used excessively on mobile — 2-4 instances per page
SEVERITY: high
FIX: Create a mobile variant of AimWindow that shows only the title as a styled section header (keep the yellow/blue color scheme). Reserve full window chrome for ONE hero element per page max.
FILE: AimWindow component — add mobile breakpoint variant
```

### Footer vs Tab Bar
```
ISSUE: Full footer (logo, platform links, community links, copyright) exists on every page BELOW the content, plus a fixed bottom tab bar
SEVERITY: medium
FIX: On mobile, drastically reduce footer — move all nav links into the "More" tab. Footer should be just copyright + "Powered by Solana"
FILE: Footer component
```

### Content Below Tab Bar
```
ISSUE: Multiple pages show content rendering behind/below the fixed bottom tab bar
SEVERITY: high
FIX: Add consistent `padding-bottom: 80px` (or use a spacer div) to all page containers
FILE: Layout component (global fix)
```

---

## Priority Summary

### 🔴 High Priority (Fix First)
1. **Banner overload** — show max 1 banner, dismiss permanently, never on settings/registration
2. **Content hidden behind bottom tab bar** — add bottom padding globally
3. **AIM window chrome mobile variant** — reduce to section headers on mobile
4. **Token page scroll depth** — add TOC or tabbed navigation
5. **Transactions table** — card layout on mobile

### 🟡 Medium Priority
6. Reduce hero section height on homepage
7. Simplify footer on mobile
8. Improve touch targets on search/filter icons
9. Text link navigation → pill buttons on bot profile
10. Reduce About page nesting and bio density

### 🟢 Low Priority
11. Tab bar label size
12. Empty state styling (0 values)
13. Form label sizing
14. Compact error states
15. Timeline collapse for future items

---

## What Works Well ✅
- **Color palette & theming** — the purple/yellow/blue retro AIM feel is strong and consistent
- **Bottom tab bar** — standard pattern, good icon choices, correct items
- **Bot profile layout** — clean information hierarchy
- **Theme toggle** — well-sized, clear options
- **Typography** — headlines are bold and readable
- **CTAs** — primary buttons are large and colorful
- **Registration form** — inputs are properly sized for mobile
- **Emoji usage** — adds personality without overwhelming

The retro nostalgia is the product's superpower. The mobile fixes above preserve that charm while making the app actually usable on phones.
