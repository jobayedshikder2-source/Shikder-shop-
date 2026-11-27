---
name: "SHIKDER SHOP — Design System"
description: "Modern, trustworthy, mobile-first Bangladeshi e-commerce design system balancing deep emerald heritage with vibrant terracotta commerce accents."
---

## Overview

SHIKDER SHOP is a single-vendor e-commerce platform built for Bangladesh, designed to feel dependable, fast, and unmistakably original. The visual language pairs **Modern Corporate** clarity with warm **Tactile Commerce** cues—clean surfaces, generous product photography breathing room, crisp `BDT ৳` pricing in tabular numerals, and high-contrast promotional accents that guide shoppers from discovery to checkout without visual clutter.

Both **Light Mode** (warm alabaster-mint surfaces for daytime browsing) and **Dark Mode** (deep forest-charcoal surfaces—never pure `#000000`) are first-class citizens, supporting seamless switching alongside English and Bengali localization.

## Colors

The palette anchors on a deep **Bengal Emerald** primary (`#004331`) that communicates authenticity and trust, paired with a **Terracotta Saffron** secondary (`#A63B00` / `#FF793F`) reserved for Flash Sales, discount badges, and primary conversion moments.

- **Primary (`light-primary` / `dark-primary`):** Core brand identity, active navigation, primary buttons, and verified trust indicators.
- **Secondary (`light-secondary` / `dark-secondary`):** Flash sale countdowns, discount pills, and high-priority promotional CTAs.
- **Surfaces:** Layered neutral-mint tinted surfaces (`surface` -> `surface-container-low` -> `surface-container`) establish card hierarchy without heavy drop shadows.
- **Semantic Status:** `success`, `warning`, and `error` tokens are reserved strictly for stock availability, order status, and form validation.

```yaml
colors:
  success: "#137333"
  on-success: "#FFFFFF"
  warning: "#B06000"
  on-warning: "#FFFFFF"
  light:
    primary: "#004331"
    on-primary: "#FFFFFF"
    primary-container: "#0D5C46"
    on-primary-container: "#8CD2B6"
    secondary: "#A63B00"
    on-secondary: "#FFFFFF"
    secondary-container: "#FF793F"
    on-secondary-container: "#652100"
    tertiary: "#612922"
    on-tertiary: "#FFFFFF"
    tertiary-container: "#7D3F37"
    on-tertiary-container: "#FFB0A5"
    error: "#BA1A1A"
    on-error: "#FFFFFF"
    error-container: "#FFDAD6"
    on-error-container: "#93000A"
    background: "#F3FBF6"
    on-background: "#151D1A"
    surface: "#F3FBF6"
    surface-dim: "#D3DCD7"
    surface-bright: "#FFFFFF"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#EDF6F0"
    surface-container: "#E7F0EB"
    surface-container-high: "#E2EAE5"
    surface-container-highest: "#DCE5DF"
    on-surface: "#151D1A"
    surface-variant: "#DBE5DE"
    on-surface-variant: "#3F4944"
    outline: "#6F7974"
    outline-variant: "#BFC9C2"
    inverse-surface: "#2A322F"
    inverse-on-surface: "#EAF3EE"
    inverse-primary: "#8ED5B9"
  dark:
    primary: "#8ED5B9"
    on-primary: "#003829"
    primary-container: "#0D5C46"
    on-primary-container: "#8CD2B6"
    secondary: "#FFB599"
    on-secondary: "#5A1C00"
    secondary-container: "#AE3E01"
    on-secondary-container: "#FFD8CA"
    tertiary: "#FFB4A9"
    on-tertiary: "#552019"
    tertiary-container: "#7D3F37"
    on-tertiary-container: "#FFB0A5"
    error: "#FFB4AB"
    on-error: "#690005"
    error-container: "#93000A"
    on-error-container: "#FFDAD6"
    background: "#0D1512"
    on-background: "#DCE5DF"
    surface: "#0D1512"
    surface-dim: "#0D1512"
    surface-bright: "#333B38"
    surface-container-lowest: "#08100D"
    surface-container-low: "#151D1A"
    surface-container: "#19211E"
    surface-container-high: "#242C29"
    surface-container-highest: "#2E3733"
    on-surface: "#DCE5DF"
    surface-variant: "#3F4944"
    on-surface-variant: "#BFC9C2"
    outline: "#89938D"
    outline-variant: "#3F4944"
    inverse-surface: "#DCE5DF"
    inverse-on-surface: "#2A322F"
    inverse-primary: "#226A53"
```

