import './style.css';
import { generateCards } from './cards';
import { extractPdf, MAX_FILE_BYTES, MAX_PAGES } from './pdf';
import { buildQuestions } from './questions';
import { continueSession, currentQuestion, finishSession, selectAnswer, startSession } from './session';
import type { QuizSession } from './session';
import { selectPdf } from './upload';

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
        <p class="intro">Turn a text-based PDF into four-choice recall questions. Every correct answer comes straight from a passage in your document.</p>
        <div class="hero-rule"></div>
      </section>
      <section class="workspace" aria-label="Recall practice">
        <div class="section-heading"><span class="section-number">01 / YOUR DOCUMENT</span><span class="section-rule"></span></div>
        <div class="upload-card">
          <div class="upload-icon" aria-hidden="true">↗</div>
          <div class="upload-copy">
            <h2>Start with a PDF</h2>
            <p>Choose a selectable-text PDF, or drop one anywhere on this page. Nothing is uploaded or saved.</p>
          </div>
          <label class="file-button" for="pdf-file">Choose PDF <span aria-hidden="true">→</span></label>
          <input id="pdf-file" class="visually-hidden" type="file" accept="application/pdf,.pdf" aria-describedby="limits" />
        </div>
        <p id="limits" class="limits">Up to 50 MB and ${MAX_PAGES} pages · Text-only extraction · Diagrams, tables, and scans may not work well.</p>
        <div id="status" class="status" role="status" aria-live="polite" hidden></div>
        <section id="quiz" class="practice" aria-label="Recall cards" hidden>
          <div class="section-heading"><span class="section-number">02 / MULTIPLE-CHOICE PRACTICE</span><span class="section-rule"></span></div>
          <div class="practice-head"><div><p id="file-name" class="file-name"></p><p id="progress" class="progress-text"></p></div><button id="finish" class="text-button" type="button">End session</button></div>
          <div class="card">
            <div class="card-top"><span class="card-tag">CHOOSE ONE ANSWER</span><span id="page" class="page"></span></div>
            <h2 class="card-prompt">Which answer completes the passage?</h2>
            <p id="cloze" class="cloze"></p>
            <div id="choices" class="choices" role="group" aria-label="Four answer choices"></div>
            <p id="feedback" class="feedback" role="status" aria-live="polite" tabindex="-1" hidden></p>
            <div id="reveal-panel" class="reveal-panel" hidden>
              <p class="reveal-label">ORIGINAL PASSAGE</p>
              <blockquote id="excerpt"></blockquote>
              <p id="answer" class="answer"></p>
            </div>
            <div class="card-actions">
              <button id="next" class="primary-button" type="button" hidden>Next question <span aria-hidden="true">→</span></button>
            </div>
          </div>
          <p class="practice-note">Choose the exact phrase from this page. Other choices come from elsewhere in the PDF and may be true in another context. Missed questions return later; progress is not stored.</p>
        </section>
        <section id="summary" class="summary" aria-label="Session summary" hidden>
          <div class="section-heading"><span class="section-number">02 / SESSION SUMMARY</span><span class="section-rule"></span></div>
          <div class="summary-card">
            <span class="card-tag">NICE WORK</span>
            <h2>Your practice, in a nutshell.</h2>
            <p id="summary-detail"></p>
            <div class="stats"><div><strong id="stat-mastered"></strong><span>questions correct</span></div><div><strong id="stat-review"></strong><span>questions to review</span></div><div><strong id="stat-attempts"></strong><span>total attempts</span></div></div>
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
const uploadCard = element<HTMLDivElement>('.upload-card');
const status = element<HTMLDivElement>('#status');
const quiz = element<HTMLElement>('#quiz');
const summary = element<HTMLElement>('#summary');
const revealPanel = element<HTMLDivElement>('#reveal-panel');
const choices = element<HTMLDivElement>('#choices');
const feedback = element<HTMLParagraphElement>('#feedback');
const nextButton = element<HTMLButtonElement>('#next');
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
      `${session.missed.size} question${session.missed.size === 1 ? '' : 's'} needed another try.`;
    element('#stat-mastered').textContent = String(session.mastered.size);
    element('#stat-review').textContent = String(session.questions.length - session.mastered.size);
    element('#stat-attempts').textContent = String(session.attempts);
    return;
  }
  const question = currentQuestion(session);
  if (!question) throw new Error('Missing current question.');
  const selected = session.selectedAnswer;
  element('#progress').textContent = `${session.mastered.size} of ${session.questions.length} questions correct · ${session.queue.length} in queue`;
  element('#page').textContent = `PAGE ${question.page}`;
  const cloze = element('#cloze');
  cloze.replaceChildren(document.createTextNode(question.before));
  const blank = document.createElement('span');
  blank.className = 'blank';
  blank.textContent = selected === null ? '________' : question.answer;
  cloze.append(blank, document.createTextNode(question.after));
  choices.replaceChildren();
  question.choices.forEach((answer, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.disabled = selected !== null;
    if (selected !== null && answer === question.answer) button.classList.add('is-correct');
    if (selected !== null && answer === selected && answer !== question.answer) button.classList.add('is-incorrect');
    const label = document.createElement('span');
    label.className = 'choice-letter';
    label.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('span');
    text.textContent = answer;
    button.append(label, text);
    button.addEventListener('click', () => {
      if (!session) return;
      session = selectAnswer(session, answer);
      render();
      feedback.focus();
    });
    choices.append(button);
  });
  feedback.hidden = selected === null;
  revealPanel.hidden = selected === null;
  nextButton.hidden = selected === null;
  if (selected !== null) {
    const correct = selected === question.answer;
    feedback.classList.toggle('feedback-correct', correct);
    feedback.classList.toggle('feedback-incorrect', !correct);
    feedback.textContent = correct ? 'Correct — that is the exact phrase from this page.' : 'Not quite — compare your choice with the original passage.';
    element('#excerpt').textContent = question.excerpt;
    element('#answer').textContent = `Correct answer: ${question.answer} · Page ${question.page}`;
    nextButton.firstChild!.textContent = session.queue.length === 1 ? 'See summary ' : 'Next question ';
  }
}

