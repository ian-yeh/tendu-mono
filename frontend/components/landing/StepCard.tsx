import React from 'react';

type StepNumber = '01' | '02' | '03';

interface StepCardProps {
  step: StepNumber;
  title: string;
  description: string;
}

export default function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="group relative">
      <div className="flex gap-6 items-start p-6 rounded-lg border border-[#222] bg-[#111] hover:border-[#3b3]/50 transition-all duration-200">
        <div className="text-4xl font-semibold text-[#3b3] opacity-60 group-hover:opacity-100 transition-opacity font-mono">
          {step}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium mb-2 text-white">{title}</h3>
          <p className="text-[#666] text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
