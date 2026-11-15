import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications } from "@/lib/speakup-fns";
import { getClientNotifications } from "@/lib/client-fns";

// The round violet counter that sits left of the notifications item in the sidebar.
export default function NavUnreadBadge({ client = false }) {
  const fetchInternal = useServerFn(getNotifications);
  const fetchClient = useServerFn(getClientNotifications);
  const { data } = useQuery({
    queryKey: client ? ["client-notifications"] : ["notifications"],
    queryFn: () => (client ? fetchClient() : fetchInternal()),
    staleTime: 15000,
    refetchInterval: 60000,
    retry: false,
  });
  const unread = data?.unread || 0;

  return (
    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center">
      {unread > 0 ? (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7957E8] px-1 text-[10px] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </span>
  );
}
