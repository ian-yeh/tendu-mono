import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { AgentConfig, PageContext, VisionDecision } from '@tendo/core';
import { PromptEngine } from '@tendo/prompt-engine';

export class VisionClient {
  private model;
  private promptEngine: PromptEngine;

  constructor(config: AgentConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required.');
    }

    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.promptEngine = new PromptEngine();

    this.model = genAI.getGenerativeModel({
      model: config.model ?? 'gemini-2.5-flash',
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            thought: {
              type: SchemaType.STRING,
            },
            action: {
              type: SchemaType.OBJECT,
              properties: {
                type: { type: SchemaType.STRING, description: "The type of action to perform: click, type, scroll, wait, navigate, done, fail" },
                x: { type: SchemaType.NUMBER, description: "The x pixel coordinate. ABSOLUTELY REQUIRED for click and type actions." },
                y: { type: SchemaType.NUMBER, description: "The y pixel coordinate. ABSOLUTELY REQUIRED for click and type actions." },
                text: { type: SchemaType.STRING, description: "The text to type. ABSOLUTELY REQUIRED for type action." },
                direction: { type: SchemaType.STRING },
                amount: { type: SchemaType.NUMBER },
                url: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING },
              },
              required: ['type', 'x', 'y', 'text'],
            },
          },
          required: ['thought', 'action'],
        },
      },
    });
  }

  async decideNextAction(
    instruction: string,
    context: PageContext,
    actionHistory: string[],
    remainingSteps: number,
  ): Promise<VisionDecision> {
    const prompt = this.promptEngine.buildPrompt(instruction, context, actionHistory, remainingSteps);
    const content = [
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg' as const,
          data: context.screenshotBase64,
        },
      },
    ];

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(content);
        return this.parseResponse(result.response.text());
      } catch (error) {
        const message = (error as Error).message || '';
        const isRetryable = message.includes('503') || message.includes('429') || message.includes('overloaded');

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed after retries');
  }

  private parseResponse(responseText: string): VisionDecision {
    try {
      return JSON.parse(responseText);
    } catch {
      const jsonMatch =
        responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
        responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      throw new Error('Failed to parse AI response: ' + responseText);
    }
  }
}
