import './style.css';
import { generateCards } from './cards';
import { extractPdf, MAX_FILE_BYTES, MAX_PAGES } from './pdf';
import { currentCard, finishSession, grade, reveal, startSession } from './session';
import type { QuizSession } from './session';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app root.');

root.innerHTML = `
  <div class="shell">
    <header class="masthead">
      <div class="brand"><span class="brand-mark" aria-hidden="true">M<span>·</span></span> Margin Notes</div>
      <span class="badge">A little practice goes a long way</span>
    </header>
    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="eyebrow"><span class="eyebrow-line"></span> STUDY WITH THE SOURCE</div>
        <h1 id="hero-title">Read it once.<br><em>Recall it better.</em></h1>
        <p class="intro">Turn a text-based PDF into quick fill-in-the-blank practice. Every answer comes straight from a passage in your document.</p>
        <div class="hero-rule"></div>
      </section>
      <section class="workspace" aria-label="Recall practice">
        <div class="section-heading"><span class="section-number">01 / YOUR DOCUMENT</span><span class="section-rule"></span></div>
        <div class="upload-card">
          <div class="upload-icon" aria-hidden="true">↗</div>
          <div class="upload-copy">
            <h2>Start with a PDF</h2>
            <p>Choose a file with selectable text. Nothing is uploaded or saved.</p>
          </div>
          <label class="file-button" for="pdf-file">Choose PDF <span aria-hidden="true">→</span></label>
          <input id="pdf-file" class="visually-hidden" type="file" accept="application/pdf,.pdf" aria-describedby="limits" />
        </div>
        <p id="limits" class="limits">Up to 50 MB and ${MAX_PAGES} pages · Text-only extraction · Diagrams, tables, and scans may not work well.</p>
        <div id="status" class="status" role="status" aria-live="polite" hidden></div>
        <section id="quiz" class="practice" aria-label="Recall cards" hidden>
          <div class="section-heading"><span class="section-number">02 / RECALL PRACTICE</span><span class="section-rule"></span></div>
          <div class="practice-head"><div><p id="file-name" class="file-name"></p><p id="progress" class="progress-text"></p></div><button id="finish" class="text-button" type="button">End session</button></div>
          <div class="card">
            <div class="card-top"><span class="card-tag">FILL IN THE BLANK</span><span id="page" class="page"></span></div>
            <h2 class="card-prompt">What belongs in the blank?</h2>
            <p id="cloze" class="cloze"></p>
            <div id="reveal-panel" class="reveal-panel" hidden>
              <p class="reveal-label">ORIGINAL PASSAGE</p>
              <blockquote id="excerpt"></blockquote>
              <p id="answer" class="answer"></p>
            </div>
            <div class="card-actions">
              <button id="reveal" class="primary-button" type="button">Reveal answer <span aria-hidden="true">→</span></button>
              <div id="grade-actions" class="grade-actions" hidden>
                <button id="again" class="secondary-button" type="button">Review again</button>
                <button id="knew" class="primary-button" type="button">Knew it <span aria-hidden="true">✓</span></button>
              </div>
            </div>
          </div>
          <p class="practice-note">Missed cards return later in this session. No answers or progress are stored.</p>
        </section>
        <section id="summary" class="summary" aria-label="Session summary" hidden>
          <div class="section-heading"><span class="section-number">02 / SESSION SUMMARY</span><span class="section-rule"></span></div>
          <div class="summary-card">
            <span class="card-tag">NICE WORK</span>
            <h2>Your practice, in a nutshell.</h2>
            <p id="summary-detail"></p>
            <div class="stats"><div><strong id="stat-mastered"></strong><span>cards knew</span></div><div><strong id="stat-review"></strong><span>cards to review</span></div><div><strong id="stat-attempts"></strong><span>total attempts</span></div></div>
            <p class="summary-note">Use the source pages to revisit anything you missed. This summary disappears when you leave or reload.</p>
          </div>
        </section>
      </section>
    </main>
    <footer><span>Margin Notes / A quiet place to practice</span><span>Local in your browser. No account. No AI.</span></footer>
  </div>
`;

