// register — تسجيل حساب جديد = شركة جديدة بمالك. أول حساب في المنصة يصبح مدير المنصة. verify_jwt = false
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

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const phone = normPhone(body.phone);
  const password = String(body.password || "");
  const name = String(body.full_name || "").trim().slice(0, 80);
  const company = String(body.company_name || "").trim().slice(0, 120);
  if (name.length < 2) return json({ error: "invalid_name", message: "اكتب اسمك" }, 400);
  if (company.length < 2) return json({ error: "invalid_company", message: "اكتب اسم الشركة" }, 400);
  if (phone.length < 8 || phone.length > 15) return json({ error: "invalid_phone", message: "رقم الهاتف غير صحيح" }, 400);
  if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: c, error: cErr } = await admin.auth.admin.createUser({
    email: `p${phone}@${EMAIL_DOMAIN}`, password, email_confirm: true, user_metadata: { phone, full_name: name },
  });
  if (cErr || !c?.user) {
    const dup = /already|registered|exists/i.test(cErr?.message || "");
    return json({ error: dup ? "phone_exists" : "create_failed", message: dup ? "هذا الرقم مسجّل بالفعل" : "تعذّر إنشاء الحساب" }, dup ? 409 : 400);
  }
  const { error: rErr } = await admin.rpc("create_account", { p_uid: c.user.id, p_phone: phone, p_name: name, p_company: company });
  if (rErr) {
    await admin.auth.admin.deleteUser(c.user.id);
    return json({ error: "create_failed", message: "تعذّر إنشاء الحساب" }, 400);
  }
  return json({ ok: true });
});
