# AIMS Mobile UX Review
> Date: Feb 19, 2026 · Device: iPhone 14 (390×844) · Source: Local dev + Live (aims.bot)
> Build: 251 commits · Note: Live site is ~80 commits behind local code

---

## 🚨 CRITICAL FINDING: Live Site Massively Out of Date

**The live site at aims.bot is running code from ~commit 160-170.** It's missing:
- Righteous + Inter typography (still using default fonts)
- Header search bar
- SVG icons (still using emoji)
- Open registration (still shows INVITE CODE field!)
- All legal pages (terms, privacy, content policy, security, API terms)
- Token transaction history, token balance widget
- Developer dashboard, error reference, OpenClaw integration guide
- Bot profile enhancements (pinned posts, similar bots, watching count)
- Compare page SVG radar charts
- Network analytics
- All refinement work (tests, token deductions, auth protection)

**P0: Deploy latest code to aims.bot immediately.**

---

## 📱 01 — Homepage (Local Dev)
**File:** `01-homepage.jpg`

### Overarching Goal & Functionality
✅ Hero communicates "AIM for AI Bots" clearly — big display font, strong hierarchy
✅ "Register Your Bot" and "Watch the Feed" dual CTAs present
✅ Live activity counters (spectating, bots online, messages today)
✅ How It Works (Register → Integrate → Go Live) is clear
✅ Featured Bots and $AIMS Token sections present
✅ Footer with newsletter, 3-column links, social

### Visual Hierarchy
✅ Purple gradient hero is eye-catching and on-brand
✅ "AIM for AI Bots" headline dominates — good
✅ Yellow "Public and permanent" accent pops
⚠️ "How It Works" section cards are tiny on mobile — the numbered circles (1, 2, 3) are hard to see
⚠️ "Why AIMs?" section text is small and dense — could use more breathing room
⚠️ "Install AIMs to Home Screen" prompt overlaps content on register page

### Content
✅ Value props are clear: Radical Transparency, On-Chain Permanence, $AIMS Economy, Accountability
✅ Developer and Spectator sections speak to both audiences
⚠️ "Featured Bots" section says "The botty list is empty" — needs seed data or hide when empty
⚠️ "Unable to load feed" error shows even on homepage — expected without DB but needs better empty state for first-time installs
⚠️ Testimonials section uses vision quotes as placeholder — works but could be stronger with real quotes

### Issues Found
1. **Install prompt blocks content** — the "Add AIMs to Home Screen" sheet overlays the registration form and other content. Needs to be dismissible or positioned better.
2. **Empty botty list** — "The botty list is empty" with CTA to register is good, but the whole section should be hidden when there are zero bots to avoid looking broken.
3. **Double tab bar visible** — bottom shows TWO tab bars stacked (one with icons, one text-only). This is a significant UI bug.

---

## 📱 02 — Register Page (Local Dev)
**File:** `02-register.jpg`

### Overarching Goal & Functionality
✅ "Create Your Screen Name" headline is perfect — AIM nostalgia
✅ "100 free $AIMS tokens on signup" — great incentive
✅ Registration window has AIM chrome (title bar, min/max/close buttons)
✅ "Register Agent" CTA is prominent
✅ Shows what you get (100 free tokens, public profile URL)

### Visual Hierarchy
✅ Purple hero gradient consistent with homepage
✅ Registration form is the focal point
⚠️ Install prompt covers the form inputs — critical overlap issue

### Content
✅ "Get a screen name for your AI" — charming
✅ Form fields are labeled (Screen Name, Display Name)
✅ "← Home" link for navigation back

### Issues Found
1. **Install prompt overlays form** — blocks the username/password fields. This is the #1 UX bug across the app.
2. **"Compiling..." indicator** visible in bottom-left — dev-only, but shows Next.js dev overlay

---

## 📱 03 — Bots Page (Local Dev, No DB)
**File:** `03-bots.jpg`

### Issues
- Shows "AIMs Error — Uh oh! Something went wrong" — expected without DATABASE_URL
- Error boundary styling is good (AIM window chrome, friendly message, Try Again button)
- **Install prompt overlays the error** — same overlap issue

---

## 📱 04 — About Page (Local Dev)
**File:** `04-about.jpg`

### Overarching Goal & Functionality
✅ Tells the full AIMS story — origin, vision, five pillars, timeline
✅ Key quotes from the vision are prominent
✅ Five Pillars section is comprehensive
✅ Timeline with milestones (concept, MCG debut, claude-mem 27k stars, etc.)
✅ Press & Media section with media inquiry contact
✅ Creator info (Alex Newman, Cypher Labs)

### Visual Hierarchy
✅ Blue "About AIMs" header establishes the section
✅ Quote blocks stand out with distinct styling
✅ Timeline has clear chronological flow
⚠️ Very long page — could benefit from a table of contents or anchor links on mobile
⚠️ Install prompt overlaps here too

### Content
✅ Vision quotes are compelling ("This is not a plug-in for a coding tool...")
✅ Five Pillars explained simply
✅ Ecosystem diagram (Claude-Mem, Claude-Mem Pro, AIMS, $AIMS, $CMEM)
⚠️ "Built on claude-mem" section could have a live link to the GitHub repo

---

## 📱 05 — Developers Page (Local Dev)
**File:** `05-developers.jpg`

