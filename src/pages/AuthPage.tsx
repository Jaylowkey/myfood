import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import AppLogo from "../components/AppLogo";
import { supabase } from "../lib/supabase";

type Mode = "login" | "register" | "forgot" | "reset";

const content: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: {
    title: "Bem-vindo de volta",
    subtitle: "Entre para acompanhar pedidos e guardar os seus dados.",
    button: "Entrar na minha conta",
  },
  register: {
    title: "Crie a sua conta",
    subtitle: "Peça mais rápido e acompanhe tudo num só lugar.",
    button: "Criar conta",
  },
  forgot: {
    title: "Recuperar palavra-passe",
    subtitle: "Enviaremos um link seguro para o seu e-mail.",
    button: "Enviar link de recuperação",
  },
  reset: {
    title: "Nova palavra-passe",
    subtitle: "Escolha uma palavra-passe segura para a sua conta.",
    button: "Guardar nova palavra-passe",
  },
};

export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if ((mode === "register" || mode === "reset") && password.length < 8) {
        throw new Error("A palavra-passe deve ter pelo menos 8 caracteres.");
      }
      if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
        throw new Error("As palavras-passe não coincidem.");
      }

      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw new Error("E-mail ou palavra-passe incorretos.");
        const target = (location.state as { from?: string } | null)?.from || "/";
        navigate(target, { replace: true });
      }

      if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim(), phone: phone.trim() },
            emailRedirectTo: `${window.location.origin}/confirmar-email`,
          },
        });
        if (authError) throw authError;
        if (data.session) navigate("/conta", { replace: true });
        else setSuccess("Conta criada. Confirme o link enviado para o seu e-mail.");
      }

      if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (authError) throw authError;
        setSuccess("Se existir uma conta com este e-mail, o link foi enviado.");
      }

      if (mode === "reset") {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setSuccess("Palavra-passe atualizada com sucesso.");
        window.setTimeout(() => navigate("/conta", { replace: true }), 1200);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const copy = content[mode];
  const needsEmail = mode !== "reset";
  const needsPassword = mode === "login" || mode === "register" || mode === "reset";

  return (
    <div className="grid min-h-screen bg-[#fffaf1] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#241712] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          src="https://images.unsplash.com/photo-1550547660-d9450f859349?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#241712] via-[#241712]/60 to-transparent" />
        <div className="relative"><AppLogo footer /></div>
        <div className="relative max-w-xl">
          <div className="mb-5 w-fit rounded-full bg-[#f6bf26] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#241712]">
            MyFood Club
          </div>
          <h2 className="font-display text-5xl font-black leading-[1.02] tracking-[-0.045em]">
            O seu pedido favorito, ainda mais perto.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
            Histórico, novidades exclusivas e uma experiência de compra mais rápida.
          </p>
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><AppLogo /></div>
          <Link className="mb-8 inline-flex text-sm font-bold text-[#796b60] hover:text-[#df2b24]" to="/">
            ← Voltar à loja
          </Link>
          <h1 className="font-display text-4xl font-black tracking-[-0.04em]">{copy.title}</h1>
          <p className="mt-3 leading-relaxed text-[#796b60]">{copy.subtitle}</p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Field label="Nome completo" onChange={setName} placeholder="Como devemos chamar-lhe?" required value={name} />
                <Field label="Telefone" onChange={setPhone} placeholder="+258 84 000 0000" type="tel" value={phone} />
              </>
            )}
            {needsEmail && (
              <Field label="E-mail" onChange={setEmail} placeholder="nome@exemplo.com" required type="email" value={email} />
            )}
            {needsPassword && (
              <Field label="Palavra-passe" minLength={8} onChange={setPassword} placeholder="Mínimo de 8 caracteres" required type="password" value={password} />
            )}
            {(mode === "register" || mode === "reset") && (
              <Field label="Confirmar palavra-passe" minLength={8} onChange={setConfirmPassword} placeholder="Repita a palavra-passe" required type="password" value={confirmPassword} />
            )}

            {mode === "login" && (
              <div className="text-right">
                <Link className="text-sm font-bold text-[#df2b24]" to="/recuperar-senha">Esqueceu a palavra-passe?</Link>
              </div>
            )}
            {error && <div className="rounded-2xl bg-[#fff0ee] p-4 text-sm font-semibold text-[#b6201a]">{error}</div>}
            {success && <div className="rounded-2xl bg-[#edf8ed] p-4 text-sm font-semibold text-[#286b2d]">{success}</div>}
            <button
              className="w-full rounded-full bg-[#df2b24] px-6 py-4 font-black text-white shadow-[0_4px_0_#a51b17] disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "A processar..." : copy.button}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-7 text-center text-sm text-[#796b60]">
              Ainda não tem conta? <Link className="font-black text-[#df2b24]" to="/registar">Criar conta</Link>
            </p>
          )}
          {mode === "register" && (
            <p className="mt-7 text-center text-sm text-[#796b60]">
              Já tem conta? <Link className="font-black text-[#df2b24]" to="/login">Entrar</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border border-[#e5d7c5] bg-white px-4 py-3.5 outline-none transition focus:border-[#df2b24] focus:ring-4 focus:ring-[#df2b24]/10"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
