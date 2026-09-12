"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { pageVariants, containerVariants, cardVariants, tapScale } from "@/lib/motion";

export default function LoginPage() {
  const router = useRouter();
  const { user, isHydrated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, bounce to dashboard
  useEffect(() => {
    if (isHydrated && user) {
      router.replace("/dashboard");
    }
  }, [user, isHydrated, router]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await authApi.login({ email, password });
      login(data.access_token, {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-tertiary/20 via-background to-secondary/20">
      <motion.div
        aria-hidden
        className="absolute -top-32 -left-32 w-96 h-96 bg-tertiary/20 rounded-full blur-3xl pointer-events-none animate-gradient-shift"
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none animate-gradient-shift"
      />

      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm z-10"
      >
        <Card className="w-full border-white/60 bg-card/80 backdrop-blur-xl shadow-2xl rounded-3xl p-2">
          <CardHeader className="text-center space-y-2 pb-2">
            <motion.div
              initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mx-auto h-12 w-12 rounded-2xl bg-tertiary/15 flex items-center justify-center border border-tertiary/30 text-xl"
            >
              👋
            </motion.div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Let&apos;s get you ready for your next big move.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive text-center bg-destructive/10 border border-destructive/20 rounded-lg p-3"
                >
                  {error}
                </motion.div>
              )}

              <motion.div variants={cardVariants} className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Student email address"
                  className="h-11 bg-muted/70 border-none rounded-xl text-sm pl-10 pr-4 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tertiary"
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </motion.div>

              <motion.div variants={cardVariants} className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-11 bg-muted/70 border-none rounded-xl text-sm pl-10 pr-10 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tertiary"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
                <motion.button
                  whileTap={tapScale}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </motion.button>
              </motion.div>

              <motion.div variants={cardVariants}>
                <Button
                  type="submit"
                  className="w-full h-11 bg-tertiary hover:opacity-90 text-tertiary-foreground font-medium rounded-xl shadow-md shadow-tertiary/25 flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in…" : <>Sign in to Workspace <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </motion.div>
            </motion.form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="flex items-center justify-between text-[11px] font-medium px-1 text-muted-foreground"
            >
              <Link href="#" className="hover:text-tertiary transition-colors">
                Forgot password?
              </Link>
              <Link href="/signup" className="hover:text-tertiary transition-colors">
                Create account
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="relative my-3"
            >
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="bg-card px-2">Or continue with</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.3 }}
            >
              <Button
                variant="outline"
                className="w-full h-11 bg-muted/50 border-none rounded-xl text-xs font-medium text-foreground hover:bg-muted"
                disabled={isLoading}
              >
                University ID
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold z-10"
      >
        SYSTEM V2.4.1 // SECURE
      </motion.div>
    </div>
  );
}