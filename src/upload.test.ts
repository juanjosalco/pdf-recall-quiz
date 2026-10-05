import { describe, expect, it } from 'vitest';
import { selectPdf } from './upload';

describe('PDF upload selection', () => {
  const pdf = new File(['%PDF-1.7'], 'guide.PDF', { type: 'application/octet-stream' });

  it('accepts a single PDF by extension or MIME type', () => {
    expect(selectPdf([pdf])).toBe(pdf);
    const typed = new File(['%PDF-1.7'], 'document', { type: 'application/pdf' });
    expect(selectPdf([typed])).toBe(typed);
  });

  it('rejects multiple files, missing files and non-PDF drops', () => {
    expect(() => selectPdf([])).toThrow('one PDF');
    expect(() => selectPdf([pdf, pdf])).toThrow('one PDF');
    expect(() => selectPdf([new File(['text'], 'notes.txt', { type: 'text/plain' })])).toThrow('not a PDF');
  });
});
