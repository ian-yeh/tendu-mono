import Groq from 'groq-sdk';
import type { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, VisionDecision } from '@tendo/core';
import { validateVisionDecision } from '../validate.js';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  private client: Groq;
  private model: string;
  private temperature: number;

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Groq API key is required.');
    }

    this.client = new Groq({ apiKey: config.apiKey });
    this.model = config.model;
    this.temperature = config.temperature ?? 0.2;
    console.log(`[GroqProvider] Initialized with model: ${config.model}`);
  }

  private static readonly SYSTEM_MESSAGE = `You are an autonomous QA testing agent. You analyze screenshots of web pages along with a list of detected elements (with exact pixel coordinates) to decide the next action.

CRITICAL RULES:
- You MUST return a valid JSON object with exactly two keys: "thought" (your reasoning) and "action" (the action object).
- The "action" object MUST contain "type". Additional fields depend on the action type:
  - click: "x" (number), "y" (number)
  - type: "x" (number), "y" (number), "text" (string) — types text into a field, does NOT submit
  - key: "key" (string) — presses a named key, e.g. "Enter", "Tab", "Escape". Use a separate key action after type to submit a search or advance a form.
  - evaluate: "script" (string) — runs a JavaScript expression in the browser and returns the result. Use to verify real DOM state, e.g. 'document.querySelector("video").paused'. The result appears in ACTION HISTORY. IMPORTANT: after getting a result, your NEXT action MUST be non-evaluate — use the result to click, press a key, etc. Never evaluate twice in a row.
  - scroll: "direction" ("up"|"down"|"left"|"right"), "amount" (pixels)
  - navigate: "url" (string)
  - wait: no extra fields
  - done: "reason" (string)
  - fail: "reason" (string)
- For click/type actions, ALWAYS use the exact center coordinates from the DETECTED ELEMENTS list provided in the prompt.
- ALWAYS check the ACTION HISTORY before acting. Do NOT repeat actions that have already been completed.
- ALWAYS verify from the screenshot that your previous action actually worked. If the page looks unchanged, your action FAILED — try different coordinates or a different approach.
- If you see that previous steps already accomplished a sub-task (e.g. todos already added), move to the NEXT sub-task.
- When the entire task is complete, use action type "done" with a reason.
- If stuck in a loop or unable to proceed, use action type "fail" with a reason.`;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const mime = request.imageMimeType ?? 'image/jpeg';
    const content: Groq.Chat.ChatCompletionContentPart[] = [
      { type: 'text', text: request.prompt },
    ];

    if (request.imageBase64) {
      content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${request.imageBase64}` } });
    }
    if (request.previousImageBase64) {
      content.push({ type: 'text', text: 'Previous screenshot (before last action — page did not visually change):' });
      content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${request.previousImageBase64}` } });
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.client.chat.completions.create({
          model: this.model,
          temperature: this.temperature,
          messages: [
            { role: 'system', content: GroqProvider.SYSTEM_MESSAGE },
            { role: 'user', content },
          ],
          response_format: { type: 'json_object' },
        });

        const raw = result.choices[0]?.message?.content ?? '';
        return { raw, parsed: this.parseResponse(raw) };
      } catch (error) {
        const message = (error as Error).message || '';
        const isRetryable = message.includes('503') || message.includes('429') || message.includes('rate_limit');

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
      return validateVisionDecision(JSON.parse(responseText));
    } catch {
      const jsonMatch =
        responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
        responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return validateVisionDecision(JSON.parse(jsonMatch[1] || jsonMatch[0]));
      }
      throw new Error('Failed to parse AI response: ' + responseText);
    }
  }
}
