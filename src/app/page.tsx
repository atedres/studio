
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
import { Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { useToast } from "@/hooks/use-toast"

const Logo = () => (
  <svg width="200" height="50" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" style={{stopColor: '#F58220', stopOpacity: 1}} />
        <stop offset="100%" style={{stopColor: '#FFD200', stopOpacity: 1}} />
      </linearGradient>
    </defs>
    <path d="M42.33,26.12c-5.89-1.14-10.3-6.07-10.3-12.04c0-6.72,5.45-12.17,12.17-12.17c2.39,0,4.64,0.7,6.56,1.93c-2.43-1.63-5.38-2.63-8.56-2.63c-8.28,0-15,6.72-15,15c0,7.34,5.27,13.45,12.11,14.74L42.33,26.12z" fill="#E6E7E8"/>
    <path d="M40.48,48.07c-2.43,1.63-5.38,2.63-8.56,2.63c-8.28,0-15-6.72-15-15c0-1.92,0.37-3.76,1.05-5.46c2.2,0.7,4.55,1.09,7.02,1.09c8.53,0,15.7-5.59,17.65-13.11c1.2,1.86,1.93,4.05,1.93,6.43c0,6.72-5.45,12.17-12.17,12.17c-2.39,0-4.64-0.7-6.56-1.93L40.48,48.07z" fill="url(#grad1)"/>
    <text x="65" y="32" fontFamily="Arial, sans-serif" fontSize="24" fill="#808285">Soma</text>
    <text x="135" y="32" fontFamily="Arial, sans-serif" fontSize="24" fill="#F58220">Steel</text>
  </svg>
);


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
          <div className="mx-auto w-fit mb-4">
            <Logo />
          </div>
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
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
