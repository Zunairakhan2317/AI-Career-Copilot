"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Mail, Lock, Eye } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-tertiary/20 via-background to-secondary/20">
      
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-tertiary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-sm border-white/60 bg-card/80 backdrop-blur-xl shadow-2xl rounded-3xl p-2 z-10">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-tertiary/15 flex items-center justify-center border border-tertiary/30 text-xl">
            👋
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Let&apos;s get you ready for your next big move.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="email" 
              placeholder="Student email address" 
              className="h-11 bg-muted/70 border-none rounded-xl text-sm pl-10 pr-4 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tertiary"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="password" 
              placeholder="Password" 
              className="h-11 bg-muted/70 border-none rounded-xl text-sm pl-10 pr-10 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tertiary"
            />
            <button 
              type="button" 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>

          <Button className="w-full h-11 bg-tertiary hover:opacity-90 text-tertiary-foreground font-medium rounded-xl shadow-md shadow-tertiary/25 flex items-center justify-center gap-2">
            <span>Sign in to Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="flex items-center justify-between text-[11px] font-medium px-1 text-muted-foreground">
            <Link href="#" className="hover:text-tertiary transition-colors">
              Forgot password?
            </Link>
            <Link href="/signup" className="hover:text-tertiary transition-colors">
              Create account
            </Link>
          </div>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="bg-card px-2">Or continue with</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-11 bg-muted/50 border-none rounded-xl text-xs font-medium text-foreground hover:bg-muted"
          >
            University ID
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold z-10">
        SYSTEM V2.4.1 // SECURE
      </div>
    </div>
  );
}