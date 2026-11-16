// staff — إدارة المستخدمين (للمدير فقط). verify_jwt = true
// actions: list · create · update · reset_password · delete
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_DOMAIN = "phone.projectserp.app";
const ROLES = ["admin", "staff", "viewer"];

function normPhone(v: string) {
  let d = String(v || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}
const cleanPerms = (p: unknown) =>
  Array.isArray(p) ? [...new Set(p.filter((x) => typeof x === "string" && /^[a-z:-]{2,40}$/.test(x)))].slice(0, 80) : [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // هوية المتصل + التأكد أنه مدير مفعّل
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized", message: "سجّل الدخول أولاً" }, 401);
  const { data: me } = await admin.from("app_users").select("id,role,active").eq("id", u.user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) return json({ error: "forbidden", message: "هذه العملية للمدير فقط" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = String(body.action || "");

  // عدد المديرين المفعّلين غير المستخدم المستهدف (لمنع قفل النظام)
  async function otherActiveAdmins(exceptId: string) {
    const { count } = await admin.from("app_users").select("id", { count: "exact", head: true })
      .eq("role", "admin").eq("active", true).neq("id", exceptId);
    return count ?? 0;
  }
  async function target(id: string) {
    const { data } = await admin.from("app_users").select("id,role,active").eq("id", id).maybeSingle();
    return data;
  }

  if (action === "list") {
    const { data: users, error } = await admin.from("app_users").select("*").order("created_at", { ascending: false });
    if (error) return json({ error: "failed", message: "تعذّر تحميل المستخدمين" }, 500);
    const { data: days } = await admin.from("activity_days").select("user_id");
    const used: Record<string, number> = {};
    (days || []).forEach((d: any) => { used[d.user_id] = (used[d.user_id] || 0) + 1; });
    const emails: Record<string, string> = {};
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    (list?.users || []).forEach((x: any) => { emails[x.id] = x.email; });
    return json({ users: (users || []).map((x: any) => ({ ...x, days_used: used[x.id] || 0, email: emails[x.id] || null })) });
  }

  if (action === "create") {
    const phone = normPhone(body.phone);
    const password = String(body.password || "");
    const name = String(body.full_name || "").trim();
    const role = String(body.role || "staff");
    if (phone.length < 8 || phone.length > 15) return json({ error: "invalid_phone", message: "رقم الهاتف غير صحيح" }, 400);
    if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);
    if (name.length < 2) return json({ error: "invalid_name", message: "اكتب اسم المستخدم" }, 400);
    if (!ROLES.includes(role)) return json({ error: "invalid_role", message: "الدور غير صحيح" }, 400);

    const { data: c, error: cErr } = await admin.auth.admin.createUser({
      email: `p${phone}@${EMAIL_DOMAIN}`, password, email_confirm: true, user_metadata: { phone, full_name: name },
    });
    if (cErr || !c?.user) {
      const dup = /already|registered|exists/i.test(cErr?.message || "");
      return json({ error: dup ? "phone_exists" : "create_failed", message: dup ? "هذا الرقم مسجّل بالفعل" : "تعذّر إنشاء الحساب" }, dup ? 409 : 400);
    }
    // الـ trigger أنشأ صفاً غير مفعّل؛ نكمله ونفعّله
    const { error: uErr } = await admin.from("app_users").upsert({
      id: c.user.id, phone, name, role, active: true, status_note: null,
      permissions: cleanPerms(body.permissions), created_by: me.id,
    });
    if (uErr) { await admin.auth.admin.deleteUser(c.user.id); return json({ error: "create_failed", message: "تعذّر إنشاء الحساب" }, 400); }
    return json({ ok: true });
  }

  if (action === "update") {
    const id = String(body.user_id || "");
    const t = await target(id);
    if (!t) return json({ error: "not_found", message: "المستخدم غير موجود" }, 404);
    const role = body.role === undefined ? t.role : String(body.role);
    const active = body.active === undefined ? t.active : !!body.active;
    if (!ROLES.includes(role)) return json({ error: "invalid_role", message: "الدور غير صحيح" }, 400);
    if (id === me.id && (role !== "admin" || !active)) return json({ error: "self", message: "لا يمكنك تغيير دورك أو إيقاف حسابك" }, 400);
    if (t.role === "admin" && (role !== "admin" || !active) && (await otherActiveAdmins(id)) < 1)
      return json({ error: "last_admin", message: "لا يمكن إزالة آخر مدير مفعّل" }, 400);
    const patch: Record<string, unknown> = { role, active, status_note: active ? null : (String(body.status_note || "").slice(0, 200) || null) };
    if (body.full_name !== undefined && String(body.full_name).trim().length >= 2) patch.name = String(body.full_name).trim();
    if (body.permissions !== undefined) patch.permissions = cleanPerms(body.permissions);
    const { error } = await admin.from("app_users").update(patch).eq("id", id);
    return error ? json({ error: "failed", message: "تعذّر الحفظ" }, 400) : json({ ok: true });
  }

  if (action === "reset_password" || action === "delete") {
    const id = String(body.user_id || "");
    const t = await target(id);
    if (!t) return json({ error: "not_found", message: "المستخدم غير موجود" }, 404);
    if (action === "delete") {
      if (id === me.id) return json({ error: "self", message: "لا يمكنك حذف حسابك" }, 400);
      if (t.role === "admin" && t.active && (await otherActiveAdmins(id)) < 1)
        return json({ error: "last_admin", message: "لا يمكن حذف آخر مدير مفعّل" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      return error ? json({ error: "failed", message: "تعذّر الحذف" }, 400) : json({ ok: true });
    }
    const password = String(body.password || "");
    if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    return error ? json({ error: "failed", message: "تعذّر تغيير كلمة المرور" }, 400) : json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
