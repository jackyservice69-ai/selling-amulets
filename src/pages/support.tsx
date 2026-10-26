import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Plus, RefreshCw } from "lucide-react";
import { send, useAuth, useData } from "../api";
import { Button, Field, Textarea, Select, FormMessage, State, Pagination, useToast } from "../components/ui";
import { UnsavedGuard } from "../components/forms";
import type { Page } from "../types";

type Status = "OPEN" | "ANSWERED" | "CLOSED";
interface Person { id: string; profile: { displayName: string } | null }
interface Ticket { id:string; subject:string; status:Status; version:number; createdAt:string; updatedAt:string; user:Person; _count:{messages:number} }
interface Message { id:string; body:string; isStaff:boolean; createdAt:string; author:Person }
interface Thread { ticket:Ticket; messages:Page<Message> }
const labels:Record<Status,string> = {OPEN:"รอผู้ดูแลตอบ",ANSWERED:"ผู้ดูแลตอบแล้ว",CLOSED:"ปิดเรื่องแล้ว"};
const timestamp = (value:string) => new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(new Date(value));
const root = (staff:boolean) => staff ? "/admin/support" : "/dashboard/support";
const endpoint = (staff:boolean) => staff ? "/admin/support" : "/me/support";
function StatusLabel({status}:{status:Status}) { return <span className={`support-status support-status-${status.toLowerCase()}`}>{labels[status]}</span>; }

export function SupportPage({staff=false,create=false}:{staff?:boolean;create?:boolean}) {
  const {user} = useAuth();
  const {id} = useParams();
  if (staff && !["ADMIN","SUPER_ADMIN"].includes(user?.role ?? "")) return <div className="empty"><h1>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p>เฉพาะผู้ดูแลและผู้ดูแลสูงสุด</p></div>;
  return create ? <NewTicket key={user?.id} /> : id ? <Conversation key={`${user?.id}:${staff}:${id}`} id={id} staff={staff} /> : <TicketList staff={staff} />;
}

function TicketList({staff}:{staff:boolean}) {
  const [params,setParams] = useSearchParams();
  const list = useData<Page<Ticket>>(`${endpoint(staff)}?${params}`);
  return <>
    <div className="page-heading support-heading"><div><h1>{staff ? "รับแจ้งเรื่อง" : "แจ้งเรื่องถึงผู้ดูแล"}</h1><p>{staff ? "รับเรื่องและตอบกลับผู้ประกาศ พร้อมติดตามสถานะการดำเนินการ" : "ส่งปัญหาหรือคำถาม และติดตามคำตอบจากผู้ดูแลได้ที่นี่"}</p></div>
      {!staff && <Button asChild><Link to={`${root(false)}/new`}><Plus size={18} />แจ้งเรื่องใหม่</Link></Button>}
    </div>
    <div className="support-toolbar">
      <Select label="สถานะเรื่อง" value={params.get("status") ?? ""} onChange={e=>setParams(e.target.value ? {status:e.target.value} : {})}>
        <option value="">ทุกสถานะ</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </Select>
      <Button variant="outline" disabled={list.loading} onClick={list.reload}><RefreshCw size={16} />โหลดรายการล่าสุด</Button>
    </div>
    <State {...list} retry={list.reload}>
      {list.data && !list.data.items.length ? <div className="empty"><MessageSquare size={32} /><h2>ยังไม่มีเรื่องในรายการนี้</h2><p>{staff ? "เรื่องใหม่จากผู้ประกาศจะแสดงที่นี่และแจ้งเตือนผ่านกระดิ่ง" : "กดแจ้งเรื่องใหม่เพื่อส่งข้อความถึงผู้ดูแล"}</p></div> : <div className="support-list">{list.data?.items.map(ticket=><Link className="panel support-ticket" key={ticket.id} to={`${root(staff)}/${ticket.id}`}>
        <div><h2>{ticket.subject}</h2>{staff && <p>ผู้แจ้ง: {ticket.user.profile?.displayName ?? "สมาชิก"}</p>}<small>{ticket._count.messages} ข้อความ · อัปเดต {timestamp(ticket.updatedAt)}</small></div><StatusLabel status={ticket.status} />
      </Link>)}</div>}
      {list.data && <Pagination {...list.data} onPage={page=>{const next=new URLSearchParams(params);next.set("page",String(page));setParams(next);}} />}
    </State>
  </>;
}

