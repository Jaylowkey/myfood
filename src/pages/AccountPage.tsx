import { useEffect, useState } from "react";
import { Link } from "react-router";
import AppLogo from "../components/AppLogo";
import { type Profile, useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Order = {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
};

const statusLabels: Record<string, string> = {
  received: "Recebido",
  preparing: "Em preparação",
  delivery: "Em entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export default function AccountPage() {
  const { profile, refreshProfile, signOut, isAdmin } = useAuth();
  const [form, setForm] = useState<Profile | null>(profile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(profile);
    api<{ orders: Order[] }>("/orders").then((result) => setOrders(result.orders)).catch(() => {});
  }, [profile]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    await api("/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        marketingOptIn: form.marketingOptIn,
      }),
    });
    await refreshProfile();
    setMessage("Dados guardados com sucesso.");
  }

  return (
    <div className="min-h-screen bg-[#fffaf1] text-[#241712]">
      <header className="border-b border-[#eadfce] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <AppLogo />
          <div className="flex gap-3">
            {isAdmin && <Link className="rounded-full bg-[#241712] px-5 py-3 text-sm font-black text-white" to="/admin">Painel admin</Link>}
            <button className="rounded-full border border-[#e5d7c5] px-5 py-3 text-sm font-black" onClick={() => void signOut()}>Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-[0_12px_35px_rgba(75,44,30,.07)]">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#df2b24]">Minha conta</div>
          <h1 className="font-display mt-2 text-3xl font-black">Os seus dados</h1>
          {form && (
            <form className="mt-6 space-y-4" onSubmit={save}>
              <AccountField label="Nome" onChange={(name) => setForm({ ...form, name })} value={form.name} />
              <AccountField disabled label="E-mail" onChange={() => {}} value={form.email} />
              <AccountField label="Telefone" onChange={(phone) => setForm({ ...form, phone })} value={form.phone} />
              <label className="flex items-start gap-3 rounded-2xl bg-[#fffaf1] p-4 text-sm">
                <input checked={form.marketingOptIn} className="mt-1 size-4 accent-[#df2b24]" onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })} type="checkbox" />
                <span><strong className="block">Novidades e ofertas</strong><span className="text-[#796b60]">Quero receber promoções dentro da MyFood.</span></span>
              </label>
              {message && <div className="rounded-xl bg-[#edf8ed] p-3 text-sm font-bold text-[#286b2d]">{message}</div>}
              <button className="w-full rounded-full bg-[#df2b24] px-5 py-3.5 font-black text-white" type="submit">Guardar alterações</button>
            </form>
          )}
        </section>
        <section>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#df2b24]">Histórico</div>
              <h2 className="font-display mt-2 text-3xl font-black">Os seus pedidos</h2>
            </div>
            <Link className="text-sm font-black text-[#df2b24]" to="/">Fazer novo pedido</Link>
          </div>
          <div className="mt-6 space-y-4">
            {orders.length ? orders.map((order) => (
              <article className="rounded-2xl border border-[#eadfce] bg-white p-5" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#95877c]">#{order.id.slice(0, 8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString("pt-PT")}</div>
                    <div className="mt-2 font-black">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</div>
                  </div>
                  <span className="rounded-full bg-[#fff4cf] px-3 py-1.5 text-xs font-black">{statusLabels[order.status] || order.status}</span>
                </div>
                <div className="mt-4 border-t border-dashed border-[#eadfce] pt-4 font-display text-xl font-black text-[#df2b24]">{order.total} MT</div>
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-[#d5c6b4] bg-white/50 py-16 text-center text-[#796b60]">Ainda não fez nenhum pedido.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AccountField({ label, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-black">{label}</span><input {...props} className="w-full rounded-xl border border-[#e5d7c5] bg-white px-4 py-3 outline-none focus:border-[#df2b24] disabled:bg-[#f5efe7] disabled:text-[#95877c]" onChange={(event) => onChange(event.target.value)} /></label>;
}
