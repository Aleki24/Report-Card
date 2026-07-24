# Report card fonts

The project's own typefaces, bundled so report card PDFs are typeset in the
same faces as the app UI (`--font-sans` / `--font-display` in globals.css):

| File | Family | Used for |
|---|---|---|
| `merriweather-400.ttf` | Merriweather Regular | body copy |
| `merriweather-700.ttf` | Merriweather Bold | labels, figures, headings |
| `merriweather-400i.ttf` | Merriweather Italic | teacher / principal remarks |
| `syne-800.ttf` | Syne ExtraBold | the school name on the masthead |

Both families are licensed under the **SIL Open Font License 1.1**, which
permits bundling and redistribution:

- Merriweather — © Sorkin Type Co, <https://fonts.google.com/specimen/Merriweather>
- Syne — © Bonjour Monde, <https://fonts.google.com/specimen/Syne>

They are read from disk at render time by `../pdfTheme.ts`, so they must be
traced into the serverless bundle — see `outputFileTracingIncludes` in
`next.config.ts`. If the files are ever missing, font registration falls back
to the built-in Times/Helvetica families and report cards still generate.
