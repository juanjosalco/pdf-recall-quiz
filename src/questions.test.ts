import { describe, expect, it } from 'vitest';
import type { Card } from './cards';
import { buildQuestions } from './questions';

const cards: Card[] = [
  'a privilege granted by the state',
  'a permit issued to new drivers',
  'a license valid for one year',
  'a certificate from the testing office',
  'a document used for identification',
].map((answer, index) => ({
  id: `${index + 1}-0`, page: index + 1,
  answer, before: 'This is ', after: '.',
  excerpt: `This is ${answer}.`,
}));

describe('four-option questions', () => {
  it('provides four distinct choices, one verbatim correct answer, and source-based distractors', () => {
    const questions = buildQuestions(cards);
    expect(questions).toHaveLength(cards.length);
    for (const question of questions) {
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices.filter((choice) => choice === question.answer)).toHaveLength(1);
      for (const wrong of question.choices.filter((choice) => choice !== question.answer)) {
        expect(cards.some((card) => card.id !== question.id && card.answer === wrong)).toBe(true);
        expect(question.excerpt.toLowerCase()).not.toContain(wrong.toLowerCase());
      }
    }
    expect(new Set(questions.map((question) => question.choices.indexOf(question.answer))).size).toBeGreaterThan(1);
  });

  it('skips questions when there are fewer than three distinct, non-ambiguous distractors', () => {
    expect(buildQuestions(cards.slice(0, 3))).toEqual([]);
    const sameAnswer = cards.map((card) => ({ ...card, answer: 'a privilege granted by the state' }));
    expect(buildQuestions(sameAnswer)).toEqual([]);
  });
});
