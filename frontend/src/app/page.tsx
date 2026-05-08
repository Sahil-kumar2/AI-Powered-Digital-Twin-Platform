"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Cpu, ArrowRight, Zap, ShieldAlert, Activity, Menu, X } from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Cpu className="h-7 w-7 text-cyan-400" />
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">DigitalTwin</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors hidden sm:block">Log in</Link>
          <Link href="/dashboard" className="px-4 py-2 bg-white text-neutral-950 text-sm font-semibold rounded-full hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hidden sm:block">
            Go to Dashboard
          </Link>
          {/* Mobile hamburger */}
          <button className="md:hidden p-2 text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="absolute top-[65px] left-0 right-0 bg-neutral-950 border-b border-neutral-800 flex flex-col p-6 gap-4 z-50">
            <Link href="#features" className="text-lg font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="#architecture" className="text-lg font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Architecture</Link>
            <Link href="#pricing" className="text-lg font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <div className="border-t border-neutral-800 pt-4 flex flex-col gap-3">
              <Link href="/login" className="text-lg font-medium text-neutral-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
              <Link href="/dashboard" className="px-4 py-3 bg-cyan-500 text-neutral-950 font-bold rounded-lg text-center" onClick={() => setMobileMenuOpen(false)}>
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 md:pt-48 md:pb-32 px-4 sm:px-6 flex flex-col items-center text-center">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6 sm:mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Platform v1.0 Alpha Live
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] mb-4 sm:mb-6">
            Predict hardware failures before they <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">happen.</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-2xl mb-8 sm:mb-10 leading-relaxed px-2">
            The intelligent digital twin platform for electronic systems. Design visual architectures, stream live high-frequency telemetry, and use AI anomaly detection to safeguard your infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-4 sm:px-0">
            <Link href="/dashboard" className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)]">
              Build Your Twin <ArrowRight className="h-5 w-5" />
            </Link>
            <button className="w-full sm:w-auto px-8 py-3.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-medium rounded-full transition-colors">
              Book a Demo
            </button>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-neutral-900/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-neutral-900/30 border border-neutral-800 backdrop-blur-sm flex flex-col gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Visual System Builder</h3>
              <p className="text-neutral-400 leading-relaxed text-sm">
                Drag and drop MCUs, sensors, and power modules on an infinite architecture canvas. Map out connections intuitively exactly as they exist physically.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-neutral-900/30 border border-neutral-800 backdrop-blur-sm flex flex-col gap-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Live Telemetry Simulation</h3>
              <p className="text-neutral-400 leading-relaxed text-sm">
                Stream dense telemetry matrices over WebSockets. Visualize signal interference, voltage drops, and temperature spikes in real-time.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-neutral-900/30 border border-neutral-800 backdrop-blur-sm flex flex-col gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">AI Anomaly Detection</h3>
              <p className="text-neutral-400 leading-relaxed text-sm">
                Integrated Isolation Forest models dynamically flag anomalous readings. Large Language Models automatically provide reasoning for component stress.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-900 py-8 sm:py-12 text-center text-neutral-500 text-sm px-4">
        <p>© 2026 AI Digital Twin Inc. Production-grade monitoring for engineers.</p>
      </footer>
    </div>
  );
}
