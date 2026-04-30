import { EventEmitter } from 'events';
import type { AgentConfig, AgentState } from '@tendo/core';
import { BrowserPool, PageInteractor } from '@tendo/browser';
import { VisionClient } from '@tendo/vision';
import type { RunOptions } from './types.js';

export * from './types.js';

export class AgentRunner extends EventEmitter {
  private pool: BrowserPool;
  private vision: VisionClient;
  private state: AgentState;

  constructor(config: AgentConfig) {
    super();
    this.pool = new BrowserPool({ maxBrowsers: 1, maxPagesPerBrowser: 1 });
    this.vision = new VisionClient(config);
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

  async run(options: RunOptions): Promise<AgentState> {
    const { url, prompt, maxSteps = 30, headless = true, viewport } = options;
    this.state = this.resetState();
    this.state.currentUrl = url;

    const interactor = await PageInteractor.create(this.pool, { headless, viewport });

    try {
      this.emit('init', { url, prompt });
      await interactor.navigateTo(url);

      while (this.state.step < maxSteps && !this.state.completed) {
        this.state.step++;
        this.emit('step:start', { step: this.state.step });

        try {
          const context = await interactor.captureContext();
          this.state.screenshots.push(context.screenshotBase64);

          const decision = await this.vision.decideNextAction(
            prompt,
            context,
            this.state.actions,
            maxSteps - this.state.step,
          );

          this.emit('step:decision', { step: this.state.step, thought: decision.thought, action: decision.action });

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
          }

          this.emit('step:end', { step: this.state.step, action: decision.action });

        } catch (error) {
          this.emit('error', { step: this.state.step, error });
          this.state.completed = true;
          this.state.success = false;
        }

        if (!this.state.completed) {
          // Wait 12 seconds between steps to avoid the 5/min rate limit on Gemini free tier
          await new Promise(r => setTimeout(r, 12000));
        }
      }

      if (this.state.step >= maxSteps && !this.state.completed) {
        this.state.completed = true;
        this.state.success = false;
      }

      return this.state;
    } finally {
      await interactor.release();
      await this.pool.dispose();
      this.emit('complete', { success: this.state.success });
    }
  }
}
