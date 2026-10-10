import { useEffect, useState } from "react";
import { Link } from "react-router";
import AppLogo from "../components/AppLogo";
import { type Profile, useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Order = {
  id: string;
  total: number;
  status: string;
  deliveryStage?: string | null;
  driverName?: string;
  createdAt: string;
  updatedAt?: string;
  items: Array<{ name: string; quantity: number }>;
};

const steps = [
  { key: "received", title: "Pedido recebido", detail: "Recebemos o seu pedido e estamos a preparar tudo." },
  { key: "preparing", title: "Em preparação", detail: "A cozinha está a preparar o seu pedido." },
  { key: "ready", title: "Pronto para recolha", detail: "O pedido está pronto para seguir." },
  { key: "delivery", title: "Saiu para entrega", detail: "O seu pedido está a caminho." },
  { key: "completed", title: "Entregue", detail: "Bom apetite! Obrigado por escolher a MyFood." },
];

const statusIndex: Record<string, number> = {
  received: 0, confirmed: 0, pending: 0, preparing: 1, ready: 2,
  driver_assigned: 2, accepted: 2, picked_up: 3, arriving: 3,
  delivery: 3, out_for_delivery: 3, delivered: 4, completed: 4,
};

export default function AccountPage() {
  const { profile, refreshProfile, signOut, isAdmin } = useAuth();
  const [form, setForm] = useState<Profile | null>(profile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  useEffect(() => {
    let alive = true;
    const loadOrders = async () => {
      try {
        const result = await api<{ orders: Order[] }>("/orders");
        if (alive) {
          setOrders(result.orders);
          setLastUpdated(new Date());
        }
      } catch {
        // Mantém os últimos dados apresentados se a rede falhar temporariamente.
      }
    };
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 10000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [profile?.id]);

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
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#df2b24]">Acompanhamento em directo</div>
              <h2 className="font-display mt-2 text-3xl font-black">Os seus pedidos</h2>
              <p className="mt-2 text-sm text-[#796b60]">O estado actualiza automaticamente a cada 10 segundos.</p>
            </div>
            {lastUpdated && <span className="shrink-0 text-xs text-[#95877c]">Actualizado {lastUpdated.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <div className="mt-6 space-y-5">
            {orders.length ? orders.map((order) => {
              const cancelled = order.status === "cancelled";
              const current = statusIndex[order.deliveryStage || ""] ?? statusIndex[order.status] ?? 0;
              const activeStep = steps[current];
              return (
                <article className="overflow-hidden rounded-[26px] border border-[#eadfce] bg-white shadow-[0_12px_35px_rgba(75,44,30,.06)]" key={order.id}>
                  <div className="bg-gradient-to-r from-[#241712] to-[#503126] p-5 text-white sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white/60">PEDIDO #{order.id.slice(0, 8).toUpperCase()}</div>
                        <h3 className="mt-2 text-xl font-black">{cancelled ? "Pedido cancelado" : activeStep.title}</h3>
                        <p className="mt-1 max-w-md text-sm text-white/75">{cancelled ? "Este pedido foi cancelado. Contacte-nos se precisar de ajuda." : activeStep.detail}</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Total</div>
                        <div className="text-xl font-black">{order.total.toLocaleString("pt-PT")} MT</div>
                      </div>
                    </div>
                    {!cancelled && order.status !== "completed" && order.status !== "delivered" && (
                      <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#f6bf26]">
                        <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f6bf26] opacity-75" /><span className="relative inline-flex size-2.5 rounded-full bg-[#f6bf26]" /></span>
                        A acompanhar o seu pedido
                      </div>
                    )}
                  </div>
                  <div className="p-5 sm:p-6">
                    {!cancelled ? (
                      <ol className="relative space-y-0">
                        {steps.map((step, index) => {
                          const done = index < current || order.status === "completed" || order.status === "delivered";
                          const active = index === current && !done;
                          return (
                            <li className="relative flex gap-4 pb-6 last:pb-0" key={step.key}>
                              {index < steps.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-8px)] w-0.5 ${index < current ? "bg-[#df2b24]" : "bg-[#eadfce]"}`} />}
                              <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-all duration-700 ${done ? "border-[#df2b24] bg-[#df2b24] text-white" : active ? "border-[#df2b24] bg-white text-[#df2b24] shadow-[0_0_0_6px_rgba(223,43,36,.10)] animate-pulse" : "border-[#e5d7c5] bg-white text-[#b7a797]"}`}>
                                {done ? "✓" : index + 1}
                              </span>
                              <div className="min-w-0 flex-1 pt-0.5">
                                <div className={`font-black ${done || active ? "text-[#241712]" : "text-[#b7a797]"}`}>{step.title}</div>
                                <p className={`mt-1 text-sm ${done || active ? "text-[#796b60]" : "text-[#b7a797]"}`}>{step.detail}</p>
                                {active && <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#fff0ee] px-3 py-1 text-xs font-black text-[#df2b24]"><span className="size-1.5 animate-pulse rounded-full bg-[#df2b24]" />Estado actual</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <div className="rounded-2xl bg-[#fff0ee] p-4 font-bold text-[#b6201a]">Não é necessário fazer mais nada. Se o cancelamento parecer incorrecto, contacte o restaurante.</div>
                    )}
                    {order.driverName && <div className="mb-4 rounded-2xl bg-[#fffaf1] p-4 text-sm"><span className="text-[#796b60]">Entregador atribuído: </span><strong>{order.driverName}</strong></div>}
                    <div className="border-t border-dashed border-[#eadfce] pt-4">
                      <div className="text-xs font-black uppercase tracking-wider text-[#95877c]">Resumo do pedido</div>
                      <div className="mt-3 space-y-2">{order.items.map((item, index) => <div className="flex justify-between gap-3 text-sm" key={index}><span>{item.quantity}× {item.name}</span></div>)}</div>
                      <div className="mt-4 text-xs text-[#95877c]">Criado em {new Date(order.createdAt).toLocaleString("pt-PT")}</div>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-[#d5c6b4] bg-white/50 py-16 text-center text-[#796b60]"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#fff0ee] text-2xl">🍔</div><div className="mt-4 font-black">Ainda não fez nenhum pedido</div><p className="mt-1 text-sm">Quando fizer um pedido, poderá acompanhar aqui cada etapa.</p><Link className="mt-5 inline-flex rounded-full bg-[#df2b24] px-5 py-3 font-black text-white" to="/">Explorar menu</Link></div>
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
