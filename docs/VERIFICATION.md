# Verification report · 2026-10-27

## Passed

| Check | Result |
| --- | --- |
| npm run typecheck | passed |
| npm test | passed: 8 files, 82 tests |
| npm run test:turn | passed |
| npm run test:retrieve -- “厌食 拒绝进食” | passed: 3 relevant BM25 hits |
| npm run eval | passed: BM25+expand hit@5 75%, MRR@5 0.47 |
| npm run eval:contract | passed: 16/16 |
| npm run build | D 盘隔离副本通过：6 routes generated；G 盘复现 EISDIR readlink 卷兼容性故障 |
| npm run test:visual | passed in Chromium 149.0.7827.55: 26 screenshots |
| npm run test:performance | passed local baseline: desktop DCL 34ms / LCP 96ms; mobile DCL 23ms / LCP 68ms |

Visual evidence is stored outside the repository at:
D:\.cache\codex\visualizations\2026\10\26\01a17687-8b0d-70e2-82b1-0fc744fb3c69\philosopher-cafe-visual-final-audit.

It contains all six requested states at 1440×900, 1024×768, 390×844 and 375×812, plus desktop-dark and mobile-light appearance captures. The script also verifies persistence, Escape, outside click, focus return and 24 preference combinations.

The local headless performance report is at:
D:\.cache\codex\visualizations\2026\10\26\01a17687-8b0d-70e2-82b1-0fc744fb3c69\philosopher-cafe-performance-audit.
These are repeatable local baselines, not field performance or a mobile-hardware budget.

## Not passed / not available

- npm run lint is not a usable quality gate: next lint opens an interactive ESLint setup because the repository has no ESLint configuration. No lint result is claimed.
- G 盘中的 npm run build 在 2026-10-27 复现：EISDIR readlink G:\实习\philosopher-cafe\src\app\api\dish\route.ts。相同源码在 D 盘隔离副本构建通过；详见 README 的已知问题。
- No Firefox/WebKit run was available.
- No real Anthropic/Voyage request, model-stream timing, real photo request or production Vercel runtime was tested because no credentials or deployment telemetry were provided.
- GLB/glTF material quality, first-load timing, mobile FPS, GPU memory and hit-testing are unverified; there is no Blender executable or source asset in this environment.

## Intentional non-features

The implementation contains no calories, weights, body evaluation, eating progress, completion reward, streak or psychological diagnosis.
