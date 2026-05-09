import type { TestResult } from '@tendo/core';

interface StepRecord {
  step: number;
  action: {
    type: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    url?: string;
    direction?: string;
    amount?: number;
    reason?: string;
    message?: string;
  };
  thought: string;
  result?: string;
  outcome?: {
    urlChanged?: boolean;
    titleChanged?: boolean;
    screenshotChanged?: boolean;
    offDomain?: boolean;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAction(action: StepRecord['action']): string {
  switch (action.type) {
    case 'click':    return `click @ (${action.x}, ${action.y})`;
    case 'type':     return `type "${action.text}" @ (${action.x}, ${action.y})`;
    case 'key':      return `key "${action.key}"`;
    case 'navigate': return `navigate → ${action.url}`;
    case 'scroll':   return `scroll ${action.direction} ${action.amount}px`;
    case 'wait':     return `wait ${action.amount ?? 1000}ms`;
    case 'evaluate': return `evaluate JS`;
    case 'done':     return `done — ${action.reason}`;
    case 'fail':     return `fail — ${action.message ?? action.reason}`;
    default:         return action.type;
  }
}

const ACTION_COLORS: Record<string, string> = {
  click:    '#1a73e8',
  type:     '#7c3aed',
  key:      '#0891b2',
  navigate: '#d97706',
  scroll:   '#6b7280',
  wait:     '#9ca3af',
  evaluate: '#ea580c',
  done:     '#16a34a',
  fail:     '#dc2626',
};

function chipColor(type: string): string {
  return ACTION_COLORS[type] ?? '#6b7280';
}

function outcomeNote(outcome?: StepRecord['outcome']): string {
  if (!outcome) return '';
  const notes: string[] = [];
  if (outcome.screenshotChanged === false) notes.push('page did not change after this action');
  if (outcome.offDomain) notes.push('navigated off-domain — restored');
  return notes.length ? `<p class="outcome-note">${notes.join(' · ')}</p>` : '';
}

function stepHtml(step: StepRecord, screenshot: string | undefined, isLast: boolean): string {
  const thoughtHtml = step.thought
    ? `<p class="thought">${escapeHtml(step.thought)}</p>`
    : '';

  const imgHtml = screenshot
    ? `<div class="img-wrap">
        <img src="data:image/jpeg;base64,${screenshot}" alt="Step ${step.step}" loading="lazy">
      </div>
      <p class="img-caption">Step ${step.step} — after ${escapeHtml(step.action.type)}</p>`
    : '';

  return `<div class="step">
  <p class="step-label">Step ${step.step}</p>
  <span class="action-chip">
    <span class="chip-dot" style="background:${chipColor(step.action.type)}"></span>${escapeHtml(formatAction(step.action))}
  </span>
  ${thoughtHtml}
  ${outcomeNote(step.outcome)}
  ${imgHtml}
</div>
${isLast ? '' : '<hr class="step-divider">'}`;
}

export function generateReport(result: TestResult): string {
  const steps = result.actions as unknown as StepRecord[];
  const screenshots = result.screenshots ?? [];

  const lastAction = steps[steps.length - 1];
  const finalReason = lastAction?.action?.reason ?? lastAction?.action?.message ?? '';

  const formattedDate = new Date(result.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const stepsHtml = steps.map((s, i) => stepHtml(s, screenshots[i], i === steps.length - 1)).join('\n');
  const lastScreenshot = screenshots[screenshots.length - 1];
  const passClass = result.success ? 'pass' : 'fail';
  const passLabel = result.success ? 'PASS' : 'FAIL';
  const verdictHeading = result.success ? 'Flow completed successfully.' : 'Flow failed.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(result.prompt)} — Tendo</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:Georgia,'Times New Roman',serif;
  background:#fff;
  color:#242424;
  font-size:18px;
  line-height:1.78;
  -webkit-font-smoothing:antialiased;
}

/* Nav */
.nav{
  position:sticky;top:0;
  background:rgba(255,255,255,0.96);
  backdrop-filter:blur(8px);
  border-bottom:1px solid #f2f2f2;
  padding:14px 28px;
  display:flex;align-items:center;justify-content:space-between;
  z-index:10;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
.nav-brand{font-weight:700;font-size:14px;letter-spacing:-0.2px;color:#242424}
.verdict-badge{
  padding:5px 15px;border-radius:999px;
  font-size:12px;font-weight:600;letter-spacing:0.2px;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
.pass{background:#e8f5e9;color:#2e7d32}
.fail{background:#ffebee;color:#c62828}

/* Article */
.article{max-width:680px;margin:0 auto;padding:72px 24px 120px}

/* Header */
h1{
  font-size:42px;font-weight:700;
  line-height:1.18;letter-spacing:-1.5px;
  margin-bottom:20px;
}
.subtitle{
  font-size:20px;color:#6b6b6b;font-weight:400;line-height:1.5;
  margin-bottom:28px;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  word-break:break-all;
}
.article-meta{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:13px;color:#6b6b6b;
  padding:20px 0;
  border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;
  margin-bottom:64px;
}
.dot{color:#ccc}

/* Steps */
.step{margin-bottom:56px}
.step-label{
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;
  color:#b0b0b0;margin-bottom:14px;
}
.action-chip{
  display:inline-flex;align-items:center;gap:8px;
  background:#f7f7f7;border:1px solid #ebebeb;border-radius:4px;
  padding:5px 12px 5px 10px;
  font-family:'SF Mono','Fira Code','Fira Mono',Menlo,monospace;
  font-size:12px;color:#444;
  margin-bottom:22px;
}
.chip-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.thought{
  font-size:17px;line-height:1.78;color:#3b3b3b;
  margin-bottom:24px;
}
.outcome-note{
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:12px;color:#b0b0b0;
  margin-bottom:16px;
}

/* Images */
.img-wrap{margin:12px -80px 0}
.img-wrap img{width:100%;display:block;border-radius:2px}
.img-caption{
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:13px;color:#9e9e9e;text-align:center;
  padding:10px 0 0;line-height:1.4;
}

.step-divider{border:none;border-top:1px solid #f2f2f2;margin:0 0 56px}

/* Verdict */
.verdict{border-top:2px solid #242424;padding-top:40px;margin-top:80px}
.verdict h2{
  font-size:30px;font-weight:700;letter-spacing:-0.8px;line-height:1.2;
  margin-bottom:14px;
}
.verdict-reason{
  font-size:17px;color:#6b6b6b;line-height:1.6;margin-bottom:32px;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
.verdict-img{width:100%;border-radius:4px;display:block}

@media(max-width:860px){
  .img-wrap{margin:12px 0 0}
  h1{font-size:28px}
}
</style>
</head>
<body>

<nav class="nav">
  <span class="nav-brand">Tendo</span>
  <span class="verdict-badge ${passClass}">${passLabel}</span>
</nav>

<article class="article">
  <h1>${escapeHtml(result.prompt)}</h1>
  <p class="subtitle">${escapeHtml(result.url)}</p>
  <div class="article-meta">
    <span>${escapeHtml(formattedDate)}</span>
    <span class="dot">·</span>
    <span>${result.steps} steps</span>
    <span class="dot">·</span>
    <span>${escapeHtml(result.finalUrl)}</span>
  </div>

  ${stepsHtml}

  <div class="verdict">
    <h2>${verdictHeading}</h2>
    ${finalReason ? `<p class="verdict-reason">${escapeHtml(finalReason)}</p>` : ''}
    ${lastScreenshot ? `<img class="verdict-img" src="data:image/jpeg;base64,${lastScreenshot}" alt="Final state">` : ''}
  </div>
</article>

</body>
</html>`;
}
