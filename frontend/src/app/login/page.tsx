"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, Mail, Lock, LogIn, Github, UserPlus } from "lucide-react";
import { auth } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isSignup) {
                await auth.register(email, password, name);
                // Auto login after registration
                const data = await auth.login(email, password);
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                router.push("/dashboard");
            } else {
                const data = await auth.login(email, password);
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                router.push("/dashboard");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 font-sans">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-600/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-sm relative z-10">
                <Link href="/" className="flex items-center justify-center gap-2 font-bold text-2xl mb-10">
                    <Cpu className="h-8 w-8 text-cyan-400" />
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">DigitalTwin AI</span>
                </Link>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
                    <h2 className="text-xl font-bold mb-1 text-center">{isSignup ? "Create Account" : "Welcome Back"}</h2>
                    <p className="text-sm text-neutral-400 text-center mb-6">{isSignup ? "Sign up to get started" : "Sign in to your engineering workspace"}</p>

                    {error && (
                        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {isSignup && (
                            <div className="relative">
                                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                    required
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <input
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                required
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="h-4 w-4 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin"></span>
                            ) : (
                                <><LogIn className="h-4 w-4" /> {isSignup ? "Create Account" : "Sign In"}</>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
                        <button
                            onClick={() => { setIsSignup(!isSignup); setError(""); }}
                            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                            {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
