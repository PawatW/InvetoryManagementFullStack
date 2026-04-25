import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const unreadCount = await db.notification.count({
    where: { userId: session.user.id, read: false },
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto bg-muted/30 lg:pt-0 pt-14">
        {children}
      </main>
    </div>
  )
}
