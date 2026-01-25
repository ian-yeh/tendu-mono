// app/(root)/test/[sessionId]/page.tsx

// 1) Make sure this file is a SERVER component (NO "use client" here)
"use client";
import { useParams, useSearchParams } from "next/navigation";
import TestSessionClient from "./test-session-client";

// 2) Force this page to be rendered dynamically on every request
export const dynamic = "force-dynamic";

type PageProps = {
  params: { sessionId: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default function TestSessionPage() {
  // Safely read query params from the server-rendered props
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId as string;
  const urlParam = searchParams.get("serverUrl") || ""
  const promptParam = searchParams.get("prompt") || ""

  // Optional: log everything to confirm it's working
  console.log("searchParams:", searchParams);
  console.log("serverUrl:", urlParam);
  console.log("prompt:", promptParam);

  return (
    <TestSessionClient
      sessionId={sessionId}
      initialUrl={urlParam}
      initialPrompt={promptParam}
    />
  );
}
