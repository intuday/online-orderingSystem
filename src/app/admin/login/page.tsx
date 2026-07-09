// "use client";

// import { useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Lock, Mail, Eye, EyeOff, Shield,
//   AlertCircle, CheckCircle, RefreshCw,
// } from "lucide-react";
// import {
//   auth,
//   signInWithEmailAndPassword,
//   sendEmailVerification,
// } from "@/lib/firebase";

// type Step = "login" | "verify_email" | "success";

// export default function AdminLoginPage() {
//   const router       = useRouter();
//   const searchParams = useSearchParams();
//   const redirectTo   = searchParams.get("redirect") || "/admin";

//   const [step, setStep]         = useState<Step>("login");
//   const [email, setEmail]       = useState("");
//   const [password, setPassword] = useState("");
//   const [showPass, setShowPass] = useState(false);
//   const [error, setError]       = useState("");
//   const [loading, setLoading]   = useState(false);
//   const [resending, setResending] = useState(false);
//   const [resent, setResent]     = useState(false);

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");
//     setLoading(true);

//     try {
//       // ✅ Step 1: Firebase Auth se login
//       const userCredential = await signInWithEmailAndPassword(
//         auth, email.trim(), password
//       );
//       const user = userCredential.user;

//       // ✅ Step 2: Email verified check
//       if (!user.emailVerified) {
//         setStep("verify_email");
//         setLoading(false);
//         return;
//       }

//       // ✅ Step 3: ID token lo
//       const idToken = await user.getIdToken();

//       // ✅ Step 4: Backend se verify + cookie set karwao
//       const res  = await fetch("/api/auth/admin-login", {
//         method:  "POST",
//         headers: { "Content-Type": "application/json" },
//         body:    JSON.stringify({ idToken }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         if (data.error === "email_not_verified") {
//           setStep("verify_email");
//           return;
//         }
//         setError(data.error || "Login failed");
//         return;
//       }

//       // ✅ Step 5: Success - redirect
//       setStep("success");
//       setTimeout(() => {
//         router.push(redirectTo);
//         router.refresh();
//       }, 800);

//     } catch (err: any) {
//       // Firebase error codes handle karo
//       const code = err?.code || "";
//       if (
//         code === "auth/user-not-found" ||
//         code === "auth/wrong-password" ||
//         code === "auth/invalid-credential" ||
//         code === "auth/invalid-email"
//       ) {
//         setError("Invalid email or password");
//       } else if (code === "auth/too-many-requests") {
//         setError("Too many attempts. Please try again later.");
//       } else if (code === "auth/user-disabled") {
//         setError("This account has been disabled.");
//       } else {
//         setError(err?.message || "Login failed. Please try again.");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendVerification = async () => {
//     if (resending || resent) return;
//     setResending(true);
//     try {
//       const userCredential = await signInWithEmailAndPassword(
//         auth, email.trim(), password
//       );
//       await sendEmailVerification(userCredential.user);
//       setResent(true);
//     } catch {
//       setError("Failed to resend. Please try again.");
//     } finally {
//       setResending(false);
//     }
//   };

//   const handleCheckVerification = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       // Reload user to get latest emailVerified status
//       await auth.currentUser?.reload();
//       const user = auth.currentUser;

//       if (user?.emailVerified) {
//         const idToken = await user.getIdToken(true);
//         const res = await fetch("/api/auth/admin-login", {
//           method:  "POST",
//           headers: { "Content-Type": "application/json" },
//           body:    JSON.stringify({ idToken }),
//         });
//         const data = await res.json();
//         if (res.ok) {
//           setStep("success");
//           setTimeout(() => { router.push(redirectTo); router.refresh(); }, 800);
//         } else {
//           setError(data.error || "Login failed");
//         }
//       } else {
//         setError("Email not verified yet. Please check your inbox.");
//       }
//     } catch {
//       setError("Failed to check verification. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
//       <motion.div
//         initial={{ opacity: 0, y: 30, scale: 0.95 }}
//         animate={{ opacity: 1, y: 0, scale: 1 }}
//         className="w-full max-w-sm"
//       >
//         <AnimatePresence mode="wait">

//           {/* ── Login Form ── */}
//           {step === "login" && (
//             <motion.div
//               key="login"
//               initial={{ opacity: 0, x: -20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: 20 }}
//               className="bg-white rounded-2xl shadow-2xl p-8"
//             >
//               <div className="text-center mb-8">
//                 <div className="w-14 h-14 bg-slate-900 rounded-xl mx-auto flex items-center justify-center mb-4">
//                   <Shield className="w-7 h-7 text-white" />
//                 </div>
//                 <h1 className="text-xl font-bold text-slate-900">Admin Login</h1>
//                 <p className="text-sm text-slate-500 mt-1">Restaurant Management Panel</p>
//               </div>

