# Responsive Baseline

Use CSS viewport size as the review standard. Do not use physical monitor
resolution or Windows display scaling as the source of truth.

Primary review targets:

| Target | Viewport | Purpose |
| --- | ---: | --- |
| Desktop main | 1440 x 900 | Primary desktop layout baseline |
| Laptop | 1280 x 800 | 1080p screens with OS scaling or smaller browser windows |
| Mobile | 390 x 844 | Main phone layout baseline |

Secondary checks:

| Target | Viewport | Purpose |
| --- | ---: | --- |
| Legacy laptop | 1366 x 768 | Short desktop height and older notebooks |
| Tablet | 768 x 1024 | Narrow two-column breakpoints |
| Wide desktop | 1920 x 1080 | Avoid over-stretched content |
| Small mobile | 360 x 800 | Tight phone fallback |

Rules for this project:

- Keep page shell and dense data views capped at 1760px.
- Keep long prose sections narrower than data views; do not stretch paragraph
  copy just to fill a wide screen.
- Use internal horizontal scroll for dense scientific tables instead of forcing
  the whole page to overflow.
- Use viewport-relative chart heights, such as `clamp(...dvh...)`, instead of
  fixed desktop-only plot heights.
- Verify Home, Trait, Genes, Programs, Data, and Help at the three primary
  targets, plus 1920 x 1080, before accepting broad UI changes.
- Browser zoom should be 100% during review.
