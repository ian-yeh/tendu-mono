import { Sparkles } from "lucide-react";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Sparkles className="h-4 w-4 text-[#888]" />
      <span className="text-sm font-medium text-[#e5e5e5] tracking-wide">
        TestPilot
      </span>
    </div>
  );
}
