import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import AppLogo from "../components/AppLogo";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Tab = "available" | "active" | "completed";
type Stage = "accepted" | "picked_up" | "arriving" | "delivered" | null;
type DeliveryOrder = {
  id: string; customerName: string; customerPhone?: string; address: string; notes?: string;
  total: number; delivery: number; status: string; deliveryStage: Stage; driverName?: string;
  createdAt: string; assignmentStatus?: string; assignmentExpiresAt?: string | null; etaMinutes?: number | null; etaDueAt?: string | null; preparationStartedAt?: string | null; preparationMinutes?: number; referenceRequest?: string; items: Array<{ id?: string | number; name: string; quantity: number; price?: number }>;
};
const labels: Record<Tab, string> = { available: "Disponíveis", active: "Em curso", completed: "Concluídas" };
const stageInfo: Record<string, { label: string; action: string; next: string }> = {
  accepted: { label: "Aceite · recolher", action: "Confirmar recolha", next: "picked_up" },
  picked_up: { label: "A caminho", action: "Estou a chegar", next: "arriving" },
  arriving: { label: "Próximo do cliente", action: "Confirmar entrega", next: "delivered" },
};

export default function DriverPage() {
  const { profile, isAdmin, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<DeliveryOrder[]>([]);
  const [assigned, setAssigned] = useState<DeliveryOrder[]>([]);
  const [completed, setCompleted] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [etaValues, setEtaValues] = useState<Record<string, string>>({});
  const [referenceValues, setReferenceValues] = useState<Record<string, string>>({});
  const [reasonValues, setReasonValues] = useState<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await api<{ available: DeliveryOrder[]; assigned: DeliveryOrder[]; completed: DeliveryOrder[] }>("/driver/orders");
      setAvailable(result.available || []); setAssigned(result.assigned || []); setCompleted(result.completed || []); setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as entregas.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 10000);
    const clockTimer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { window.clearInterval(timer); window.clearInterval(clockTimer); };
  }, [load]);

  const orders = useMemo(() => tab === "available" ? available : tab === "active" ? assigned : completed, [tab, available, assigned, completed]);
  const fees = completed.reduce((sum, order) => sum + Number(order.delivery || 0), 0);

  async function claim(id: string) {
    setWorkingId(id); setError("");
    try { await api(`/driver/orders/${id}/claim`, { method: "POST" }); await load(true); setTab("active"); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar a aceitação."); }
    finally { setWorkingId(""); }
  }
  async function decide(id: string, decision: "accept" | "reject" | "reference") {
    setWorkingId(id); setError("");
    try { await api(`/driver/orders/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, reason: reasonValues[id] || "", reference: referenceValues[id] || "" }) }); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível registar a decisão."); }
    finally { setWorkingId(""); }
  }
  async function saveEta(id: string) {
    setWorkingId(id); setError("");
    try { await api(`/driver/orders/${id}/eta`, { method: "PUT", body: JSON.stringify({ minutes: Number(etaValues[id] || 30) }) }); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível guardar a estimativa."); }
    finally { setWorkingId(""); }
  }
  async function advance(id: string, stage: string) {
    setWorkingId(id); setError("");
    try { await api(`/driver/orders/${id}/stage`, { method: "PUT", body: JSON.stringify({ stage }) }); await load(true); if (stage === "delivered") setTab("completed"); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a entrega."); }
    finally { setWorkingId(""); }
  }

  return <div className="min-h-screen bg-[#f6f2eb] text-[#241712]">
    <header className="sticky top-0 z-30 border-b border-[#eadfce] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <AppLogo />
        <div className="flex items-center gap-2">
          {isAdmin && <Link className="rounded-full bg-[#241712] px-4 py-2.5 text-xs font-black text-white" to="/admin">Administração</Link>}
          <button className="rounded-full border border-[#e5d7c5] px-4 py-2.5 text-xs font-black" onClick={() => void load()}>Atualizar</button>
          <button className="rounded-full border border-[#e5d7c5] px-4 py-2.5 text-xs font-black" onClick={() => void signOut()}>Sair</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <section className="overflow-hidden rounded-[28px] bg-[#241712] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><div className="text-xs font-black uppercase tracking-[0.18em] text-[#f6bf26]">MyFood Driver</div><h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">Olá, {profile?.name?.split(" ")[0] || "Entregador"}</h1><p className="mt-2 text-sm text-white/60">As entregas actualizam-se automaticamente a cada 15 segundos.</p></div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{([[available.length,"Disponíveis"],[assigned.length,"Em curso"],[completed.length,"Entregues"]] as [number,string][]).map(([value,label]) => <div className="min-w-24 rounded-2xl bg-white/10 p-3" key={label}><div className="text-2xl font-black">{value}</div><div className="text-xs text-white/60">{label}</div></div>)}</div>
        </div>
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[#e3d8ca] bg-white p-5"><div className="text-xs font-black uppercase tracking-wider text-[#95877c]">Taxas das entregas concluídas</div><div className="font-display mt-2 text-2xl font-black text-[#df2b24]">{fees.toLocaleString("pt-PT")} MT</div></div><div className="rounded-2xl border border-[#e3d8ca] bg-white p-5"><div className="text-xs font-black uppercase tracking-wider text-[#95877c]">Conta</div><div className="mt-2 font-black">{isAdmin ? "Administrador" : "Entregador"}</div></div></section>
      <nav className="no-scrollbar mt-7 flex gap-2 overflow-x-auto">{(Object.keys(labels) as Tab[]).map(key => <button key={key} onClick={() => setTab(key)} className={`shrink-0 rounded-full px-5 py-3 text-sm font-black ${tab === key ? "bg-[#df2b24] text-white" : "border border-[#e3d8ca] bg-white"}`}>{labels[key]} <span className="ml-1 opacity-75">{key === "available" ? available.length : key === "active" ? assigned.length : completed.length}</span></button>)}</nav>
      {error && <div className="mt-5 rounded-2xl bg-[#fff0ee] p-4 text-sm font-bold text-[#b6201a]">{error}</div>}
      {loading ? <div className="grid min-h-60 place-items-center"><div className="size-10 animate-spin rounded-full border-4 border-[#eadfce] border-t-[#df2b24]" /></div> : orders.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{orders.map(order => {
        const stage = order.deliveryStage ? stageInfo[order.deliveryStage] : null;
        return <article key={order.id} className="overflow-hidden rounded-[24px] border border-[#e3d8ca] bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-[#eee5da] p-5"><div><div className="text-xs font-bold uppercase tracking-wider text-[#95877c]">Pedido #{order.id.slice(0,8).toUpperCase()}</div><h2 className="mt-1 text-lg font-black">{order.customerName}</h2></div><span className="rounded-full bg-[#fff4cf] px-3 py-1.5 text-xs font-black">{tab === "completed" ? "Entregue" : stage?.label || "Pronto para recolha"}</span></div>
          <div className="p-5">
            <div className="text-xs font-bold text-[#95877c]">Endereço de entrega</div><div className="mt-1 font-bold">{order.address || "Endereço não indicado"}</div>
            {order.customerPhone && <div className="mt-3 text-sm"><span className="text-[#95877c]">Contacto: </span><a className="font-bold text-[#df2b24]" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></div>}
            <div className="mt-4 rounded-2xl bg-[#fffaf1] p-4"><div className="text-xs font-black uppercase tracking-wider text-[#95877c]">Itens</div><div className="mt-2 text-sm font-bold">{(order.items || []).map(item => `${item.quantity}× ${item.name}`).join(" · ")}</div>{order.notes && <p className="mt-3 border-t border-dashed border-[#dfd2c1] pt-3 text-xs text-[#796b60]">Observações: {order.notes}</p>}</div>
            <div className="mt-4 flex items-center justify-between"><div><div className="text-xs text-[#95877c]">Total do pedido</div><div className="font-display text-xl font-black">{Number(order.total || 0).toLocaleString("pt-PT")} MT</div></div><div className="text-right"><div className="text-xs text-[#95877c]">Taxa de entrega</div><div className="font-black text-[#df2b24]">{Number(order.delivery || 0)} MT</div></div></div>
            {tab === "available" && <button disabled={workingId === order.id} onClick={() => void claim(order.id)} className="mt-5 w-full rounded-full bg-[#df2b24] px-5 py-4 text-sm font-black text-white disabled:opacity-60">{workingId === order.id ? "A solicitar..." : "Receber atribuição · 5 min"}</button>}
            {tab === "active" && order.assignmentStatus === "pending" && <div className="mt-5 space-y-3 rounded-2xl border border-[#f2d78c] bg-[#fff8df] p-4">
              <div className="flex items-center justify-between gap-3"><span className="font-black">Decida sobre esta entrega</span><span className="rounded-full bg-[#241712] px-3 py-1.5 font-mono text-sm font-black text-white">{Math.floor(Math.max(0, Date.parse(order.assignmentExpiresAt || "") - clock) / 60000).toString().padStart(2,"0")}:{Math.floor(Math.max(0, Date.parse(order.assignmentExpiresAt || "") - clock) / 1000 % 60).toString().padStart(2,"0")}</span></div>
              <p className="text-xs text-[#796b60]">O prazo é validado pelo servidor. Se expirar, a entrega volta a ficar disponível.</p>
              <button disabled={workingId === order.id || !order.assignmentExpiresAt || Date.parse(order.assignmentExpiresAt) <= clock} onClick={() => void decide(order.id,"accept")} className="w-full rounded-full bg-[#df2b24] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">Aceitar entrega</button>
              <div className="grid gap-2 sm:grid-cols-2"><input value={reasonValues[order.id] || ""} onChange={e => setReasonValues(v => ({...v,[order.id]:e.target.value}))} placeholder="Motivo da rejeição (opcional)" className="min-w-0 rounded-xl border border-[#e3d8ca] bg-white px-3 py-3 text-sm"/><button disabled={workingId === order.id} onClick={() => void decide(order.id,"reject")} className="rounded-xl border border-[#e3d8ca] bg-white px-3 py-3 text-sm font-black">Rejeitar</button></div>
              <input value={referenceValues[order.id] || ""} onChange={e => setReferenceValues(v => ({...v,[order.id]:e.target.value}))} placeholder="Ponto de referência que precisa" className="w-full rounded-xl border border-[#e3d8ca] bg-white px-3 py-3 text-sm"/>
              <button disabled={workingId === order.id} onClick={() => void decide(order.id,"reference")} className="w-full rounded-xl border border-[#e3d8ca] bg-white px-4 py-3 text-sm font-black">Pedir referência ao cliente</button>
            </div>}
            {tab === "active" && order.assignmentStatus === "accepted" && !order.etaMinutes && <div className="mt-5 space-y-3 rounded-2xl bg-[#fffaf1] p-4">
              <label className="block text-sm font-black">Estimativa até ao cliente</label>
              <select value={etaValues[order.id] || "30"} onChange={e => setEtaValues(v => ({...v,[order.id]:e.target.value}))} className="w-full rounded-xl border border-[#e3d8ca] bg-white px-4 py-3"><option value="15">15 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select>
              <button disabled={workingId === order.id} onClick={() => void saveEta(order.id)} className="w-full rounded-full bg-[#df2b24] px-4 py-3.5 text-sm font-black text-white">Guardar estimativa</button>
            </div>}
            {tab === "active" && order.etaMinutes && <div className="mt-4 rounded-2xl bg-[#edf8ed] p-4 text-sm"><strong>ETA enviado ao cliente: {order.etaMinutes} minutos</strong>{order.etaDueAt && <p className="mt-1 text-xs text-[#286b2d]">Prazo previsto: {new Date(order.etaDueAt).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}</p>}</div>}
            {tab === "active" && stage && order.assignmentStatus !== "pending" && <button disabled={workingId === order.id || (order.assignmentStatus === "accepted" && !order.etaMinutes)} onClick={() => void advance(order.id, stage.next)} className="mt-5 w-full rounded-full bg-[#241712] px-5 py-4 text-sm font-black text-white disabled:opacity-60">{workingId === order.id ? "A actualizar..." : stage.action}</button>}
          </div>
        </article>;
      })}</div> : <div className="mt-5 rounded-[24px] border border-dashed border-[#d5c6b4] bg-white/60 px-5 py-20 text-center"><div className="font-black">Nenhuma entrega nesta lista</div><p className="mt-1 text-sm text-[#796b60]">{tab === "available" ? "Os pedidos aparecerão aqui quando estiverem prontos para recolha." : "As suas entregas aparecerão aqui."}</p></div>}
    </main>
  </div>;
}
