// setup — إنشاء أول مدير للنظام (يعمل فقط طالما لا يوجد أي مستخدم). verify_jwt = false
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_DOMAIN = "phone.projectserp.app";

function normPhone(v: string) {
  let d = String(v || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const { count, error: cntErr } = await admin.from("app_users").select("id", { count: "exact", head: true });
  if (cntErr) return json({ error: "failed", message: "تعذّر الاتصال بقاعدة البيانات" }, 500);
  const needsSetup = (count ?? 0) === 0;

  if (body.action === "status") return json({ needs_setup: needsSetup });
  if (body.action !== "create") return json({ error: "unknown_action" }, 400);
  if (!needsSetup) return json({ error: "already_setup", message: "تم إعداد النظام من قبل. سجّل الدخول." }, 403);

  const phone = normPhone(body.phone);
  const password = String(body.password || "");
  const name = String(body.full_name || "").trim();
  if (phone.length < 8 || phone.length > 15) return json({ error: "invalid_phone", message: "رقم الهاتف غير صحيح" }, 400);
  if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);
  if (name.length < 2) return json({ error: "invalid_name", message: "اكتب اسمك" }, 400);

  const { data: c, error: cErr } = await admin.auth.admin.createUser({
    email: `p${phone}@${EMAIL_DOMAIN}`, password, email_confirm: true, user_metadata: { phone, full_name: name },
  });
  if (cErr || !c?.user) return json({ error: "create_failed", message: "تعذّر إنشاء الحساب" }, 400);

  // الـ trigger جعله admin مفعّلاً لأنه أول مستخدم؛ نتأكد ونكمل بياناته
  const { data: row } = await admin.from("app_users").select("role,active").eq("id", c.user.id).maybeSingle();
  if (!row || row.role !== "admin" || !row.active) {
    await admin.auth.admin.deleteUser(c.user.id);
    return json({ error: "already_setup", message: "تم إعداد النظام من قبل. سجّل الدخول." }, 409);
  }
  await admin.from("app_users").update({ phone, name }).eq("id", c.user.id);
  return json({ ok: true });
});
