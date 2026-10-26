import { useState } from "react";
import { useAuth, useData, send } from "../api";
import { Button, Field, PasswordField, Select, Textarea, Modal, FormMessage, State, useToast } from "../components/ui";
import type { Settings } from "../types";

export function CreateUserDialog({open,onOpenChange,onCreated}:{open:boolean;onOpenChange:(open:boolean)=>void;onCreated:()=>void}) {
  return <Modal open={open} onOpenChange={onOpenChange} title="เพิ่มสมาชิกจากหลังบ้าน">
    {open && <CreateUserForm onCreated={()=>{onOpenChange(false);onCreated();}} />}
  </Modal>;
}
function CreateUserForm({onCreated}:{onCreated:()=>void}) {
  const {user}=useAuth(),toast=useToast();
  const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
  const [role,setRole]=useState("MEMBER");
  return <form noValidate onSubmit={async e=>{
    e.preventDefault();if(busy)return;setError(null);setBusy(true);
    const data=Object.fromEntries(new FormData(e.currentTarget));
    try{await send("/admin/users",{...data,role});toast("สร้างบัญชีสมาชิกแล้ว");onCreated();}catch(err){setError(err);}finally{setBusy(false);}
  }}>
    <Field label="ชื่อที่ใช้แสดง" name="displayName" autoComplete="name" required disabled={busy} />
    <Field label="ชื่อผู้ใช้ใหม่" name="username" autoComplete="off" spellCheck={false} autoCapitalize="none" required maxLength={40} disabled={busy} />
    <PasswordField label="รหัสผ่านสมาชิกใหม่" name="password" autoComplete="new-password" minLength={8} required disabled={busy} />
    <PasswordField label="ยืนยันรหัสผ่านสมาชิกใหม่" name="confirmPassword" autoComplete="new-password" required disabled={busy} />
    <Select label="สิทธิ์บัญชีใหม่" value={role} disabled={busy || user?.role !== "SUPER_ADMIN"} onChange={e=>setRole(e.target.value)}>
      <option value="MEMBER">สมาชิก</option>{user?.role === "SUPER_ADMIN" && <><option value="MODERATOR">ผู้ตรวจสอบ</option><option value="ADMIN">ผู้ดูแล</option><option value="SUPER_ADMIN">ผู้ดูแลสูงสุด</option></>}
    </Select>
    <Textarea label="เหตุผลการสร้างบัญชี" name="reason" required minLength={5} maxLength={1000} disabled={busy} />
    <PasswordField label="รหัสผ่านของผู้ดูแล" name="currentPassword" autoComplete="current-password" required disabled={busy} />
    <p className="muted">ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร ส่งข้อมูลเข้าสู่ระบบให้เจ้าของบัญชีผ่านช่องทางที่คุณตกลงไว้</p>
    <FormMessage error={error} /><Button type="submit" busy={busy}>สร้างบัญชีสมาชิก</Button>
  </form>;
}
export function AdminSocial() {
  const {user}=useAuth();
  const data=useData<Settings>(user && ["ADMIN","SUPER_ADMIN"].includes(user.role) ? "/settings" : null);
  if(!user || !["ADMIN","SUPER_ADMIN"].includes(user.role))return <div className="empty"><h1>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1></div>;
  return <><h1>ตั้งค่าช่องทาง Social</h1><p>ช่องทางที่เปิดใช้จะแสดงในหน้าติดต่อเราและท้ายเว็บไซต์</p><State {...data} retry={data.reload}>{data.data && <SocialForm initial={data.data.socialLinks} />}</State></>;
}
function SocialForm({initial}:{initial:Settings["socialLinks"]}) {
  const [links,setLinks]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
  const toast=useToast();
  const change=(id:string,patch:Partial<Settings["socialLinks"][number]>)=>setLinks(v=>v.map(s=>s.id===id?{...s,...patch}:s));
  return <form className="panel editor-form" noValidate onSubmit={async e=>{
    e.preventDefault();if(busy)return;setBusy(true);setError(null);
    try{await send("/admin/social",{socialLinks:links},"PUT");toast("บันทึกช่องทาง Social แล้ว");}catch(err){setError(err);}finally{setBusy(false);}
  }}>
    {!links.length && <p>ยังไม่มีช่องทาง Social กดเพิ่มช่องทางเพื่อเริ่มต้น</p>}
    {links.map((s,i)=><fieldset className="social-row" key={s.id} disabled={busy}><legend>ช่องทางที่ {i+1}</legend>
      <Field label={`ชื่อช่องทาง ${i+1}`} value={s.label} maxLength={60} required onChange={e=>change(s.id,{label:e.target.value})} />
      <Field label={`ลิงก์ช่องทาง ${i+1}`} type="url" autoComplete="url" placeholder="https://" value={s.url} maxLength={500} required onChange={e=>change(s.id,{url:e.target.value})} />
      <label className="checkbox"><input type="checkbox" checked={s.enabled} onChange={e=>change(s.id,{enabled:e.target.checked})} />แสดงช่องทางนี้</label>
      <Button type="button" variant="outline" onClick={()=>setLinks(v=>v.filter(x=>x.id!==s.id))}>ลบช่องทาง {i+1}</Button>
    </fieldset>)}
    <div className="button-row"><Button type="button" variant="outline" disabled={busy || links.length>=12} onClick={()=>setLinks(v=>[...v,{id:crypto.randomUUID(),label:"",url:"",enabled:true}])}>เพิ่มช่องทาง Social</Button><Button type="submit" busy={busy}>บันทึกช่องทาง Social</Button></div><FormMessage error={error} />
  </form>;
}
