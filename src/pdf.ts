import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 300;
const MAX_TEXT_CHARS = 1_500_000;

export interface SourcePage {
  page: number;
  lines: string[];
}

export interface ExtractedDocument {
  pages: SourcePage[];
  pageCount: number;
  textPageCount: number;
}

export function textLines(items: readonly Pick<TextItem, 'str' | 'hasEOL' | 'transform'>[]): string[] {
  const lines: string[] = [];
  let line = '';
  let baseline: number | undefined;

  for (const item of items) {
    const y = item.transform[5];
    if (line && baseline !== undefined && Math.abs(y - baseline) > 2) {
      lines.push(line.trim());
      line = '';
    }
    line += item.str;
    baseline = y;
    if (item.hasEOL) {
      if (line.trim()) lines.push(line.trim());
      line = '';
      baseline = undefined;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export async function extractPdf(
  file: Blob,
  onProgress: (page: number, total: number) => void = () => {},
): Promise<ExtractedDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('This PDF is over 50 MB. Try a smaller selectable-text PDF.');
  }
  if (file.size === 0) throw new Error('This file is empty. Choose a selectable-text PDF.');

  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data, useSystemFonts: true });
  try {
    const document = await task.promise;
    if (document.numPages > MAX_PAGES) {
      throw new Error(`This PDF has ${document.numPages} pages; the limit is ${MAX_PAGES}. Try a shorter PDF.`);
    }
    const pages: SourcePage[] = [];
    let textPageCount = 0;
    let totalChars = 0;

    for (let page = 1; page <= document.numPages; page++) {
      const pdfPage = await document.getPage(page);
      const content = await pdfPage.getTextContent();
      const items = content.items.filter((item): item is TextItem => 'str' in item);
      const lines = textLines(items);
      const chars = lines.reduce((sum, line) => sum + line.length, 0);
      totalChars += chars;
      if (totalChars > MAX_TEXT_CHARS) {
        throw new Error('This PDF contains too much text to process safely. Try a shorter PDF.');
      }
      if (chars >= 40) textPageCount++;
      pages.push({ page, lines });
      pdfPage.cleanup();
      onProgress(page, document.numPages);
      if (page % 5 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return { pages, pageCount: document.numPages, textPageCount };
  } finally {
    await task.destroy();
  }
}