function element<T extends HTMLElement>(selector: string): T {
  const found = root!.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

const input = element<HTMLInputElement>('#pdf-file');
const status = element<HTMLDivElement>('#status');
const quiz = element<HTMLElement>('#quiz');
const summary = element<HTMLElement>('#summary');
const revealPanel = element<HTMLDivElement>('#reveal-panel');
const gradeActions = element<HTMLDivElement>('#grade-actions');
const revealButton = element<HTMLButtonElement>('#reveal');
let session: QuizSession | undefined;

function setStatus(message: string, error = false): void {
  status.hidden = !message;
  status.classList.toggle('status-error', error);
  status.textContent = message;
}

function render(): void {
  if (!session) return;
  quiz.hidden = session.finished;
  summary.hidden = !session.finished;
  if (session.finished) {
    element('#summary-detail').textContent =
      `${session.stoppedEarly ? 'You stopped this round early.' : 'You reached the end of this round.'} ` +
      `${session.missed.size} card${session.missed.size === 1 ? '' : 's'} needed another try.`;
    element('#stat-mastered').textContent = String(session.mastered.size);
    element('#stat-review').textContent = String(session.cards.length - session.mastered.size);
    element('#stat-attempts').textContent = String(session.attempts);
    return;
  }
  const card = currentCard(session);
  if (!card) throw new Error('Missing current card.');
  element('#progress').textContent = `${session.mastered.size} of ${session.cards.length} cards knew · ${session.queue.length} in queue`;
  element('#page').textContent = `PAGE ${card.page}`;
  const cloze = element('#cloze');
  cloze.replaceChildren(document.createTextNode(card.before));
  const blank = document.createElement('span');
  blank.className = 'blank';
  blank.textContent = session.revealed ? card.answer : '________';
  cloze.append(blank, document.createTextNode(card.after));
  revealPanel.hidden = !session.revealed;
  revealButton.hidden = session.revealed;
  gradeActions.hidden = !session.revealed;
  if (session.revealed) {
    element('#excerpt').textContent = card.excerpt;
    element('#answer').textContent = `Answer: ${card.answer} · Page ${card.page}`;
  }
}

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  quiz.hidden = true;
  summary.hidden = true;
  session = undefined;
  input.disabled = true;
  setStatus('Opening PDF locally…');
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('This PDF is over 50 MB. Try a smaller selectable-text PDF.');
    const result = await extractPdf(file, (page, total) => {
      setStatus(`Reading page ${page} of ${total} locally…`);
    });
    if (result.textPageCount === 0) {
      throw new Error('No selectable text was found. Scanned or image-only PDFs need OCR, which this app does not provide.');
    }
    const cards = generateCards(result.pages);
    if (!cards.length) {
      throw new Error('Text was found, but not enough clear factual sentences for reliable cards. Tables, diagrams, or fragmented text may be the reason. Try another selectable-text PDF.');
    }
    session = startSession(cards);
    element('#file-name').textContent = file.name;
    setStatus(`${cards.length} source-grounded cards from ${result.textPageCount} text pages. ${result.pageCount - result.textPageCount} pages had little or no selectable text.`);
    render();
    quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected PDF error occurred.';
    const known = /^(This PDF|This file|No selectable text|Text was found)/.test(message);
    setStatus(known ? message : 'Could not read this PDF. It may be damaged, password-protected, or not a valid PDF.', true);
  } finally {
    input.disabled = false;
    input.value = '';
  }
});

revealButton.addEventListener('click', () => {
  if (!session) return;
  session = reveal(session);
  render();
});

for (const [selector, knewIt] of [['#again', false], ['#knew', true]] as const) {
  element<HTMLButtonElement>(selector).addEventListener('click', () => {
    if (!session) return;
    session = grade(session, knewIt);
    render();
  });
}

element<HTMLButtonElement>('#finish').addEventListener('click', () => {
  if (!session) return;
  session = finishSession(session);
  render();
});
