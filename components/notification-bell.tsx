"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { th } from "date-fns/locale"
import { Bell, CheckCheck, BookOpen, Star, Megaphone, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

interface NotificationBellProps {
  initialUnreadCount: number
}

function typeIcon(type: string) {
  switch (type) {
    case "GRADE_RELEASED":
      return <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
    case "ASSIGNMENT_CREATED":
      return <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" />
    case "ANNOUNCEMENT":
      return <Megaphone className="h-3.5 w-3.5 text-purple-500 shrink-0" />
    default:
      return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  }
}

export function NotificationBell({ initialUnreadCount }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (loaded) return
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
      setLoaded(true)
    } catch {
      // silently fail
    }
  }, [loaded])

  const markAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silently fail
    }
  }

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [n.id] }),
        })
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // silently fail
      }
    }
    if (n.link) router.push(n.link)
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">การแจ้งเตือน</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">การแจ้งเตือน</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground gap-1"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 cursor-pointer focus:bg-accent",
                  !n.read && "bg-primary/5"
                )}
                onClick={() => handleNotificationClick(n)}
              >
                <span className="mt-0.5">{typeIcon(n.type)}</span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className={cn("text-xs leading-snug", !n.read && "font-semibold")}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: th })}
                  </p>
                </div>
                {!n.read && (
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Footer */}
        <div className="p-1">
          <DropdownMenuItem asChild className="justify-center text-xs text-muted-foreground cursor-pointer">
            <button
              className="w-full text-center py-1"
              onClick={() => router.push("/dashboard/notifications")}
            >
              ดูทั้งหมด
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
