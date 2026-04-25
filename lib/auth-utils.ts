import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { Role } from "@prisma/client"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireRole(role: Role | Role[]) {
  const user = await requireAuth()
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(user.role as Role)) redirect("/dashboard")
  return user
}

export function getDashboardUrl(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/dashboard/admin"
    case "INSTRUCTOR":
      return "/dashboard/instructor"
    case "STUDENT":
      return "/dashboard/student"
    default:
      return "/dashboard"
  }
}
