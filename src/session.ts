import type { Question } from './questions';

export interface QuizSession {
  questions: Question[];
  queue: string[];
  selectedAnswer: string | null;
  attempts: number;
  mastered: Set<string>;
  missed: Set<string>;
  finished: boolean;
  stoppedEarly: boolean;
}

export function startSession(questions: Question[]): QuizSession {
  if (!questions.length) throw new Error('Cannot start a session without four-option questions.');
  return {
    questions, queue: questions.map((question) => question.id), selectedAnswer: null,
    attempts: 0, mastered: new Set(), missed: new Set(), finished: false, stoppedEarly: false,
  };
}

export function currentQuestion(session: QuizSession): Question | undefined {
  return session.questions.find((question) => question.id === session.queue[0]);
}

export function selectAnswer(session: QuizSession, answer: string): QuizSession {
  const question = currentQuestion(session);
  if (session.finished || !question || session.selectedAnswer !== null) {
    throw new Error('This question cannot be answered again.');
  }
  if (!question.choices.includes(answer)) throw new Error('Choose one of the four answers.');

  const mastered = new Set(session.mastered);
  const missed = new Set(session.missed);
  const queue = [...session.queue];
  if (answer === question.answer) mastered.add(question.id);
  else {
    missed.add(question.id);
    queue.push(question.id);
  }
  return {
    ...session, queue, selectedAnswer: answer, attempts: session.attempts + 1,
    mastered, missed,
  };
}

export function continueSession(session: QuizSession): QuizSession {
  if (session.finished || session.selectedAnswer === null) {
    throw new Error('Choose an answer before continuing.');
  }
  const queue = session.queue.slice(1);
  return { ...session, queue, selectedAnswer: null, finished: queue.length === 0 };
}

export function finishSession(session: QuizSession): QuizSession {
  const remaining = session.queue.length - (session.selectedAnswer === null ? 0 : 1);
  return {
    ...session, queue: [], selectedAnswer: null, finished: true, stoppedEarly: remaining > 0,
  };
}
