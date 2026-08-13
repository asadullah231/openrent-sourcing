# Design system — reference bar (13 Aug directive)

Read this before building or restyling ANY screen in web/.

## What this app should feel like

A premium internal property-sourcing operating system.
Think **"Linear + Twenty + modern real-estate software"** — NOT a generic
Tailwind dashboard, NOT an AI-generated SaaS template, NOT a clone of any
single reference.

## Reference system (each for a specific purpose)

| Reference | Use for |
| --- | --- |
| [Twenty CRM](https://github.com/twentyhq/twenty) | CRM information architecture, tables, record detail pages, relationships, filters, views, Kanban |
| [microRealEstate](https://github.com/microrealestate/microrealestate) | Property presentation, property details, real-estate workflow concepts |
| [COSS / Cal.com](https://github.com/cosscom/coss) | Component quality — buttons, inputs, menus, dialogs, spacing, typography |
| [Linear](https://github.com/linear/linear) | Information density, compact navigation, status presentation, keyboard-friendly workflows |
| [Outline](https://github.com/outline/outline) | Information hierarchy, restrained visual design, typography, detail layouts |
| [Actual Budget](https://github.com/actualbudget/actual) | Dense data presentation, tables, filters, practical dashboards |

Combine the strongest patterns. The app has its OWN identity — never a clone.

## Quality bar — ask before implementing a screen

1. Does this look like a real product?
2. Is the information hierarchy obvious?
3. Is there too much empty space?
4. Are there unnecessary cards?
5. Is this action-oriented?
6. Can a sourcing operator scan this quickly?
7. Does every visual element have a purpose?

**Prefer:** compact tables · contextual side panels · clean detail views ·
subtle borders · restrained colors · small status badges · excellent
typography · meaningful whitespace · strong hover/selected states ·
consistent spacing · keyboard-friendly actions.

**Avoid:** giant cards · giant rounded containers · gradient backgrounds ·
excessive shadows · colorful statistic cards · random icons · decorative
charts · excessive whitespace · oversized headings · generic dashboard
widgets.

## Most important UX principle

The user is a **sourcing operator**. They must be able to scan
Order → Property → Match → Source → Outreach status → Next action
**in seconds**. Optimize for operational speed, not visual decoration.

## Implementation notes (this codebase)

- All colors via CSS variables in `app/globals.css` — never hard-coded hex
  in components (dark + light themes both must work).
- Status badges: use `LeadStatusBadge` / `OutreachBadge` from
  `components/crm-bits.js` (dot + label, neutral text). Never invent a new
  badge style per page.
- Dense tables: `.crm-wrap` + `.crm-table` classes.
- Dashboard metrics: `.metric-strip` (one bordered strip, dividers) — never
  a grid of separate stat cards.
- Page headings are normalized globally (`main h1` in globals.css) — do not
  fight it with inline sizes.
