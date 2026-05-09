import { EventEmitter } from 'events';
import type { AgentState, LLMProvider, Action } from '@tendo/core';
import { BrowserPool, PageInteractor } from '@tendo/browser';
import { VisionClient } from '@tendo/vision';
import type { RunOptions } from './types.js';

export * from './types.js';

const LOOP_WARN_THRESHOLD = 2;
const LOOP_FAIL_THRESHOLD = 4;

export class AgentRunner extends EventEmitter {
  private pool: BrowserPool;
  private vision: VisionClient;
  private state: AgentState;

  constructor(provider: LLMProvider) {
    super();
    this.pool = new BrowserPool({ maxBrowsers: 1, maxPagesPerBrowser: 1 });
    this.vision = new VisionClient(provider);
    this.state = this.resetState();
  }

  private resetState(): AgentState {
    return {
      page: null as any,
      currentUrl: '',
      step: 0,
      actions: [],
      screenshots: [],
      completed: false,
      success: false,
    };
  }

  /** Fuzzy fingerprint — ignores coordinates, only compares type + text */
  private actionFingerprint(action: Action): string {
    return `${action.type}:${action.text ?? ''}`;
  }

  /** Count how many of the last N actions share the same fuzzy fingerprint */
  private consecutiveRepeats(): number {
    if (this.state.actions.length < 2) return 0;

    let last: { action: Action };
    try {
      last = JSON.parse(this.state.actions[this.state.actions.length - 1]);
    } catch {
      return 0;
    }
    const lastFp = this.actionFingerprint(last.action);
    let count = 1;

    for (let i = this.state.actions.length - 2; i >= 0; i--) {
      let prev: { action: Action };
      try {
        prev = JSON.parse(this.state.actions[i]);
      } catch {
        break;
      }
      if (this.actionFingerprint(prev.action) === lastFp) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /** Compare two base64 screenshot strings by sampling pixels to detect visual changes */
  private screenshotsMatch(a: string, b: string): boolean {
    if (a.length === 0 || b.length === 0) return false;
    // Quick heuristic: compare lengths
    if (Math.abs(a.length - b.length) > a.length * 0.02) return false;
    
    // Sample slices of the base64 data
    const sampleSize = 200;
    const numSamples = 10;
    let matches = 0;
    for (let i = 0; i < numSamples; i++) {
      const offset = Math.floor((a.length / numSamples) * i);
      if (a.substring(offset, offset + sampleSize) === b.substring(offset, offset + sampleSize)) {
        matches++;
      }
    }
    // If 80%+ of samples match, screenshots are effectively the same
    return matches >= numSamples * 0.8;
  }

  async run(options: RunOptions): Promise<AgentState> {
    const { url, prompt, maxSteps = 30, headless = true, viewport } = options;
    this.state = this.resetState();
    this.state.currentUrl = url;

    let interactor: PageInteractor | undefined;
    try {
      interactor = await PageInteractor.create(this.pool, { headless, viewport });
      this.emit('init', { url, prompt });
      await interactor.navigateTo(url);

      while (this.state.step < maxSteps && !this.state.completed) {
        this.state.step++;
        this.emit('step:start', { step: this.state.step });

        try {
          const context = await interactor.captureContext();
          this.state.screenshots.push(context.screenshotBase64);

          let actionHistory = [...this.state.actions];
          const repeats = this.consecutiveRepeats();
          if (repeats >= LOOP_WARN_THRESHOLD) {
            actionHistory.push(JSON.stringify({
              step: 'SYSTEM',
              action: { type: 'warning' },
              thought: `WARNING: You have repeated the same action ${repeats} times. Look at the screenshot carefully — your previous actions may have already succeeded. Move on to the NEXT sub-task or use "fail" if the task cannot be completed.`,
            }));
          }

          // Detect if the previous action had no visual effect
          if (this.state.screenshots.length >= 2 && this.state.actions.length > 0) {
            const prev = this.state.screenshots[this.state.screenshots.length - 2];
            const curr = context.screenshotBase64;
            if (this.screenshotsMatch(prev, curr)) {
              let lastAction: { action?: { type?: string } };
            try {
              lastAction = JSON.parse(this.state.actions[this.state.actions.length - 1]);
            } catch {
              lastAction = {};
            }
            const actionType = lastAction.action?.type;
              if (actionType === 'click' || actionType === 'type') {
                actionHistory.push(JSON.stringify({
                  step: 'SYSTEM',
                  action: { type: 'warning' },
                  thought: `WARNING: The screenshot is UNCHANGED after your previous "${actionType}" action. Your action FAILED (likely wrong coordinates). Check the DETECTED ELEMENTS list for the exact center coordinates and try again.`,
                }));
              }
            }
          }

          const decision = await this.vision.decideNextAction(
            prompt,
            context,
            actionHistory,
            maxSteps - this.state.step,
          );

          this.emit('step:decision', { step: this.state.step, thought: decision.thought, action: decision.action, screenshotBase64: context.screenshotBase64 });

          await interactor.executeAction(decision.action);
          this.state.actions.push(JSON.stringify({
            step: this.state.step,
            action: decision.action,
            thought: decision.thought
          }));

          if (decision.action.type === 'done') {
            this.state.completed = true;
            this.state.success = true;
          } else if (decision.action.type === 'fail') {
            this.state.completed = true;
            this.state.success = false;
          } else if (this.consecutiveRepeats() >= LOOP_FAIL_THRESHOLD) {
            this.emit('error', {
              step: this.state.step,
              error: new Error(`Loop detected: same action repeated ${LOOP_FAIL_THRESHOLD} times`),
            });
            this.state.completed = true;
            this.state.success = false;
          }

          this.emit('step:end', { step: this.state.step, action: decision.action });

        } catch (error) {
          this.emit('error', { step: this.state.step, error });
          this.state.completed = true;
          this.state.success = false;
        }

        if (!this.state.completed) {
          //await new Promise(r => setTimeout(r, 12000));
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (this.state.step >= maxSteps && !this.state.completed) {
        this.state.completed = true;
        this.state.success = false;
      }

      return this.state;
    } finally {
      await interactor?.release();
      await this.pool.dispose();
      this.emit('complete', { success: this.state.success });
    }
  }
}
