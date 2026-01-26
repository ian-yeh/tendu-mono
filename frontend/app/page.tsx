import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Home(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo />
          <Link href={"/test"}>
            <Button
              size="sm"
              className="bg-[#1a1a1a] border border-[#333] text-[#888] hover:bg-[#222] hover:text-white text-xs px-4 py-2 rounded-md"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-medium mb-4 leading-tight text-white">
            Built to make you extraordinarily productive.
            <br />
            <span className="text-[#888]">
              TestPilot is the best way to test with AI.
            </span>
          </h1>

          <div className="mt-8">
            <Link href={"/test"}>
              <Button
                size="sm"
                className="bg-[#1a1a1a] border border-[#333] text-white hover:bg-[#222] text-xs px-4 py-2 rounded-md"
              >
                Start Testing <ArrowRight className="ml-2 w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Product Screenshot Hero */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-xl overflow-hidden border border-[#222] bg-[#111]">
            {/* Fake product screenshot - styled like Cursor */}
            <div className="aspect-16/10 bg-gradient-to-br from-[#0d0d0d] via-[#111] to-[#0d0d0d] p-4">
              <div className="h-full rounded-lg border border-[#222] bg-[#0a0a0a] flex">
                {/* Sidebar */}
                <div className="w-48 border-r border-[#1a1a1a] p-3">
                  <div className="text-[10px] text-[#555] uppercase mb-2">Recent Tests</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-[#666] p-1.5 bg-[#1a1a1a] rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3b3]" />
                      Test login flow
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#555] p-1.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#555]" />
                      Check navigation
                    </div>
                  </div>
                </div>
                {/* Main area */}
                <div className="flex-1 p-4">
                  <div className="text-xs text-[#666] mb-4">What would you like to test?</div>
                  <div className="bg-[#111] border border-[#222] rounded-lg p-3 text-[10px] text-[#444]">
                    Test the checkout flow: add item to cart, fill shipping details...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-12 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] text-[#444] uppercase tracking-wider mb-6">
            Trusted every day by developers at
          </p>
          <div className="flex items-center justify-center gap-12 text-[#333]">
            {['Stripe', 'OpenAI', 'Linear', 'Vercel', 'Figma', 'Adobe'].map((company) => (
              <span key={company} className="text-sm font-medium text-[#555]">{company}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature 1 */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-2xl font-medium mb-4 text-white">
              Agent turns tests into code
            </h2>
            <p className="text-sm text-[#666] leading-relaxed mb-4">
              A human-AI tester, orders of magnitude more effective than any automated alone.
            </p>
            <a href="#" className="text-xs text-[#f80] hover:underline">
              Learn about Agent →
            </a>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="aspect-[4/3] bg-[#0a0a0a] rounded-lg flex items-center justify-center">
              <div className="text-[10px] text-[#333]">[Product Screenshot]</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2 */}
      <section className="py-24 px-6 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="bg-[#111] border border-[#222] rounded-xl p-4 order-2 md:order-1">
            <div className="aspect-[4/3] bg-[#0a0a0a] rounded-lg flex items-center justify-center">
              <div className="text-[10px] text-[#333]">[Product Screenshot]</div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-2xl font-medium mb-4 text-white">
              Real-time test results
            </h2>
            <p className="text-sm text-[#666] leading-relaxed mb-4">
              Watch as AI navigates your app, takes screenshots, and reports issues with striking speed and precision.
            </p>
            <a href="#" className="text-xs text-[#f80] hover:underline">
              Learn about Tab →
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-medium mb-4 text-white">
            Try TestPilot for Free
          </h2>
          <p className="text-sm text-[#666] mb-8">
            Start testing your local development environment with AI today.
          </p>
          <Link href={"/test"}>
            <Button
              className="bg-white text-black hover:bg-[#e5e5e5] text-sm px-6 py-2 rounded-md font-medium"
            >
              Start Testing
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#333] text-xs">© 2024 TestPilot</p>
          <div className="flex gap-6 text-xs text-[#444]">
            <a href="#" className="hover:text-[#888] transition-colors">Documentation</a>
            <a href="#" className="hover:text-[#888] transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
