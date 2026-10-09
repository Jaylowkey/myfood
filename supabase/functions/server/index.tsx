import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const route = "/make-server-1c85eca0";
const superAdminEmails = new Set([
  "jrsamadh@gmail.com",
  "paygoprimeira@gmail.com",
]);

const configuredAdminEmails = new Set(
  (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

type Role = "customer" | "admin" | "super_admin";

type Profile = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  marketingOptIn: boolean;
  createdAt: string;
};

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

async function allAuthUsers() {
  const client = adminClient();
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

function publicProfile(profile: Profile) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone ?? "",
    role: profile.role,
    marketingOptIn: profile.marketingOptIn,
    createdAt: profile.createdAt,
  };
}

async function actor(c: any): Promise<Profile> {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user?.email) throw new Error("UNAUTHORIZED");

  const email = data.user.email.toLowerCase();
  const existing = await kv.get(`profile:${data.user.id}`);
  const role: Role = superAdminEmails.has(email)
    ? "super_admin"
    : configuredAdminEmails.has(email)
      ? "admin"
      : existing?.role === "admin"
        ? "admin"
        : "customer";
  const profile: Profile = {
    id: data.user.id,
    email,
    name:
      existing?.name ||
      data.user.user_metadata?.name ||
      email.split("@")[0],
    phone: existing?.phone || data.user.user_metadata?.phone || "",
    role,
    marketingOptIn: existing?.marketingOptIn ?? true,
    createdAt: existing?.createdAt || data.user.created_at,
  };

  if (!existing || existing.role !== role || existing.email !== email) {
    await kv.set(`profile:${profile.id}`, profile);
  }
  return profile;
}

function requireAdmin(profile: Profile) {
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new Error("FORBIDDEN");
  }
}

function requireSuperAdmin(profile: Profile) {
  if (profile.role !== "super_admin") throw new Error("FORBIDDEN");
}

function failure(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return c.json({ error: "Sessão inválida." }, 401);
  if (message === "FORBIDDEN") return c.json({ error: "Acesso não autorizado." }, 403);
  console.log(error);
  return c.json({ error: "Não foi possível concluir a operação." }, 500);
}

app.get(`${route}/health`, (c) => c.json({ status: "ok" }));

app.get(`${route}/profile`, async (c) => {
  try {
    return c.json({ profile: publicProfile(await actor(c)) });
  } catch (error) {
    return failure(c, error);
  }
});

