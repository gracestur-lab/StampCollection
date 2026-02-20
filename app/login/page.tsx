import LoginForm from "@/components/LoginForm";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const authDisabled = process.env.AUTH_DISABLED === "true";
  if (authDisabled) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
      <LoginForm />
    </main>
  );
}
