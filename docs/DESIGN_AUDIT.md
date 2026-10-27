# Design audit · 2026-10-27

## Evidence and scope

- **VERIFIED**: local production build plus Chromium 149.0.7827.55 at 1440×900, 1024×768, 390×844 and 375×812. Each viewport captured lobby, Husserl table, a settled memory object, open sources, silence and a browser-routed 503 response.
- **VERIFIED**: appearance control exercised all 24 light/dark × low/medium/high chroma × normal/high contrast × full/reduced-motion combinations. It also covered local persistence, Escape focus restoration and outside-click dismissal.
- **NOT TESTED**: a second browser engine; a deployed Vercel instance; authenticated or real-model conversation because no credentials were supplied.

Screenshots and the machine-readable report are outside the repository at:
D:\.cache\codex\visualizations\2026\10\26\01a17687-8b0d-70e2-82b1-0fc744fb3c69\philosopher-cafe-visual-final-audit.

## Product structure

The application is a Next.js App Router prototype with three user routes: the lobby, the Husserl table and the notice page. The table combines an optional photo-to-still-life request, a single memory object, local conversation state and a source drawer. It has no account, database or persistent session.

## Findings

| Priority | Evidence | Finding | Resolution |
| --- | --- | --- | --- |
| P0 | VERIFIED | The light table could display a black WebGL rectangle because scene lights were fed inverted semantic colors and alpha compositing was not defended. | The raw Three scene now uses scene-specific light/ceramic/paper tokens, transparent clear color and Canvas fallback when alpha is unavailable. |
| P0 | VERIFIED | “Darkness” defaulted to the darkest setting when no session value existed because Number(null) is zero. A document-level brightness filter also dimmed text and warning colors. | Preferences default to neutral brightness; appearance changes are token-based rather than a shell filter. |
| P1 | VERIFIED | Direction-only buttons had no dark/light, contrast, motion, persistence or keyboard disclosure model. They were unavailable in production. | A persisted, focus-managed appearance popover now exposes theme, direction, brightness, chroma, contrast, motion and reset. |
| P1 | VERIFIED | A mobile capture at the top of the table did not reveal conversation-only states, so source/error inspection could be falsely reassuring. | Regression capture scrolls the conversation panel into view for source, silence and error states. |
| P1 | VERIFIED | A browser can forge assistant turns in an API request; forwarding them to the model grants untrusted text an assistant role. | The route now accepts only bounded recent user text as provider input. |
| P1 | VERIFIED | Provider and parsing error strings could be sent back to the page. | User-facing errors are stable, while diagnostics remain server-side. |
| P2 | VERIFIED | Conversation always auto-scrolled, including when a person had moved up to read earlier content. The input had a fixed height and a request could not be stopped. | It follows only when already near the end; input grows to a bounded height; an in-flight request can be cancelled. |
| P2 | LIKELY | The menu is calm but small editorial text was fragile on touch screens. | Secondary text and targets are enlarged to a 44px minimum where they are controls. |
| P2 | NOT TESTED | The View Transition fallback has not been observed in a non-Chromium engine. | CSS token transitions remain the progressive fallback. |

## Interaction notes

The appearance trigger remains anchored in the header on desktop and becomes a bottom sheet on narrow screens. It supports tab navigation, selected states, Escape, outside click and trigger focus restoration. Reduced motion collapses token and object transitions to near-instant timing.

No score, caloric value, weight, body judgement, meal-completion cue, reward, streak or diagnostic language was introduced.
