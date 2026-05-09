import type { PageContext } from '@tendo/core';

export class PromptEngine {
  buildPrompt(
    instruction: string,
    context: PageContext,
    actionHistory: string[],
    remainingSteps: number,
    warnings: string[] = [],
  ): string {
    const warningsBlock = warnings.length > 0
      ? `**⚠️ CRITICAL WARNINGS — ACT ON THESE BEFORE ANYTHING ELSE:**
${warnings.map(w => `  ${w}`).join('\n')}

`
      : '';

    const historyBlock = actionHistory.length === 0
      ? 'No actions taken yet.'
      : actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n');

    return `You are an autonomous QA agent controlling a browser.

**TASK:** "${instruction}"

**STATE:**
- URL: ${context.currentUrl}
- Title: ${context.pageTitle}
- Remaining Steps: ${remainingSteps}

**DETECTED ELEMENTS (exact pixel coordinates):**
${context.visibleElements.join('\n') || 'None detected'}

${warningsBlock}**ACTION HISTORY:**
${historyBlock}

**ACTIONS:** click {x,y}, type {x,y,text}, key {key}, scroll {direction,amount}, wait, navigate {url}, evaluate {script}, done {reason}, fail {reason}

**RULES:**
- Coordinates are ABSOLUTE PIXELS. Never use normalized values like 0.5.
- Prefer coordinates from DETECTED ELEMENTS. Estimate from screenshot only if not listed.
- evaluate returns raw JS. "false" means false (e.g. paused=false = video IS playing).
- Never evaluate twice in a row. After evaluate, act on the result.
- Call done immediately when the goal is confirmed. Do not over-step.
- If an action did not produce the expected result, use evaluate to diagnose the current state before trying a different approach. Look for overlays, ads, dialogs, or popups that may be blocking interaction. Do not abandon a strategy without first confirming via evaluate why it failed.

**THOUGHT FORMAT:**
"LAST ACTION: ... RESULT: ... DONE IF: [condition] — [yes/no]. NEXT: ..."
If DONE IF is yes, action MUST be done.

**OUTPUT:** Raw JSON only. No markdown.
{"thought": "...", "action": {"type": "...", ...}}`;
  }
}
