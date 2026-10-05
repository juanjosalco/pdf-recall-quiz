import type { Card } from './cards';

export interface Question extends Card {
  choices: [string, string, string, string];
}

function key(answer: string): string {
  return answer.toLowerCase()
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function kind(answer: string): string {
  if (/^(?:a|an|the)\s/i.test(answer)) return 'noun';
  if (/\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(answer)) return 'quantity';
  if (/^(?:not|never)\b/i.test(answer)) return 'negation';
  return 'phrase';
}

function score(correct: Card, candidate: Card): number {
  const words = (answer: string) => answer.split(/\s+/).length;
  return (kind(correct.answer) === kind(candidate.answer) ? 6 : 0) +
    (correct.answer.split(' ')[0].toLowerCase() === candidate.answer.split(' ')[0].toLowerCase() ? 3 : 0) -
    Math.abs(words(correct.answer) - words(candidate.answer)) -
    Math.abs(correct.answer.length - candidate.answer.length) / 20;
}

function position(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 4;
}

export function buildQuestions(cards: Card[]): Question[] {
  return cards.flatMap((card) => {
    const correct = key(card.answer);
    const seen = new Set([correct]);
    const distractors: Card[] = [];
    const candidates = cards
      .filter((other) => other.id !== card.id && !card.excerpt.toLowerCase().includes(other.answer.toLowerCase()))
      .sort((a, b) => score(card, b) - score(card, a) || Math.abs(card.page - a.page) - Math.abs(card.page - b.page));

    for (const candidate of candidates) {
      const option = key(candidate.answer);
      if (!option || seen.has(option) || option.includes(correct) || correct.includes(option)) continue;
      seen.add(option);
      distractors.push(candidate);
      if (distractors.length === 3) break;
    }
    if (distractors.length < 3) return [];

    const choices: [string, string, string, string] = [
      distractors[0].answer, distractors[1].answer, distractors[2].answer, card.answer,
    ];
    const index = position(card.id);
    [choices[index], choices[3]] = [choices[3], choices[index]];
    return [{ ...card, choices }];
  });
}
