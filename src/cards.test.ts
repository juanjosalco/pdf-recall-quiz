import { describe, expect, it } from 'vitest';
import { generateCards } from './cards';

describe('card generation', () => {
  it('uses verbatim answers and excerpts with accurate page references', () => {
    const cards = generateCards([
      { page: 3, lines: ['A driver license is a privilege granted by the state.'] },
      { page: 7, lines: ['Drivers must stop at a red traffic signal.'] },
    ]);
    expect(cards.length).toBe(2);
    expect(cards.map((card) => card.page)).toEqual([3, 7]);
    for (const card of cards) {
      expect(card.excerpt).toBe(card.before + card.answer + card.after);
      expect(card.excerpt).toContain(card.answer);
    }
  });

  it('rejects repeated headers, page numbers, tables of contents and duplicate text', () => {
    const pages = Array.from({ length: 4 }, (_, index) => ({
      page: index + 1,
      lines: [
        'This is the recurring header printed on every page.',
        String(index + 1),
        'Chapter 1...........12',
        'A license is a privilege granted by the state.',
        'This is the recurring header printed on every page.',
      ],
    }));
    const cards = generateCards(pages);
    expect(cards).toHaveLength(1);
    expect(cards[0].excerpt).toBe('A license is a privilege granted by the state.');
  });

  it('does not invent answers for headings, fragments or table-like text', () => {
    expect(generateCards([{ page: 1, lines: [
      'Chapter 2',
      'Applications ........ 14',
      '10 | 20 | 30 | 40 | 50',
      'Important information about the application',
      'Drive safely.',
    ] }])).toEqual([]);
  });

  it('does not join clauses across removed noise or hide a conditional premise', () => {
    const cards = generateCards([{ page: 1, lines: [
      'A license is a privilege granted',
      'https://example.invalid',
      'by the state to qualified drivers.',
      'When you are eligible, you must take the driving skills exam.',
    ] }]);
    expect(cards).toHaveLength(1);
    expect(cards[0].answer).toBe('take the driving skills exam');
  });

  it('spreads a capped set of cards across long documents', () => {
    const cards = generateCards(Array.from({ length: 90 }, (_, i) => ({
      page: i + 1, lines: [
        'Chapter overview',
        `A driver license is a privilege granted by the state in region ${i + 1}.`,
        'End of section',
      ],
    })));
    expect(cards).toHaveLength(30);
    expect(cards[0].page).toBeLessThan(5);
    expect(cards.at(-1)!.page).toBeGreaterThan(85);
  });
});
