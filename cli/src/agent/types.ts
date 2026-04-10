// cli/src/agent/types.ts

export interface AgentConfig {
  apiKey: string;
  model?: string; // e.g., 'gemini-pro', 'gemini-pro-vision'
  temperature?: number; // 0.0 - 1.0
  topP?: number; // 0.0 - 1.0
  topK?: number; // 1-40
  maxOutputTokens?: number;
}
