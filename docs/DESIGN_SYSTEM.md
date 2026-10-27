# Design system specification

## Foundations

The visual language remains restrained: pale mineral paper or nocturnal ink, thin rules, serif reading text and a single cool blue-grey accent. Semantic CSS variables are exposed for backgrounds, surfaces, text, borders, accent, focus, danger and success. Existing direction tokens remain the source for the static first paint; runtime preference tokens take precedence after the bootstrap script.

| Category | Semantic variables |
| --- | --- |
| Background | color-background-primary, color-background-secondary, color-background-elevated |
| Surface | color-surface-default, color-surface-hover, color-surface-active |
| Text | color-text-primary, color-text-secondary, color-text-muted |
| Feedback | color-focus, color-danger, color-success |
| Motion | instant 90ms, fast 180ms, normal 240ms, deliberate 340ms |
| Space | space-1 through space-4 at 8px increments |

Chroma uses bounded OKLCH-to-sRGB conversion. When a requested value leaves the sRGB gamut, chroma is reduced before conversion. It never applies a saturation filter to the document.

## Appearance preferences

Preferences include theme light/dark/system, direction gallery/mineral/nocturnal, brightness 72–116, chroma 0–100, contrast normal/high and motion system/reduced/full.

Anonymous preferences persist locally under cafe:appearance:v1; legacy session values migrate on read. They apply before hydration via the same generated implementation used after React mounts. No network request participates in an appearance change.

Theme and direction use the View Transition API where available. The fallback is a 340ms color transition limited to surfaces and text. Reduced-motion preference skips that transition. Brightness changes the palette’s lightness, never the whole document’s rendered pixels.

## Components and states

- **Appearance popover**: closed/open, selected/unselected, keyboard focus, reduced-motion. It restores focus after Escape and uses a mobile bottom sheet.
- **Buttons**: default, hover, pressed, disabled, focus-visible. Pressed feedback is surface color, not bounce.
- **Conversation**: idle, pending, silence, cancelled, route error and crisis. It only follows new text when the reader is already at the end.
- **Source drawer**: collapsed/expanded; source links are labelled by licence and section.
- **Still life**: raw Three.js when compositing works; Canvas when WebGL or alpha fails.

## Typography and layout

The primary stack is Songti SC / Noto Serif SC / Source Han Serif SC / Georgia. Controls use the system sans stack. Reading copy is 1rem with a 2.0 line-height; secondary editorial metadata is 0.75rem with no control smaller than 44px high.

The table switches from two columns at 900px to a vertical composition below 680px. Conversation states are explicitly scrolled into view in visual tests. Safe-area padding is applied at the bottom of the table layout.
