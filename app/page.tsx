import { Dashboard } from "@/app/dashboard";
import { BottomNav } from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Dashboard activePage="home" userEmail={user?.email ?? "私人家庭空間"} />
      <BottomNav />
    </>
  );
}
