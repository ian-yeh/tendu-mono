import type { LLMProvider, LLMProviderConfig } from '@tendo/core';
import { GeminiProvider, GroqProvider } from '@tendo/vision';

export type ProviderName = 'gemini' | 'groq';

const PROVIDER_DEFAULTS: Record<ProviderName, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

function getProviderConfig(provider: ProviderName): LLMProviderConfig {
  switch (provider) {
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      return {
        apiKey,
        model: process.env.GEMINI_MODEL || PROVIDER_DEFAULTS.gemini,
        temperature: process.env.GEMINI_TEMPERATURE ? parseFloat(process.env.GEMINI_TEMPERATURE) : undefined,
        topP: process.env.GEMINI_TOP_P ? parseFloat(process.env.GEMINI_TOP_P) : undefined,
        topK: process.env.GEMINI_TOP_K ? parseInt(process.env.GEMINI_TOP_K, 10) : undefined,
        maxOutputTokens: process.env.GEMINI_MAX_OUTPUT_TOKENS ? parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) : undefined,
      };
    }
    case 'groq': {
      return {
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || PROVIDER_DEFAULTS.groq,
        temperature: process.env.GROQ_TEMPERATURE ? parseFloat(process.env.GROQ_TEMPERATURE) : undefined,
      };
    }
  }
}

export function createProvider(providerOverride?: string): LLMProvider {
  const name = (process.env.LLM_PROVIDER || providerOverride || 'gemini') as ProviderName;

  if (!PROVIDER_DEFAULTS[name]) {
    throw new Error(`Unknown LLM provider: "${name}". Supported: ${Object.keys(PROVIDER_DEFAULTS).join(', ')}`);
  }

  const config = getProviderConfig(name);

  if (!config.apiKey) {
    throw new Error(`API key not set for provider "${name}". Check your .env file.`);
  }

  switch (name) {
    case 'gemini': return new GeminiProvider(config);
    case 'groq': return new GroqProvider(config);
  }
}
