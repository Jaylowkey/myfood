import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function UserMenu() {
  const { profile, session, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!session) return;
    api<{ notifications: Notification[] }>("/notifications")
      .then((result) => setNotifications(result.notifications))
      .catch(() => {});
  }, [session]);

  if (!session) {
    return (
      <Link className="hidden items-center gap-2 text-sm font-bold md:flex" to="/login">
        <span className="grid size-10 place-items-center rounded-full bg-[#f2e9db]">
          <UserIcon />
        </span>
        Entrar
      </Link>
    );
  }

  const unread = notifications.filter((item) => !item.read).length;

  async function markRead(notification: Notification) {
    if (notification.read) return;
    await api(`/notifications/${notification.id}/read`, { method: "POST" });
    setNotifications((current) =>
      current.map((item) => item.id === notification.id ? { ...item, read: true } : item),
    );
  }

  return (
    <div className="relative hidden items-center gap-2 md:flex">
      <button
        aria-label="Abrir notificações"
        className="relative grid size-10 place-items-center rounded-full bg-[#f2e9db]"
        onClick={() => setOpen(!open)}
      >
        <BellIcon />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#df2b24] text-[10px] font-black text-white">{unread}</span>}
      </button>
      <Link className="max-w-28 truncate text-sm font-black" to={isAdmin ? "/admin" : "/conta"}>{profile?.name || "Minha conta"}</Link>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#eadfce] px-4 py-3">
            <strong>Notificações</strong>
            <Link className="text-xs font-black text-[#df2b24]" onClick={() => setOpen(false)} to="/conta">Ver conta</Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? notifications.slice(0, 8).map((notification) => (
              <button
                className={`block w-full border-b border-[#f0e8dc] p-4 text-left last:border-0 ${notification.read ? "bg-white" : "bg-[#fffaf1]"}`}
                key={notification.id}
                onClick={() => void markRead(notification)}
              >
                <span className="block text-sm font-black">{notification.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[#796b60]">{notification.message}</span>
              </button>
            )) : <div className="p-8 text-center text-sm text-[#796b60]">Sem notificações por enquanto.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>;
}

function UserIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}
