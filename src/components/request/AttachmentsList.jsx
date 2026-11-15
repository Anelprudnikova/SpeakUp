import { useState } from "react";
import { Download, Loader2, Paperclip } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";

export default function AttachmentsList({ attachments }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState("");

  const open = async (attachment) => {
    setBusy(attachment.id);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: attachment.file_uri });
      window.open(signed_url, "_blank", "noopener");
    } finally {
      setBusy("");
    }
  };

  if (!attachments.length) return <p className="text-sm text-muted-foreground">{t("common.none")}</p>;

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <button
            type="button"
            onClick={() => open(attachment)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs font-medium text-navy transition hover:border-primary/40 hover:text-primary"
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
            {busy === attachment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
