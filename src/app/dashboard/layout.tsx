"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Loader2,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react"
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect } from 'react'

import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { UserNav } from "@/components/user-nav"


const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/dashboard/audits", icon: ClipboardCheck, label: "Dialogue Sécurité / Audits" },
  { href: "/dashboard/anomalies", icon: AlertTriangle, label: "Chasse aux Anomalies" },
  { href: "/dashboard/reunions", icon: Users, label: "Réunions SST" },
  { href: "/dashboard/form-builder", icon: Wrench, label: "Générateur IA" },
  { href: "/dashboard/templates", icon: Archive, label: "Modèles de Formulaires" },
  { href: "/dashboard/submissions", icon: Inbox, label: "Soumissions" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres" },
]

function ProtectedDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  const NavContent = () => (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="bg-primary rounded-lg p-2">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-headline text-xl font-bold">SOMASTEEL</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  )

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="offcanvas">
          <NavContent />
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
            <SidebarTrigger />
            <div className="w-full flex-1">
              {/* Optional: Add breadcrumbs or page title here */}
            </div>
            <ThemeSwitcher />
            <LanguageSwitcher />
            <UserNav />
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
    </AuthProvider>
  )
}
