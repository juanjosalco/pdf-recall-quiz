import type { SourcePage } from './pdf';

export interface Card {
  id: string;
  page: number;
  excerpt: string;
  answer: string;
  before: string;
  after: string;
}

const MAX_CARDS = 30;
const SIGNAL = /\b(?:is|are|means|refers to|must|should|requires?|includes?|need(?:s)? to)\b/i;
const ANSWER = /\b(?:is|are|means|refers to|must|should|requires?|includes?|need(?:s)? to)\s+([^,;:.!?()]+?)(?=\s+(?:before|after|when|if|while|unless|because)\b|[,;:.!?()]|$)/gi;

function normalized(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function noise(line: string): boolean {
  const words = line.match(/\p{L}+/gu) ?? [];
  return (
    words.length < 2 ||
    (/^\d{1,4}$/.test(line)) ||
    /\.{3,}\s*\d+\s*$/.test(line) ||
    /(?:https?:\/\/|www\.)/i.test(line) ||
    (words.length <= 5 && !/[.!?,;:]/.test(line)) ||
    (line.match(/\d/g)?.length ?? 0) > line.length * 0.25 ||
    (line.match(/\p{L}/gu)?.length ?? 0) < line.length * 0.45
  );
}

function sentences(lines: string[]): string[] {
  return lines
    .join(' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[\p{Lu}"“(])/u)
    .map(normalized);
}

function makeCard(sentence: string, page: number, index: number): { card: Card; score: number } | null {
  const words = sentence.match(/\p{L}+/gu) ?? [];
  if (words.length < 8 || words.length > 45 || sentence.length > 330 ||
      !/[.!?]$/.test(sentence) || !SIGNAL.test(sentence) ||
      (sentence.match(/\p{L}/gu)?.length ?? 0) < sentence.length * 0.65 ||
      /\.{3,}|[|•©®]/.test(sentence)) return null;

  for (const match of sentence.matchAll(ANSWER)) {
    const answer = match[1].trim();
    const answerWords = answer.match(/\p{L}+/gu) ?? [];
    if (answerWords.length < 1 || answerWords.length > 12 ||
        answer.length < 5 || answer.length > 85 ||
        /^(?:a|an|the|not|that|this|it|you|they|one|your)$/i.test(answer) ||
        /^(?:the|a|an)\s+(?:following|same|above)\b/i.test(answer) ||
        /^(?:from|by|with|for|to|of)\b/i.test(answer) ||
        /^(?:listed|shown|described|provided|explained)\s+(?:below|above|in|on)\b/i.test(answer) ||
        (/^(?:easy|good|important|helpful)\s+(?:for|to)\b/i.test(answer) && !/\d/.test(answer)) ||
        (/^(?:if|when|before|after)\b/i.test(sentence) && !sentence.slice(0, match.index).includes(','))) continue;
    const start = match.index + match[0].indexOf(match[1]);
    const card: Card = {
      id: `${page}-${index}`,
      page,
      excerpt: sentence,
      answer,
      before: sentence.slice(0, start),
      after: sentence.slice(start + answer.length),
    };
    const score = /\b(?:means|refers to|is|are)\b/i.test(match[0]) ? 3 : 2;
    return { card, score: score + (answerWords.length >= 2 && answerWords.length <= 8 ? 1 : 0) };
  }
  return null;
}

export function generateCards(pages: SourcePage[]): Card[] {
  const appearances = new Map<string, Set<number>>();
  for (const { page, lines } of pages) {
    for (const line of [lines[0], lines[lines.length - 1]].filter((value): value is string => value !== undefined)) {
      const key = normalized(line).toLowerCase().replace(/\b\d+\b/g, '#');
      if (!key) continue;
      if (!appearances.has(key)) appearances.set(key, new Set());
      appearances.get(key)!.add(page);
    }
  }
  const repeated = new Set(
    [...appearances].filter(([, seen]) => seen.size >= 3 && seen.size >= pages.length * 0.2)
      .map(([key]) => key),
  );
  const candidates: { card: Card; score: number }[] = [];
  const seenSentences = new Set<string>();

  for (const { page, lines } of pages) {
    let group: string[] = [];
    let index = 0;
    const addGroup = () => {
      for (const sentence of sentences(group)) {
        const key = sentence.toLowerCase();
        if (seenSentences.has(key)) continue;
        const candidate = makeCard(sentence, page, index++);
        if (candidate) {
          candidates.push(candidate);
          seenSentences.add(key);
        }
      }
      group = [];
    };
    lines.forEach((rawLine, position) => {
      const line = normalized(rawLine);
      if (noise(line) || ((position === 0 || position === lines.length - 1) &&
        repeated.has(line.toLowerCase().replace(/\b\d+\b/g, '#')))) {
        if (group.length) addGroup();
      } else group.push(line);
    });
    if (group.length) addGroup();
  }

  candidates.sort((a, b) => b.score - a.score || a.card.page - b.card.page);
  const selected: Card[] = [];
  const usedPages = new Set<number>();
  const usedBuckets = new Set<number>();
  const firstPage = Math.min(...candidates.map(({ card }) => card.page));
  const lastPage = Math.max(...candidates.map(({ card }) => card.page));
  for (const candidate of candidates) {
    const bucket = Math.min(MAX_CARDS - 1,
      Math.floor((candidate.card.page - firstPage) * MAX_CARDS / (lastPage - firstPage + 1)));
    if (usedBuckets.has(bucket)) continue;
    selected.push(candidate.card);
    usedPages.add(candidate.card.page);
    usedBuckets.add(bucket);
    if (selected.length === MAX_CARDS) break;
  }
  if (selected.length < MAX_CARDS) {
    const selectedIds = new Set(selected.map((card) => card.id));
    for (const { card } of candidates) {
      if (selected.length === MAX_CARDS) break;
      if (!selectedIds.has(card.id) && !usedPages.has(card.page)) {
        selected.push(card);
        usedPages.add(card.page);
        selectedIds.add(card.id);
      }
    }
    for (const { card } of candidates) {
      if (selected.length === MAX_CARDS) break;
      if (!selectedIds.has(card.id)) selected.push(card);
    }
  }
  return selected.sort((a, b) => a.page - b.page);
}
