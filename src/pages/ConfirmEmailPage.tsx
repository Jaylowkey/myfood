import { useEffect, useState } from "react";
import { Link } from "react-router";
import AppLogo from "../components/AppLogo";
import { supabase } from "../lib/supabase";

export default function ConfirmEmailPage() {
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setVerified(Boolean(data.session));
      setEmail(data.session?.user.email || "");
      setChecking(false);
    }
    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setVerified(Boolean(session));
      setEmail(session?.user.email || "");
      setChecking(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fffaf1] px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-[#eadfce] bg-white p-7 text-center shadow-[0_20px_70px_rgba(36,23,18,0.08)] sm:p-10">
          <div className="mx-auto mb-8 w-fit"><AppLogo /></div>
          {checking ? (
            <>
              <div className="mx-auto mb-6 h-14 w-14 animate-pulse rounded-full bg-[#f6bf26]/30" />
              <h1 className="font-display text-3xl font-black tracking-[-0.04em]">A confirmar o seu email...</h1>
              <p className="mt-3 text-[#796b60]">Só um momento enquanto validamos a sua conta.</p>
            </>
          ) : verified ? (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf7ea] text-3xl">✓</div>
              <div className="mb-3 inline-flex rounded-full bg-[#fff4d2] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#7d5b00]">Email confirmado</div>
              <h1 className="font-display text-3xl font-black tracking-[-0.04em]">A sua conta MyFood está pronta.</h1>
              <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#796b60]">
                {email ? `O endereço ${email} foi confirmado com sucesso.` : "O seu endereço de email foi confirmado com sucesso."}
              </p>
              <Link className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#df2b24] px-6 py-4 font-black text-white shadow-[0_4px_0_#a51b17]" to="/">Ir para a MyFood</Link>
            </>
          ) : (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4d2] text-3xl">✉</div>
              <div className="mb-3 inline-flex rounded-full bg-[#fff4d2] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#7d5b00]">Confirme o seu email</div>
              <h1 className="font-display text-3xl font-black tracking-[-0.04em]">Verifique a sua caixa de entrada.</h1>
              <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#796b60]">Enviámos um link de confirmação. Abra o email da <strong className="text-[#241712]">MyFood</strong> e clique no botão para ativar a sua conta.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Link className="rounded-full border border-[#e5d7c5] px-6 py-4 font-black text-[#241712]" to="/login">Já confirmei</Link>
                <Link className="rounded-full bg-[#df2b24] px-6 py-4 font-black text-white shadow-[0_4px_0_#a51b17]" to="/registar">Voltar ao registo</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}