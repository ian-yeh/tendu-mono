import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, VisionDecision } from '@tendo/core';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private model;

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required.');
    }

    const genAI = new GoogleGenerativeAI(config.apiKey);
    console.log(`[GeminiProvider] Initialized with model: ${config.model}`);

    this.model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const content: any[] = [request.prompt];
    if (request.imageBase64) {
      content.push({
        inlineData: {
          mimeType: request.imageMimeType ?? 'image/jpeg',
          data: request.imageBase64,
        },
      });
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(content);
        const raw = result.response.text();
        return { raw, parsed: this.parseResponse(raw) };
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
