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

type Role = "customer" | "driver" | "admin" | "super_admin";

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
      : existing?.role === "admin" || existing?.role === "driver"
        ? existing.role
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
    const submittedItems = body.items as Array<{ id: string; quantity: number }>;
    const trustedItems = [];
    for (const item of submittedItems) {
      const productId = String(item.id || "");
      const quantity = Math.floor(Number(item.quantity));
      if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
        return c.json({ error: "Um dos produtos ou quantidades do pedido é inválido." }, 400);
      }
      const product = await kv.get(`product:${productId}`);
      if (!product || product.active === false) {
        return c.json({ error: "Um dos produtos já não está disponível. Atualize o menu." }, 400);
      }
      trustedItems.push({ id: product.id, name: product.name, price: Number(product.price), quantity });
    }
    const subtotal = trustedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = subtotal >= 1000 || subtotal === 0 ? 0 : 80;
    const total = subtotal + delivery;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const order = {
      id,
      userId: profile.id,
      customerName: profile.name,
      customerEmail: profile.email,
      customerPhone: profile.phone || "",
      items: trustedItems,
      subtotal,
      delivery,
      total,
      address: String(body.address || "").trim().slice(0, 240),
      notes: String(body.notes || "").trim().slice(0, 300),
      status: "received",
      driverId: null,
      driverName: null,
      driverPhone: null,
      deliveryStage: null,
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


app.get(`${route}/products`, async (c) => {
  try {
    const products = (await kv.getByPrefix("product:"))
      .filter((item: any) => item.active !== false)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    return c.json({ products });
  } catch (error) {
    return failure(c, error);
  }
});

app.get(`${route}/admin/products`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const products = (await kv.getByPrefix("product:"))
      .sort((a: any, b: any) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    return c.json({ products });
  } catch (error) {
    return failure(c, error);
  }
});

app.post(`${route}/admin/products`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const body = await c.req.json();
    const name = String(body.name || "").trim().slice(0, 120);
    const description = String(body.description || "").trim().slice(0, 1000);
    const category = String(body.category || "Geral").trim().slice(0, 80);
    const imageUrl = String(body.imageUrl || "").trim().slice(0, 1000);
    const price = Number(body.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return c.json({ error: "Indique o nome e um preço válido maior que zero." }, 400);
    }
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      return c.json({ error: "A imagem deve usar um endereço HTTPS válido." }, 400);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const product = { id, name, description, category, imageUrl, price, active: body.active !== false, createdAt: now, updatedAt: now, createdBy: profile.id };
    await kv.set(`product:${id}`, product);
    return c.json({ product }, 201);
  } catch (error) {
    return failure(c, error);
  }
});

app.put(`${route}/admin/products/:id`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const id = c.req.param("id");
    const existing = await kv.get(`product:${id}`);
    if (!existing) return c.json({ error: "Produto não encontrado." }, 404);
    const body = await c.req.json();
    const name = String(body.name ?? existing.name).trim().slice(0, 120);
    const description = String(body.description ?? existing.description ?? "").trim().slice(0, 1000);
    const category = String(body.category ?? existing.category ?? "Geral").trim().slice(0, 80);
    const imageUrl = String(body.imageUrl ?? existing.imageUrl ?? "").trim().slice(0, 1000);
    const price = Number(body.price ?? existing.price);
    if (!name || !Number.isFinite(price) || price <= 0) return c.json({ error: "Indique o nome e um preço válido maior que zero." }, 400);
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return c.json({ error: "A imagem deve usar um endereço HTTPS válido." }, 400);
    const product = { ...existing, name, description, category, imageUrl, price, active: body.active === undefined ? existing.active !== false : Boolean(body.active), updatedAt: new Date().toISOString() };
    await kv.set(`product:${id}`, product);
    return c.json({ product });
  } catch (error) {
    return failure(c, error);
  }
});

