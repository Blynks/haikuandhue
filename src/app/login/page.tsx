import { LoginPanel } from "@/components/LoginPanel";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <LoginPanel error={params.error === "1"} />;
}
