
'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // The onAuthStateChanged listener will handle the redirect
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "L'adresse e-mail ou le mot de passe est incorrect.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid-slate-50 [mask-image:linear-gradient(to_bottom,white_10%,transparent_90%)] dark:bg-grid-slate-900"></div>
      <Card className="w-full max-w-md z-10 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-headline text-3xl">SOMASTEEL</CardTitle>
          <CardDescription className="font-headline">
            HSE Digital Platform / منصة HSE الرقمية
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / البريد الإلكتروني</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe / كلمة المرور</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter / تسجيل الدخول
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Possibilité de SSO via Microsoft.
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
