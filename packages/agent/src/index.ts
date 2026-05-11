import { EventEmitter } from 'events';
import type { AgentState, LLMProvider, Action } from '@tendo/core';
import { BrowserPool, PageInteractor } from '@tendo/browser';
import { VisionClient } from '@tendo/vision';
import type { RunOptions } from './types.js';

export * from './types.js';

const LOOP_WARN_THRESHOLD = 1;
const LOOP_FAIL_THRESHOLD = 4;

export class AgentRunner extends EventEmitter {
  private pool: BrowserPool;
  private vision: VisionClient;
  private state: AgentState;
  private repeatCount = 0;
  private lastFingerprint = '';
  private lastActionType = '';
  private lastOffDomain = false;

  constructor(provider: LLMProvider) {
    super();
    this.pool = new BrowserPool({ maxBrowsers: 1, maxPagesPerBrowser: 1 });
    this.vision = new VisionClient(provider);
    this.state = this.resetState();
  }

  private sameDomain(a: string, b: string): boolean {
    try {
      return new URL(a).hostname === new URL(b).hostname;
    } catch {
      return true;
    }
  }

  private resetState(): AgentState {
    this.repeatCount = 0;
    this.lastFingerprint = '';
    this.lastActionType = '';
    this.lastOffDomain = false;
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

  private actionFingerprint(action: Action): string {
    if (action.type === 'click' || action.type === 'type')
      return `${action.type}:${action.x ?? 0},${action.y ?? 0}:${action.text ?? ''}`;
    if (action.type === 'evaluate')
      return `evaluate:${action.script ?? ''}`;
    return `${action.type}:${action.text ?? ''}`;
  }

  private trackAction(action: Action): void {
    const fp = this.actionFingerprint(action);
    this.repeatCount = fp === this.lastFingerprint ? this.repeatCount + 1 : 1;
    this.lastFingerprint = fp;
    this.lastActionType = action.type;
  }

  private screenshotsMatch(a: string, b: string): boolean {
    if (!a || !b || Math.abs(a.length - b.length) > a.length * 0.05) return false;
    const sampleSize = 500;
    const numSamples = 20;
    let matches = 0;
    for (let i = 0; i < numSamples; i++) {
      const offset = Math.floor((a.length / numSamples) * i);
      if (a.substring(offset, offset + sampleSize) === b.substring(offset, offset + sampleSize)) matches++;
    }
    return matches >= numSamples * 0.6;
  }

  private buildWarnings(screenshotUnchanged: boolean): string[] {
    const warnings: string[] = [];
    if (this.repeatCount >= LOOP_WARN_THRESHOLD) {
      const detail = this.lastActionType === 'evaluate'
        ? 'You already have the evaluate result in ACTION HISTORY. Do NOT evaluate again — use the result to take a click, key, or other action right now.'
        : `You have repeated the same action ${this.repeatCount} times. Your previous attempts may have already succeeded — check the screenshot. Move to the NEXT sub-task or use "fail" if truly stuck.`;
      warnings.push(`⚠️ LOOP DETECTED (repeated ${this.repeatCount}x): ${detail}`);
    }
    if (screenshotUnchanged && (this.lastActionType === 'click' || this.lastActionType === 'type')) {
      warnings.push(`⚠️ SCREENSHOT UNCHANGED: Your last "${this.lastActionType}" had NO visible effect — the page looks identical. Your coordinates were WRONG or the element did not respond. Re-check DETECTED ELEMENTS for the correct center coordinates and try a different approach.`);
    }
    if (this.lastOffDomain) {
      warnings.push(`⚠️ OFF-DOMAIN NAVIGATION: Your last action navigated away from the target site. The page was automatically restored. You clicked an ad or external link — avoid these. Stick to organic results on the original domain.`);
    }
    return warnings;
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
          const shots = this.state.screenshots;
          const screenshotUnchanged = shots.length >= 1 &&
            this.screenshotsMatch(shots[shots.length - 1], context.screenshotBase64);
          this.state.screenshots.push(context.screenshotBase64);

          if (this.state.actions.length > 0) {
            const last = JSON.parse(this.state.actions[this.state.actions.length - 1]);
            last.outcome = { ...last.outcome, screenshotChanged: !screenshotUnchanged };
            this.state.actions[this.state.actions.length - 1] = JSON.stringify(last);
          }

          const warnings = this.buildWarnings(screenshotUnchanged);
          const previousScreenshot = screenshotUnchanged && shots.length >= 2
            ? shots[shots.length - 2]
            : undefined;

          const decision = await this.vision.decideNextAction(
            prompt,
            context,
            this.state.actions,
            maxSteps - this.state.step,
            warnings,
            previousScreenshot,
          );

          this.emit('step:decision', {
            step: this.state.step,
            thought: decision.thought,
            action: decision.action,
            screenshotBase64: context.screenshotBase64,
          });

          const preMeta = { url: context.currentUrl, title: context.pageTitle };
          const evalResult = await interactor.executeAction(decision.action);
          const postMeta = await interactor.getPageInfo();
          this.lastOffDomain = !!postMeta.url && !this.sameDomain(url, postMeta.url);
          if (this.lastOffDomain) {
            await interactor.navigateTo(preMeta.url);
          }
          this.state.actions.push(JSON.stringify({
            step: this.state.step,
            action: decision.action,
            thought: decision.thought,
            ...(evalResult !== undefined && { result: evalResult }),
            outcome: {
              urlChanged: preMeta.url !== postMeta.url,
              titleChanged: preMeta.title !== postMeta.title,
              ...(this.lastOffDomain && { offDomain: true }),
            },
          }));
          this.trackAction(decision.action);

          if (decision.action.type === 'done') {
            this.state.completed = true;
            this.state.success = true;
          } else if (decision.action.type === 'fail') {
            this.state.completed = true;
            this.state.success = false;
          } else if (this.repeatCount >= LOOP_FAIL_THRESHOLD) {
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
