export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";

export const MESSAGES = {
  th: {
    "nav.home": "หน้าหลัก",
    "nav.account": "บัญชี",
    "nav.tasks": "งานของฉัน",
    "nav.quiz": "แบบทดสอบ",
    "nav.admin": "แดชบอร์ดแอดมิน",
    "theme.label": "ธีม",
    "theme.system": "ตามระบบ",
    "theme.light": "สว่าง",
    "theme.dark": "มืด",
    "locale.label": "ภาษา",
    "account.title": "บัญชีผู้ใช้",
    "account.email": "อีเมล",
    "account.password": "รหัสผ่าน",
    "account.displayName": "ชื่อที่แสดง",
    "account.register": "สมัครสมาชิก",
    "account.login": "เข้าสู่ระบบ",
    "account.logout": "ออกจากระบบ",
    "tasks.title": "งานของฉัน",
    "tasks.search": "ค้นหางาน",
    "tasks.filter": "สถานะ",
    "tasks.all": "ทั้งหมด",
    "tasks.add": "เพิ่มงาน",
    "tasks.empty": "ยังไม่มีงาน",
    "tasks.live": "อัปเดตแบบเรียลไทม์",
    "tasks.upload": "อัปโหลดไฟล์",
    "quiz.title": "แบบทดสอบ",
    "quiz.submit": "ส่งคำตอบ",
    "quiz.score": "คะแนน",
    "admin.title": "แดชบอร์ดแอดมิน",
    "admin.users": "ผู้ใช้ทั้งหมด",
    "admin.tasks": "งานทั้งหมด",
    "admin.done": "งานที่เสร็จแล้ว",
    "admin.export": "ดาวน์โหลดรายงาน CSV",
    "common.loading": "กำลังโหลด...",
    "common.error": "เกิดข้อผิดพลาด",
  },
  en: {
    "nav.home": "Home",
    "nav.account": "Account",
    "nav.tasks": "My tasks",
    "nav.quiz": "Quiz",
    "nav.admin": "Admin dashboard",
    "theme.label": "Theme",
    "theme.system": "System",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "locale.label": "Language",
    "account.title": "Account",
    "account.email": "Email",
    "account.password": "Password",
    "account.displayName": "Display name",
    "account.register": "Register",
    "account.login": "Log in",
    "account.logout": "Log out",
    "tasks.title": "My tasks",
    "tasks.search": "Search tasks",
    "tasks.filter": "Status",
    "tasks.all": "All",
    "tasks.add": "Add task",
    "tasks.empty": "No tasks yet",
    "tasks.live": "Live updates",
    "tasks.upload": "Upload a file",
    "quiz.title": "Quiz",
    "quiz.submit": "Submit answers",
    "quiz.score": "Score",
    "admin.title": "Admin dashboard",
    "admin.users": "Total users",
    "admin.tasks": "Total tasks",
    "admin.done": "Tasks done",
    "admin.export": "Download CSV report",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["th"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key];
}
