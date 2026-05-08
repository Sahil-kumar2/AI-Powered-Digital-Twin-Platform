"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Cpu,
    Activity,
    BrainCircuit,
    BellRing,
    BookOpen,
    Settings,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Systems Managed", href: "/dashboard/systems", icon: Cpu },
    { name: "Live Telemetry", href: "/dashboard/telemetry", icon: Activity },
    { name: "AI Insights", href: "/dashboard/insights", icon: BrainCircuit },
    { name: "Alerts", href: "/dashboard/alerts", icon: BellRing },
    { name: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose}></div>
            )}

            <div className={cn(
                "flex h-full w-64 flex-col bg-neutral-950 border-r border-neutral-800 text-white overflow-y-auto z-50 shrink-0 transition-transform duration-200",
                "fixed lg:relative",
                open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                <div className="flex h-16 items-center justify-between px-6 border-b border-neutral-800">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Cpu className="h-6 w-6 text-cyan-400" />
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">DigitalTwin AI</span>
                    </div>
                    <button className="lg:hidden text-neutral-400 hover:text-white" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <nav className="flex-1 space-y-1.5 p-4 pl-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-800/80 hover:text-white",
                                    isActive ? "bg-cyan-900/40 text-cyan-400 border border-cyan-800/50" : "text-neutral-400"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-neutral-800">
                    <UserProfile />
                </div>
            </div>
        </>
    );
}

function UserProfile() {
    const [user, setUser] = React.useState<any>(null);
    React.useEffect(() => {
        const u = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        if (u) setUser(JSON.parse(u));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
    };

    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-medium">
                {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : "?"}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{user?.name || user?.email || "Not logged in"}</span>
                <button onClick={handleLogout} className="text-xs text-neutral-500 hover:text-rose-400 transition-colors text-left">Sign out</button>
            </div>
        </div>
    );
}