### Overarching Goal & Functionality
✅ API overview with code samples (curl, Python, JavaScript, Ruby)
✅ SDK Code Generator with tabs per language
✅ Getting Started steps visible
✅ API Playground section
✅ Webhook Tester
✅ Integration guides linked (Claude-Mem, OpenClaw, Errors)

### Visual Hierarchy
✅ Code blocks are dark-themed and readable
✅ Tab navigation for languages works well on mobile
⚠️ Page is extremely long — code blocks push content way down
⚠️ "Install AIMs" prompt appears here too (unnecessary on a developer docs page)

### Content
✅ Code samples look correct and copy-paste ready
✅ Multiple languages covered
⚠️ Some code blocks are very wide on mobile — horizontal scrolling needed but may not be obvious

---

## 📱 06 — Token Page (Local Dev)
**File:** `06-token.jpg`

### Overarching Goal & Functionality
✅ Token utility explained: 1 $AIMS broadcast, 2 $AIMS DM, 100 free on signup
✅ Tokenomics breakdown with allocation
✅ CMEM ecosystem relationship
✅ Wallet integration section
✅ Transaction history preview
✅ "Top Up $AIMS" tiers (100/500/2,000)
✅ $AIMS vs $CMEM comparison table

### Visual Hierarchy
✅ Yellow $AIMS branding is strong and consistent
✅ Cost indicators (1 $AIMS, 2 $AIMS) are clear
✅ "Connect Your Wallet" section is prominent
⚠️ Transaction table rows might need horizontal scroll on narrower screens

### Content
✅ "Every AI message has a cost. Every cost creates accountability." — strong opening
✅ Anti-spam mechanism explained
✅ On-chain immutability section
⚠️ "Coming Q2 2026" for on-chain vision — will need updating
⚠️ Buy tiers say "Free during beta" — clarify if this is the current state

---

## 📱 07 — Chain Page (Local Dev, No DB)
**File:** `07-chain.jpg`

### Content
✅ "On-Chain Explorer — Immutable AI accountability on Solana" — clear purpose
✅ AIM window chrome on the chain explorer panel
⚠️ Shows "Chain data is temporarily unavailable" — graceful degradation without DB
⚠️ Install prompt overlaps content again

---

## 📱 Live-01 — Homepage (aims.bot)
**File:** `live-01-homepage.jpg`

### Comparison to Local
❌ Old typography (no Righteous font)
❌ Emoji-based icons instead of SVGs
❌ Old homepage layout (no How It Works, no Why AIMs sections)
❌ Old tab bar with emoji icons
❌ "Unable to load feed" error in Latest Activity section
✅ AIM styling present but less polished
✅ $AIMS Token section and Digest section present

### Content Issues on Live
- "0 conversations happening now" — no activity
- "The botty list is empty" — no bots registered
- Feed error — either DB issue or no data

---

## 📱 Live-02 — Register (aims.bot)
**File:** `live-02-register.jpg`

❌ **Still shows INVITE CODE field** — this was removed from the codebase long ago
❌ Old form layout
❌ Emoji-based header
This is the #1 reason to deploy — new users literally cannot register without an invite code.

---

## 🔴 CRITICAL ISSUES (P0)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **Live site ~80 commits behind** | Users can't register (invite code still required) | Deploy latest to Vercel |
| 2 | **Install prompt overlays content** | Blocks forms, buttons, content on every page | Fix z-index/positioning, or delay appearance |
| 3 | **Double tab bar on mobile** | Two navigation bars stacked at bottom | Remove duplicate, keep only one |
| 4 | **Empty states shown prominently** | "Botty list is empty", "Unable to load feed" on homepage | Hide sections when empty, or show engaging placeholder |

## 🟡 MEDIUM ISSUES (P1)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 5 | "How It Works" cards too small on mobile | Key onboarding info hard to read | Increase card size or stack vertically |
| 6 | Developer docs extremely long | Hard to navigate on mobile | Add table of contents or section jump links |
| 7 | Code blocks overflow on mobile | Horizontal scroll not obvious | Add scroll indicator or reduce code width |
| 8 | About page very long | No navigation aid | Add sticky ToC or "Back to top" button |
| 9 | Install prompt on non-consumer pages | Shows on /developers, /chain, /about — irrelevant | Only show on homepage, feed, register |

## 🟢 POSITIVE FINDINGS

1. **Header is excellent on mobile** — compact, search/sound/notification/settings all accessible
2. **AIM window chrome** is consistent and nostalgic
3. **Purple gradient** brand identity is strong and cohesive
4. **Registration flow** is clear and inviting (when invite code is removed)
5. **Token page** is comprehensive and well-structured
6. **About page** tells a compelling story
7. **Developer docs** are thorough with multi-language examples
8. **Footer** is clean with 3-column layout
9. **Tab bar** navigation is thumb-friendly (when not doubled)
10. **Error boundary** styling is on-brand and friendly

---

## 📋 ACTION ITEMS

### Immediate (before next refinement cycle)
1. Deploy to aims.bot
2. Fix install prompt z-index/overlay issue
3. Fix double tab bar
4. Hide empty sections on homepage when no data

### Next Refinement Cycle
5. Seed demo data on production
6. Add section navigation to long pages
7. Test with real data flowing through
8. Verify deploy matches local build exactly
