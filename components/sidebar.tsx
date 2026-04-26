"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  TrendingUp,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notification-bell"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  INSTRUCTOR: [
    { href: "/dashboard/instructor", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/instructor/courses", icon: BookOpen, label: "วิชาของฉัน" },
    { href: "/dashboard/instructor/reports", icon: BarChart3, label: "รายงาน" },
  ],
  STUDENT: [
    { href: "/dashboard/student", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/student/courses", icon: BookOpen, label: "วิชาที่เรียน" },
    { href: "/dashboard/student/progress", icon: TrendingUp, label: "ความก้าวหน้า" },
  ],
  ADMIN: [
    { href: "/dashboard/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/admin/users", icon: Users, label: "จัดการผู้ใช้" },
  ],
}

interface SidebarUser {
  name?: string | null
  email?: string | null
  role: string
}

interface SidebarProps {
  user: SidebarUser
  unreadCount: number
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard/instructor" &&
            item.href !== "/dashboard/student" &&
            item.href !== "/dashboard/admin" &&
            pathname.startsWith(item.href + "/"))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarContent({
  user,
  unreadCount,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const items = NAV_ITEMS[user.role] ?? NAV_ITEMS.ADMIN

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <GraduationCap className="h-6 w-6 shrink-0" />
        <span className="font-semibold text-sm leading-tight">ระบบจัดการคะแนน</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4 px-3">
        <NavLinks items={items} onNavigate={onNavigate} />
      </div>

      {/* Bottom: notifications + user */}
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <NotificationBell initialUnreadCount={unreadCount} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ user, unreadCount }: SidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r bg-background flex-col h-screen sticky top-0">
        <SidebarContent user={user} unreadCount={unreadCount} />
      </aside>

      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">เปิดเมนู</span>
      </Button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 bottom-0 w-72 z-50 bg-background border-r transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        <SidebarContent user={user} unreadCount={unreadCount} onNavigate={() => setOpen(false)} />
      </div>
    </>
  )
}
