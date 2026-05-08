"use client";
import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Bell, Search, Menu } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen w-full bg-neutral-900 text-white overflow-hidden font-sans">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                {/* Top Navigation */}
                <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur shrink-0 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Mobile menu button */}
                        <button className="lg:hidden p-1.5 text-neutral-400 hover:text-white shrink-0" onClick={() => setSidebarOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="relative w-full max-w-sm hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Search systems, components... (Cmd+K)"
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all text-neutral-200 placeholder:text-neutral-500"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-medium text-emerald-500 hidden sm:inline">Live</span>
                        </div>
                        <button className="text-neutral-400 hover:text-white transition-colors relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white border-2 border-neutral-950">3</span>
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/20">
                    {children}
                </main>
            </div>
        </div>
    );
}
