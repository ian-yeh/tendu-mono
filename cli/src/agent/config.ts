// cli/src/agent/config.ts
import { AgentConfig } from './types.js';

/**
 * Retrieves the agent configuration, primarily the Gemini API key
 * from environment variables.
 */
export function getAgentConfig(): AgentConfig {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  return {
    apiKey: apiKey || '',
    model: process.env.GEMINI_MODEL || 'gemini-pro',
    temperature: process.env.GEMINI_TEMPERATURE ? parseFloat(process.env.GEMINI_TEMPERATURE) : undefined,
    topP: process.env.GEMINI_TOP_P ? parseFloat(process.env.GEMINI_TOP_P) : undefined,
    topK: process.env.GEMINI_TOP_K ? parseInt(process.env.GEMINI_TOP_K, 10) : undefined,
    maxOutputTokens: process.env.GEMINI_MAX_OUTPUT_TOKENS ? parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) : undefined,
  };
}
