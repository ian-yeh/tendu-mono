import React from 'react';

type StepNumber = '01' | '02' | '03';

interface StepCardProps {
  step: StepNumber;
  title: string;
  description: string;
}

const gradients: Record<StepNumber, string> = {
  '01': 'from-purple-500/20 to-blue-500/20',
  '02': 'from-blue-500/20 to-red-500/20',
  '03': 'from-red-500/20 to-purple-500/20'
};

const textGradients: Record<StepNumber, string> = {
  '01': 'from-purple-400 to-blue-400',
  '02': 'from-blue-400 to-red-400',
  '03': 'from-red-400 to-purple-400'
};

export default function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="group relative">
      <div className={`flex gap-8 items-start p-8 rounded-2xl border border-white/10 bg-gradient-to-r ${gradients[step]} backdrop-blur-sm hover:border-white/20 transition-all duration-300`}>
        <div className={`text-6xl font-bold bg-gradient-to-r ${textGradients[step]} bg-clip-text text-transparent group-hover:opacity-80 transition-opacity`}>
          {step}
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-semibold mb-3 text-white">{title}</h3>
          <p className="text-gray-400 text-lg leading-relaxed font-light">{description}</p>
        </div>
      </div>
    </div>
  );
}
