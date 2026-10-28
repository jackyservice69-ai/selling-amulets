import { useState } from "react";
import { NavLink, Link, Outlet, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Flag,
  Tags,
  Newspaper,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Store,
  Check,
  X,
  Eye,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useAuth, useData, send, api } from "../api";
import {
  Button,
  Field,
  PasswordField,
  Select,
  Textarea,
  State,
  Pagination,
  Modal,
  FormMessage,
  useToast,
} from "../components/ui";
import { ImageUpload } from "../components/forms";
import { DeleteListingDialog } from "../components/delete-listing-dialog";
import { CreateUserDialog } from "./admin-extra";
import {
  type Amulet,
  type Page,
  type Category,
  type Banner,
  type Popup,
  type Announcement,
  type Settings,
  media,
  listingPrice,
  listingTypeLabel,
  date,
  statuses,
} from "../types";
interface Stats {
  users: number;
  newUsers: number;
  shops: number;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
  reports: number;
  views: number;
  daily: { day: string; count: number }[];
}
export function AdminLayout() {
  const { user } = useAuth();
  return (
    <div className="container workspace admin-workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-identity">
          <ShieldCheck size={30} />
          <strong>จัดการตลาดพระเครื่อง</strong>
          <small>
            {user?.role === "SUPER_ADMIN"
              ? "ผู้ดูแลระบบสูงสุด"
              : user?.role === "ADMIN"
                ? "ผู้ดูแลระบบ"
                : "ผู้ตรวจสอบประกาศ"}
          </small>
        </div>
        <nav aria-label="เมนูผู้ดูแล">
          {[
            ["", "ตรวจสอบประกาศ", LayoutDashboard],
            ["reports", "รายงานประกาศ", Flag],
            ...(user?.role !== "MODERATOR"
              ? [
                  ["users", "สมาชิก", Users],
                  ["support", "รับแจ้งเรื่อง", MessageSquare],
                  ["categories", "หมวดหมู่", Tags],
                  ["content", "ข่าวสารและแบนเนอร์", Newspaper],
                  ["social", "ตั้งค่าช่องทาง Social", Store],
                  ["audit", "ประวัติการดำเนินการ", HistoryIcon],
                ]
              : []),
            ...(user?.role === "SUPER_ADMIN"
              ? [["settings", "ตั้งค่าเว็บไซต์", SettingsIcon]]
              : []),
          ].map(([path, label, Icon]) => {
            const I = Icon as typeof Store;
            return (
              <NavLink
                key={String(path)}
                end={path === ""}
                to={`/admin${path ? "/" + path : ""}`}
              >
                <I size={18} />
                {String(label)}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="workspace-main">
        <Outlet />
      </div>
    </div>
  );
}
function AdminSearch({
  placeholder = "ค้นหารายการ",
}: {
  placeholder?: string;
}) {
  const [params, setParams] = useSearchParams(),
    [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      noValidate
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params);
        next.set("q", q);
        next.delete("page");
        setParams(next);
      }}
    >
      <Search size={17} />
      <label className="sr-only" htmlFor="admin-search">
        {placeholder}
      </label>
      <input
        id="admin-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
      />
      {q && (
        <button
          type="button"
          aria-label="ล้างคำค้น"
          onClick={() => {
            setQ("");
            const next = new URLSearchParams(params);
            next.delete("q");
            next.delete("page");
            setParams(next);
          }}
        >
          <X size={16} />
        </button>
      )}
      <button type="submit" className="search-submit">
        ค้นหา
      </button>
    </form>
  );
}
function PageControls({ data }: { data: Page<unknown> | null }) {
  const [params, setParams] = useSearchParams();
  return (
    data && (
      <Pagination
        {...data}
        onPage={(p) => {
          const next = new URLSearchParams(params);
          next.set("page", String(p));
          setParams(next);
        }}
      />
    )
  );
}
export function AdminListings() {
  const [params, setParams] = useSearchParams(),
    stats = useData<Stats>("/admin/stats"),
    list = useData<Page<Amulet>>(`/admin/amulets?${params}`),
    [selected, setSelected] = useState<Amulet | null>(null),
    [deleting, setDeleting] = useState<Amulet | null>(null),
    [action, setAction] = useState("APPROVED"),
    [reason, setReason] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [chart, setChart] = useState("daily");
  const { user } = useAuth(),
    toast = useToast();
  function refresh() {
    list.reload();
    stats.reload();
  }
  async function commit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await send(`/admin/amulets/${selected.id}/status`, {
        status: action,
        reason,
        version: selected.version,
      });
      setSelected(null);
      refresh();
      toast("บันทึกผลการตรวจสอบแล้ว");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const s = stats.data;
  const daily = s?.daily ?? [],
    monthly = Object.entries(
      daily.reduce<Record<string, number>>((acc, d) => {
        const month = d.day.slice(0, 7);
        acc[month] = (acc[month] ?? 0) + d.count;
        return acc;
      }, {}),
    ).map(([day, count]) => ({ day, count }));
  const points = chart === "daily" ? daily : monthly;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ภาพรวมตลาดพระเครื่อง</span>
          <h1>ตรวจสอบประกาศ</h1>
          <p className="muted">
            การอนุมัติจะเผยแพร่ประกาศและแจ้งสมาชิกในขั้นตอนเดียวกัน
          </p>
        </div>
      </div>
      <div className="stat-grid">
        {(
          [
            ["สมาชิก", s?.users],
            ["สมาชิกใหม่ 30 วัน", s?.newUsers],
            ["ร้านค้า", s?.shops],
            ["ประกาศทั้งหมด", s?.total],
            ["รอตรวจสอบ", s?.pending],
            ["เผยแพร่แล้ว", s?.approved],
            ["ไม่อนุมัติ", s?.rejected],
            ["ระงับประกาศ", s?.suspended],
            ["รายงานรอตรวจ", s?.reports],
            ["เข้าชม", s?.views],
          ] as const
        ).map(([label, value]) => (
          <div className="stat-card" key={label}>
            <small>{label}</small>
            <strong>{value?.toLocaleString("th-TH") ?? "—"}</strong>
          </div>
        ))}
      </div>
      {stats.error && <State error={stats.error} retry={stats.reload} />}
      <details className="panel chart-panel">
        <summary>สถิติผู้เข้าชม 90 วันล่าสุด</summary>
        <Select
          label="ช่วงเวลา"
          value={chart}
          onChange={(e) => setChart(e.target.value)}
        >
          <option value="daily">รายวัน</option>
          <option value="monthly">รายเดือน</option>
        </Select>
        {points.length ? (
          <div className="bar-chart" aria-label="กราฟจำนวนเข้าชม">
            {points.map((p) => (
              <div key={p.day}>
                <span
                  style={{
                    height: `${Math.max(3, (p.count / Math.max(...points.map((x) => x.count))) * 110)}px`,
                  }}
                  title={`${p.count} ครั้ง`}
                />
                <small>{p.day}</small>
                <b>{p.count}</b>
              </div>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีข้อมูลการเข้าชม</p>
        )}
      </details>
      <div className="admin-toolbar">
        <AdminSearch />
        <Select
          label="สถานะประกาศ"
          value={params.get("status") ?? ""}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("status", e.target.value);
            next.delete("page");
            setParams(next);
          }}
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(statuses).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ประกาศ</th>
                <th>ร้านค้า / ราคา</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="table-item">
                      <img
                        src={media(a.images[0]?.uploadId, true)}
                        alt=""
                        width="56"
                        height="56"
                      />
                      <div>
                        <strong>{a.title}</strong>
                        <small>{date(a.createdAt)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {a.shop.name}
                    <small>{listingTypeLabel(a.listingType)} · {listingPrice(a)}</small>
                  </td>
                  <td>
                    <span className={`status ${a.status.toLowerCase()}`}>
                      {statuses[a.status]}
                    </span>
                  </td>
                  <td>
                    <div className="button-row">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(a);
                          setAction(
                            a.status === "PENDING" ? "APPROVED" : "PENDING",
                          );
                          setReason("");
                          setError(null);
                        }}
                      >
                        <Eye size={15} />
                        ตรวจสอบ
                      </Button>
                      {user?.role !== "MODERATOR" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={
                            a.featured ? "นำออกจากรายการแนะนำ" : "ปักหมุดแนะนำ"
                          }
                          aria-pressed={a.featured}
                          onClick={() =>
                            void send(
                              `/admin/amulets/${a.id}/featured`,
                              { featured: !a.featured },
                              "PUT",
                            )
                              .then(refresh)
                              .catch((e) => toast(e.message))
                          }
                        >
                          <Pin
                            size={16}
                            fill={a.featured ? "currentColor" : "none"}
                          />
                        </Button>
                      )}
                      {user?.role !== "MODERATOR" && <Button variant="danger" size="sm" onClick={() => setDeleting(a)}>
                        <Trash2 size={15} />ลบประกาศ
                      </Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageControls data={list.data} />
      </State>
      {deleting && <DeleteListingDialog key={deleting.id} listing={deleting} managed onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          if (list.data?.items.length === 1 && list.data.page > 1) {
            const next = new URLSearchParams(params);
            next.set("page", String(list.data.page - 1));
            setParams(next);
            stats.reload();
          } else refresh();
        }} />}
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="ตรวจสอบรายละเอียดประกาศ"
      >
        {selected && (
          <>
            <h2>{selected.title}</h2>
            <p>
              {selected.shop.name} · {listingTypeLabel(selected.listingType)} · {listingPrice(selected)} ·{" "}
              {statuses[selected.status]}
            </p>
            <div className="preview-gallery">
              {selected.images.map((i) => (
                <a
                  key={i.uploadId}
                  href={media(i.uploadId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={media(i.uploadId)}
                    alt={selected.title}
                    width="250"
                    height="250"
                  />
                </a>
              ))}
            </div>
            <p className="preserve">{selected.description}</p>
            <dl className="facts">
              {[
                ["วัด", selected.temple],
                ["เกจิ", selected.master],
                ["ปีที่สร้าง", selected.year],
                ["เนื้อ", selected.material],
                ["พิมพ์", selected.size],
                ["สภาพ", selected.condition],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "ไม่ระบุ"}</dd>
                </div>
              ))}
            </dl>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void commit();
              }}
            >
              <Select
                label="ผลการตรวจสอบ"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="APPROVED">อนุมัติ / คืนสถานะเผยแพร่</option>
                <option value="REJECTED">ไม่อนุมัติ</option>
                <option value="SUSPENDED">ระงับประกาศ</option>
                <option value="PENDING">ส่งกลับรอตรวจสอบ</option>
                <option value="CLOSED">ปิดประกาศ</option>
              </Select>
              <Textarea
                label="เหตุผล (จำเป็นเมื่อไม่อนุมัติหรือระงับ)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <FormMessage error={error} />
              <Button type="submit" busy={busy}>
                <Check size={17} />
                บันทึกผลการตรวจสอบ
              </Button>
            </form>
            <details>
              <summary>ประวัติการตรวจสอบ</summary>
              {selected.histories?.map((h) => (
                <p key={h.id}>
                  {date(h.createdAt)} · {h.actor?.username} ·{" "}
                  {statuses[h.status]} · {h.reason}
                </p>
              ))}
            </details>
          </>
        )}
      </Modal>
    </>
  );
}
interface AdminUser {
  profile: {
    displayName: string;
    phone: string | null;
    avatarId: string | null;
  };
  id: string;
  username: string;
  status: string;
  maxListings: number;
  createdAt: string;
  role: { name: string };
  shop: { id: string; slug: string; name: string; featured: boolean } | null;
}
export function AdminUsers() {
  const [creating,setCreating]=useState(false);
  const [params] = useSearchParams(),
    list = useData<Page<AdminUser>>(`/admin/users?${params}`),
    [selected, setSelected] = useState<AdminUser | null>(null),
    [resetTarget, setResetTarget] = useState<AdminUser | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    { user } = useAuth(),
    toast = useToast();
  return (
    <>
      <div className="page-heading"><h1>จัดการสมาชิก</h1><Button onClick={()=>setCreating(true)}><Plus size={17} />เพิ่มสมาชิก</Button></div>
      <CreateUserDialog open={creating} onOpenChange={setCreating} onCreated={list.reload} />
      <AdminSearch placeholder="ค้นหาชื่อผู้ใช้หรือร้าน" />
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>ร้านค้า</th>
                <th>สถานะ / สิทธิ์</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.profile.displayName}</strong>
                    <small>{u.username}</small>
                    <small>{date(u.createdAt)}</small>
                  </td>
                  <td>
                    {u.shop && (
                      <>
                        <Link to={`/shop/${u.shop.slug}`}>{u.shop.name}</Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-pressed={u.shop.featured}
                          onClick={() =>
                            void send(
                              `/admin/shops/${u.shop!.id}/featured`,
                              { featured: !u.shop!.featured },
                              "PUT",
                            )
                              .then(() => {
                                list.reload();
                                toast("ปรับรายการร้านแนะนำแล้ว");
                              })
                              .catch((e) => toast(e.message))
                          }
                        >
                          {u.shop.featured
                            ? "นำออกจากร้านแนะนำ"
                            : "แนะนำร้านนี้"}
                        </Button>
                      </>
                    )}
                  </td>
                  <td>
                    {u.status === "ACTIVE" ? "ใช้งานปกติ" : "ระงับบัญชี"}
                    <small>{u.role.name}</small>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={u.id === user?.id}
                      onClick={() => {
                        setSelected(u);
                        setError(null);
                        setReason("");
                      }}
                    >
                      จัดการบัญชี
                    </Button>
                    {u.id !== user?.id && (user?.role === "SUPER_ADMIN" || u.role.name === "MEMBER") && (
                      <Button size="sm" variant="ghost" onClick={() => setResetTarget(u)}>
                        รีเซ็ตรหัสผ่าน
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageControls data={list.data} />
      </State>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={`จัดการบัญชี ${selected?.username ?? ""}`}
      >
        {selected && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void send(
                `/admin/users/${selected.id}`,
                {
                  status: selected.status,
                  maxListings: selected.maxListings,
                  role: selected.role.name,
                  reason,
                },
                "PUT",
              )
                .then(() => {
                  setSelected(null);
                  list.reload();
                  toast("ปรับสถานะบัญชีแล้ว");
                })
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          >
            <p>
              ชื่อที่ใช้แสดง: {selected.profile.displayName}
              <br />
              เบอร์โทรส่วนตัว: {selected.profile.phone || "ไม่ได้ระบุ"}
            </p>
            <p className="inline-note">
              การเปลี่ยนสถานะหรือสิทธิ์จะยกเลิก Session ของบัญชีนี้ หากระงับ
              ร้านและประกาศทั้งหมดจะถูกซ่อนทันที
            </p>
            <Select
              label="สถานะบัญชี"
              value={selected.status}
              onChange={(e) =>
                setSelected({ ...selected, status: e.target.value })
              }
            >
              <option value="ACTIVE">ใช้งานปกติ</option>
              <option value="SUSPENDED">ระงับบัญชี</option>
            </Select>
            <Field
              label="จำนวนประกาศสูงสุด"
              type="number"
              min="1"
              max="1000"
              value={selected.maxListings}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  maxListings: Number(e.target.value),
                })
              }
            />
            {user?.role === "SUPER_ADMIN" && (
              <Select
                label="สิทธิ์สมาชิก"
                value={selected.role.name}
                onChange={(e) =>
                  setSelected({ ...selected, role: { name: e.target.value } })
                }
              >
                {[
                  ["MEMBER", "สมาชิก"],
                  ["MODERATOR", "ผู้ตรวจสอบ"],
                  ["ADMIN", "ผู้ดูแล"],
                  ["SUPER_ADMIN", "ผู้ดูแลสูงสุด"],
                ].map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
            <Textarea
              label="เหตุผลการเปลี่ยนแปลง (อย่างน้อย 5 ตัวอักษร)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <FormMessage error={error} />
            <div className="button-row">
              <Button
                variant="outline"
                type="button"
                onClick={() => setSelected(null)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" busy={busy}>
                ยืนยันการเปลี่ยนแปลง
              </Button>
            </div>
          </form>
        )}
      </Modal>
      {resetTarget && <ResetMemberPassword target={resetTarget} onClose={() => setResetTarget(null)} />}
    </>
  );
}
function ResetMemberPassword({ target, onClose }: { target: AdminUser; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await send(`/admin/users/${target.id}/password`, body);
      toast(`รีเซ็ตรหัสผ่าน ${target.username} แล้ว`);
      onClose();
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  return <Modal open initialFocusSelector="[data-reset-cancel]" onOpenChange={open => { if (!open && !busy) onClose(); }} title={`รีเซ็ตรหัสผ่าน ${target.username}`}>
    <form noValidate onSubmit={e => void submit(e)}>
      <p className="inline-note">ตรวจสอบความเป็นเจ้าของบัญชีก่อนดำเนินการ รหัสผ่านเดิมจะใช้ไม่ได้และบัญชีนี้จะออกจากระบบทุกเครื่อง สถานะและสิทธิ์ของบัญชีจะคงเดิม</p>
      <p>ส่งรหัสผ่านใหม่ให้เจ้าของบัญชีผ่านช่องทางส่วนตัวที่ตรวจสอบแล้ว และให้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบ</p>
      <PasswordField label="รหัสผ่านของผู้ดูแล" name="currentPassword" autoComplete="current-password" required disabled={busy} />
      <PasswordField label="รหัสผ่านใหม่ของสมาชิก (อย่างน้อย 8 ตัวอักษร)" name="password" autoComplete="new-password" minLength={8} required disabled={busy} />
      <PasswordField label="ยืนยันรหัสผ่านใหม่" name="confirmPassword" autoComplete="new-password" minLength={8} required disabled={busy} />
      <Textarea label="เหตุผลการรีเซ็ต (อย่างน้อย 5 ตัวอักษร)" name="reason" required disabled={busy} />
      <FormMessage error={error} />
      <div className="button-row">
        <Button variant="outline" type="button" data-reset-cancel disabled={busy} onClick={onClose}>ยกเลิก</Button>
        <Button variant="danger" type="submit" busy={busy}>ยืนยันรีเซ็ตรหัสผ่าน</Button>
      </div>
    </form>
  </Modal>;
}
interface Report {
  id: string;
  reason: string;
  details: string;
  resolved: boolean;
  resolution: string | null;
  createdAt: string;
  amulet: { title: string; id: string };
  user: { username: string };
}
export function AdminReports() {
  const [params] = useSearchParams(),
    list = useData<Page<Report>>(`/admin/reports?${params}`),
    [selected, setSelected] = useState<Report | null>(null),
    [resolution, setResolution] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    toast = useToast();
  return (
    <>
      <h1>รายงานประกาศ</h1>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="own-list">
          {list.data?.items.map((r) => (
            <article className="panel" key={r.id}>
              <span className={`status ${r.resolved ? "approved" : "pending"}`}>
                {r.resolved ? "ดำเนินการแล้ว" : "รอตรวจสอบ"}
              </span>
              <h2>{r.amulet.title}</h2>
              <p>
                <b>{r.reason}</b> — {r.details}
              </p>
              <small>
                ผู้รายงาน {r.user.username} · {date(r.createdAt)}
              </small>
              {r.resolution && <p>ผลดำเนินการ: {r.resolution}</p>}
              <div className="button-row">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin?q=${encodeURIComponent(r.amulet.title)}`}>
                    ตรวจสอบ / ระงับประกาศ
                  </Link>
                </Button>
                {!r.resolved && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelected(r);
                      setResolution("");
                      setError(null);
                    }}
                  >
                    บันทึกผลดำเนินการ
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        <PageControls data={list.data} />
      </State>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="ปิดรายงาน"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void send(`/admin/reports/${selected?.id}`, { resolution }, "PUT")
              .then(() => {
                setSelected(null);
                list.reload();
                toast("ปิดรายงานแล้ว");
              })
              .catch(setError)
              .finally(() => setBusy(false));
          }}
        >
          <Textarea
            label="ผลการตรวจสอบและการดำเนินการ"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
          <FormMessage error={error} />
          <Button type="submit" busy={busy}>
            บันทึกและปิดรายงาน
          </Button>
        </form>
      </Modal>
    </>
  );
}
export function AdminCategories() {
  const list = useData<Category[]>("/admin/categories"),
    [selected, setSelected] = useState<Category | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    toast = useToast();
  return (
    <>
      <div className="page-heading">
        <h1>หมวดหมู่พระเครื่อง</h1>
        <Button
          onClick={() => {
            setSelected({
              id: "",
              name: "",
              slug: "",
              parentId: null,
              imageId: null,
              active: true,
              sortOrder: 0,
            });
            setError(null);
          }}
        >
          <Plus size={17} />
          เพิ่มหมวดหมู่
        </Button>
      </div>
      <State {...list} retry={list.reload} empty={!list.data?.length}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>หมวดหมู่</th>
                <th>หมวดหมู่หลัก</th>
                <th>ลำดับ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {list.data?.find((p) => p.id === c.parentId)?.name ?? "—"}
                  </td>
                  <td>{c.sortOrder}</td>
                  <td>{c.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(c);
                        setError(null);
                      }}
                    >
                      แก้ไข
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={selected?.id ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
      >
        {selected && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              const { id, ...data } = selected;
              void send(
                `/admin/categories${id ? "/" + id : ""}`,
                data,
                id ? "PUT" : "POST",
              )
                .then(() => {
                  setSelected(null);
                  list.reload();
                  toast("บันทึกหมวดหมู่แล้ว");
                })
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          >
            <Field
              label="ชื่อหมวดหมู่"
              value={selected.name}
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
            <Field
              label="รหัสหมวดหมู่ (อังกฤษ ตัวเลข และ -)"
              value={selected.slug}
              onChange={(e) =>
                setSelected({ ...selected, slug: e.target.value })
              }
            />
            <Select
              label="หมวดหมู่หลัก"
              value={selected.parentId ?? ""}
              onChange={(e) =>
                setSelected({ ...selected, parentId: e.target.value || null })
              }
            >
              <option value="">ไม่มีหมวดหมู่หลัก</option>
              {list.data
                ?.filter((c) => c.id !== selected.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Field
              label="ลำดับการแสดง"
              type="number"
              value={selected.sortOrder}
              onChange={(e) =>
                setSelected({ ...selected, sortOrder: Number(e.target.value) })
              }
            />
            <ImageUpload
              label="รูปหมวดหมู่"
              max={1}
              ids={selected.imageId ? [selected.imageId] : []}
              onChange={(ids) =>
                setSelected({ ...selected, imageId: ids[0] ?? null })
              }
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.active}
                onChange={(e) =>
                  setSelected({ ...selected, active: e.target.checked })
                }
              />
              เปิดใช้งานหมวดหมู่
            </label>
            <FormMessage error={error} />
            <Button busy={busy} type="submit">
              บันทึกหมวดหมู่
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
interface Content {
  page: number;
  limit: number;
  totals: Record<"popups" | "banners" | "announcements", number>;
  popups: Popup[];
  banners: Banner[];
  announcements: Announcement[];
}
const emptyCampaign = (): Popup => ({
  id: "",
  name: "",
  title: "",
  body: "",
  imageId: null,
  buttonText: "ดูรายละเอียด",
  url: "/catalog",
  active: false,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  audience: "ALL",
  page: "/",
  delaySeconds: 2,
  maxViews: 1,
  oncePerSession: true,
  intervalHours: 24,
});
type ContentEditor = Popup & { sortOrder: number };
export function AdminContent() {
  const [page, setPage] = useState(1),
    list = useData<Content>(`/admin/content?page=${page}&limit=12`),
    [kind, setKind] = useState<"popups" | "banners" | "announcements">(
      "popups",
    ),
    [selected, setSelected] = useState<ContentEditor | null>(null),
    [preview, setPreview] = useState(false),
    [deleting, setDeleting] = useState<ContentEditor | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    toast = useToast();
  function update<K extends keyof ContentEditor>(
    key: K,
    value: ContentEditor[K],
  ) {
    if (selected) setSelected({ ...selected, [key]: value });
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const data =
      kind === "popups"
        ? selected
        : kind === "banners"
          ? {
              title: selected.title,
              imageId: selected.imageId,
              url: selected.url,
              sortOrder: selected.sortOrder,
              active: selected.active,
              startsAt: selected.startsAt,
              endsAt: selected.endsAt,
            }
          : {
              title: selected.title,
              body: selected.body,
              active: selected.active,
            };
    try {
      await send(
        `/admin/content/${kind}${selected.id ? "/" + selected.id : ""}`,
        data,
        selected.id ? "PUT" : "POST",
      );
      setSelected(null);
      list.reload();
      toast("บันทึกเนื้อหาแล้ว");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>ข่าวสารและประชาสัมพันธ์</h1>
        <Button
          onClick={() => {
            setSelected({ ...emptyCampaign(), sortOrder: 0 });
            setError(null);
          }}
        >
          <Plus size={17} />
          {kind === "popups" ? "เพิ่มประกาศป๊อปอัป" : "เพิ่มรายการ"}
        </Button>
      </div>
      <div className="category-chips">
        {(
          [
            ["popups", "ป๊อปอัป"],
            ["banners", "แบนเนอร์"],
            ["announcements", "ข่าวสาร"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            className={kind === v ? "active" : ""}
            onClick={() => {
              setKind(v);
              setPage(1);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {kind === "popups" && <p className="inline-note">เพิ่มประกาศได้หลายรายการ ประกาศที่เปิดใช้งานและตรงเงื่อนไขจะแสดงรวมเป็นสไลด์ เปลี่ยนอัตโนมัติทุก 5 วินาที ผู้ชมเลื่อนเองหรือหยุดสไลด์ได้</p>}
      <State {...list} retry={list.reload} empty={!list.data?.[kind].length}>
        <div className="own-list">
          {list.data?.[kind].map((item) => (
            <article key={item.id} className="panel own-item">
              <div className="own-item-text">
                <span
                  className={`status ${item.active ? "approved" : "closed"}`}
                >
                  {item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                </span>
                <h2>{item.title}</h2>
                {"startsAt" in item && (
                  <small>
                    {date(item.startsAt)} — {date(item.endsAt)}
                  </small>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected({ ...emptyCampaign(), sortOrder: 0, ...item });
                  setError(null);
                }}
              >
                แก้ไข
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleting({ ...emptyCampaign(), sortOrder: 0, ...item });
                  setError(null);
                }}
              >
                ลบ
              </Button>
            </article>
          ))}
        </div>
      </State>
      {list.data && (
        <Pagination
          page={page}
          total={list.data.totals[kind]}
          limit={list.data.limit}
          onPage={setPage}
        />
      )}
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="จัดการเนื้อหา"
      >
        {selected && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {kind === "popups" && (
              <Field
                label="ชื่อรายการสำหรับผู้ดูแล"
                value={selected.name}
                onChange={(e) => update("name", e.target.value)}
              />
            )}
            <Field
              label="หัวข้อ"
              value={selected.title}
              onChange={(e) => update("title", e.target.value)}
            />
            {kind !== "banners" && (
              <Textarea
                label="รายละเอียด"
                value={selected.body}
                onChange={(e) => update("body", e.target.value)}
              />
            )}
            {kind !== "announcements" && (
              <>
                <ImageUpload
                  label="ภาพประชาสัมพันธ์"
                  max={1}
                  ids={selected.imageId ? [selected.imageId] : []}
                  onChange={(ids) => update("imageId", ids[0] ?? null)}
                />
                <Field
                  label="ลิงก์ปลายทาง (HTTPS หรือ /เส้นทาง)"
                  value={selected.url ?? ""}
                  onChange={(e) => update("url", e.target.value || null)}
                />
                <Field
                  label="เวลาเริ่มแสดง UTC (เช่น 2026-10-26T09:00:00.000Z)"
                  value={selected.startsAt}
                  onChange={(e) => update("startsAt", e.target.value)}
                />
                <Field
                  label="เวลาสิ้นสุด UTC"
                  value={selected.endsAt}
                  onChange={(e) => update("endsAt", e.target.value)}
                />
              </>
            )}
            {kind === "banners" && (
              <Field
                label="ลำดับการแสดง"
                type="number"
                value={selected.sortOrder}
                onChange={(e) => update("sortOrder", Number(e.target.value))}
              />
            )}
            {kind === "popups" && (
              <>
                <Field
                  label="ข้อความบนปุ่ม"
                  value={selected.buttonText ?? ""}
                  onChange={(e) => update("buttonText", e.target.value)}
                />
                <Select
                  label="กลุ่มผู้ชม"
                  value={selected.audience}
                  onChange={(e) => update("audience", e.target.value)}
                >
                  <option value="ALL">ทุกคน</option>
                  <option value="GUEST">ผู้เยี่ยมชม</option>
                  <option value="MEMBER">สมาชิก</option>
                </Select>
                <Field
                  label="หน้าเว็บไซต์ที่แสดง"
                  value={selected.page}
                  onChange={(e) => update("page", e.target.value)}
                />
                {(
                  [
                    ["delaySeconds", "หน่วงเวลา (วินาที)"],
                    ["maxViews", "จำนวนครั้งสูงสุดต่อผู้ชม"],
                    ["intervalHours", "ช่วงห่าง (ชั่วโมง)"],
                  ] as const
                ).map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    type="number"
                    value={selected[k]}
                    onChange={(e) => update(k, Number(e.target.value))}
                  />
                ))}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={selected.oncePerSession}
                    onChange={(e) => update("oncePerSession", e.target.checked)}
                  />
                  แสดงครั้งเดียวต่อ Session
                </label>
              </>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.active}
                onChange={(e) => update("active", e.target.checked)}
              />
              เปิดใช้งาน
            </label>
            <FormMessage error={error} />
            <div className="button-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(true)}
              >
                ดูตัวอย่าง
              </Button>
              <Button type="submit" busy={busy}>
                บันทึกเนื้อหา
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={preview}
        onOpenChange={setPreview}
        title={selected?.title ?? "ตัวอย่าง"}
      >
        {selected?.imageId && (
          <img
            className="popup-image"
            src={media(selected.imageId)}
            alt="ภาพประกอบ"
            width="700"
            height="400"
          />
        )}
        <p className="preserve">{selected?.body}</p>
        {selected?.url && (
          <span className="btn btn-outline">
            {selected.buttonText ?? "ดูรายละเอียด"} → {selected.url}
          </span>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
        title="ลบเนื้อหา"
      >
        <p>
          ลบ “{deleting?.title}” ออกจากระบบ? ข้อมูลนี้จะกู้คืนจากหน้าจอไม่ได้
        </p>
        <FormMessage error={error} />
        <div className="button-row">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={() => {
              setBusy(true);
              void api(`/admin/content/${kind}/${deleting?.id}`, {
                method: "DELETE",
              })
                .then(() => {
                  setDeleting(null);
                  list.reload();
                  toast("ลบเนื้อหาแล้ว");
                })
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          >
            ลบเนื้อหา
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function AdminSettings() {
  const data = useData<Settings>("/settings");
  return (
    <State {...data} retry={data.reload}>
      {data.data && <SettingsForm initial={data.data} />}
    </State>
  );
}
function SettingsForm({ initial }: { initial: Settings }) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    toast = useToast();
  return (
    <>
      <h1>ตั้งค่าเว็บไซต์</h1>
      <form
        noValidate
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setError(null);
          setBusy(true);
          void send("/admin/settings", value, "PUT")
            .then(() => toast("บันทึกการตั้งค่าแล้ว"))
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        <div className="registration-setting">
          <label className="checkbox">
            <input type="checkbox" role="switch" aria-label="เปิดรับสมัครสมาชิก" checked={value.registrationEnabled} disabled={busy}
              onChange={e => setValue({ ...value, registrationEnabled: e.target.checked })} />
            เปิดรับสมัครสมาชิก
          </label>
          <p className="muted">{value.registrationEnabled ? "เปิดให้ผู้ใช้ใหม่สมัครสมาชิกได้" : "ปิดรับสมาชิกใหม่ชั่วคราว"} · สมาชิกเดิมยังเข้าสู่ระบบได้ตามปกติ</p>
          <small>กดบันทึกการตั้งค่าเพื่อให้การเปลี่ยนแปลงมีผล</small>
        </div>
        {(
          [
            ["name", "ชื่อเว็บไซต์"],
            ["description", "คำอธิบายเว็บไซต์ / SEO"],
            ["notice", "ข้อความประกาศ"],
            ["contact", "ช่องทางติดต่อผู้ดูแล"],
            ["footer", "ข้อความท้ายเว็บไซต์"],
            ["primaryColor", "สีหลัก (#rrggbb)"],
          ] as const
        ).map(([k, l]) => (
          <Field
            key={k}
            label={l}
            value={value[k]}
            onChange={(e) => setValue({ ...value, [k]: e.target.value })}
          />
        ))}
        {(
          [
            ["logoId", "โลโก้เว็บไซต์"],
            ["faviconId", "ไอคอนเว็บไซต์"],
            ["heroId", "ภาพหน้าแรก"],
          ] as const
        ).map(([k, l]) => (
          <ImageUpload
            key={k}
            label={l}
            max={1}
            ids={value[k] ? [value[k]] : []}
            onChange={(ids) => setValue({ ...value, [k]: ids[0] ?? null })}
          />
        ))}
        <div className="form-grid">
          {(
            [
              ["maxImages", "จำนวนภาพสูงสุดต่อประกาศ"],
              ["maxImageMb", "ขนาดภาพสูงสุด (MB)"],
              ["maxListings", "จำนวนประกาศสูงสุดต่อสมาชิก"],
            ] as const
          ).map(([k, l]) => (
            <Field
              key={k}
              label={l}
              type="number"
              value={value[k]}
              onChange={(e) =>
                setValue({ ...value, [k]: Number(e.target.value) })
              }
            />
          ))}
        </div>
        <p className="inline-note">
          นโยบาย: ทุกประกาศต้องผ่านการตรวจสอบ และส่งตรวจใหม่เมื่อแก้ไข ·
          ระบบแนะนำเพื่อนไม่มีผลตอบแทนเป็นเงิน
        </p>
        <FormMessage error={error} />
        <Button type="submit" busy={busy}>
          บันทึกการตั้งค่า
        </Button>
      </form>
    </>
  );
}
interface Audit {
  id: string;
  action: string;
  entityId: string;
  detail: string;
  createdAt: string;
  actor: { username: string };
}
export function AdminAudit() {
  const [params] = useSearchParams(),
    list = useData<Page<Audit>>(`/admin/audit?${params}`);
  return (
    <>
      <h1>ประวัติการดำเนินการ</h1>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>เวลาไทย</th>
                <th>ผู้ดำเนินการ</th>
                <th>การดำเนินการ</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Asia/Bangkok",
                    }).format(new Date(a.createdAt))}
                  </td>
                  <td>{a.actor.username}</td>
                  <td>
                    {a.action}
                    <small>{a.entityId}</small>
                  </td>
                  <td className="break-all">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageControls data={list.data} />
      </State>
    </>
  );
}
