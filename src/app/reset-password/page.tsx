import { ResetPasswordForm } from "@/components/AuthForms";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token ?? ""} />;
}

