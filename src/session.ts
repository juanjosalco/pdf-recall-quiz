import type { Card } from './cards';

export interface QuizSession {
  cards: Card[];
  queue: string[];
  revealed: boolean;
  attempts: number;
  mastered: Set<string>;
  missed: Set<string>;
  finished: boolean;
  stoppedEarly: boolean;
}

export function startSession(cards: Card[]): QuizSession {
  if (!cards.length) throw new Error('Cannot start a session without cards.');
  return {
    cards, queue: cards.map((card) => card.id), revealed: false,
    attempts: 0, mastered: new Set(), missed: new Set(), finished: false, stoppedEarly: false,
  };
}

export function currentCard(session: QuizSession): Card | undefined {
  return session.cards.find((card) => card.id === session.queue[0]);
}

export function reveal(session: QuizSession): QuizSession {
  if (session.finished || !session.queue.length) throw new Error('No card to reveal.');
  return { ...session, revealed: true };
}

export function grade(session: QuizSession, knewIt: boolean): QuizSession {
  if (session.finished || !session.revealed || !session.queue.length) {
    throw new Error('Reveal the answer before grading.');
  }
  const [id, ...rest] = session.queue;
  const mastered = new Set(session.mastered);
  const missed = new Set(session.missed);
  if (knewIt) mastered.add(id);
  else {
    missed.add(id);
    rest.push(id);
  }
  return {
    ...session, queue: rest, revealed: false, attempts: session.attempts + 1,
    mastered, missed, finished: rest.length === 0,
  };
}

export function finishSession(session: QuizSession): QuizSession {
  return { ...session, queue: [], revealed: false, finished: true, stoppedEarly: session.queue.length > 0 };
}
