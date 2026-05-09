import type { LLMProvider, PageContext, VisionDecision } from '@tendo/core';
import { PromptEngine } from '@tendo/prompt-engine';

export { GeminiProvider } from './providers/gemini.js';
export { GroqProvider } from './providers/groq.js';

export class VisionClient {
  private promptEngine: PromptEngine;

  constructor(private provider: LLMProvider) {
    this.promptEngine = new PromptEngine();
  }

  async decideNextAction(
    instruction: string,
    context: PageContext,
    actionHistory: string[],
    remainingSteps: number,
    warnings: string[] = [],
  ): Promise<VisionDecision> {
    const prompt = this.promptEngine.buildPrompt(instruction, context, actionHistory, remainingSteps, warnings);

    const response = await this.provider.generate({
      prompt,
      imageBase64: context.screenshotBase64,
      imageMimeType: 'image/jpeg',
    });

    return response.parsed;
  }
}
