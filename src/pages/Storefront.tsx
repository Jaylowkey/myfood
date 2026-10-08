import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import UserMenu from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  image: string;
  tag?: string;
};

const products: Product[] = [
  { id:1,name:"Smash Duplo",description:"2 carnes smash, cheddar, cebola caramelizada e molho da casa.",price:450,oldPrice:500,category:"Hambúrgueres",image:"https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800",tag:"Mais vendido" },
  { id:2,name:"Classic Bacon",description:"Carne artesanal, bacon crocante, queijo, alface e tomate.",price:390,category:"Hambúrgueres",image:"https://images.unsplash.com/photo-1590742309630-e9f9b66da3f7?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800" },
  { id:3,name:"Pizza Pepperoni",description:"Molho de tomate, mozzarella, pepperoni e orégãos. 30 cm.",price:680,category:"Pizzas",image:"https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800",tag:"Favorito" },
  { id:4,name:"Batata da Casa",description:"Batata crocante, cheddar cremoso, bacon e cebolinho.",price:280,category:"Fritos",image:"https://images.unsplash.com/photo-1625502578738-dbf2a215bd09?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800" },
  { id:5,name:"Big House",description:"Carne alta, cheddar, pickles, cebola roxa e molho especial.",price:420,category:"Hambúrgueres",image:"https://images.unsplash.com/photo-1636298653102-ed5bb0438929?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800" },
  { id:6,name:"Pizza Margherita",description:"Tomate, mozzarella fresca, manjericão e azeite extra virgem.",price:590,category:"Pizzas",image:"https://images.unsplash.com/photo-1607929298871-fbdcf7e84852?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800" },
  { id:7,name:"Brownie & Gelado",description:"Brownie quente de chocolate com gelado cremoso de baunilha.",price:260,category:"Sobremesas",image:"https://images.unsplash.com/photo-1757030477866-31f7076d49a2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800" },
  { id:8,name:"Combo MyFood",description:"Smash Classic, batata crocante e bebida à sua escolha.",price:540,oldPrice:620,category:"Combos",image:"https://images.unsplash.com/photo-1575367439051-9be800a160d8?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=800",tag:"Poupe 80 MT" },
];

const categories=["Todos","Hambúrgueres","Pizzas","Fritos","Combos","Sobremesas","Bebidas"];

