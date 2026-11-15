import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getProfile } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import ProfileForm from "@/components/ProfileForm";

export const Route = createFileRoute("/_authed/profile")({
  head: () => ({ meta: [{ title: "SpeakUp — Профиль" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const fetchProfile = useServerFn(getProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("profile.heading")}</h1>
      </header>
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <ProfileForm data={data} />
      )}
    </div>
  );
}
