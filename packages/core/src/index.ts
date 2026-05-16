import type { Page } from 'playwright';
export * from './Logger.js';
export * from './LLMProvider.js';

// ── Agent Configuration ──────────────────────────────────────────────

export interface AgentConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

// ── Agent Actions ────────────────────────────────────────────────────

export type ActionType =
  | 'click'
  | 'type'
  | 'key'
  | 'evaluate'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'screenshot'
  | 'done'
  | 'fail';

export type Action =
  | { type: 'click'; x: number; y: number; reason?: string }
  | { type: 'type'; x: number; y: number; text: string; reason?: string }
  | { type: 'key'; key: string; reason?: string }
  | { type: 'evaluate'; script: string; reason?: string }
  | { type: 'scroll'; direction?: 'up' | 'down' | 'left' | 'right'; amount?: number; reason?: string }
  | { type: 'wait'; amount?: number; reason?: string }
  | { type: 'navigate'; url: string; reason?: string }
  | { type: 'screenshot'; reason?: string }
  | { type: 'done'; reason?: string }
  | { type: 'fail'; message: string };

// ── Agent State ──────────────────────────────────────────────────────

export interface AgentState {
  page: Page;
  currentUrl: string;
  step: number;
  actions: string[];
  screenshots: string[];
  completed: boolean;
  success: boolean;
}

// ── Vision Types ─────────────────────────────────────────────────────

export interface PageContext {
  screenshotBase64: string;
  pageTitle: string;
  currentUrl: string;
  visibleElements: string[];
}

export interface VisionDecision {
  thought: string;
  action: Action;
}

// ── Test Result ──────────────────────────────────────────────────────

export interface TestResult {
  success: boolean;
  url: string;
  prompt: string;
  steps: number;
  actions: Record<string, unknown>[];
  finalUrl: string;
  timestamp: string;
  screenshots?: string[];
}