export default function Storefront() {
  const navigate=useNavigate();
  const {session}=useAuth();
  const [category,setCategory]=useState("Todos");
  const [search,setSearch]=useState("");
  const [cart,setCart]=useState<Record<number,number>>({});
  const [checkout,setCheckout]=useState(false);
  const [address,setAddress]=useState("");
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{try{const saved=localStorage.getItem("myfood-cart");if(saved)setCart(JSON.parse(saved));}catch{}},[]);
  useEffect(()=>{localStorage.setItem("myfood-cart",JSON.stringify(cart));},[cart]);

  const visible=useMemo(()=>products.filter(p=>(category==="Todos"||p.category===category)&&p.name.toLowerCase().includes(search.toLowerCase())),[category,search]);
  const itemCount=Object.values(cart).reduce((a,b)=>a+b,0);
  const subtotal=Object.entries(cart).reduce((sum,[id,q])=>sum+(products.find(p=>p.id===Number(id))?.price||0)*q,0);
  const delivery=subtotal>=1000||subtotal===0?0:80;

  function change(id:number,delta:number){setCart(c=>{const n=Math.max(0,(c[id]||0)+delta);const next={...c};if(n)next[id]=n;else delete next[id];return next;});}
  function add(id:number){change(id,1);const p=products.find(x=>x.id===id);setNotice(`${p?.name} adicionado ao carrinho`);setTimeout(()=>setNotice(""),2200);}
  function startCheckout(){if(!itemCount)return;if(!session){navigate("/login",{state:{from:"/"}});return;}setError("");setCheckout(true);}
  async function placeOrder(e:React.FormEvent){e.preventDefault();if(!address.trim()){setError("Indique o endereço de entrega.");return;}setBusy(true);setError("");try{const r=await api<{order:{id:string}}>("/orders",{method:"POST",body:JSON.stringify({items:products.filter(p=>cart[p.id]).map(p=>({id:p.id,name:p.name,price:p.price,quantity:cart[p.id]})),subtotal,delivery,total:subtotal+delivery,address,notes})});setCart({});setCheckout(false);setAddress("");setNotes("");setNotice(`Pedido #${r.order.id.slice(0,8).toUpperCase()} confirmado`);setTimeout(()=>setNotice(""),3500);}catch(e){setError(e instanceof Error?e.message:"Não foi possível finalizar o pedido.");}finally{setBusy(false);}}

  return <div className="min-h-screen bg-[#fffaf1] text-[#241712]">
    {notice&&<div className="fixed left-1/2 top-5 z-[80] -translate-x-1/2 rounded-full bg-[#241712] px-5 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>}
    <div className="bg-[#241712] px-5 py-2 text-center text-xs font-bold text-white">Entrega grátis em pedidos acima de 1.000 MT • Hoje até às 22:30</div>
    <header className="sticky top-0 z-40 border-b border-[#eadfce] bg-[#fffaf1]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-4">
        <a href="/"><img alt="MyFood" className="h-12 w-auto" src="/myfood-header.png"/></a>
        <nav className="hidden gap-7 text-sm font-bold lg:flex"><a href="#menu">Menu</a><a href="#sobre">Sobre nós</a><a href="#contactos">Contactos</a></nav>
        <div className="ml-auto hidden max-w-xs flex-1 items-center rounded-full border border-[#e5d7c5] bg-white px-4 py-2 md:flex"><input className="w-full bg-transparent text-sm outline-none" onChange={e=>setSearch(e.target.value)} placeholder="O que lhe apetece?" value={search}/></div>
        <UserMenu/>
        <button className="rounded-full bg-[#df2b24] px-4 py-3 text-sm font-black text-white shadow-[0_4px_0_#a51b17]" onClick={startCheckout}>Carrinho ({itemCount})</button>
      </div>
    </header>
    <main>
      <section className="px-4 pt-5 lg:px-8"><div className="relative mx-auto min-h-[460px] max-w-7xl overflow-hidden rounded-[32px] bg-[#321b14]">
        <img alt="Hambúrguer" className="absolute inset-0 h-full w-full object-cover opacity-80" src="https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=90&w=1800"/>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(30,13,8,.95),rgba(39,18,12,.55),transparent)]"/>
        <div className="relative z-10 flex min-h-[460px] max-w-2xl flex-col justify-center px-7 py-12 text-white sm:px-14 lg:px-20">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#f6bf26]">Sabor que chega quente</div>
          <h1 className="font-display mt-4 text-5xl font-black leading-[.95] sm:text-6xl lg:text-7xl">Feito na hora.<br/><span className="text-[#f6bf26]">Do jeito certo.</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">Ingredientes frescos, receitas irresistíveis e entrega rápida. A sua próxima refeição favorita está aqui.</p>
          <a className="mt-8 w-fit rounded-full bg-[#df2b24] px-6 py-4 text-sm font-black text-white" href="#menu">Ver menu completo →</a>
        </div>
      </div></section>
      <section className="mx-auto max-w-7xl px-5 pb-6 pt-14" id="menu">
        <div><div className="text-xs font-black uppercase tracking-[.18em] text-[#df2b24]">Escolha o seu favorito</div><h2 className="font-display mt-2 text-4xl font-black sm:text-5xl">O nosso menu</h2><p className="mt-3 text-[#796b60]">Clássicos que nunca falham e novidades para descobrir.</p></div>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold ${category===c?"bg-[#241712] text-white":"border border-[#e5d7c5] bg-white"}`}>{c}</button>)}</div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map(p=><article key={p.id} className="overflow-hidden rounded-[24px] border border-[#eadfce] bg-white shadow-sm">
          <div className="relative h-52"><img alt={p.name} className="h-full w-full object-cover" src={p.image}/>{p.tag&&<span className="absolute left-4 top-4 rounded-full bg-[#f6bf26] px-3 py-1 text-xs font-black">{p.tag}</span>}</div>
          <div className="p-5"><div className="text-xs font-bold uppercase tracking-wider text-[#95877c]">{p.category}</div><h3 className="font-display mt-1 text-xl font-black">{p.name}</h3><p className="mt-2 min-h-10 text-sm text-[#796b60]">{p.description}</p><div className="mt-5 flex items-end justify-between"><div>{p.oldPrice&&<div className="text-xs text-[#95877c] line-through">{p.oldPrice} MT</div>}<div className="font-display text-xl font-black text-[#df2b24]">{p.price} MT</div></div><button onClick={()=>add(p.id)} className="rounded-full bg-[#241712] px-4 py-3 text-xs font-black text-white">+ Adicionar</button></div></div>
        </article>)}</div>
        <aside className="h-fit rounded-[24px] border border-[#eadfce] bg-white p-5 lg:sticky lg:top-28">
          <h2 className="font-display text-xl font-black">O seu pedido</h2>
          {!itemCount?<div className="py-12 text-center text-sm text-[#796b60]">O carrinho está vazio.</div>:<>
            <div className="mt-5 space-y-4">{products.filter(p=>cart[p.id]).map(p=><div className="flex gap-3" key={p.id}><img className="size-14 rounded-xl object-cover" src={p.image}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{p.name}</div><div className="text-sm font-bold text-[#df2b24]">{p.price*cart[p.id]} MT</div><div className="mt-1 flex w-fit rounded-full border"><button className="px-2" onClick={()=>change(p.id,-1)}>−</button><span className="px-2 text-xs font-bold">{cart[p.id]}</span><button className="px-2" onClick={()=>change(p.id,1)}>+</button></div></div></div>)}</div>
            <div className="mt-5 border-t border-dashed pt-4 text-sm"><div className="flex justify-between text-[#796b60]"><span>Subtotal</span><span>{subtotal} MT</span></div><div className="mt-2 flex justify-between text-[#796b60]"><span>Entrega</span><span>{delivery?"80 MT":"Grátis"}</span></div><div className="mt-3 flex justify-between font-display text-lg font-black"><span>Total</span><span>{subtotal+delivery} MT</span></div></div>
            <button onClick={startCheckout} className="mt-5 w-full rounded-full bg-[#df2b24] px-5 py-4 text-sm font-black text-white">Finalizar pedido</button>
          </>}
        </aside>
      </section>
      <section className="bg-[#df2b24] px-5 py-16 text-white" id="sobre"><div className="mx-auto max-w-7xl"><div className="text-xs font-black uppercase tracking-[.18em] text-[#f6bf26]">MyFood é da casa</div><h2 className="font-display mt-3 text-4xl font-black">Comida honesta.<br/>Momentos felizes.</h2></div></section>
    </main>
    <footer className="bg-[#241712] px-5 py-10 text-white" id="contactos"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><img alt="MyFood" className="h-12 w-auto" src="/myfood-footer.png"/><span className="text-sm text-white/60">Av. 24 de Julho, Maputo · +258 84 123 4567 · 10:00–22:30</span></div></footer>
    {checkout&&<div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 px-5"><form onSubmit={placeOrder} className="w-full max-w-lg rounded-[28px] bg-[#fffaf1] p-6 shadow-2xl"><div className="flex justify-between"><h2 className="font-display text-2xl font-black">Confirmar entrega</h2><button type="button" onClick={()=>setCheckout(false)}>✕</button></div><label className="mt-5 block text-sm font-black">Endereço<input required value={address} onChange={e=>setAddress(e.target.value)} className="mt-2 w-full rounded-2xl border bg-white px-4 py-3" placeholder="Bairro, rua, número e referência"/></label><label className="mt-4 block text-sm font-black">Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border bg-white px-4 py-3" placeholder="Ex.: sem cebola..."/></label>{error&&<div className="mt-4 rounded-xl bg-[#fff0ee] p-3 text-sm font-bold text-[#b6201a]">{error}</div>}<div className="mt-5 flex justify-between font-display text-xl font-black"><span>Total</span><span>{subtotal+delivery} MT</span></div><button disabled={busy} className="mt-5 w-full rounded-full bg-[#df2b24] px-5 py-4 font-black text-white">{busy?"A confirmar...":"Confirmar pedido"}</button></form></div>}
  </div>;
}
