import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  return <AuthForm mode="signup" invite={invite} />;
}