## Typography

A three-role Google Font pairing: **Mulish** for geometric, approachable display and section headings; **Instrument Sans** for crisp, highly legible product titles, UI labels, and body copy; and **Source Code Pro** for SKUs, order IDs, coupon codes, and tracking numbers. All currency values (`৳`) and countdown timers use `tabular-nums`.

```yaml
typography:
  display-lg:
    fontFamily: "Mulish"
    fontSize: 44px
    fontWeight: 800
    lineHeight: 50px
    letterSpacing: -0.75px
  display-lg-mobile:
    fontFamily: "Mulish"
    fontSize: 28px
    fontWeight: 800
    lineHeight: 34px
    letterSpacing: -0.5px
  headline-lg:
    fontFamily: "Mulish"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 38px
    letterSpacing: -0.25px
  headline-md:
    fontFamily: "Mulish"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: -0.15px
  title-lg:
    fontFamily: "Instrument Sans"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  title-md:
    fontFamily: "Instrument Sans"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
  body-lg:
    fontFamily: "Instrument Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  body-md:
    fontFamily: "Instrument Sans"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  label-lg:
    fontFamily: "Instrument Sans"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.1px
  label-sm:
    fontFamily: "Instrument Sans"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 14px
    letterSpacing: 0.3px
  mono-md:
    fontFamily: "Source Code Pro"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: 0.2px
```

## Layout & Spacing

Mobile-first **Fluid Grid** (`390px` viewport with `16px` page margins and `12px` product grid gutters) scaling cleanly to a **12-column Fixed-Max-Width Grid** (`max-w-7xl` / `1280px`) on desktop. Built on a strict `4px` / `8px` spacing rhythm.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 12px
  gutter-lg: 16px
  gutter-xl: 24px
  section: 32px
  page-margin: 16px
```

## Elevation & Depth

Hierarchy relies on **tonal surface layering** (`surface` -> `surface-container-lowest` cards) paired with subtle `1px` ghost borders (`outline-variant`). Shadows are reserved strictly for sticky navigation bars, floating cart/checkout docks, and modal overlays—never stacked on top of heavy borders.

## Shapes

Friendly, modern geometry: product cards and promo banners use `12px` (`md`) to `16px` (`lg`) corners; interactive buttons, search inputs, and filter chips use `9999px` (`full`) or `8px` (`DEFAULT`) depending on density. Inner media thumbnails step down by `4px` relative to their padded card container.

```yaml
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
```

## Motion & Micro-interaction

Motion is crisp and purposeful: button presses and chip toggles respond within `120ms`, while drawers and modals decelerate smoothly over `240ms`. Only `transform`, `opacity`, and `color` animate.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 240ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  surface-exit:
    duration: 150ms
    delay: 0ms
    timingFunction: cubic-bezier(0.3, 0, 1, 1)
```

## Voice & Content Strategy

- **Tone:** Warm, clear, and trustworthy—helpful to both first-time online shoppers in Bangladesh and experienced buyers.
- **Capitalisation:** Sentence case for UI labels, navigation, and product descriptions; Title Case for brand and category names.
- **Currency & Numbers:** Always prefix Bangladeshi Taka with `৳` and format with commas (e.g., `৳2,450`, never `BDT 2450/-`).
- **Action Labels:** Verb-first outcomes (`Add to Cart`, `Track Order`, `Proceed to Checkout`) rather than generic `Submit` or `OK`.

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Badge** → `@components/badge.html` — `badge-numeric`, `badge-dot`
- **Button** → `@components/button.html` — `button-primary`, `button-icon`, `button-with-icon`
- **Card** → `@components/card.html` — `card-elevated`, `card-action`, `card-interactive`, `card-interactive-2`
- **Input Field** → `@components/input-field.html` — `input-field-text`, `input-field-icon`
- **Typography** → `@components/typography.html` — `typography-display`, `typography-body`, `typography-label`
