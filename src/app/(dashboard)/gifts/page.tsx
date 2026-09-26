import { getSession } from "@/lib/auth";
import { giftsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { GiftsManager } from "./GiftsManager";

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const session = await getSession();
  const gifts   = await giftsApi.list().catch(() => []);

  return (
    <>
      <Header
        title="الهدايا المتحركة (Animated Gifts)"
        subtitle="إدارة ومعاينة كتالوج الهدايا المتحركة، تكوينات الأنيميشن، والأسعار"
        adminName={session?.name || ""}
      />

      <div className="p-8">
        <GiftsManager initialGifts={gifts} />
      </div>
    </>
  );
}
