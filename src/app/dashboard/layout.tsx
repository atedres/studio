
"use client"

import Link from "next/link"
import Image from "next/image"
import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect } from 'react'

import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { LanguageSwitcher } from "@/components/language-switcher"
import { NotificationBell } from "@/components/notification-bell"
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
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord / لوحة التحكم", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/audits", icon: ClipboardCheck, label: "Dialogue Sécurité / حوار السلامة", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/anomalies", icon: AlertTriangle, label: "Chasse aux Anomalies / اصطياد الحالات الشاذة", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/actions", icon: ListChecks, label: "Plan d'Action / خطة العمل", roles: ['niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/reunions", icon: Users, label: "Réunions SST / اجتماعات SST", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/submissions", icon: Inbox, label: "Soumissions / التقديمات", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/form-builder", icon: Wrench, label: "Générateur IA / منشئ AI", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/templates", icon: Archive, label: "Modèles / النماذج", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/activity-log", icon: History, label: "Journal d'activité / سجل النشاط", roles: ['admin'] },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres / الإعدادات", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
]

const Logo = () => (
  <div className="w-36">
    <Image
      src="/logo.png"
      width={200}
      height={50}
      alt="Somasteel Logo"
      className="h-auto w-full"
    />
  </div>
);


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
  
  const visibleNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const NavContent = () => (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {visibleNavItems.map((item) => (
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
            <NotificationBell />
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