app.delete(`${route}/admin/products/:id`, async (c) => {
  try {
    const profile = await actor(c);
    requireAdmin(profile);
    const id = c.req.param("id");
    const existing = await kv.get(`product:${id}`);
    if (!existing) return c.json({ error: "Produto não encontrado." }, 404);
    await kv.del(`product:${id}`);
    return c.json({ success: true, id });
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
      ["received", "preparing", "ready", "delivery"].includes(order.status),
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
    const statuses = ["received", "preparing", "ready", "delivery", "completed", "cancelled"];
    if (!statuses.includes(body.status)) return c.json({ error: "Estado inválido." }, 400);
    const now = new Date().toISOString();
    const updated = {
      ...order,
      status: body.status,
      preparationStartedAt: body.status === "preparing" && !order.preparationStartedAt ? now : order.preparationStartedAt,
      preparationMinutes: Number(body.preparationMinutes || order.preparationMinutes || 30),
      readyAt: body.status === "ready" ? now : order.readyAt,
      updatedAt: now,
    };
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
    if (body.status === "ready" && !order.driverId) {
      const drivers = (await kv.getByPrefix("profile:")).filter((item: any) => item.role === "driver");
      await Promise.all(drivers.map((driver: any) => {
        const driverNotificationId = crypto.randomUUID();
        return kv.set(`notification:${driver.id}:${driverNotificationId}`, {
          id: driverNotificationId,
          title: "Nova entrega disponível",
          message: `Pedido #${order.id.slice(0, 8).toUpperCase()} está pronto para recolha.`,
          type: "delivery",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }));
    }
    return c.json({ order: updated });
  } catch (error) {
    return failure(c, error);
  }
});

app.put(`${route}/admin/orders/:id/driver`, async (c) => {
  try {
    const admin = await actor(c);
    requireAdmin(admin);
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    const body = await c.req.json();
    const driverId = String(body.driverId || "").trim();
    if (!driverId) return c.json({ error: "Selecione um entregador." }, 400);
    const driver = await kv.get(`profile:${driverId}`);
    if (!driver || driver.role !== "driver") {
      return c.json({ error: "O utilizador seleccionado não é um entregador." }, 400);
    }
    if (["completed", "cancelled"].includes(order.status)) {
      return c.json({ error: "Não é possível atribuir um pedido concluído ou cancelado." }, 400);
    }
    const now = new Date().toISOString();
    const updated = {
      ...order,
      driverId,
      driverName: driver.name,
      driverPhone: driver.phone || "",
      deliveryStage: null,
      assignmentStatus: "pending",
      assignmentExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      assignmentDecidedAt: null,
      etaMinutes: null,
      etaSetAt: null,
      status: order.status,
      assignedAt: now,
      updatedAt: now,
    };
    await kv.set(`order:${id}`, updated);
    const notificationId = crypto.randomUUID();
    await kv.set(`notification:${order.userId}:${notificationId}`, {
      id: notificationId,
      title: "Entregador atribuído",
      message: `${driver.name} foi atribuído ao seu pedido.`,
      type: "delivery",
      read: false,
      createdAt: now,
    });
    await kv.set(`notification:${driverId}:${notificationId}`, {
      id: notificationId,
      title: "Nova entrega atribuída",
      message: `Foi-lhe atribuído o pedido #${id.slice(0, 8).toUpperCase()}.`,
      type: "delivery",
      read: false,
      createdAt: now,
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
          : existing?.role === "admin" || existing?.role === "driver"
            ? existing.role
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
    const targetId = c.req.param("id");
    const body = await c.req.json();
    if (!["customer", "driver", "admin"].includes(body.role)) {
      return c.json({ error: "Função inválida." }, 400);
    }
    let target = await kv.get(`profile:${targetId}`);
    if (!target) {
      const authUser = (await allAuthUsers()).find((item: any) => item.id === targetId);
      if (!authUser?.email) return c.json({ error: "Utilizador não encontrado." }, 404);
      const email = String(authUser.email).toLowerCase();
      target = {
        id: authUser.id,
        email,
        name: authUser.user_metadata?.name || email.split("@")[0] || "Utilizador",
        phone: authUser.user_metadata?.phone || "",
        role: superAdminEmails.has(email) ? "super_admin" : "customer",
        marketingOptIn: true,
        createdAt: authUser.created_at,
      };
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

    let recipientCount = 0;
    if (body.sendNow) {
      // Use Auth as the source of truth, and stored profiles for marketing preferences.
      const [authUsers, storedProfiles] = await Promise.all([
        allAuthUsers(),
        kv.getByPrefix("profile:"),
      ]);
      const profilesById = new Map(storedProfiles.map((item: any) => [item.id, item]));
      const recipients = authUsers.filter((user: any) => {
        const email = String(user.email || "").toLowerCase();
        if (!email || superAdminEmails.has(email)) return false;
        const stored: any = profilesById.get(user.id);
        return campaign.audience === "all" || stored?.marketingOptIn !== false;
      });
      const results = await Promise.allSettled(
        recipients.map((user: any) =>
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
      recipientCount = results.filter((result) => result.status === "fulfilled").length;
      if (recipientCount === 0 && recipients.length > 0) {
        throw new Error("Não foi possível criar notificações para os destinatários.");
      }
      await kv.set(`campaign:${id}`, { ...campaign, recipientCount, status: "sent" });
    }
    return c.json({ campaign: { ...campaign, recipientCount } }, 201);
  } catch (error) {
    return failure(c, error);
  }
});


async function expireDriverAssignments() {
  const nowMs = Date.now();
  const orders = await kv.getByPrefix("order:");
  for (const order of orders as any[]) {
    if (order.etaDueAt && Date.parse(order.etaDueAt) <= nowMs && !["completed", "cancelled"].includes(order.status) && !order.isLate) {
      const lateOrder = { ...order, isLate: true, lateDetectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await kv.set(`order:${order.id}`, lateOrder);
      if (order.driverId) await kv.set(`driver-reputation-event:${order.driverId}:${crypto.randomUUID()}`, { driverId: order.driverId, orderId: order.id, type: "late_delivery", penalty: 0.25, at: new Date().toISOString(), reason: "Estimativa ultrapassada" });
    }
    if (order.assignmentStatus === "pending" && order.assignmentExpiresAt && Date.parse(order.assignmentExpiresAt) <= nowMs) {
      const now = new Date().toISOString();
      const expired = {
        ...order,
        driverId: null, driverName: null, driverPhone: null,
        assignmentStatus: "expired", assignmentExpiredAt: now,
        assignmentExpiresAt: null, deliveryStage: null,
        reputationEvents: [...(order.reputationEvents || []), { type: "assignment_expired", driverId: order.driverId, at: now, penalty: 1 }],
        updatedAt: now,
      };
      await kv.set(`order:${order.id}`, expired);
      const driverId = order.driverId;
      const eventId = crypto.randomUUID();
      await kv.set(`driver-reputation-event:${driverId}:${eventId}`, { id: eventId, driverId, orderId: order.id, type: "assignment_expired", penalty: 1, at: now, reason: "Prazo de aceitação expirado" });
      const drivers = (await kv.getByPrefix("profile:")).filter((p: any) => p.role === "driver" && p.id !== driverId);
      await Promise.all(drivers.map((driver: any) => kv.set(`notification:${driver.id}:${crypto.randomUUID()}`, {
        id: crypto.randomUUID(), title: "Entrega disponível", message: `Pedido #${String(order.id).slice(0, 8).toUpperCase()} voltou a ficar disponível.`, type: "delivery", read: false, createdAt: now,
      })));
      await kv.set(`notification:${order.userId}:${crypto.randomUUID()}`, {
        id: crypto.randomUUID(), title: "A procurar outro entregador", message: "O prazo de aceitação terminou. Estamos a procurar outro entregador.", type: "delivery", read: false, createdAt: now,
      });
    }
  }
}

app.post(`${route}/internal/expire-assignments`, async (c) => {
  const secret = Deno.env.get("ASSIGNMENT_CRON_SECRET");
  if (!secret || c.req.header("x-cron-secret") !== secret) return c.json({ error: "Acesso não autorizado." }, 401);
  try {
    await expireDriverAssignments();
    return c.json({ success: true, checkedAt: new Date().toISOString() });
  } catch (error) { return failure(c, error); }
});

app.get(`${route}/driver/orders`, async (c) => {
  try {
    const profile = await actor(c);
    if (!["driver", "admin", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
    await expireDriverAssignments();
    const orders = (await kv.getByPrefix("order:")).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return c.json({
      available: orders.filter((item: any) => item.status === "ready" && !item.driverId),
      assigned: orders.filter((item: any) =>
        ["admin", "super_admin"].includes(profile.role)
          ? item.driverId && !["completed", "cancelled"].includes(item.status)
          : item.driverId === profile.id && !["completed", "cancelled"].includes(item.status),
      ),
      completed: orders.filter((item: any) => item.status === "completed" && (["admin", "super_admin"].includes(profile.role) || item.driverId === profile.id)).slice(0, 30),
    });
  } catch (error) { return failure(c, error); }
});

app.post(`${route}/driver/orders/:id/claim`, async (c) => {
  try {
    const profile = await actor(c);
    if (!["driver", "admin", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    if (order.driverId && order.driverId !== profile.id) return c.json({ error: "Entrega já atribuída." }, 409);
    if (order.status !== "ready") return c.json({ error: "Pedido ainda não está pronto." }, 400);
    const now = new Date().toISOString();
    const updated = { ...order, driverId: profile.id, driverName: profile.name, driverPhone: profile.phone || "", deliveryStage: null, assignmentStatus: "pending", assignmentExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), assignedAt: now, updatedAt: now };
    await kv.set(`order:${id}`, updated);
    await kv.set(`notification:${profile.id}:${crypto.randomUUID()}`, { id: crypto.randomUUID(), title: "Confirme a entrega em 5 minutos", message: `Pedido #${id.slice(0,8).toUpperCase()}: aceite, rejeite ou peça uma referência antes do prazo.`, type: "delivery", read: false, createdAt: now });
    return c.json({ order: updated });
  } catch (error) { return failure(c, error); }
});

app.post(`${route}/driver/orders/:id/decision`, async (c) => {
  try {
    const profile = await actor(c);
    if (!["driver", "admin", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    if (order.driverId !== profile.id && !["admin", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
    if (order.assignmentStatus !== "pending" || !order.assignmentExpiresAt || Date.parse(order.assignmentExpiresAt) <= Date.now()) {
      await expireDriverAssignments();
      return c.json({ error: "O prazo de aceitação terminou ou a atribuição já foi decidida." }, 409);
    }
    const body = await c.req.json();
    const decision = String(body.decision || "");
    const now = new Date().toISOString();
    if (decision === "reference") {
      const referenceRequest = String(body.reference || "").trim().slice(0, 240);
      const updated = { ...order, referenceRequest: referenceRequest || "Solicita um ponto de referência adicional", referenceRequestedAt: now, updatedAt: now };
      await kv.set(`order:${id}`, updated);
      await kv.set(`notification:${order.userId}:${crypto.randomUUID()}`, { id: crypto.randomUUID(), title: "Entregador pediu uma referência", message: updated.referenceRequest, type: "delivery", read: false, createdAt: now });
      return c.json({ order: updated });
    }
    if (decision === "reject") {
      const reason = String(body.reason || "").trim().slice(0, 300);
      await kv.set(`driver-reputation-event:${profile.id}:${crypto.randomUUID()}`, { driverId: profile.id, orderId: id, type: "explicit_rejection", penalty: 0.5, reason, at: now });
      const updated = { ...order, driverId: null, driverName: null, driverPhone: null, assignmentStatus: "rejected", assignmentRejectedAt: now, assignmentExpiresAt: null, rejectionReason: reason, deliveryStage: null, updatedAt: now };
      await kv.set(`order:${id}`, updated);
      await kv.set(`notification:${order.userId}:${crypto.randomUUID()}`, { id: crypto.randomUUID(), title: "A procurar outro entregador", message: "O entregador não pôde aceitar a entrega. Estamos a procurar outro entregador.", type: "delivery", read: false, createdAt: now });
      return c.json({ order: updated });
    }
    if (decision === "accept") {
      const updated = { ...order, assignmentStatus: "accepted", assignmentDecidedAt: now, assignmentExpiresAt: null, deliveryStage: "accepted", status: "delivery", updatedAt: now };
      await kv.set(`order:${id}`, updated);
      await kv.set(`notification:${order.userId}:${crypto.randomUUID()}`, { id: crypto.randomUUID(), title: "Entregador confirmou", message: `${profile.name} aceitou a entrega. A estimativa será actualizada em breve.`, type: "delivery", read: false, createdAt: now });
      return c.json({ order: updated });
    }
    return c.json({ error: "Decisão inválida." }, 400);
  } catch (error) { return failure(c, error); }
});

app.put(`${route}/driver/orders/:id/eta`, async (c) => {
  try {
    const profile = await actor(c);
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    if (profile.role === "driver" && order.driverId !== profile.id) throw new Error("FORBIDDEN");
    if (order.assignmentStatus !== "accepted") return c.json({ error: "Aceite a atribuição antes de definir a estimativa." }, 400);
    const body = await c.req.json();
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) return c.json({ error: "A estimativa deve estar entre 5 e 180 minutos." }, 400);
    const now = new Date().toISOString();
    const updated = { ...order, etaMinutes: minutes, etaSetAt: now, etaDueAt: new Date(Date.now() + minutes * 60000).toISOString(), updatedAt: now };
    await kv.set(`order:${id}`, updated);
    await kv.set(`notification:${order.userId}:${crypto.randomUUID()}`, { id: crypto.randomUUID(), title: "Estimativa de entrega actualizada", message: `O entregador estima chegar em cerca de ${minutes} minutos.`, type: "delivery", read: false, createdAt: now });
    return c.json({ order: updated });
  } catch (error) { return failure(c, error); }
});

app.put(`${route}/driver/orders/:id/stage`, async (c) => {
  try {
    const profile = await actor(c);
    if (!["driver", "admin", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Pedido não encontrado." }, 404);
    if (profile.role === "driver" && order.driverId !== profile.id) throw new Error("FORBIDDEN");
    const { stage } = await c.req.json();
    const allowedStages = ["accepted", "picked_up", "arriving", "delivered"];
    if (!allowedStages.includes(stage)) return c.json({ error: "Etapa inválida." }, 400);
    if (stage !== "accepted" && !order.driverId) return c.json({ error: "Entrega sem entregador atribuído." }, 400);
    const labels: Record<string, string> = {
      accepted: "O entregador aceitou a entrega.",
      picked_up: "O pedido foi recolhido e está a caminho.",
      arriving: "O entregador está próximo do endereço.",
      delivered: "Pedido entregue. Bom apetite!",
    };
    const status = stage === "delivered" ? "completed" : stage === "accepted" ? "ready" : "delivery";
    const now = new Date().toISOString();
    const updated = { ...order, deliveryStage: stage, status, updatedAt: now };
    await kv.set(`order:${id}`, updated);
    const notificationId = crypto.randomUUID();
    await kv.set(`notification:${order.userId}:${notificationId}`, {
      id: notificationId, title: "Atualização da entrega", message: labels[stage],
      type: "delivery", read: false, createdAt: now,
    });
    return c.json({ order: updated });
  } catch (error) {
    return failure(c, error);
  }
});

Deno.serve(app.fetch);
