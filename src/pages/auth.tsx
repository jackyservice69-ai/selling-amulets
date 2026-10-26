import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth, useData, send, ApiError } from "../api";
import { Button, Field, PasswordField, FormMessage, State } from "../components/ui";
import type { User, Settings } from "../types";

export function AuthPage({ register = false }: { register?: boolean }) {
  const [params] = useSearchParams(), navigate = useNavigate(), { accept } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null);
  const site = useData<Settings>("/settings");
  const closed = site.data?.registrationEnabled === false;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || (register && (closed || site.loading || site.error))) return;
    setError(null); setBusy(true);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await send<{ user: User; csrf: string }>(register ? "/auth/register" : "/auth/login", form);
      accept(result);
      const next = params.get("next");
      navigate(next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard");
    } catch (e) { setError(e); if (register && e instanceof ApiError && e.status === 403) site.reload(); } finally { setBusy(false); }
  }
  return <div className="container auth-page">
    <div className="auth-story">
      <span className="eyebrow">ร่วมเป็นส่วนหนึ่งของชุมชน</span>
      <h1>พื้นที่ของคนที่เห็น<br />คุณค่าในสิ่งเดียวกัน</h1>
      <img src="/brand/hero.webp" alt="ภาพพระเครื่องประกอบเพื่อสาธิต" width="480" height="420" />
      <p><ShieldCheck size={19} /> ตรวจประกาศก่อนเผยแพร่ · เปิดร้านได้ฟรี</p>
    </div>
    <div className="auth-form panel">
      <span className="eyebrow">THAI AMULET MARKET</span>
      <h2>{register ? closed ? "ปิดรับสมัครสมาชิกชั่วคราว" : "สมัครสมาชิก" : "ยินดีต้อนรับกลับมา"}</h2>
      <p className="muted">{register ? closed ? "กรุณากลับมาสมัครอีกครั้งภายหลัง สมาชิกเดิมยังเข้าสู่ระบบได้ตามปกติ" : "ตั้งชื่อผู้ใช้และรหัสผ่านเพื่อเปิดร้านของคุณ" : "เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านของคุณ"}</p>
      {register && (site.loading || site.error) ? <State loading={site.loading} error={site.error} retry={site.reload} /> : register && closed ? <p><Link className="text-link" to="/contact">ติดต่อผู้ดูแล</Link></p> : <form noValidate onSubmit={e => void submit(e)}>
        {register && <Field label="ชื่อที่ใช้แสดง" name="displayName" required autoComplete="name" />}
        <Field label="ชื่อผู้ใช้" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40} hint={register ? "ตัวอักษรอังกฤษ ตัวเลข _ @ . หรือ - จำนวน 3–40 ตัว" : undefined} />
        <PasswordField name="password" required autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : undefined} />
        {register && <>
          <p className="muted small">รหัสผ่านอย่างน้อย 8 ตัวอักษร</p>
          <Field label="รหัสแนะนำเพื่อน (ถ้ามี)" name="ref" defaultValue={params.get("ref") ?? ""} />
          <p className="small">สมัครสมาชิกเพื่อใช้พื้นที่ลงประกาศ กรุณาอ่าน <Link className="text-link" to="/privacy">ข้อมูลความเป็นส่วนตัว</Link></p>
        </>}
        {!register && <Link className="forgot-link" to="/contact">ลืมรหัสผ่าน? ติดต่อผู้ดูแล</Link>}
        <FormMessage error={error} />
        <Button type="submit" busy={busy} className="full">{register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}<ArrowRight size={17} /></Button>
      </form>}
      <p className="auth-alternate">{register ? <>มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link></> : closed ? "ขณะนี้ปิดรับสมัครสมาชิกใหม่" : <>ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิกฟรี</Link></>}</p>
    </div>
  </div>;
}