app.put(`${route}/profile`, async (c) => {
  try {
    const profile = await actor(c);
    const body = await c.req.json();
    const updated: Profile = {
      ...profile,
      name: String(body.name || profile.name).trim().slice(0, 80),
      phone: String(body.phone || "").trim().slice(0, 30),
      marketingOptIn: Boolean(body.marketingOptIn),
    };
    await kv.set(`profile:${profile.id}`, updated);
    return c.json({ profile: publicProfile(updated) });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/notifications`, async (c) => {
  try {
    const profile = await actor(c);
    const notifications = await kv.getByPrefix(`notification:${profile.id}:`);
    return c.json({
      notifications: notifications.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    });
  } catch (error) {
    return failure(c, error);
  }
});

app.post(`${route}/notifications/:id/read`, async (c) => {
  try {
    const profile = await actor(c);
    const id = c.req.param("id");
    const key = `notification:${profile.id}:${id}`;
    const notification = await kv.get(key);
    if (!notification) return c.json({ error: "Notificação não encontrada." }, 404);
    await kv.set(key, { ...notification, read: true });
    return c.json({ success: true });
  } catch (error) {
    return failure(c, error);
  }
});

app.post(`${route}/orders`, async (c) => {
  try {
    const profile = await actor(c);
    const body = await c.req.json();
    if (!Array.isArray(body.items) || !body.items.length) {
      return c.json({ error: "O pedido está vazio." }, 400);
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const order = {
      id,
      userId: profile.id,
      customerName: profile.name,
      customerEmail: profile.email,
      items: body.items,
      subtotal: Number(body.subtotal) || 0,
      delivery: Number(body.delivery) || 0,
      total: Number(body.total) || 0,
      address: String(body.address || "").trim().slice(0, 240),
      notes: String(body.notes || "").trim().slice(0, 300),
      status: "received",
      createdAt,
      updatedAt: createdAt,
    };
    await kv.set(`order:${id}`, order);
    await kv.set(`notification:${profile.id}:${id}`, {
      id,
      title: "Pedido recebido",
      message: `O seu pedido #${id.slice(0, 8).toUpperCase()} foi recebido.`,
      type: "order",
      read: false,
      createdAt,
    });
    return c.json({ order }, 201);
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/orders`, async (c) => {
  try {
    const profile = await actor(c);
    const orders = (await kv.getByPrefix("order:"))
      .filter((order) => order.userId === profile.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return c.json({ orders });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/admin/dashboard`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const [orders, authUsers, campaigns] = await Promise.all([
      kv.getByPrefix("order:"),
      allAuthUsers(),
      kv.getByPrefix("campaign:"),
    ]);
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pending = orders.filter((order) =>
      ["received", "preparing", "delivery"].includes(order.status),
    ).length;
    return c.json({
      metrics: {
        orders: orders.length,
        customers: authUsers.length,
        campaigns: campaigns.length,
        revenue,
        pending,
      },
      recentOrders: orders
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 8),
    });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/admin/orders`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const orders = await kv.getByPrefix("order:");
    return c.json({
      orders: orders.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    });
  } catch (error) {
    return failure(c, error);
  }
});

app.put(`${route}/admin/orders/:id`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    const body = await c.req.json();
    const statuses = ["received", "preparing", "delivery", "completed", "cancelled"];
    if (!statuses.includes(body.status)) return c.json({ error: "Estado inválido." }, 400);
    const updated = { ...order, status: body.status, updatedAt: new Date().toISOString() };
    await kv.set(`order:${id}`, updated);
    const notificationId = crypto.randomUUID();
    await kv.set(`notification:${order.userId}:${notificationId}`, {
      id: notificationId,
      title: "Pedido atualizado",
      message: `O estado do seu pedido agora é: ${body.status}.`,
      type: "order",
      read: false,
      createdAt: new Date().toISOString(),
    });
    return c.json({ order: updated });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/admin/users`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const [authUsers, storedProfiles] = await Promise.all([
      allAuthUsers(),
      kv.getByPrefix("profile:"),
    ]);
    const profilesById = new Map(storedProfiles.map((item: any) => [item.id, item]));
    const users = authUsers.map((user: any) => {
      const email = String(user.email || "").toLowerCase();
      const existing: any = profilesById.get(user.id);
      const role: Role = superAdminEmails.has(email)
        ? "super_admin"
        : configuredAdminEmails.has(email)
          ? "admin"
          : existing?.role === "admin"
            ? "admin"
            : "customer";
      return publicProfile({
        id: user.id,
        email,
        name: existing?.name || user.user_metadata?.name || email.split("@")[0] || "Utilizador",
        phone: existing?.phone || user.user_metadata?.phone || "",
        role,
        marketingOptIn: existing?.marketingOptIn ?? true,
        createdAt: existing?.createdAt || user.created_at,
      });
    });
    return c.json({ users });
  } catch (error) {
    return failure(c, error);
  }
});

app.put(`${route}/admin/users/:id/role`, async (c) => {
  try {
    const profile = await actor(c);
    requireSuperAdmin(profile);
    const target = await kv.get(`profile:${c.req.param("id")}`);
    if (!target) return c.json({ error: "Utilizador não encontrado." }, 404);
    const body = await c.req.json();
    if (!["customer", "admin"].includes(body.role)) {
      return c.json({ error: "Função inválida." }, 400);
    }
    if (superAdminEmails.has(String(target.email).toLowerCase())) {
      return c.json({ error: "Não é possível alterar um super administrador." }, 400);
    }
    const updated = { ...target, role: body.role };
    await kv.set(`profile:${target.id}`, updated);
    return c.json({ user: publicProfile(updated) });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/admin/campaigns`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const campaigns = await kv.getByPrefix("campaign:");
    return c.json({
      campaigns: campaigns.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    });
  } catch (error) {
    return failure(c, error);
  }
});

app.post(`${route}/admin/campaigns`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const body = await c.req.json();
    const title = String(body.title || "").trim().slice(0, 100);
    const message = String(body.message || "").trim().slice(0, 500);
    if (!title || !message) return c.json({ error: "Preencha título e mensagem." }, 400);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const campaign = {
      id,
      title,
      message,
      audience: body.audience === "all" ? "all" : "marketing",
      status: body.sendNow ? "sent" : "draft",
      createdAt,
      sentAt: body.sendNow ? createdAt : null,
      createdBy: profile.email,
    };
    await kv.set(`campaign:${id}`, campaign);

    if (body.sendNow) {
      const users = await kv.getByPrefix("profile:");
      const recipients = users.filter(
        (user) => campaign.audience === "all" || user.marketingOptIn !== false,
      );
      await Promise.all(
        recipients.map((user) =>
          kv.set(`notification:${user.id}:${id}`, {
            id,
            title,
            message,
            type: "marketing",
            read: false,
            createdAt,
          }),
        ),
      );
    }
    return c.json({ campaign }, 201);
  } catch (error) {
    return failure(c, error);
  }
});

Deno.serve(app.fetch);
