import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import AppLogo from "../components/AppLogo";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Tab = "overview" | "orders" | "deliveries" | "products" | "marketing" | "users";
type Metrics = { orders: number; customers: number; campaigns: number; revenue: number; pending: number };
type Order = { id: string; userId?: string; customerName: string; customerEmail: string; customerPhone?: string; address?: string; delivery?: number; total: number; status: string; driverId?: string; driverName?: string; createdAt: string };
type User = { id: string; name: string; email: string; role: string; marketingOptIn: boolean };
type Campaign = { id: string; title: string; message: string; status: string; audience: string; createdAt: string };
type Product = { id: string; name: string; description: string; category: string; imageUrl: string; price: number; active: boolean; createdAt: string };

const tabs: Array<[Tab, string]> = [
  ["overview", "Visão geral"],
  ["orders", "Pedidos"],
  ["deliveries", "Entregas"],
  ["products", "Produtos"],
  ["marketing", "Marketing"],
  ["users", "Utilizadores"],
];

const statusLabels: Record<string, string> = {
  received: "Recebido",
  preparing: "Em preparação",
  ready: "Pronto para recolha",
  delivery: "Em entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export default function AdminPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deliveryBusy, setDeliveryBusy] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", category: "Geral", imageUrl: "", price: "" });
  const [productBusy, setProductBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState({ title: "", message: "", audience: "marketing" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, orderData, userData, campaignData, productData] = await Promise.all([
        api<{ metrics: Metrics; recentOrders: Order[] }>("/admin/dashboard"),
        api<{ orders: Order[] }>("/admin/orders"),
        api<{ users: User[] }>("/admin/users"),
        api<{ campaigns: Campaign[] }>("/admin/campaigns"),
        api<{ products: Product[] }>("/admin/products"),
      ]);
      setMetrics(dashboard.metrics);
      setOrders(orderData.orders);
      setUsers(userData.users);
      setCampaigns(campaignData.campaigns);
      setProducts(productData.products);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateOrder(id: string, status: string) {
    await api(`/admin/orders/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  }

  function resetProductForm() { setEditingProduct(null); setProductForm({ name: "", description: "", category: "Geral", imageUrl: "", price: "" }); }

  async function saveProduct() {
    setError("");
    if (!productForm.name.trim() || !productForm.price || Number(productForm.price) <= 0) { setError("Preencha o nome e um preço válido para o produto."); return; }
    setProductBusy(true);
    try {
      const payload = { ...productForm, price: Number(productForm.price), active: true };
      const result = await api<{ product: Product }>(editingProduct ? `/admin/products/${editingProduct}` : "/admin/products", { method: editingProduct ? "PUT" : "POST", body: JSON.stringify(payload) });
      setProducts((current) => editingProduct ? current.map((item) => item.id === editingProduct ? result.product : item) : [result.product, ...current]);
      resetProductForm();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível guardar o produto."); }
    finally { setProductBusy(false); }
  }

  async function toggleProduct(product: Product) {
    try {
      const result = await api<{ product: Product }>(`/admin/products/${product.id}`, { method: "PUT", body: JSON.stringify({ ...product, active: !product.active }) });
      setProducts((current) => current.map((item) => item.id === product.id ? result.product : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o produto."); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Eliminar o produto “${product.name}”?`)) return;
    try { await api(`/admin/products/${product.id}`, { method: "DELETE" }); setProducts((current) => current.filter((item) => item.id !== product.id)); if (editingProduct === product.id) resetProductForm(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível eliminar o produto."); }
  }

  async function createCampaign(sendNow: boolean) {
    setError("");
    try {
      await api("/admin/campaigns", {
        method: "POST",
        body: JSON.stringify({ ...campaign, sendNow }),
      });
      setCampaign({ title: "", message: "", audience: "marketing" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível guardar a campanha.");
    }
  }

  async function assignDriver(orderId: string, driverId: string) {
    setError("");
    setDeliveryBusy(orderId);
    try {
      const result = await api<{ order: Order }>(`/admin/orders/${orderId}/driver`, { method: "PUT", body: JSON.stringify({ driverId }) });
      setOrders((current) => current.map((order) => order.id === orderId ? result.order : order));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atribuir o entregador.");
    } finally {
      setDeliveryBusy("");
    }
  }

  async function updateRole(id: string, role: string) {
    try {
      await api(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
      setUsers((current) => current.map((user) => user.id === id ? { ...user, role } : user));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a função.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f3ec] text-[#241712] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-[#3a2b25] bg-[#241712] p-5 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <AppLogo footer />
        <div className="mt-8 hidden lg:block">
          <div className="text-xs font-bold uppercase tracking-wider text-white/40">Administração</div>
          <nav className="mt-3 space-y-1">
            {tabs.map(([value, label]) => (
              <button className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab === value ? "bg-[#df2b24] text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`} key={value} onClick={() => setTab(value)}>{label}</button>
            ))}
          </nav>
        </div>
        <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block">
          <div className="truncate text-sm font-bold">{profile?.name}</div>
          <div className="mt-1 truncate text-xs text-white/45">{profile?.email}</div>
          <div className="mt-4 flex gap-4 text-xs font-bold"><Link className="text-[#f6bf26]" to="/">Ver loja</Link><button className="text-white/55" onClick={() => void signOut()}>Sair</button></div>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#df2b24]">MyFood Control</div>
            <h1 className="font-display mt-1 text-3xl font-black tracking-[-0.03em] sm:text-4xl">{tabs.find(([value]) => value === tab)?.[1]}</h1>
          </div>
          <button className="rounded-full border border-[#dcd0c1] bg-white px-5 py-3 text-sm font-black" onClick={() => void load()}>Atualizar dados</button>
        </div>

        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto lg:hidden">
          {tabs.map(([value, label]) => <button className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === value ? "bg-[#241712] text-white" : "bg-white"}`} key={value} onClick={() => setTab(value)}>{label}</button>)}
        </div>

        {error && <div className="mt-6 rounded-2xl bg-[#fff0ee] p-4 text-sm font-bold text-[#b6201a]">{error}</div>}
        {loading ? <div className="grid min-h-80 place-items-center"><div className="size-10 animate-spin rounded-full border-4 border-[#eadfce] border-t-[#df2b24]" /></div> : (
          <>
            {tab === "overview" && metrics && (
              <div className="mt-8">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Metric label="Faturação" value={`${metrics.revenue.toLocaleString("pt-PT")} MT`} featured />
                  <Metric label="Pedidos" value={String(metrics.orders)} />
                  <Metric label="Em curso" value={String(metrics.pending)} />
                  <Metric label="Clientes" value={String(metrics.customers)} />
                  <Metric label="Campanhas" value={String(metrics.campaigns)} />
                </div>
                <section className="mt-8 rounded-[24px] border border-[#e2d8cb] bg-white p-6">
                  <div className="flex items-center justify-between"><h2 className="font-display text-xl font-black">Pedidos recentes</h2><button className="text-sm font-black text-[#df2b24]" onClick={() => setTab("orders")}>Ver todos</button></div>
                  <OrderTable onUpdate={updateOrder} orders={orders.slice(0, 6)} />
                </section>
              </div>
            )}
            {tab === "orders" && <section className="mt-8 rounded-[24px] border border-[#e2d8cb] bg-white p-6"><OrderTable onUpdate={updateOrder} orders={orders} /></section>}
            {tab === "deliveries" && (
              <section className="mt-8 rounded-[24px] border border-[#e2d8cb] bg-white p-6">
                <h2 className="font-display text-xl font-black">Gestão de entregas</h2>
                <p className="mt-1 text-sm text-[#796b60]">Atribua pedidos a entregadores registados e acompanhe o estado da entrega.</p>
                <div className="mt-5 space-y-3">
                  {orders.filter((order) => !["completed", "cancelled"].includes(order.status)).map((order) => (
                    <article key={order.id} className="rounded-2xl border border-[#eadfce] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-black">Pedido #{order.id.slice(0, 8).toUpperCase()} · {order.customerName || "Cliente"}</div>
                          <div className="mt-1 text-sm text-[#796b60]">{order.address || "Sem endereço registado"} · {order.total} MT</div>
                          <div className="mt-1 text-xs font-bold text-[#df2b24]">Estado: {statusLabels[order.status] || order.status} · Entregador: {order.driverName || "Por atribuir"}</div>
                        </div>
                        <select disabled={deliveryBusy === order.id} className="min-w-48 rounded-xl border border-[#e5d7c5] bg-white px-3 py-2 text-sm font-bold" value={order.driverId || ""} onChange={(event) => { if (event.target.value) void assignDriver(order.id, event.target.value); }}>
                          <option value="">Atribuir entregador…</option>
                          {users.filter((user) => user.role === "driver").map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.email}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                  {!orders.some((order) => !["completed", "cancelled"].includes(order.status)) && <div className="py-12 text-center text-[#796b60]">Não existem entregas pendentes.</div>}
                  {!users.some((user) => user.role === "driver") && <div className="rounded-xl bg-[#fff0ee] p-3 text-sm text-[#b6201a]">Ainda não existem utilizadores com a função Entregador. Na secção Utilizadores, atribua essa função a uma conta.</div>}
                </div>
              </section>
            )}
            {tab === "products" && (
              <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
                <section className="rounded-[24px] bg-[#241712] p-6 text-white">
                  <div className="text-xs font-black uppercase tracking-[0.15em] text-[#f6bf26]">{editingProduct ? "Editar produto" : "Novo produto"}</div>
                  <h2 className="font-display mt-2 text-2xl font-black">{editingProduct ? "Atualizar catálogo" : "Adicionar à loja"}</h2>
                  <p className="mt-2 text-sm text-white/60">Os produtos criados aqui ficam guardados no catálogo da MyFood.</p>
                  <label className="mt-5 block text-sm font-bold">Nome do produto<input required maxLength={120} className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-[#f6bf26]" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Ex.: Frango grelhado" /></label>
                  <label className="mt-4 block text-sm font-bold">Descrição<textarea maxLength={1000} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-[#f6bf26]" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} placeholder="Ingredientes ou detalhes do produto" /></label>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="block text-sm font-bold">Preço (MT)<input required type="number" min="1" step="0.01" className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 outline-none focus:border-[#f6bf26]" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} placeholder="250" /></label>
                    <label className="block text-sm font-bold">Categoria<input maxLength={80} className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 outline-none focus:border-[#f6bf26]" value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} placeholder="Refeições" /></label>
                  </div>
                  <label className="mt-4 block text-sm font-bold">URL da fotografia (HTTPS)<input type="url" className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-[#f6bf26]" value={productForm.imageUrl} onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })} placeholder="https://..." /></label>
                  {productForm.imageUrl && <img src={productForm.imageUrl} alt="Pré-visualização do produto" className="mt-3 h-36 w-full rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                  <div className="mt-5 flex gap-3"><button disabled={productBusy} className="flex-1 rounded-full bg-[#df2b24] px-4 py-3 text-sm font-black disabled:opacity-50" onClick={() => void saveProduct()}>{productBusy ? "A guardar..." : editingProduct ? "Guardar alterações" : "Adicionar produto"}</button>{editingProduct && <button className="rounded-full border border-white/20 px-4 py-3 text-sm font-black" onClick={resetProductForm}>Cancelar</button>}</div>
                </section>
                <section className="min-w-0 rounded-[24px] border border-[#e2d8cb] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black">Catálogo de produtos</h2><p className="mt-1 text-sm text-[#796b60]">{products.length} produto(s) registado(s)</p></div><button className="rounded-full border border-[#dcd0c1] px-4 py-2 text-sm font-black" onClick={() => void load()}>Atualizar</button></div>
                  <div className="mt-5 space-y-3">{products.map((product) => <article key={product.id} className="flex flex-col gap-4 rounded-2xl border border-[#eadfce] p-3 sm:flex-row sm:items-center">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-24 w-full rounded-xl object-cover sm:w-24" /> : <div className="grid h-24 w-full place-items-center rounded-xl bg-[#f7f3ec] text-xs font-bold text-[#95877c] sm:w-24">Sem fotografia</div>}
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{product.name}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${product.active ? "bg-[#edf8ed] text-[#286b2d]" : "bg-[#f2e9db] text-[#796b60]"}`}>{product.active ? "Disponível" : "Oculto"}</span></div><div className="mt-1 text-xs font-bold text-[#95877c]">{product.category || "Geral"}</div><p className="mt-1 line-clamp-2 text-sm text-[#796b60]">{product.description || "Sem descrição."}</p><div className="mt-2 font-black text-[#df2b24]">{Number(product.price).toLocaleString("pt-PT")} MT</div></div>
                    <div className="flex flex-wrap gap-2 sm:flex-col"><button className="rounded-full border border-[#e5d7c5] px-3 py-2 text-xs font-black" onClick={() => { setEditingProduct(product.id); setProductForm({ name: product.name, description: product.description || "", category: product.category || "Geral", imageUrl: product.imageUrl || "", price: String(product.price) }); }}>Editar</button><button className="rounded-full border border-[#e5d7c5] px-3 py-2 text-xs font-black" onClick={() => void toggleProduct(product)}>{product.active ? "Ocultar" : "Publicar"}</button><button className="rounded-full bg-[#fff0ee] px-3 py-2 text-xs font-black text-[#b6201a]" onClick={() => void deleteProduct(product)}>Eliminar</button></div>
                  </article>)}
                  {!products.length && <div className="py-14 text-center text-[#796b60]">Ainda não há produtos. Utilize o formulário para adicionar o primeiro.</div>}</div>
                </section>
              </div>
            )}
            {tab === "marketing" && (
              <div className="mt-8 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
                <section className="rounded-[24px] bg-[#241712] p-6 text-white">
                  <div className="text-xs font-black uppercase tracking-[0.15em] text-[#f6bf26]">Nova campanha</div>
                  <h2 className="font-display mt-2 text-2xl font-black">Fale com os seus clientes</h2>
                  <label className="mt-6 block text-sm font-bold">Título<input className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-[#f6bf26]" onChange={(event) => setCampaign({ ...campaign, title: event.target.value })} value={campaign.title} /></label>
                  <label className="mt-4 block text-sm font-bold">Mensagem<textarea className="mt-2 min-h-32 w-full resize-none rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-[#f6bf26]" onChange={(event) => setCampaign({ ...campaign, message: event.target.value })} value={campaign.message} /></label>
                  <label className="mt-4 block text-sm font-bold">Público<select className="mt-2 w-full rounded-xl border border-white/15 bg-[#35251f] px-4 py-3" onChange={(event) => setCampaign({ ...campaign, audience: event.target.value })} value={campaign.audience}><option value="marketing">Aceitaram marketing</option><option value="all">Todos os utilizadores</option></select></label>
                  <div className="mt-5 flex gap-3"><button className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-black" onClick={() => void createCampaign(false)}>Guardar rascunho</button><button className="flex-1 rounded-full bg-[#df2b24] px-4 py-3 text-sm font-black" onClick={() => void createCampaign(true)}>Enviar agora</button></div>
                </section>
                <section className="rounded-[24px] border border-[#e2d8cb] bg-white p-6">
                  <h2 className="font-display text-xl font-black">Campanhas</h2>
                  <div className="mt-5 space-y-3">{campaigns.length ? campaigns.map((item) => <article className="rounded-2xl border border-[#eadfce] p-4" key={item.id}><div className="flex justify-between gap-3"><strong>{item.title}</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.status === "sent" ? "bg-[#edf8ed] text-[#286b2d]" : "bg-[#f2e9db] text-[#796b60]"}`}>{item.status === "sent" ? "Enviada" : "Rascunho"}</span></div><p className="mt-2 text-sm leading-relaxed text-[#796b60]">{item.message}</p></article>) : <div className="py-16 text-center text-[#796b60]">Ainda não existem campanhas.</div>}</div>
                </section>
              </div>
            )}
            {tab === "users" && (
              <section className="mt-8 overflow-hidden rounded-[24px] border border-[#e2d8cb] bg-white">
                <div className="border-b border-[#eadfce] p-6"><h2 className="font-display text-xl font-black">Utilizadores e permissões</h2><p className="mt-1 text-sm text-[#796b60]">Apenas super administradores podem promover administradores.</p></div>
                <div className="divide-y divide-[#eadfce]">{users.map((user) => <div className="flex flex-wrap items-center justify-between gap-4 p-5" key={user.id}><div><div className="font-black">{user.name}</div><div className="text-sm text-[#796b60]">{user.email}</div></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${user.marketingOptIn ? "bg-[#edf8ed] text-[#286b2d]" : "bg-[#f2e9db] text-[#796b60]"}`}>{user.marketingOptIn ? "Marketing ativo" : "Sem marketing"}</span>{profile?.role === "super_admin" && user.role !== "super_admin" ? <select className="rounded-xl border border-[#e5d7c5] px-3 py-2 text-sm font-bold" onChange={(event) => void updateRole(user.id, event.target.value)} value={user.role}><option value="customer">Cliente</option><option value="driver">Entregador</option><option value="admin">Admin</option></select> : <span className="rounded-full bg-[#241712] px-3 py-1.5 text-xs font-black text-white">{user.role}</span>}</div></div>)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return <div className={`rounded-[22px] p-5 ${featured ? "bg-[#df2b24] text-white" : "border border-[#e2d8cb] bg-white"}`}><div className={`text-xs font-black uppercase tracking-wider ${featured ? "text-white/65" : "text-[#95877c]"}`}>{label}</div><div className="font-display mt-2 text-2xl font-black">{value}</div></div>;
}

function OrderTable({ orders, onUpdate }: { orders: Order[]; onUpdate: (id: string, status: string) => Promise<void> }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-[#95877c]"><tr><th className="pb-3">Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Data</th><th className="pb-3">Total</th><th className="pb-3">Estado</th></tr></thead><tbody className="divide-y divide-[#eadfce]">{orders.map((order) => <tr key={order.id}><td className="py-4 font-black">#{order.id.slice(0, 8).toUpperCase()}</td><td className="py-4"><div className="font-bold">{order.customerName}</div><div className="text-xs text-[#95877c]">{order.customerEmail}</div></td><td className="py-4 text-[#796b60]">{new Date(order.createdAt).toLocaleDateString("pt-PT")}</td><td className="py-4 font-black text-[#df2b24]">{order.total} MT</td><td className="py-4"><select className="rounded-xl border border-[#e5d7c5] bg-white px-3 py-2 text-xs font-bold" onChange={(event) => void onUpdate(order.id, event.target.value)} value={order.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table>{!orders.length && <div className="py-14 text-center text-[#796b60]">Nenhum pedido encontrado.</div>}</div>;
}
