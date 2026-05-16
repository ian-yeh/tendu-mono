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

**EXAMPLES:**

// 1. Always use exact coordinates from DETECTED ELEMENTS — never estimate
// Detected elements include: [button] "Add to Cart" at (743, 412)
{"thought": "LAST ACTION: opened product page RESULT: page loaded, Add to Cart button visible in detected elements DONE IF: item in cart — no. NEXT: click Add to Cart at exact detected coordinates", "action": {"type": "click", "x": 743, "y": 412}}

// 2. Evaluate to verify state, then immediately act on the result — never evaluate twice in a row
// Step A: result of previous click is unclear
{"thought": "LAST ACTION: clicked Subscribe RESULT: button responded but outcome unclear DONE IF: subscribed — unknown. NEXT: evaluate to confirm success message exists", "action": {"type": "evaluate", "script": "document.querySelector('.success-message') !== null"}}
// Step B: evaluate returned true — now act, do NOT evaluate again
{"thought": "LAST ACTION: evaluate returned true RESULT: success message confirmed in DOM DONE IF: subscribed — yes. NEXT: done", "action": {"type": "done", "reason": "Subscription confirmed — success message is present"}}

// 3. Dismiss modals and overlays before attempting the main task
// Screenshot shows a cookie consent banner covering the page. Detected: [button] "Accept all" at (960, 540)
{"thought": "LAST ACTION: navigated to site RESULT: cookie consent modal is blocking the page — cannot interact with content beneath it DONE IF: task complete — no. NEXT: dismiss the modal first", "action": {"type": "click", "x": 960, "y": 540}}

**THOUGHT FORMAT:**
"LAST ACTION: ... RESULT: ... DONE IF: [condition] — [yes/no]. NEXT: ..."
If DONE IF is yes, action MUST be done.

**OUTPUT:** Raw JSON only. No markdown.
{"thought": "...", "action": {"type": "...", ...}}`;
  }
}