async function loadPdf(file: File): Promise<void> {
  if (input.disabled) {
    setStatus('Please wait until the current PDF finishes processing.', true);
    return;
  }
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
    const questions = buildQuestions(generateCards(result.pages));
    if (!questions.length) {
      throw new Error('Text was found, but not enough distinct factual answers for four-choice questions. Try a longer selectable-text PDF with clear prose rather than tables or diagrams.');
    }
    session = startSession(questions);
    element('#file-name').textContent = file.name;
    setStatus(`${questions.length} source-grounded questions from ${result.textPageCount} text pages. ${result.pageCount - result.textPageCount} pages had little or no selectable text.`);
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
}

function showSelectionError(error: unknown): void {
  setStatus(error instanceof Error ? error.message : 'Could not select this PDF.', true);
}

input.addEventListener('change', () => {
  if (!input.files?.length) return;
  try {
    void loadPdf(selectPdf(input.files));
  } catch (error) {
    showSelectionError(error);
    input.value = '';
  }
});

let dragDepth = 0;
document.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  dragDepth++;
  if (!input.disabled) uploadCard.classList.add('is-dragging');
});
document.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
});
document.addEventListener('dragleave', () => {
  if (dragDepth === 0) return;
  dragDepth--;
  if (dragDepth === 0) uploadCard.classList.remove('is-dragging');
});
document.addEventListener('drop', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  dragDepth = 0;
  uploadCard.classList.remove('is-dragging');
  if (input.disabled) {
    setStatus('Please wait until the current PDF finishes processing.', true);
    return;
  }
  try {
    void loadPdf(selectPdf(event.dataTransfer.files));
  } catch (error) {
    showSelectionError(error);
  }
});

nextButton.addEventListener('click', () => {
  if (!session) return;
  session = continueSession(session);
  render();
  if (!session.finished) choices.querySelector('button')?.focus();
});

element<HTMLButtonElement>('#finish').addEventListener('click', () => {
  if (!session) return;
  session = finishSession(session);
  render();
});
