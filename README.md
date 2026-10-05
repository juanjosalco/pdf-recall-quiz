# Margin Notes — PDF recall practice

A free, static browser app that turns **selectable-text PDFs** into fill-in-the-blank recall cards. Each card hides an exact phrase from a source sentence, cites its PDF page, and reveals the original passage. Mark **Knew it** or **Review again**; missed cards return later in the same session. End the session to see how many cards you knew, still need to review, and how many attempts you made.

Choose one PDF with the file picker or drag and drop it anywhere on the page. Non-PDF files and multi-file drops show an error without replacing the current practice session.

**Try it:** https://juanjosalco.github.io/pdf-recall-quiz/

## Privacy and scope

PDF text is extracted and processed **locally in your browser**. The PDF and your answers are not uploaded, sent to an AI service, stored in localStorage, or saved to an account. The site serves its application files from GitHub Pages; normal hosting requests for those files still occur. Reloading or leaving the page clears the current practice session.

This is a study aid, **not** an official exam or a claim of exam equivalency. Cards are literal cloze excerpts, not generated explanations or inferred answers; review the linked page in your original PDF for context. There is no AI API, backend, account, OCR, analytics, or saved progress.

## Limits

- PDFs must have selectable text. Scanned/image-only documents have no usable text here and need OCR elsewhere first. A mixed PDF may produce cards only from its text pages.
- Complex tables, diagrams, columns, equations, unusual encodings, and fragmented text may be skipped or read out of order. The app favors legible factual/definitional sentences, excludes common repeated headers, page numbers, contents listings, and noisy fragments, and may skip many valid passages rather than invent an answer.
- To keep work bounded in the browser, files are limited to **50 MB, 300 pages, and 1.5 million extracted text characters**. At most 30 cards are selected across pages. Oversized, empty, password-protected, invalid, image-only, and PDFs with no reliable card candidates show an explanation instead of a misleading quiz.
- Page numbers refer to physical PDF pages (page 1 is the first PDF page), which may differ from printed book page numbers. The displayed excerpt is whitespace-normalized extracted text, so visual spacing may differ from the page.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To check the app:

```sh
npm test
npm run build
```

The tests include a small generated text PDF, a blank page, source-fidelity and card filtering cases, and retry-session behavior. To additionally exercise a local text PDF without adding it to the repo:

```sh
PDF_RECALL_SAMPLE=/absolute/path/to/file.pdf npm test
```

## Deploy

Vite uses the repository base path `/pdf-recall-quiz/`. Pushing to `main` triggers `.github/workflows/pages.yml`, which tests, builds, uploads `dist`, and deploys with GitHub Pages Actions. In repository **Settings → Pages**, select **GitHub Actions** as the build/deployment source. No secrets or third-party services are needed.
