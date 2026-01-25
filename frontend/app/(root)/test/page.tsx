"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Play,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTest } from "@/lib/api";
import { useData } from "@/hooks/useData";
import Logo from "@/components/Logo";

export default function DashboardPage() {
  const router = useRouter();
  const { sessions, addSession } = useData();
  const [serverUrl, setServerUrl] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Load recent sessions from localStorage or API if needed
    console.log(sessions)
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
        summary: `Tested: ${testPrompt.substring(0, 30)}${testPrompt.length > 30 ? "..." : ""}`,
      });

      router.push(`/test/${response.id}?${params.toString()}`);
    } catch (error) {
      console.error("Failed to create test:", error);
      // Handle error (show toast, etc.)
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0a0a1a] via-[#0f0a1f] to-[#1a0a1f] flex">
      {/* Sidebar */}
      <aside className="w-1/4 bg-[#1a1a2e] p-4 text-white flex flex-col justify-between h-screen">
        <div>
          <Link href="/" >
            <Logo />
          </Link>
          <h2 className="text-md mb-4 mt-8">Recent</h2>
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id} className="p-2 bg-[#2a2a3e] rounded">
                {session.summary}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Page Header */}
          <div className="mb-12 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs backdrop-blur-sm mb-4 animate-fade-in">
              <Sparkles className="h-3 w-3 text-purple-400" />
              <p className="text-white">AI Testing Dashboard</p>
            </div>
            <h1 className="text-5xl font-semibold text-white mb-3 animate-fade-in-up delay-100">
              Test Your App
            </h1>
            <p className="text-gray-400 text-lg animate-fade-in-up delay-200">
              Run AI-powered tests on your local development environment.
            </p>
          </div>

          {/* Input Section */}
          <Card className="bg-[#1a1a2e]/50 border-gray-800 backdrop-blur-sm animate-fade-in-up delay-300">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label
                  htmlFor="server-url"
                  className="text-white text-sm font-medium"
                >
                  Local Dev Server URL
                </Label>
                <Input
                  id="server-url"
                  placeholder="http://localhost:3000"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="bg-[#0f0f1e] border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 h-12 text-base"
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="test-prompt"
                  className="text-white text-sm font-medium"
                >
                  Test Instructions
                </Label>
                <Textarea
                  id="test-prompt"
                  placeholder="Describe what you want to test... e.g., 'Test the login flow with valid credentials' or 'Check if all navigation links work'"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={10}
                  className="bg-[#0f0f1e] border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 resize-none text-base"
                />
              </div>

              <Button
                onClick={handleRunTests}
                disabled={!serverUrl || !testPrompt || isRunning}
                className="w-full bg-linear-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed h-12 text-base font-medium"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Preparing test session...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Run Tests
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