function NewTicket() {
  const [subject,setSubject] = useState("");
  const [body,setBody] = useState("");
  const [clientRequestId,setRequestId] = useState(()=>crypto.randomUUID());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<unknown>(null);
  const [created,setCreated] = useState<string|null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(()=>{if(created) navigate(`${root(false)}/${created}`,{replace:true});},[created,navigate]);
  return <>
    <UnsavedGuard dirty={!created && !!(subject || body)} />
    <Link className="text-link" to={root(false)}><ArrowLeft size={16} />กลับรายการแจ้งเรื่อง</Link>
    <div className="page-heading"><div><h1>แจ้งเรื่องใหม่</h1><p>ระบุปัญหาหรือคำถามให้ชัดเจน ผู้ดูแลจะตอบกลับผ่านระบบและกระดิ่งแจ้งเตือน</p></div></div>
    <form noValidate className="panel support-form" onSubmit={async e=>{
      e.preventDefault();if(busy)return;setBusy(true);setError(null);
      try {const result=await send<{id:string}>("/me/support",{subject,body,clientRequestId});setCreated(result.id);toast("ส่งเรื่องถึงผู้ดูแลแล้ว");}
      catch(err){setError(err);}finally{setBusy(false);}
    }}>
      <Field label="หัวข้อเรื่อง" value={subject} required minLength={3} maxLength={160} disabled={busy} onChange={e=>{setSubject(e.target.value);setRequestId(crypto.randomUUID());}} />
      <Textarea label="รายละเอียดเรื่อง" value={body} required maxLength={5000} disabled={busy} onChange={e=>{setBody(e.target.value);setRequestId(crypto.randomUUID());}} />
      <p className="muted">เฉพาะคุณและผู้ดูแลที่รับเรื่องเท่านั้นที่ดูบทสนทนานี้ได้</p>
      <FormMessage error={error} /><Button type="submit" busy={busy}>ส่งเรื่องถึงผู้ดูแล</Button>
    </form>
  </>;
}

function Conversation({staff,id}:{staff:boolean;id:string}) {
  const visit = useLocation().key;
  const previousVisit = useRef(visit);
  const [params,setParams] = useSearchParams();
  const thread = useData<Thread>(`${endpoint(staff)}/${id}?${params}`);
  const reload = thread.reload;
  const [body,setBody] = useState("");
  const [status,setStatus] = useState<"ANSWERED"|"CLOSED">("ANSWERED");
  const [clientRequestId,setRequestId] = useState(()=>crypto.randomUUID());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<unknown>(null);
  const toast = useToast();
  const ticket = thread.data?.ticket;
  useEffect(()=>{if(previousVisit.current !== visit){previousVisit.current=visit;reload();}},[visit,reload]);
  useEffect(()=>{const timer=setInterval(reload,30000);return()=>clearInterval(timer);},[reload]);
  return <>
    <UnsavedGuard dirty={!!body} />
    <Link className="text-link" to={root(staff)}><ArrowLeft size={16} />กลับรายการแจ้งเรื่อง</Link>
    <div className="page-heading support-heading"><div><h1 className="support-subject">{ticket?.subject ?? "รายละเอียดเรื่องที่แจ้ง"}</h1>{ticket && <p>ผู้แจ้ง: {ticket.user.profile?.displayName ?? "สมาชิก"} · {timestamp(ticket.createdAt)}</p>}</div>
      <Button variant="outline" disabled={thread.loading || busy} onClick={thread.reload}><RefreshCw size={16} />โหลดเรื่องล่าสุด</Button>
    </div>
    {ticket && <StatusLabel status={ticket.status} />}
    <State {...thread} retry={thread.reload}>
      <div className="support-messages" aria-label="ประวัติการสนทนา">{thread.data?.messages.items.map(message=><article className={`panel support-message ${message.isStaff ? "support-message-staff" : ""}`} key={message.id}>
        <header><strong>{message.isStaff ? "ผู้ดูแล" : "ผู้แจ้งเรื่อง"} · {message.author.profile?.displayName ?? "สมาชิก"}</strong><time dateTime={message.createdAt}>{timestamp(message.createdAt)}</time></header>
        <p className="preserve">{message.body}</p>
      </article>)}</div>
      {thread.data && <Pagination {...thread.data.messages} onPage={page=>setParams({page:String(page)})} />}
    </State>
    {ticket && <form noValidate className="panel support-form" onSubmit={async e=>{
      e.preventDefault();if(busy || thread.loading)return;setBusy(true);setError(null);
      try {await send(`${endpoint(staff)}/${id}/messages`,{body,version:ticket.version,clientRequestId,...(staff ? {status} : {})});setBody("");setRequestId(crypto.randomUUID());setParams({});thread.reload();toast("ส่งข้อความแล้ว");}
      catch(err){setError(err);}finally{setBusy(false);}
    }}>
      <h2>{staff ? "ตอบกลับผู้แจ้งเรื่อง" : "ส่งข้อความเพิ่มเติม"}</h2>
      {!staff && ticket.status === "CLOSED" && <p>หากยังต้องการความช่วยเหลือ ส่งข้อความเพิ่มเติมเพื่อเปิดเรื่องอีกครั้ง</p>}
      <Textarea label="ข้อความตอบกลับ" value={body} required maxLength={5000} disabled={busy} onChange={e=>{setBody(e.target.value);setRequestId(crypto.randomUUID());}} />
      {staff && <Select label="สถานะหลังตอบกลับ" value={status} disabled={busy} onChange={e=>{setStatus(e.target.value as "ANSWERED"|"CLOSED");setRequestId(crypto.randomUUID());}}><option value="ANSWERED">ตอบกลับแล้ว รอข้อความจากผู้แจ้ง</option><option value="CLOSED">ตอบกลับและปิดเรื่อง</option></Select>}
      <FormMessage error={error} /><Button type="submit" busy={busy} disabled={thread.loading}>ส่งข้อความตอบกลับ</Button>
    </form>}
  </>;
}
