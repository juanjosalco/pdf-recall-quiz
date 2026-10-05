import { describe, expect, it } from 'vitest';
import type { Question } from './questions';
import { continueSession, currentQuestion, finishSession, selectAnswer, startSession } from './session';

const questions: Question[] = [1, 2].map((n) => ({
  id: String(n), page: n, excerpt: `Example ${n} is correct.`,
  answer: 'correct', before: `Example ${n} is `, after: '.',
  choices: ['wrong A', 'correct', 'wrong B', 'wrong C'],
}));

describe('multiple-choice session', () => {
  it('requires a choice, shows feedback once, retries incorrect answers and counts completion', () => {
    let session = startSession(questions);
    expect(() => continueSession(session)).toThrow('Choose an answer');
    expect(() => selectAnswer(session, 'not a choice')).toThrow('four answers');
    session = selectAnswer(session, 'wrong A');
    expect(session.selectedAnswer).toBe('wrong A');
    expect(session.attempts).toBe(1);
    expect(() => selectAnswer(session, 'correct')).toThrow('cannot be answered again');
    session = continueSession(session);
    expect(currentQuestion(session)?.id).toBe('2');
    expect(session.queue).toEqual(['2', '1']);
    session = continueSession(selectAnswer(session, 'correct'));
    expect(currentQuestion(session)?.id).toBe('1');
    session = continueSession(selectAnswer(session, 'correct'));
    expect(session.finished).toBe(true);
    expect(session.attempts).toBe(3);
    expect(session.mastered.size).toBe(2);
    expect(session.missed.size).toBe(1);
    expect(() => selectAnswer(session, 'correct')).toThrow('cannot be answered again');
  });

  it('summarizes answered and unanswered questions when ending early', () => {
    const session = finishSession(selectAnswer(startSession(questions), 'correct'));
    expect(session.finished).toBe(true);
    expect(session.stoppedEarly).toBe(true);
    expect(session.mastered.size).toBe(1);
    expect(questions.length - session.mastered.size).toBe(1);
    expect(session.queue).toEqual([]);
    expect(finishSession(selectAnswer(startSession(questions.slice(0, 1)), 'correct')).stoppedEarly).toBe(false);
  });
});
