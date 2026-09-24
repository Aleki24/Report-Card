# Report card fonts

Typefaces for the report card templates and the class mark sheet, bundled as
`.ttf` so PDFs render the same everywhere. They are registered in
`src/lib/pdf/pdfTheme.ts`.

| Files | Family | Used by |
|---|---|---|
| `playfair-700` | Playfair Display Bold | Heritage display, mark sheet school name |
| `sourcesans-400/600/700` | Source Sans 3 | Heritage body |
| `sourceserif-400i` | Source Serif 4 Italic | Heritage remarks |
| `jakarta-400/600/700/800` | Plus Jakarta Sans | Aurora |
| `instrumentserif-400`, `-400i` | Instrument Serif | Editorial display |
| `inter-400/600/700/800` | Inter | Editorial body, mark sheet, footers |
| `manrope-400/600/700/800` | Manrope | Growth body |
| `dmserif-400` | DM Serif Display | Growth display |

Every family is licensed under the **SIL Open Font License 1.1**, which permits
bundling and redistribution (see <https://fonts.google.com> for each specimen).

They are read from disk at render time, so they must be traced into the
serverless bundle — see `outputFileTracingIncludes` in `next.config.ts`. If a
file is ever missing, registration fails quietly and PDFs still generate.
