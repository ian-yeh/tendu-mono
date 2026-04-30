import type { Page } from 'playwright';
export * from './Logger.js';

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
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'screenshot'
  | 'done'
  | 'fail';

export interface Action {
  type: ActionType;
  x?: number;
  y?: number;
  text?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  url?: string;
  reason?: string;
  message?: string;
}

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
}
