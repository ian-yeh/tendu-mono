"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  Globe,
  ChevronRight,
  Clock,
  CheckCircle,
  Circle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTest } from "@/lib/api";
import { useData } from "@/hooks/useData";

export default function DashboardPage() {
  const router = useRouter();
  const { sessions, addSession } = useData();
  const [serverUrl, setServerUrl] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleRunTests = async () => {
    if (!serverUrl || !testPrompt || isRunning) return;

    setIsRunning(true);

    try {
      const response = await createTest({
        url: serverUrl,
        focus: testPrompt,
      });

      const params = new URLSearchParams({
        url: serverUrl,
        focus: testPrompt,
      });

      addSession({
        id: response.id,
        summary: `${testPrompt.substring(0, 40)}${testPrompt.length > 40 ? "..." : ""}`,
      });

      router.push(`/test/${response.id}?${params.toString()}`);
    } catch (error) {
      console.error("Failed to create test:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && serverUrl && testPrompt) {
      e.preventDefault();
      handleRunTests();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex">
      {/* Left Sidebar - Sessions */}
      <aside className="w-64 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2 text-[#888] text-xs uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            TestPilot
          </div>
        </div>

        {/* Session Lists */}
        <div className="flex-1 overflow-y-auto">
          {/* In Progress Section */}
          <div className="p-2">
            <div className="text-[10px] text-[#555] uppercase tracking-wider px-2 py-2">
              Recent Tests
            </div>

            {hasMounted && sessions.length > 0 ? (
              <div className="space-y-0.5">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/test/${session.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5] transition-colors group"
                  >
                    <Circle className="h-2.5 w-2.5 text-[#3b3]" />
                    <span className="truncate flex-1">{session.summary}</span>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-2 py-1 text-[11px] text-[#444] italic">
                No recent tests
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-2xl w-full space-y-6">
            {/* Welcome Message */}
            <div className="space-y-4">
              <h1 className="text-2xl font-medium text-white">
                What would you like to test?
              </h1>
              <p className="text-sm text-[#666] leading-relaxed">
                Describe your testing scenario and I'll navigate your app, interact with elements,
                and report the results in real-time.
              </p>
            </div>

            {/* URL Input Card */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#3b3]" />
                <span className="text-xs text-[#666]">Target URL</span>
              </div>
              <input
                type="url"
                placeholder="http://localhost:3000"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-[#444] outline-none"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {[
                "Test the login flow",
                "Check all navigation links",
                "Verify form validation",
                "Test the checkout process",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setTestPrompt(suggestion)}
                  className="text-xs px-3 py-1.5 bg-[#111] border border-[#222] rounded text-[#888] hover:border-[#3b3] hover:text-[#3b3] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Input Bar */}
        <div className="border-t border-[#1a1a1a] p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#111] border border-[#222] rounded-lg">
              <textarea
                placeholder="Describe what you want to test..."
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                className="w-full bg-transparent text-sm text-white placeholder:text-[#444] outline-none resize-none p-4"
              />

              {/* Bottom Bar */}
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#666] bg-[#1a1a1a] px-2 py-1 rounded">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3b3]" />
                    <span>Agent</span>
                  </div>
                  <span className="text-xs text-[#444]">Gemini 2.5</span>
                </div>

                <button
                  onClick={handleRunTests}
                  disabled={!serverUrl || !testPrompt || isRunning}
                  className="p-2 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#3b3] hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Helper Text */}
            <div className="mt-2 text-center">
              <span className="text-[10px] text-[#444]">
                Press Enter to run • Shift+Enter for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
