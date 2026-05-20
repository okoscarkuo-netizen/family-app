import { Dashboard } from "@/app/dashboard";
import { BottomNav } from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Dashboard activePage="reminders" userEmail={user?.email ?? "私人家庭空間"} />
      <BottomNav />
    </>
  );
}
