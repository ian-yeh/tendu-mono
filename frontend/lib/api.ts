const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface CreateTestRequest {
  url: string;
  focus?: string;
}

export interface CreateTestResponse {
  id: string;
  status: string;
}

export interface Action {
  type: "navigate" | "click" | "input" | "screenshot";
  element?: string;
  value?: string;
  reasoning?: string;
  screenshot?: string;
  timestamp: string;
}

export interface TestCase {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  actual?: string;
  status: "pass" | "fail" | "pending";
  screenshot?: string;
}

export interface TestRun {
  id: string;
  url: string;
  focus?: string;
  status: "running" | "complete" | "failed";
  actions: Action[];
  cases: TestCase[];
  created_at: string;
  completed_at?: string;
}

/**
 * Create a new test run
 */
export async function createTest(
  request: CreateTestRequest
): Promise<CreateTestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/test/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: request.url,
      focus: request.focus || "Test the website",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get test run status and results
 */
export async function getTest(testId: string): Promise<TestRun> {
  const response = await fetch(`${API_BASE_URL}/api/test/${testId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Test not found" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get test cases for a test run
 */
export async function getTestCases(testId: string): Promise<{ test_id: string; cases: TestCase[] }> {
  const response = await fetch(`${API_BASE_URL}/api/test/${testId}/cases`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Test not found" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get all past test runs
 */
export async function getAllTests(): Promise<TestRun[]> {
  const response = await fetch(`${API_BASE_URL}/api/tests`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch tests" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

