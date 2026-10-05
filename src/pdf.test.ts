import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { extractPdf, MAX_FILE_BYTES, textLines } from './pdf';
import { generateCards } from './cards';

describe('PDF extraction', () => {
  it('reconstructs text lines and skips empty items', () => {
    const item = (str: string, y: number, hasEOL = false) => ({
      str, hasEOL, transform: [1, 0, 0, 1, 0, y] as [number, number, number, number, number, number],
    });
    expect(textLines([
      item('A license ', 100), item('is a privilege.', 100, true),
      item('', 90), item('Drivers must stop at red lights.', 90),
      item('New line.', 70),
    ])).toEqual(['A license is a privilege.', 'Drivers must stop at red lights.', 'New line.']);
  });

  it('extracts page-numbered text from a real PDF and identifies blank pages', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText('A license is a privilege for qualified drivers.', { x: 40, y: 700, font, size: 12 });
    pdf.addPage();
    pdf.addPage().drawText('Drivers must stop at every red traffic light.', { x: 40, y: 700, font, size: 12 });
    const bytes = await pdf.save();
    const result = await extractPdf(new Blob([new Uint8Array(bytes)]));
    expect(result.pageCount).toBe(3);
    expect(result.textPageCount).toBe(2);
    expect(result.pages[0].lines.join(' ')).toContain('A license is a privilege');
    expect(result.pages[1].lines).toEqual([]);
    expect(result.pages[2].lines.join(' ')).toContain('Drivers must stop');
    const cards = generateCards(result.pages);
    expect(cards.every((card) => result.pages[card.page - 1].lines.join(' ').includes(card.excerpt))).toBe(true);
  });

  it('rejects empty and oversized input before parsing', async () => {
    await expect(extractPdf(new Blob([]))).rejects.toThrow('empty');
    await expect(extractPdf({ size: MAX_FILE_BYTES + 1 } as Blob)).rejects.toThrow('50 MB');
  });
});

it.skipIf(!process.env.PDF_RECALL_SAMPLE)('extracts useful source-grounded cards from the supplied guide', async () => {
  const bytes = await readFile(process.env.PDF_RECALL_SAMPLE!);
  const result = await extractPdf(new Blob([new Uint8Array(bytes)]));
  const cards = generateCards(result.pages);
  expect(result.textPageCount).toBeGreaterThan(10);
  expect(cards.length).toBeGreaterThanOrEqual(10);
  expect(new Set(cards.map((card) => card.page)).size).toBeGreaterThan(5);
  for (const card of cards) {
    expect(card.before + card.answer + card.after).toBe(card.excerpt);
    expect(result.pages[card.page - 1].lines.join(' ').replace(/\s+/g, ' ')).toContain(card.excerpt);
  }
  console.info(`Sample PDF: ${result.pageCount} pages, ${result.textPageCount} text pages, ${cards.length} cards across ${new Set(cards.map((card) => card.page)).size} pages`);
});
