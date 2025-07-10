
"use client"

import Link from "next/link"
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
  { href: "/dashboard/form-builder", icon: Wrench, label: "Générateur IA / منشئ AI", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/templates", icon: Archive, label: "Modèles / النماذج", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/submissions", icon: Inbox, label: "Soumissions / التقديمات", roles: ['niveau3', 'niveau4', 'niveau5', 'admin'] },
  { href: "/dashboard/activity-log", icon: History, label: "Journal d'activité / سجل النشاط", roles: ['admin'] },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres / الإعدادات", roles: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'] },
]

const Logo = () => (
<svg width="200" height="50" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style={{stopColor:"#F58220",stopOpacity:1}} />
      <stop offset="100%" style={{stopColor:"#FFD200",stopOpacity:1}} />
    </linearGradient>
  </defs>
  <path d="M42.33,26.12c-5.89-1.14-10.3-6.07-10.3-12.04c0-6.72,5.45-12.17,12.17-12.17c2.39,0,4.64,0.7,6.56,1.93c-2.43-1.63-5.38-2.63-8.56-2.63c-8.28,0-15,6.72-15,15c0,7.34,5.27,13.45,12.11,14.74L42.33,26.12z" fill="#E6E7E8"/>
  <path d="M40.48,48.07c-2.43,1.63-5.38,2.63-8.56,2.63c-8.28,0-15-6.72-15-15c0-1.92,0.37-3.76,1.05-5.46c2.2,0.7,4.55,1.09,7.02,1.09c8.53,0,15.7-5.59,17.65-13.11c1.2,1.86,1.93,4.05,1.93,6.43c0,6.72-5.45,12.17-12.17,12.17c-2.39,0-4.64-0.7-6.56-1.93L40.48,48.07z" fill="url(#grad1)"/>
  <text x="65" y="32" fontFamily="Arial, sans-serif" fontSize="24" fill="#808285" className="dark:fill-gray-300">Soma</text>
  <text x="135" y="32" fontFamily="Arial, sans-serif" fontSize="24" fill="#F58220">Steel</text>
</svg>
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
