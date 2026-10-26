---
version: alpha
colors:
  primary: "#7c5129"
  background: "#faf8f4"
  surface: "#ffffff"
  foreground: "#30261e"
  muted: "#746c63"
  accent: "#bb9458"
typography:
  body:
    fontFamily: "Sarabun, Tahoma, sans-serif"
  display:
    fontFamily: "Noto Serif Thai, Georgia, serif"
rounded:
  card: "12px"
  control: "8px"
spacing:
  unit: "4px"
components:
  button:
    height: "44px"
---

# Thai Amulet Market

## Overview

Thai collectors' cabinet: a carefully lit central amulet against a walnut display, surrounded by quiet cream catalog pages. Public catalog and member/admin workspace share the same identity. Avoid flashy auction and payment cues. No authenticity badge; moderation concerns publication only.

## Colors

Runtime owner: src/styles.css :root. Frontmatter values map to --primary, --background, --surface, --foreground, --muted, --accent. Tailwind consumes the same CSS; no separate palette. Success uses green, pending amber, rejected red, always with text.

## Typography

Sarabun for Thai forms and body, Noto Serif Thai for the public hero only, Tahoma fallback. Body 15–16px, line-height 1.7; metadata 13px. Fonts may fall back without blocking content.

## Layout

1240px max width, 28px gutters, 4-column catalog desktop, 2-column phone, single-column forms on phones. Phone breakpoint 640px; tablet 960px. Natural document scrolling.

## Elevation & Depth

Quiet borders on cards; shadow only on floating dialogs, notification panel and hero display.

## Shapes

12px cards, 8px controls. Rounded pill category chips. Product images have consistent 4:3 frames.

## Components

Lucide icons, shadcn-style Button and Radix Dialog in src/components/ui.tsx. Shared Field, State, Pagination and Toast. All owned text Thai. Explicit native select ownership: operating-system popup is accepted.

## Do's and Don'ts

Image first; use factual sample labels in seed. Never certify authenticity. Respect reduced motion. Global visible scrollbars and focus rings. Never hide important actions behind hover.
