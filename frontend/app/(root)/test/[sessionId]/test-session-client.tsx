"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  MousePointer2,
  Navigation,
  Keyboard,
  ScrollText,
  ArrowLeftCircle,
  ArrowRightCircle,
  Clock,
  Command,
  Flag,
  Sparkles,
  XCircle,
  Maximize2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { getTest, type TestRun, type TestCase, type Action } from "@/lib/api";
import { io } from "socket.io-client";
import Image from "next/image";

interface Props {
  sessionId: string;
  initialUrl: string;
  initialPrompt: string;
}

// Action type to icon mapping
const ACTION_ICONS: Record<string, React.ReactNode> = {
  navigate: <Navigation className="h-3.5 w-3.5" />,
  click_at: <MousePointer2 className="h-3.5 w-3.5" />,
  type_text_at: <Keyboard className="h-3.5 w-3.5" />,
  scroll_document: <ScrollText className="h-3.5 w-3.5" />,
  go_back: <ArrowLeftCircle className="h-3.5 w-3.5" />,
  go_forward: <ArrowRightCircle className="h-3.5 w-3.5" />,
  wait_5_seconds: <Clock className="h-3.5 w-3.5" />,
  key_combination: <Command className="h-3.5 w-3.5" />,
  done: <Flag className="h-3.5 w-3.5" />,
};

// Action type to color mapping
const ACTION_COLORS: Record<string, string> = {
  navigate: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  click_at: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  type_text_at: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  scroll_document: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  go_back: "text-gray-400 bg-gray-400/10 border-gray-400/30",
  go_forward: "text-gray-400 bg-gray-400/10 border-gray-400/30",
  wait_5_seconds: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  key_combination: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  done: "text-green-400 bg-green-400/10 border-green-400/30",
};

