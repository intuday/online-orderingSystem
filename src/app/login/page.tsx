"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, Eye, EyeOff, User, Phone,
  AlertCircle, CheckCircle, RefreshCw,
  ExternalLink, ArrowRight, UtensilsCrossed,
} from "lucide-react";

import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  googleProvider,
} from "@/lib/firebase";

type Step =
  | "login"
  | "signup"
  | "verify_email"
  | "forgot_password"
  | "collect_phone"
  | "success";

// ── All logic inside this inner component ──────────────────────────────────────
function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const redirectTo   = searchParams.get("redirect") || "";
  const tableId      = searchParams.get("table")    || "";
  const restaurantId = searchParams.get("r")        || "";

  const [step, setStep]           = useState<Step>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [name, setName]           = useState("");
  const [phone, setPhone]         = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [userRole, setUserRole]   = useState("customer");

  const buildRedirect = (role: string) => {
    if (redirectTo) return redirectTo;
    if (role === "admin" || role === "super_admin") return "/admin";
    const p = new URLSearchParams();
    if (tableId)      p.set("table", tableId);
    if (restaurantId) p.set("r", restaurantId);
    return p.toString() ? `/menu?${p.toString()}` : "/menu";
  };

  const goSuccess = (role: string) => {
    setStep("success");
    setTimeout(() => { router.push(buildRedirect(role)); router.refresh(); }, 900);
  };

  const handleAuthSuccess = async (idToken: string) => {
    const res  = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === "email_not_verified") { setStep("verify_email"); return; }
      throw new Error(data.error || "Login failed");
    }

    if (data.needsPhone === true) {
      setName(data.user?.name   || "");
      setEmail(data.user?.email || "");
      setUserRole(data.user?.role || "customer");
      setStep("collect_phone");
      return;
    }

    goSuccess(data.user.role);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!cred.user.emailVerified) { setStep("verify_email"); return; }
      await handleAuthSuccess(await cred.user.getIdToken(true));
    } catch (err: any) {
      const c = err?.code || "";
      if (c.includes("user-not-found") || c.includes("wrong-password") || c.includes("invalid-credential")) {
        setError("Invalid email or password");
      } else if (c.includes("too-many-requests")) {
        setError("Too many attempts. Try later.");
      } else { setError(err?.message || "Login failed"); }
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await handleAuthSuccess(await cred.user.getIdToken(true));
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") setError(err?.message || "Google sign in failed");
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (password.length < 6)  { setError("Password must be at least 6 characters"); return; }
      if (phone.length < 10)    { setError("Enter valid 10-digit phone number"); return; }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user);
      await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: cred.user.uid, email: email.trim(), name: name.trim(), phone: phone.trim() }),
      });
      setStep("verify_email");
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") setError("Email already registered. Please login.");
      else if (err?.code === "auth/weak-password") setError("Password too weak.");
      else setError(err?.message || "Signup failed");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resending || resent) return;
    setResending(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user);
      setResent(true);
      setTimeout(() => setResent(false), 30000);
    } catch { setError("Failed to resend"); }
    finally { setResending(false); }
  };

  const handleCheckVerified = async () => {
    setLoading(true); setError("");
    try {
      await auth.currentUser?.reload();
      const user = auth.currentUser;
      if (user?.emailVerified) {
        await handleAuthSuccess(await user.getIdToken(true));
      } else { setError("Email not verified yet. Please check Gmail."); }
    } catch { setError("Please try again."); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email"); return; }
    setLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err: any) { setError(err?.message || "Failed"); }
    finally { setLoading(false); }
  };

  const handleSavePhone = async () => {
    if (phone.length < 10) { setError("Enter valid 10-digit phone number"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (res.ok) { goSuccess(userRole); }
      else { setError("Failed to save. Try again."); }
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  const inp = "w-full h-12 px-8 pl-11 pr-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-orange-400 transition-colors placeholder:text-slate-400";
  const btn = "w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200/50";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 overflow-y-auto">

      {/* Brand Header */}
      <div className="pt-10 pb-6 px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg"
        >
          <UtensilsCrossed className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-white"
        >
          The Royal Kitchen
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/70 text-sm mt-1"
        >
          Premium Dining Experience
        </motion.p>
        {tableId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full border border-white/30"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Table {tableId}
          </motion.div>
        )}
      </div>

      {/* Card */}
      <div className="px-4 pb-12">
        <div className="mx-auto w-full max-w-sm">
          <AnimatePresence mode="wait">

            {/* LOGIN */}
            {step === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="flex border-b border-slate-100">
                  <button className="flex-1 py-4 text-sm font-bold text-orange-500 border-b-2 border-orange-500 bg-orange-50/40">
                    Sign In
                  </button>
                  <button
                    onClick={() => { setStep("signup"); setError(""); setPhone(""); }}
                    className="flex-1 py-4 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          autoComplete="email"
                          className={inp}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-600">Password</label>
                        <button
                          type="button"
                          onClick={() => { setStep("forgot_password"); setError(""); }}
                          className="text-[11px] text-orange-500 font-semibold hover:text-orange-600"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPass ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          autoComplete="current-password"
                          className="w-full h-12 pl-11 px-8 pr-11 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          {showPass
                            ? <EyeOff className="w-4 h-4 text-slate-400" />
                            : <Eye className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !email || !password}
                      className={btn}
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium">or</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full h-12 border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    Don&apos;t have an account?{" "}
                    <button
                      onClick={() => { setStep("signup"); setError(""); setPhone(""); }}
                      className="text-orange-500 font-bold hover:text-orange-600"
                    >
                      Sign up free
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* SIGNUP */}
            {step === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="flex border-b border-slate-100">
                  <button
                    onClick={() => { setStep("login"); setError(""); }}
                    className="flex-1 py-4 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Sign In
                  </button>
                  <button className="flex-1 py-4 text-sm font-bold text-orange-500 border-b-2 border-orange-500 bg-orange-50/40">
                    Sign Up
                  </button>
                </div>
                <div className="p-5">
                  <form onSubmit={handleSignup} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name"
                          required
                          autoComplete="name"
                          className={inp}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          autoComplete="email"
                          className={inp}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Phone * <span className="font-normal text-slate-400">(10 digits)</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="10-digit mobile"
                          required
                          maxLength={10}
                          autoComplete="tel"
                          className={inp}
                        />
                      </div>
                      {phone.length > 0 && phone.length < 10 && (
                        <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{10 - phone.length} more digits needed
                        </p>
                      )}
                      {phone.length === 10 && (
                        <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />Valid ✓
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Password * <span className="font-normal text-slate-400">(min 6)</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPass ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          autoComplete="new-password"
                          className="w-full h-12 px-8 pl-11 pr-11 rounded-2xl border-2 border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          {showPass
                            ? <EyeOff className="w-4 h-4 text-slate-400" />
                            : <Eye className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !name || !email || !password || phone.length < 10}
                      className={btn}
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : "Create Account"}
                    </button>
                  </form>
                  <p className="text-center text-xs text-slate-500 mt-4">
                    Already have an account?{" "}
                    <button
                      onClick={() => { setStep("login"); setError(""); }}
                      className="text-orange-500 font-bold hover:text-orange-600"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* COLLECT PHONE */}
            {step === "collect_phone" && (
              <motion.div
                key="collect_phone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
                <div className="p-6">
                  <div className="text-center mb-5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="text-5xl mb-3"
                    >
                      📱
                    </motion.div>
                    <h2 className="text-xl font-bold text-slate-900">One Last Step!</h2>
                    <p className="text-sm text-slate-500 mt-1">Add your phone for order updates</p>
                    {name && (
                      <p className="text-xs text-orange-500 font-semibold mt-1">Welcome, {name}! 👋</p>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="10-digit phone number"
                          autoFocus
                          maxLength={10}
                          className="w-full h-13 py-3.5 pl-11 pr-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-base font-medium tracking-wider focus:outline-none focus:border-orange-400 transition-colors placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal"
                        />
                      </div>
                      {phone.length > 0 && phone.length < 10 && (
                        <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />{10 - phone.length} more digits needed
                        </p>
                      )}
                      {phone.length === 10 && (
                        <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 shrink-0" />Valid number ✓
                        </p>
                      )}
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    <button
                      onClick={handleSavePhone}
                      disabled={loading || phone.length < 10}
                      className={btn}
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                    <button
                      onClick={() => goSuccess(userRole)}
                      className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
                    >
                      Skip for now →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* EMAIL VERIFICATION */}
            {step === "verify_email" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-6 text-center"
              >
                <div className="w-16 h-16 bg-amber-100 rounded-2xl mx-auto flex items-center justify-center mb-3">
                  <Mail className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Verify Your Email</h2>
                <p className="text-sm text-slate-500 mt-1">Verification link sent to:</p>
                <p className="text-sm font-bold text-slate-900 bg-slate-50 px-3 py-2 rounded-xl mt-2 mb-3 break-all">
                  {email}
                </p>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Click the link in your email, then tap the button below.
                </p>
                {error && (
                  <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl mb-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                {resent && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-100 px-3 py-2.5 rounded-xl mb-3">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Email sent!</span>
                  </div>
                )}
                <div className="space-y-3">
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 bg-red-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                      <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                    </svg>
                    Open Gmail <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleCheckVerified}
                    disabled={loading}
                    className="w-full h-12 bg-slate-900 text-white font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle className="w-4 h-4" /> I&apos;ve Verified My Email</>}
                  </button>
                  <button
                    onClick={handleResend}
                    disabled={resending || resent}
                    className="w-full h-10 border-2 border-slate-200 text-slate-600 text-sm font-medium rounded-2xl hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {resending
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : resent ? "Sent ✓" : "Resend Verification Email"}
                  </button>
                  <button
                    onClick={() => { setStep("login"); setError(""); setResent(false); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
                  >
                    ← Back to Login
                  </button>
                </div>
              </motion.div>
            )}

            {/* FORGOT PASSWORD */}
            {step === "forgot_password" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="bg-white rounded-3xl shadow-2xl p-6"
              >
                <div className="text-center mb-5">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center mb-2">
                    <Lock className="w-7 h-7 text-slate-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                  <p className="text-sm text-slate-500 mt-1">We&apos;ll send a reset link to your email</p>
                </div>
                {!resetSent ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className={inp}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-slate-900 text-white font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center active:scale-[0.98] transition-all"
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : "Send Reset Link"}
                    </button>
                  </form>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Reset link sent!</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Check inbox at <strong>{email}</strong>
                      </p>
                    </div>
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-11 bg-red-500 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 transition-all"
                    >
                      Open Gmail <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
                <button
                  onClick={() => { setStep("login"); setError(""); setResetSent(false); }}
                  className="w-full text-center text-xs text-slate-400 mt-4 hover:text-slate-600 transition-colors py-1"
                >
                  ← Back to Login
                </button>
              </motion.div>
            )}

            {/* SUCCESS */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4"
                >
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </motion.div>
                <h2 className="text-xl font-bold text-slate-900">Welcome! 🎉</h2>
                <p className="text-sm text-slate-500 mt-2">Redirecting you now...</p>
                <div className="mt-4 w-8 h-8 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Suspense wrapper — fixes useSearchParams build error ───────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8 text-white" />
            </div>
            <div className="w-8 h-8 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}