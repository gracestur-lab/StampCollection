import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "stamp_session";
export const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

const localUser = {
  id: "local-dev-user",
  email: "local@stamp-collection",
  name: "Local User"
};

export async function getSessionUser() {
  if (AUTH_DISABLED) {
    return localUser;
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true }
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  if (AUTH_DISABLED) {
    return localUser;
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
