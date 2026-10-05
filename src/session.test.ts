import { describe, expect, it } from 'vitest';
import type { Card } from './cards';
import { currentCard, finishSession, grade, reveal, startSession } from './session';

const cards: Card[] = [1, 2].map((n) => ({
  id: String(n), page: n, excerpt: `Example ${n}`, answer: 'answer',
  before: 'Before ', after: ' after.',
}));

describe('recall session', () => {
  it('requires reveal, retries missed cards, and counts completion correctly', () => {
    let session = startSession(cards);
    expect(() => grade(session, true)).toThrow('Reveal');
    session = grade(reveal(session), false);
    expect(currentCard(session)?.id).toBe('2');
    expect(session.queue).toEqual(['2', '1']);
    session = grade(reveal(session), true);
    expect(currentCard(session)?.id).toBe('1');
    session = grade(reveal(session), true);
    expect(session.finished).toBe(true);
    expect(session.attempts).toBe(3);
    expect(session.mastered.size).toBe(2);
    expect(session.missed.size).toBe(1);
    expect(() => reveal(session)).toThrow('No card');
  });

  it('summarizes unfinished cards when ending early', () => {
    const session = finishSession(grade(reveal(startSession(cards)), true));
    expect(session.finished).toBe(true);
    expect(session.mastered.size).toBe(1);
    expect(cards.length - session.mastered.size).toBe(1);
    expect(session.queue).toEqual([]);
  });
});
