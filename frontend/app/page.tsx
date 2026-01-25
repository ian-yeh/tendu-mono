import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import StepCard from '../components/landing/StepCard';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Home(): React.ReactElement {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 max-w-7xl flex items-center justify-between">
          <Logo />
          <Link href={"/test"}>
            <Button 
              variant="outline" 
              className="bg-transparent border-purple-500/30 text-white hover:bg-white/10 hover:text-white"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-black to-blue-950/20" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 opacity-[0.15] rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 opacity-[0.15] rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-red-600 opacity-[0.1] rounded-full blur-3xl animate-pulse delay-500" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-600/10 to-blue-600/10 backdrop-blur-sm mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-light tracking-wide">AI-Powered Testing</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight animate-fade-in-up">
            Test Locally.
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-red-400 bg-clip-text text-transparent">
              Ship Confidently.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto font-light leading-relaxed animate-fade-in-up delay-200">
            AI-powered testing for your local development environment. 
            Catch bugs before they reach production.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
            <Link href={"/test"}>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 text-lg rounded-full font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/30"
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-purple-500/30 text-white hover:bg-white/15 hover:text-white text-lg rounded-full font-medium transition-all duration-300"
            >
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 px-6 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-red-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">How It Works</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
              Three simple steps to AI-powered testing
            </p>
          </div>

          <div className="space-y-8">
            <StepCard
              step="01"
              title="Submit Your URL & Instructions"
              description="Enter your local development server URL and describe what you want to test. Our AI agent will explore your application automatically."
            />
            <StepCard
              step="02"
              title="AI Agent Explores & Tests"
              description="Using Playwright and Gemini AI, our agent navigates your site, interacts with elements, and generates comprehensive test cases in real-time."
            />
            <StepCard
              step="03"
              title="View Real-Time Results"
              description="Watch as test cases are generated live with screenshots, action logs, and pass/fail status. Get instant feedback on your application's behavior."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-black to-black" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Ready to Transform</span>
            <br />
            Your Testing?
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light">
            Automate your QA testing with AI-powered browser automation
          </p>
          <Link href={"/test"}>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 text-white hover:from-blue-700 hover:via-purple-700 hover:to-red-700 text-lg px-12 py-7 rounded-full font-medium transition-all duration-300 hover:scale-105 shadow-2xl shadow-purple-500/50"
            >
              Start Testing Now <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">© 2024 AI Test Tool. Built for hackathon.</p>
          <div className="flex gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
