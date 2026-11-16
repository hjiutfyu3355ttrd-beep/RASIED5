// إعدادات التطبيق — نظام إدارة المشاريع والتشطيبات
// مفتاح anon (العام) آمن للنشر في الواجهة: الحماية الفعلية عبر RLS + تسجيل الدخول.
// لتشغيل وضع Demo محلي (بدون Supabase) احذف السطرين SUPABASE_URL و SUPABASE_ANON_KEY.
window.APP_CONFIG = {
  SUPABASE_URL: "https://lcbqyifyvbvgsroxghzp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjYnF5aWZ5dmJ2Z3Nyb3hnaHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjE2MzgsImV4cCI6MjExMDMzNzYzOH0.3yg9cy9594BnVRe01g1UYJh7LvlX6zcH5GIFEnpTb7M",
  APP_NAME: "نظام إدارة المشاريع والتشطيبات",
  APP_VERSION: "0.3.0",
  // نطاق البريد الداخلي الذي يُبنى من رقم الهاتف (يجب أن يطابق الـ Edge Functions)
  PHONE_EMAIL_DOMAIN: "phone.projectserp.app",
  // رقم واتساب للدعم يظهر في «نسيت كلمة المرور» (اختياري، بكود الدولة)
  SUPPORT_WHATSAPP: "",
  VAPID_PUBLIC: "",
  LS_KEY: "project_demo_v1"
};
