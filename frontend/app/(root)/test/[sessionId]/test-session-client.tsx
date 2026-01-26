"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  Circle,
  XCircle,
  Maximize2,
  X,
  Send,
} from "lucide-react";
import Link from "next/link";

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
  navigate: <Navigation className="h-4 w-4" />,
  click_at: <MousePointer2 className="h-4 w-4" />,
  type_text_at: <Keyboard className="h-4 w-4" />,
  scroll_document: <ScrollText className="h-4 w-4" />,
  go_back: <ArrowLeftCircle className="h-4 w-4" />,
  go_forward: <ArrowRightCircle className="h-4 w-4" />,
  wait_5_seconds: <Clock className="h-4 w-4" />,
  key_combination: <Command className="h-4 w-4" />,
  done: <CheckCircle2 className="h-4 w-4" />,
};

function ActionItem({ action, index, isSelected, onSelect }: {
  action: Action;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const icon = ACTION_ICONS[action.type] || <Circle className="h-3 w-3" />;

  const formatActionType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isDone = action.type === "done";

  // Special styling for Done action - detect if it's a failure
  if (isDone) {
    const elementText = (action.element || "").toLowerCase();
    const reasoningText = (action.reasoning || "").toLowerCase();
    const isFailure = elementText.includes("fail") ||
      elementText.includes("error") ||
      reasoningText.includes("failed") ||
      reasoningText.includes("could not") ||
      reasoningText.includes("unable to");

    return (
      <div
        className={`mx-2 my-2 rounded-lg border transition-colors cursor-pointer ${isFailure
            ? isSelected
              ? "bg-[#3a1a1a] border-[#b33]"
              : "bg-[#1a0d0d] border-[#3a2a2a] hover:border-[#b33]"
            : isSelected
              ? "bg-[#1a3a1a] border-[#3b3]"
              : "bg-[#0d1a0d] border-[#2a3a2a] hover:border-[#3b3]"
          }`}
        onClick={onSelect}
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            {isFailure ? (
              <XCircle className="h-5 w-5 text-[#f55]" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-[#4c4]" />
            )}
            <span className={`text-sm font-semibold ${isFailure ? "text-[#f55]" : "text-[#4c4]"}`}>
              {isFailure ? "Test Failed" : "Test Passed"}
            </span>
            <span className="text-xs text-[#555] ml-auto font-mono">
              {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {action.element && (
            <div className="mb-3">
              <div className="text-xs text-[#666] mb-1">Result</div>
              <p className="text-sm text-[#ccc]">{action.element}</p>
            </div>
          )}
          {action.reasoning && (
            <div>
              <div className="text-xs text-[#666] mb-1">Details</div>
              <p className="text-sm text-[#999] leading-relaxed">
                {action.reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`transition-colors cursor-pointer ${isSelected
        ? "bg-[#1a1a1a]"
        : "hover:bg-[#111]"
        }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Icon */}
        <div className="mt-0.5 text-[#666]">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#aaa]">
              {formatActionType(action.type)}
            </span>
            {action.element && (
              <span className="text-xs text-[#666] truncate">
                {action.element}
              </span>
            )}
          </div>

          {/* Reasoning preview or expanded */}
          {action.reasoning && (
            <div className="mt-1.5">
              {isExpanded ? (
                <p className="text-sm text-[#888] leading-relaxed">
                  {action.reasoning}
                </p>
              ) : (
                <p className="text-xs text-[#666] line-clamp-2">
                  {action.reasoning.substring(0, 100)}...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Expand/Time */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#444] font-mono">
            {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {action.reasoning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 hover:bg-[#222] rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-[#555]" />
              ) : (
                <ChevronRight className="h-3 w-3 text-[#555]" />
              )}
            </button>
          )}
        </div>
      </div>
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

  // Poll for updates periodically
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

  const selectedScreenshot = selectedActionIndex !== null && testRun?.actions[selectedActionIndex]?.screenshot
    ? testRun.actions[selectedActionIndex].screenshot
    : testRun?.actions[testRun.actions.length - 1]?.screenshot;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex">

      {/* Left Sidebar - Session List Style */}
      <aside className="w-64 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col">
        <div className="p-3 border-b border-[#1a1a1a]">
          <Link href="/test" className="flex items-center gap-2 text-[#666] hover:text-[#888] transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span className="text-xs">Back to Tests</span>
          </Link>
        </div>

        {/* Status */}
        <div className="p-3 border-b border-[#1a1a1a]">
          <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Status</div>
          {testRun && (
            <div className="flex items-center gap-2">
              {testRun.status === "running" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-[#3b3] animate-pulse" />
                  <span className="text-xs text-[#3b3]">Running</span>
                </>
              )}
              {testRun.status === "complete" && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-[#3b3]" />
                  <span className="text-xs text-[#3b3]">Complete</span>
                </>
              )}
              {testRun.status === "failed" && (
                <>
                  <XCircle className="h-3 w-3 text-[#f55]" />
                  <span className="text-xs text-[#f55]">Failed</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Test Info */}
        {testRun && (
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Test Info</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-[#444] mb-1">Goal</div>
                <p className="text-[11px] text-[#888] leading-relaxed">{testRun.focus}</p>
              </div>
              <div>
                <div className="text-[10px] text-[#444] mb-1">URL</div>
                <p className="text-[10px] text-[#3b3] break-all font-mono">{testRun.url}</p>
              </div>
              <div className="flex gap-4 pt-2">
                <div>
                  <div className="text-lg font-medium text-[#3b3]">{testRun.actions.length}</div>
                  <div className="text-[10px] text-[#555]">Actions</div>
                </div>
                <div>
                  <div className="text-lg font-medium text-[#888]">{testRun.cases.length}</div>
                  <div className="text-[10px] text-[#555]">Tests</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Middle - Actions List */}
      <div className="w-96 border-r border-[#1a1a1a] flex flex-col">
        <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <span className="text-xs text-[#666]">Actions</span>
          {testRun?.status === "running" && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-[#3b3]" />
              <span className="text-[10px] text-[#3b3]">Live</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-[#3b3]" />
            </div>
          ) : testRun?.actions.map((action, idx) => (
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

      {/* Right - Screenshot */}
      <div className="flex-1 flex flex-col bg-[#080808]">
        <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <span className="text-xs text-[#666]">
            {selectedActionIndex !== null ? `Step ${selectedActionIndex + 1}` : 'Preview'}
          </span>
          <button
            onClick={() => setIsScreenshotExpanded(true)}
            className="p-1 hover:bg-[#1a1a1a] rounded transition-colors text-[#555] hover:text-[#888]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
          {selectedScreenshot ? (
            <Image
              src={`data:image/png;base64,${selectedScreenshot}`}
              alt="Browser view"
              width={1440}
              height={900}
              className="max-w-full max-h-full object-contain rounded border border-[#222]"
            />
          ) : (
            <div className="text-[#444] text-sm">No screenshot</div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isScreenshotExpanded && selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8"
          onClick={() => setIsScreenshotExpanded(false)}
        >
          <button
            onClick={() => setIsScreenshotExpanded(false)}
            className="absolute top-4 right-4 p-2 bg-[#1a1a1a] rounded-lg hover:bg-[#222] transition-colors"
          >
            <X className="h-5 w-5 text-[#888]" />
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
