"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { getTest, type TestRun, type TestCase, type Action } from "@/lib/api";
import { io } from "socket.io-client";
import Image from "next/image";
import { useData } from "@/hooks/useData";

interface Props {
  sessionId: string;
  initialUrl: string;
  initialPrompt: string;
}

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 5); // Adjust speed here (lower = faster)

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  return <span>{displayedText}</span>;
}

export default function TestSessionClient({
  sessionId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialUrl,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialPrompt,
}: Props) {
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch test results on mount
  useEffect(() => {
    const fetchTestResults = async () => {
      try {
        setIsLoading(true);
        const data = await getTest(sessionId);
        setTestRun(data);

      } catch (error) {
        console.error("Failed to fetch test results:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTestResults();
  }, [sessionId]);

  // Connect to Socket.io for real-time updates
  useEffect(() => {
    if (!sessionId) return;

    const newSocket = io("http://127.0.0.1:8000", {
      query: { testId: sessionId },
    });

    newSocket.on("connect", () => {
      console.log("Connected to Socket.io");
    });

    newSocket.on("action", (action: Action) => {
      console.log("Received action via Socket.IO:", action);
      setTestRun((prev: TestRun | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: [...prev.actions, action],
        };
      });
    });

    newSocket.on("testcase", (testCase: TestCase) => {
      setTestRun((prev: TestRun | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          cases: [...prev.cases, testCase],
        };
      });
    });

    newSocket.on("complete", () => {
      setTestRun((prev: TestRun | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "complete",
        };
      });
    });

    newSocket.on("error", () => {
      setTestRun((prev: TestRun | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "failed",
        };
      });
    });

    return () => {
      newSocket.close();
    };
  }, [sessionId]);

  const getStatusIcon = (status: "pass" | "fail" | "pending") => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "pending":
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    }
  };

  const totalPassed = testRun?.cases.filter((c) => c.status === "pass").length ?? 0;
  const totalFailed = testRun?.cases.filter((c) => c.status === "fail").length ?? 0;

  // Format action type for display
  const formatActionType = (type: string) => {
    // Convert snake_case to readable format
    return type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Poll for updates periodically (fallback if Socket.io fails)
  useEffect(() => {
    if (!testRun || testRun.status === "complete" || testRun.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const data = await getTest(sessionId);
        setTestRun(data);
      } catch (error) {
        console.error("Failed to poll test results:", error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [sessionId, testRun]);

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0a0a1a] via-[#0f0a1f] to-[#1a0a1f] text-white flex">

      {/* SIDEBAR */}
      <aside className="hidden md:flex md:w-72 border-r border-purple-900/30 bg-[#070711]/80 backdrop-blur-sm flex-col">
        <div className="px-4 py-4 border-b border-purple-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold">Test Sessions</span>
          </div>
          <History className="h-4 w-4 text-gray-500" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {testRun ? (
            <div className="px-4 py-4 space-y-2">
              <div className="text-xs text-gray-400 mb-2">Test Run Info</div>
              <div className="px-4 py-3 bg-purple-900/25 rounded-lg">
                <p className="text-xs font-medium mb-1">{testRun.focus || "No focus specified"}</p>
                <p className="text-[0.6rem] text-gray-500">{testRun.url}</p>
                <p className="text-[0.6rem] text-gray-500 mt-1">
                  Status: <span className="capitalize">{testRun.status}</span>
                </p>
                <p className="text-[0.6rem] text-gray-500">
                  {testRun.cases.length} test cases · {testRun.actions.length} actions
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 text-xs text-gray-500">
              Loading test session...
            </div>
          )}
        </div>
      </aside>

      {/* MAIN PANEL */}
      <div className="flex-1 flex flex-col">

        {/* TOP BAR */}
        <header className="border-b border-purple-900/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/test">
              <Button variant="ghost" size="icon" className="text-gray-300">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-semibold">AI Test Session</h1>
                <p className="text-xs text-gray-400">Session ID: {sessionId}</p>
              </div>
              {testRun && (
                <div className="text-xs">
                  {testRun.status === "running" && (
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Running...</span>
                    </div>
                  )}
                  {testRun.status === "complete" && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completed</span>
                    </div>
                  )}
                  {testRun.status === "failed" && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <XCircle className="h-4 w-4" />
                      <span>Failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {testRun && (
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>{totalPassed} passed</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-400" />
                <span>{totalFailed} failed</span>
              </div>
            </div>
          )}
        </header>

        {/* CHAT AREA */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : testRun ? (
            <div className="flex gap-6">
              {/* LEFT COLUMN - Messages and Actions */}
              <div className="flex-1 space-y-6">
                {/* USER MESSAGE */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-semibold">U</div>
                  <div className="bg-[#151521] border border-gray-700 rounded-xl px-4 py-3 max-w-3xl">
                    <p className="text-sm whitespace-pre-line">{testRun.focus || "Test this application"}</p>
                    <p className="text-xs text-gray-500 mt-2">URL: {testRun.url}</p>
                  </div>
                </div>

                {/* AI RESPONSE - Actions */}
                {testRun.actions.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-semibold">AI</div>
                    <div className="flex-1 max-w-3xl space-y-2">
                      <div className="text-xs text-gray-400 mb-2">Actions ({testRun.actions.length})</div>
                      {testRun.actions.map((action, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="bg-[#0f0f1e] border border-gray-800 rounded-lg px-3 py-2 text-xs">
                            <span className="text-purple-400 capitalize">{formatActionType(action.type)}</span>
                            {action.element && <span className="text-gray-400 ml-2">{action.element}</span>}
                            <span className="text-gray-600 ml-2 text-[0.65rem]">
                              {new Date(action.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {action.reasoning && (
                            <div className="text-sm text-gray-300 mb-5">
                              <TypewriterText text={action.reasoning} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN - Screenshot */}
              {testRun.actions.length > 0 && testRun.actions[testRun.actions.length - 1].screenshot && (
                <div className="w-[500px] sticky top-6 self-start">
                  <div className="text-xs text-gray-400 mb-2">Current View</div>
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <Image
                      src={`data:image/png;base64,${testRun.actions[testRun.actions.length - 1].screenshot}`}
                      alt="Current browser view"
                      width={1440}
                      height={900}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Test session not found
            </div>
          )}
        </main>

        {/* INFO FOOTER */}
        <footer className="border-t border-purple-900/30 p-4 bg-[#0d0d14]">
          <div className="max-w-3xl mx-auto text-xs text-gray-500">
            {testRun?.status === "running" && (
              <span>Updates will appear in real-time</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