function ActionItem({ action, index, isSelected, onSelect }: {
  action: Action;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const icon = ACTION_ICONS[action.type] || <Sparkles className="h-3.5 w-3.5" />;
  const colorClass = ACTION_COLORS[action.type] || "text-gray-400 bg-gray-400/10 border-gray-400/30";

  const formatActionType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div
      className={`border rounded-lg transition-all cursor-pointer ${isSelected
          ? "border-purple-500/50 bg-purple-500/5"
          : "border-gray-800 hover:border-gray-700"
        }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Step number */}
        <div className="text-[0.65rem] text-gray-600 w-4 text-center font-mono">
          {index + 1}
        </div>

        {/* Icon with color */}
        <div className={`p-1.5 rounded border ${colorClass}`}>
          {icon}
        </div>

        {/* Action info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${colorClass.split(' ')[0]}`}>
              {formatActionType(action.type)}
            </span>
            {action.element && (
              <span className="text-xs text-gray-500 truncate max-w-[200px]">
                {action.element}
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <span className="text-[0.65rem] text-gray-600">
          {new Date(action.timestamp).toLocaleTimeString()}
        </span>

        {/* Expand button for reasoning */}
        {action.reasoning && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {/* Collapsible reasoning */}
      {isExpanded && action.reasoning && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-800/50">
          <p className="text-xs text-gray-400 leading-relaxed pl-8">
            {action.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TestSessionClient({
  sessionId,
  initialUrl,
  initialPrompt,
}: Props) {
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPassed, setTotalPassed] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [isScreenshotExpanded, setIsScreenshotExpanded] = useState(false);
  const actionsEndRef = useRef<HTMLDivElement>(null);

  // Fetch test results on mount
  useEffect(() => {
    const fetchTestResults = async () => {
      try {
        setIsLoading(true);
        const data = await getTest(sessionId);
        setTestRun(data);
        if (data.actions.length > 0) {
          setSelectedActionIndex(data.actions.length - 1);
        }
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
        const newActions = [...prev.actions, action];
        setSelectedActionIndex(newActions.length - 1);
        return {
          ...prev,
          actions: newActions,
        };
      });
      // Auto-scroll to bottom
      setTimeout(() => {
        actionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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
        setTotalPassed(prev.cases.filter((c) => c.status === "pass").length);
        setTotalFailed(prev.cases.filter((c) => c.status === "fail").length);
        return {
          ...prev,
          status: "complete",
        };
      });
    });

    newSocket.on("error", () => {
      setTestRun((prev: TestRun | null) => {
        if (!prev) return prev;
        setTotalPassed(prev.cases.filter((c) => c.status === "pass").length);
        setTotalFailed(prev.cases.filter((c) => c.status === "fail").length);
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
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, testRun]);

  // Get selected screenshot
  const selectedScreenshot = selectedActionIndex !== null && testRun?.actions[selectedActionIndex]?.screenshot
    ? testRun.actions[selectedActionIndex].screenshot
    : testRun?.actions[testRun.actions.length - 1]?.screenshot;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#0f0a1f] to-[#1a0a1f] text-white flex">

      {/* SIDEBAR */}
      <aside className="hidden lg:flex lg:w-64 border-r border-purple-900/30 bg-[#070711]/80 backdrop-blur-sm flex-col">
        <div className="px-4 py-4 border-b border-purple-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold">TestPilot</span>
          </div>
          <History className="h-4 w-4 text-gray-500" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {testRun ? (
            <div className="p-4 space-y-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Test Info</div>

              {/* Focus/Goal */}
              <div className="space-y-1">
                <div className="text-[0.65rem] text-gray-500">Goal</div>
                <p className="text-xs font-medium leading-relaxed">{testRun.focus || "No focus specified"}</p>
              </div>

              {/* URL */}
              <div className="space-y-1">
                <div className="text-[0.65rem] text-gray-500">URL</div>
                <p className="text-[0.65rem] text-purple-400 break-all">{testRun.url}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="bg-[#151521] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-purple-400">{testRun.actions.length}</div>
                  <div className="text-[0.65rem] text-gray-500">Actions</div>
                </div>
                <div className="bg-[#151521] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-cyan-400">{testRun.cases.length}</div>
                  <div className="text-[0.65rem] text-gray-500">Tests</div>
                </div>
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
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP BAR */}
        <header className="border-b border-purple-900/30 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/test">
              <Button variant="ghost" size="icon" className="text-gray-300 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-semibold">AI Test Session</h1>
              <p className="text-[0.65rem] text-gray-500 font-mono">{sessionId}</p>
            </div>
            {testRun && (
              <div className="ml-2">
                {testRun.status === "running" && (
                  <div className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Running</span>
                  </div>
                )}
                {testRun.status === "complete" && (
                  <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2 py-1 rounded-full text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Complete</span>
                  </div>
                )}
                {testRun.status === "failed" && (
                  <div className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded-full text-xs">
                    <XCircle className="h-3 w-3" />
                    <span>Failed</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {testRun && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{totalPassed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                <span>{totalFailed}</span>
              </div>
            </div>
          )}
        </header>

        {/* MAIN CONTENT - 50/50 split */}
        <main className="flex-1 flex overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : testRun ? (
            <>
              {/* LEFT - Actions List (50%) */}
              <div className="w-1/2 flex flex-col border-r border-gray-800/50">
                <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Actions ({testRun.actions.length})
                  </span>
                  {testRun.status === "running" && (
                    <div className="flex items-center gap-1.5 text-[0.65rem] text-blue-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Live
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {testRun.actions.map((action, idx) => (
                    <ActionItem
                      key={idx}
                      action={action}
                      index={idx}
                      isSelected={selectedActionIndex === idx}
                      onSelect={() => setSelectedActionIndex(idx)}
                    />
                  ))}
                  <div ref={actionsEndRef} />
                </div>
              </div>

              {/* RIGHT - Screenshot (50%) */}
              <div className="w-1/2 flex flex-col bg-[#080812]">
                <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {selectedActionIndex !== null ? `Step ${selectedActionIndex + 1} View` : 'Current View'}
                  </span>
                  <button
                    onClick={() => setIsScreenshotExpanded(true)}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors text-gray-500 hover:text-gray-300"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
                  {selectedScreenshot ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <Image
                        src={`data:image/png;base64,${selectedScreenshot}`}
                        alt="Browser view"
                        width={1440}
                        height={900}
                        className="max-w-full max-h-full object-contain rounded-lg border border-gray-800"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-600 text-sm">No screenshot available</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Test session not found
            </div>
          )}
        </main>
      </div>

      {/* Fullscreen Screenshot Modal */}
      {isScreenshotExpanded && selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          onClick={() => setIsScreenshotExpanded(false)}
        >
          <button
            onClick={() => setIsScreenshotExpanded(false)}
            className="absolute top-4 right-4 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <Image
            src={`data:image/png;base64,${selectedScreenshot}`}
            alt="Browser view fullscreen"
            width={1440}
            height={900}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
