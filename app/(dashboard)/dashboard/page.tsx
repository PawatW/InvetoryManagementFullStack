import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth-utils"
import { getDashboardUrl } from "@/lib/auth-utils"

export default async function DashboardRedirectPage() {
  const user = await requireAuth()
  redirect(getDashboardUrl(user.role))
}
