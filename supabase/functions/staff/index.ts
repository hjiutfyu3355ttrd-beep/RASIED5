// staff — مالك الشركة يدير موظفي شركته فقط. verify_jwt = true
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
const ROLES = ["staff", "viewer"];

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

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized", message: "سجّل الدخول أولاً" }, 401);
  const { data: me } = await admin.from("app_users").select("id,role,active,company_id").eq("id", u.user.id).maybeSingle();
  if (!me || me.role !== "owner" || !me.active) return json({ error: "forbidden", message: "هذه العملية لمالك الشركة فقط" }, 403);
  const { data: co } = await admin.from("companies").select("status").eq("id", me.company_id).maybeSingle();
  if (!co || co.status !== "active") return json({ error: "forbidden", message: "الشركة موقوفة" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = String(body.action || "");

  // المستخدم المستهدف يجب أن يكون موظفاً (غير مالك) في نفس الشركة
  async function target(id: string) {
    const { data } = await admin.from("app_users").select("id,role,active,company_id").eq("id", id).maybeSingle();
    return data && data.company_id === me.company_id && data.role !== "owner" ? data : null;
  }

  if (action === "list") {
    const { data: users, error } = await admin.from("app_users").select("*").eq("company_id", me.company_id).order("created_at", { ascending: false });
    if (error) return json({ error: "failed", message: "تعذّر تحميل المستخدمين" }, 500);
    const ids = (users || []).map((x: any) => x.id);
    const { data: days } = await admin.from("activity_days").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const used: Record<string, number> = {};
    (days || []).forEach((d: any) => { used[d.user_id] = (used[d.user_id] || 0) + 1; });
    return json({ users: (users || []).map((x: any) => ({ ...x, days_used: used[x.id] || 0 })) });
  }

  if (action === "create") {
    const phone = normPhone(body.phone);
    const password = String(body.password || "");
    const name = String(body.full_name || "").trim().slice(0, 80);
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
    const { error: rErr } = await admin.rpc("create_staff", {
      p_uid: c.user.id, p_company: me.company_id, p_phone: phone, p_name: name, p_role: role, p_perms: cleanPerms(body.permissions), p_by: me.id,
    });
    if (rErr) { await admin.auth.admin.deleteUser(c.user.id); return json({ error: "create_failed", message: "تعذّر إنشاء الحساب" }, 400); }
    return json({ ok: true });
  }

  if (action === "update" || action === "reset_password" || action === "delete") {
    const id = String(body.user_id || "");
    const t = await target(id);
    if (!t) return json({ error: "not_found", message: "المستخدم غير موجود" }, 404);

    if (action === "update") {
      const role = body.role === undefined ? undefined : String(body.role);
      if (role !== undefined && !ROLES.includes(role)) return json({ error: "invalid_role", message: "الدور غير صحيح" }, 400);
      const active = body.active === undefined ? t.active : !!body.active;
      const patch: Record<string, unknown> = { active, status_note: active ? null : (String(body.status_note || "").slice(0, 200) || null) };
      if (role !== undefined) patch.role = role;
      if (body.full_name !== undefined && String(body.full_name).trim().length >= 2) patch.name = String(body.full_name).trim().slice(0, 80);
      if (body.permissions !== undefined) patch.permissions = cleanPerms(body.permissions);
      const { error } = await admin.from("app_users").update(patch).eq("id", id);
      return error ? json({ error: "failed", message: "تعذّر الحفظ" }, 400) : json({ ok: true });
    }
    if (action === "delete") {
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