//               <form onSubmit={handleLogin} className="space-y-4">
//                 <div>
//                   <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
//                   <div className="relative">
//                     <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//                     <input
//                       type="email"
//                       value={email}
//                       onChange={(e) => setEmail(e.target.value)}
//                       placeholder="admin@restaurant.com"
//                       required
//                       className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
//                     />
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
//                   <div className="relative">
//                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//                     <input
//                       type={showPass ? "text" : "password"}
//                       value={password}
//                       onChange={(e) => setPassword(e.target.value)}
//                       placeholder="••••••••"
//                       required
//                       className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => setShowPass(!showPass)}
//                       className="absolute right-3 top-1/2 -translate-y-1/2"
//                     >
//                       {showPass ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
//                     </button>
//                   </div>
//                 </div>

//                 {error && (
//                   <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
//                     <AlertCircle className="w-4 h-4 shrink-0" />
//                     <span>{error}</span>
//                   </div>
//                 )}

//                 <button
//                   type="submit"
//                   disabled={loading || !email || !password}
//                   className="w-full h-11 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
//                 >
//                   {loading ? (
//                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                   ) : "Sign In"}
//                 </button>
//               </form>

//               <p className="text-[10px] text-center text-slate-400 mt-6">
//                 Only authorized restaurant staff can access this panel
//               </p>
//             </motion.div>
//           )}

//           {/* ── Email Verification Screen ── */}
//           {step === "verify_email" && (
//             <motion.div
//               key="verify"
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//               className="bg-white rounded-2xl shadow-2xl p-8 text-center"
//             >
//               <div className="w-16 h-16 bg-amber-100 rounded-2xl mx-auto flex items-center justify-center mb-4">
//                 <Mail className="w-8 h-8 text-amber-600" />
//               </div>
//               <h2 className="text-lg font-bold text-slate-900 mb-2">Verify Your Email</h2>
//               <p className="text-sm text-slate-500 mb-2">
//                 A verification link was sent to:
//               </p>
//               <p className="text-sm font-bold text-slate-900 mb-4 bg-slate-50 px-3 py-2 rounded-xl">
//                 {email}
//               </p>
//               <p className="text-xs text-slate-400 mb-6">
//                 Please check your inbox and click the verification link.
//                 Then come back and click below.
//               </p>

//               {error && (
//                 <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl mb-4">
//                   <AlertCircle className="w-4 h-4 shrink-0" />
//                   <span>{error}</span>
//                 </div>
//               )}

//               {resent && (
//                 <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-100 px-3 py-2.5 rounded-xl mb-4">
//                   <CheckCircle className="w-4 h-4 shrink-0" />
//                   <span>Verification email sent!</span>
//                 </div>
//               )}

//               <div className="space-y-3">
//                 <button
//                   onClick={handleCheckVerification}
//                   disabled={loading}
//                   className="w-full h-11 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
//                 >
//                   {loading ? (
//                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                   ) : (
//                     <><CheckCircle className="w-4 h-4" /> I have verified my email</>
//                   )}
//                 </button>

//                 <button
//                   onClick={handleResendVerification}
//                   disabled={resending || resent}
//                   className="w-full h-10 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
//                 >
//                   {resending ? (
//                     <RefreshCw className="w-4 h-4 animate-spin" />
//                   ) : resent ? (
//                     "Email Sent ✓"
//                   ) : (
//                     "Resend Verification Email"
//                   )}
//                 </button>

//                 <button
//                   onClick={() => { setStep("login"); setError(""); setResent(false); }}
//                   className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
//                 >
//                   ← Back to Login
//                 </button>
//               </div>
//             </motion.div>
//           )}

//           {/* ── Success Screen ── */}
//           {step === "success" && (
//             <motion.div
//               key="success"
//               initial={{ opacity: 0, scale: 0.9 }}
//               animate={{ opacity: 1, scale: 1 }}
//               className="bg-white rounded-2xl shadow-2xl p-8 text-center"
//             >
//               <motion.div
//                 initial={{ scale: 0 }}
//                 animate={{ scale: 1 }}
//                 transition={{ type: "spring", delay: 0.1 }}
//                 className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4"
//               >
//                 <CheckCircle className="w-8 h-8 text-green-600" />
//               </motion.div>
//               <h2 className="text-lg font-bold text-slate-900">Welcome Back!</h2>
//               <p className="text-sm text-slate-500 mt-2">Redirecting to dashboard...</p>
//               <div className="mt-4 w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
//             </motion.div>
//           )}

//         </AnimatePresence>
//       </motion.div>
//     </div>
//   );
// }
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?redirect=/admin");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );
}