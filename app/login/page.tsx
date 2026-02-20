import LoginForm from "@/components/LoginForm";
import { redirect } from "next/navigation";
import { AUTH_DISABLED } from "@/lib/session";

export default function LoginPage() {
  if (AUTH_DISABLED) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
      <LoginForm />
    </main>
  );
}
