import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  Store,
  Package,
  Heart,
  UserRound,
  Users,
  Bell,
  MessageSquare,
  LogOut,
  Eye,
  Pencil,
  Copy,
  Share2,
  ArrowDown,
  ArrowUp,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { useAuth, useData, send } from "../api";
import {
  Button,
  Field,
  Select,
  Textarea,
  Modal,
  State,
  Pagination,
  FormMessage,
  PasswordField,
  useToast,
} from "../components/ui";
import { ImageUpload, UnsavedGuard } from "../components/forms";
import { AmuletCard, contactLabel } from "../components/catalog";
import {
  type Amulet,
  type Shop,
  type Category,
  type Contact,
  type Notice,
  type Page,
  media,
  money,
  listingTypeLabel,
  listingPrice,
  date,
  statuses,
} from "../types";
export function MemberLayout() {
  const { user, logout } = useAuth(),
    navigate = useNavigate(),
    toast = useToast();
  const own = useData<Shop>("/me/shop");
  return (
    <div className="container workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-identity">
          <div className="shop-avatar">
            <Store size={25} />
          </div>
          <strong>{own.data?.name ?? user?.profile.displayName}</strong>
          <small>พื้นที่จัดการร้านค้าของคุณ</small>
        </div>
        <nav aria-label="เมนูสมาชิก">
          {[
            ["", "ประกาศของฉัน", Package],
            ["shop", "ตั้งค่าร้านค้า", Store],
            ["favorites", "รายการโปรด", Heart],
            ["notifications", "การแจ้งเตือน", Bell],
            ["support", "แจ้งเรื่องถึงผู้ดูแล", MessageSquare],
            ["referrals", "แนะนำเพื่อน", Users],
            ["profile", "ข้อมูลส่วนตัว", UserRound],
          ].map(([path, label, Icon]) => {
            const I = Icon as typeof Store;
            return (
              <NavLink
                key={String(path)}
                end={path === ""}
                to={`/dashboard${path ? "/" + path : ""}`}
              >
                <I size={18} />
                {String(label)}
              </NavLink>
            );
          })}
          {own.data && (
            <Link to={`/shop/${own.data.slug}`}>
              <Eye size={18} />
              ดูหน้าร้านสาธารณะ
            </Link>
          )}
          <button
            onClick={() =>
              void logout()
                .then(() => navigate("/"))
                .catch((e) => toast(e.message))
            }
          >
            <LogOut size={18} />
            ออกจากระบบ
          </button>
        </nav>
      </aside>
      <div className="workspace-main">
        <Outlet />
      </div>
    </div>
  );
}
export function MemberListings() {
  const [params, setParams] = useSearchParams(),
    list = useData<Page<Amulet>>(`/me/amulets?page=${params.get("page") ?? 1}`),
    shop = useData<Shop>("/me/shop"),
    [close, setClose] = useState<Amulet | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    toast = useToast();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">พื้นที่จัดการร้าน</span>
          <h1>ประกาศของฉัน</h1>
          <p className="muted">ติดตามสถานะและจัดการพระเครื่องที่คุณลงไว้</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/new">
            <Plus size={17} />
            เพิ่มประกาศ
          </Link>
        </Button>
      </div>
      <div className="inline-note">
        ประกาศใหม่และประกาศที่แก้ไขจะเข้าสู่การตรวจสอบก่อนเผยแพร่
      </div>
      {shop.data?.active === false && <div className="inline-note" role="status">
        <strong>ร้านของคุณยังปิดอยู่</strong>
        <p>ประกาศที่อนุมัติแล้วจะยังไม่แสดงบนหน้าสาธารณะจนกว่าจะเปิดร้าน</p>
        <Link className="text-link" to="/dashboard/shop">เปิดร้านจากตั้งค่าร้านค้า</Link>
      </div>}
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="own-list">
          {list.data?.items.map((a) => (
            <article className="own-item panel" key={a.id}>
              <img
                src={media(a.images[0]?.uploadId, true)}
                alt={a.title}
                width="96"
                height="96"
              />
              <div className="own-item-text">
                <span className={`status ${a.status.toLowerCase()}`}>
                  {a.status === "APPROVED" && shop.data?.active !== true ? "อนุมัติแล้ว" : statuses[a.status]}
                </span>
                <h2>{a.title}</h2>
                <p>
                  {listingTypeLabel(a.listingType)} · {listingPrice(a)} · <Eye size={13} />
                  {a.views} เข้าชม · {date(a.createdAt)}
                </p>
                {a.rejectionReason && (
                  <p className="rejection">เหตุผล: {a.rejectionReason}</p>
                )}
              </div>
              <div className="own-item-actions">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/dashboard/edit/${a.id}`}>
                    <Pencil size={14} />
                    แก้ไข
                  </Link>
                </Button>
                {a.status === "APPROVED" && shop.data?.active === true && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/amulet/${a.id}`}>ดูประกาศ</Link>
                  </Button>
                )}
                {!["CLOSED", "SUSPENDED"].includes(a.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setClose(a);
                    }}
                  >
                    ปิดประกาศ
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {list.data && (
          <Pagination
            {...list.data}
            onPage={(p) => setParams({ page: String(p) })}
          />
        )}
      </State>
      <Modal
        open={!!close}
        onOpenChange={(v) => {
          if (!v) setClose(null);
        }}
        title="ปิดประกาศ"
      >
        <p>
          ปิด “{close?.title}” เพื่อหยุดแสดงในหน้าสาธารณะ
          คุณส่งตรวจสอบใหม่ได้ภายหลัง
        </p>
        <FormMessage error={error} />
        <div className="button-row">
          <Button variant="outline" onClick={() => setClose(null)}>
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={() => {
              setBusy(true);
              void send(`/me/amulets/${close?.id}/close`)
                .then(() => {
                  setClose(null);
                  list.reload();
                  toast("ปิดประกาศแล้ว");
                })
                .catch(setError)
                .finally(() => setBusy(false));
            }}
          >
            ปิดประกาศ
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function ListingEditor() {
  const { id } = useParams(),
    item = useData<Amulet>(id ? `/me/amulets/${id}` : null),
    categories = useData<Category[]>("/categories");
  if (id && (item.loading || item.error))
    return <State {...item} retry={item.reload} />;
  return (
    <ListingForm
      key={id ?? "new"}
      initial={item.data}
      categories={categories.data ?? []}
    />
  );
}
function ListingForm({
  initial,
  categories,
}: {
  initial: Amulet | null;
  categories: Category[];
}) {
  const navigate = useNavigate(),
    toast = useToast();
  const [fields, setFields] = useState({
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      categoryId: initial?.categoryId ?? "",
      temple: initial?.temple ?? "",
      master: initial?.master ?? "",
      year: initial?.year ?? "",
      material: initial?.material ?? "",
      size: initial?.size ?? "",
      condition: initial?.condition ?? "",
      price: initial?.price ?? "",
      priceType: initial?.priceType ?? "FIXED",
      listingType: initial?.listingType ?? "SALE",
    }),
    [ids, setIds] = useState(initial?.images.map((i) => i.uploadId) ?? []),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState<unknown>(null),
    [saved, setSaved] = useState(false);
  const f = (key: keyof typeof fields, value: string) => {
    setFields({ ...fields, [key]: value });
    setDirty(true);
  };
  async function save(draft: boolean) {
    setBusy(true);
    setError(null);
    try {
      await send(
        initial ? `/me/amulets/${initial.id}` : "/me/amulets",
        {
          ...fields,
          price: fields.listingType === "SHOW" || fields.price === "" ? null : Number(fields.price),
          imageIds: ids,
          draft,
          version: initial?.version,
        },
        initial ? "PUT" : "POST",
      );
      setDirty(false);
      setSaved(true);
      toast(draft ? "บันทึกแบบร่างแล้ว" : "ส่งประกาศให้ผู้ดูแลตรวจสอบแล้ว");
    } catch (e) {
      setError(e);
      document
        .querySelector<HTMLElement>('[role="alert"]')
        ?.scrollIntoView({ block: "center" });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (saved) navigate("/dashboard");
  }, [saved, navigate]);
  return (
    <>
      <UnsavedGuard dirty={dirty} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">ส่งต่อสิ่งสะสมของคุณ</span>
          <h1>{initial ? "แก้ไขประกาศ" : "เพิ่มประกาศพระเครื่อง"}</h1>
          <p className="muted">
            กรอกข้อมูลตามจริง ภาพที่ชัดเจนช่วยให้ผู้สนใจตัดสินใจได้ง่ายขึ้น
          </p>
        </div>
      </div>
      {initial?.status === "SUSPENDED" && (
        <div className="form-error">
          ประกาศนี้ถูกระงับ กรุณาติดต่อผู้ดูแลก่อนแก้ไข
        </div>
      )}
      <form
        noValidate
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <h2>ภาพพระเครื่อง</h2>
        <ImageUpload
          ids={ids}
          onChange={(v) => {
            setIds(v);
            setDirty(true);
          }}
          onBusy={setUploading}
        />
        <h2>ข้อมูลประกาศ</h2>
        <Select
          label="ประเภทประกาศ *"
          name="listingType"
          value={fields.listingType}
          onChange={(e) => f("listingType", e.target.value)}
          required
        >
          <option value="SALE">สำหรับขาย</option>
          <option value="SHOW">สำหรับโชว์</option>
        </Select>
        <Field
          label="ชื่อพระเครื่อง *"
          name="title"
          value={fields.title}
          onChange={(e) => f("title", e.target.value)}
          maxLength={200}
          required
        />
        <div className="form-grid">
          <Select
            label="หมวดหมู่ *"
            name="categoryId"
            value={fields.categoryId}
            onChange={(e) => f("categoryId", e.target.value)}
            required
          >
            <option value="">เลือกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {fields.listingType === "SALE" && <Select
            label="สถานะราคา"
            value={fields.priceType}
            onChange={(e) => f("priceType", e.target.value)}
          >
            <option value="FIXED">ระบุราคา</option>
            <option value="ASK">สอบถามราคา</option>
          </Select>}
          {fields.listingType === "SALE" && fields.priceType === "FIXED" && (
            <Field
              label="ราคาแสดงประกาศ (บาท) *"
              name="price"
              type="number"
              min="0"
              max="9999999999"
              value={fields.price}
              onChange={(e) => f("price", e.target.value)}
            />
          )}
          {(
            [
              ["temple", "วัด / สำนัก"],
              ["master", "พระเกจิอาจารย์"],
              ["year", "ปีที่สร้าง"],
              ["material", "เนื้อพระ / วัสดุ"],
              ["size", "ขนาด / พิมพ์พระ"],
              ["condition", "สภาพพระ"],
            ] as const
          ).map(([k, l]) => (
            <Field
              key={k}
              label={l}
              value={fields[k]}
              onChange={(e) => f(k, e.target.value)}
            />
          ))}
        </div>
        <Textarea
          label="รายละเอียดพระเครื่อง * (อย่างน้อย 20 ตัวอักษร)"
          name="description"
          value={fields.description}
          onChange={(e) => f("description", e.target.value)}
          required
        />
        <p className="inline-note">
          {fields.listingType === "SHOW" ? "ประกาศสำหรับโชว์ ไม่เปิดขายและไม่แสดงราคา " : "ราคาเป็นข้อมูลอ้างอิงเท่านั้น ผู้สนใจติดต่อผ่านช่องทางในหน้าร้าน "}
          กรุณาตรวจสอบ <Link to="/dashboard/shop">การตั้งค่าช่องทางติดต่อ</Link>
        </p>
        <FormMessage error={error} />
        <div className="button-row editor-actions">
          <Button
            variant="outline"
            type="button"
            onClick={() => setPreview(true)}
          >
            <Eye size={17} />
            ดูตัวอย่าง
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={busy || uploading}
            onClick={() => void save(true)}
          >
            บันทึกแบบร่าง
          </Button>
          <Button
            type="submit"
            busy={busy}
            disabled={uploading || initial?.status === "SUSPENDED"}
          >
            ส่งตรวจสอบ
          </Button>
        </div>
      </form>
      {initial?.histories && (
        <details className="panel">
          <summary>ประวัติสถานะประกาศ</summary>
          {initial.histories.map((h) => (
            <p key={h.id}>
              {date(h.createdAt)} · {statuses[h.status]} · {h.reason}
            </p>
          ))}
        </details>
      )}
      <Modal
        open={preview}
        onOpenChange={setPreview}
        title="ตัวอย่างประกาศก่อนส่ง"
      >
        <div className="preview-gallery">
          {ids.map((id) => (
            <img
              key={id}
              src={media(id)}
              alt="รูปพระเครื่องก่อนส่ง"
              width="220"
              height="220"
            />
          ))}
        </div>
        <h2>{fields.title || "ชื่อพระเครื่อง"}</h2>
        <p>{fields.listingType === "SHOW" ? "สำหรับโชว์" : "สำหรับขาย"}</p>
        <strong className="card-price">
          {fields.listingType === "SHOW" ? "ไม่เปิดขาย" : fields.priceType === "ASK" ? "สอบถามราคา" : money(fields.price)}
        </strong>
        <p className="preserve">{fields.description}</p>
        <p className="muted">
          ตัวอย่างนี้ยังไม่เผยแพร่ กรุณากดส่งตรวจสอบเมื่อข้อมูลครบถ้วน
        </p>
      </Modal>
    </>
  );
}
export function ShopEditor() {
  const own = useData<Shop>("/me/shop");
  return (
    <State {...own} retry={own.reload}>
      {own.data && <ShopForm initial={own.data} />}
    </State>
  );
}
function ShopForm({ initial }: { initial: Shop }) {
  const [shop, setShop] = useState(initial),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState<unknown>(null);
  const toast = useToast();
  function change<K extends keyof Shop>(key: K, value: Shop[K]) {
    setShop({ ...shop, [key]: value });
    setDirty(true);
  }
  function contact(i: number, fields: Partial<Contact>) {
    change(
      "contacts",
      shop.contacts.map((c, n) =>
        n === i
          ? { ...c, ...fields }
          : fields.primary
            ? { ...c, primary: false }
            : c,
      ),
    );
  }
  function move(i: number, delta: number) {
    const next = [...shop.contacts];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    change(
      "contacts",
      next.map((c, n) => ({ ...c, sortOrder: n })),
    );
  }
  return (
    <>
      <UnsavedGuard dirty={dirty} />
      <div className="page-heading">
        <div>
          <h1>ตั้งค่าร้านค้า</h1>
          <p className="muted">
            ข้อมูลและช่องทางติดต่อที่ผู้สนใจจะเห็นในหน้าร้าน
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/shop/${shop.slug}`}>ดูหน้าร้าน</Link>
        </Button>
      </div>
      <form
        noValidate
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void send(
            "/me/shop",
            {
              name: shop.name,
              description: shop.description,
              active: shop.active,
              logoId: shop.logoId,
              coverId: shop.coverId,
              contacts: shop.contacts,
            },
            "PUT",
          )
            .then(() => {
              setDirty(false);
              toast("บันทึกร้านค้าแล้ว");
            })
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        <Field
          label="ชื่อร้าน"
          value={shop.name}
          onChange={(e) => change("name", e.target.value)}
        />
        <Textarea
          label="รายละเอียดร้าน"
          value={shop.description}
          onChange={(e) => change("description", e.target.value)}
        />
        <div className="form-grid">
          <ImageUpload
            label="โลโก้ร้าน"
            max={1}
            ids={shop.logoId ? [shop.logoId] : []}
            onChange={(ids) => change("logoId", ids[0] ?? null)}
            onBusy={setUploading}
          />
          <ImageUpload
            label="ภาพหน้าปกร้าน"
            max={1}
            ids={shop.coverId ? [shop.coverId] : []}
            onChange={(ids) => change("coverId", ids[0] ?? null)}
            onBusy={setUploading}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={shop.active}
            onChange={(e) => change("active", e.target.checked)}
          />
          เปิดร้านสาธารณะ (ปิดเพื่อพักร้านและซ่อนประกาศทั้งหมด)
        </label>
        <h2>ช่องทางติดต่อ</h2>
        <p className="muted">
          เฉพาะช่องทางที่เลือก “เปิดเผย” เท่านั้นที่จะปรากฏต่อสาธารณะ
        </p>
        {shop.contacts.map((c, i) => (
          <div className="contact-editor" key={i}>
            <div className="form-grid">
              <Select
                label={`ประเภทช่องทาง ${i + 1}`}
                value={c.type}
                onChange={(e) => contact(i, { type: e.target.value })}
              >
                {Object.entries(contactLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <Field
                label={`ข้อมูลติดต่อ ${i + 1}`}
                value={c.value}
                onChange={(e) => contact(i, { value: e.target.value })}
                placeholder={
                  c.type === "PHONE"
                    ? "08x-xxx-xxxx"
                    : c.type === "LINE"
                      ? "LINE ID"
                      : "https://"
                }
              />
            </div>
            <div className="button-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={c.visible}
                  onChange={(e) => contact(i, { visible: e.target.checked })}
                />
                เปิดเผย
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={c.primary}
                  onChange={(e) => contact(i, { primary: e.target.checked })}
                />
                ช่องทางหลัก
              </label>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                disabled={i === 0}
                aria-label="เลื่อนช่องทางขึ้น"
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                disabled={i === shop.contacts.length - 1}
                aria-label="เลื่อนช่องทางลง"
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="นำช่องทางออกจากแบบฟอร์ม"
                onClick={() =>
                  change(
                    "contacts",
                    shop.contacts.filter((_, n) => n !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          type="button"
          disabled={shop.contacts.length >= 15}
          onClick={() =>
            change("contacts", [
              ...shop.contacts,
              {
                type: "LINE",
                value: "",
                visible: false,
                primary: false,
                sortOrder: shop.contacts.length,
              },
            ])
          }
        >
          <Plus size={16} />
          เพิ่มช่องทาง
        </Button>
        <FormMessage error={error} />
        <div className="button-row">
          <Button type="submit" busy={busy} disabled={uploading}>
            บันทึกร้านค้า
          </Button>
        </div>
      </form>
    </>
  );
}
export function Profile() {
  const { user, refresh, logout } = useAuth(),
    toast = useToast(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [avatar, setAvatar] = useState(user?.profile.avatarId ?? null);
  return (
    <>
      <h1>ข้อมูลส่วนตัว</h1>
      <form
        noValidate
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget));
          void send(
            "/me/profile",
            { ...f, avatarId: avatar, phone: f.phone || null },
            "PUT",
          )
            .then(() => refresh())
            .then(() => toast("บันทึกข้อมูลส่วนตัวแล้ว"))
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        <ImageUpload
          label="รูปโปรไฟล์ส่วนตัว"
          max={1}
          ids={avatar ? [avatar] : []}
          onChange={(v) => setAvatar(v[0] ?? null)}
        />
        <Field
          label="ชื่อที่ใช้แสดง"
          name="displayName"
          defaultValue={user?.profile.displayName}
        />
        <Field
          label="เบอร์โทรส่วนตัว (ไม่แสดงสาธารณะ)"
          name="phone"
          type="tel"
          defaultValue={user?.profile.phone ?? ""}
        />
        <Field label="ชื่อผู้ใช้" value={user?.username ?? ""} readOnly />
        <p>สมัครเมื่อ {user && date(user.createdAt)}</p>
        <FormMessage error={error} />
        <Button busy={busy} type="submit">
          บันทึกข้อมูล
        </Button>
      </form>
      <form
        noValidate
        className="panel editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void send(
            "/me/password",
            Object.fromEntries(new FormData(e.currentTarget)),
          )
            .then(() => logout().catch(() => {}))
            .then(() => {
              toast("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่");
              void refresh();
              navigate("/login");
            })
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        <h2>เปลี่ยนรหัสผ่าน</h2>
        <PasswordField
          label="รหัสผ่านปัจจุบัน"
          name="currentPassword"
          autoComplete="current-password"
        />
        <PasswordField
          label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
          name="password"
          minLength={8}
          autoComplete="new-password"
        />
        <Button busy={busy} type="submit">
          เปลี่ยนรหัสผ่าน
        </Button>
      </form>
    </>
  );
}
interface ReferralData
  extends Page<{
    id: string;
    createdAt: string;
    referred: {
      username: string;
      status: string;
    };
  }> {
  counted: number;
  countAt: string;
  code: string;
  url: string;
}
export function Referrals() {
  const [params, setParams] = useSearchParams(),
    list = useData<ReferralData>(
      `/me/referrals?page=${params.get("page") ?? 1}`,
    ),
    [qr, setQr] = useState(""),
    toast = useToast();
  useEffect(() => {
    let active = true;
    if (list.data)
      void QRCode.toDataURL(list.data.url, {
        width: 240,
        margin: 2,
        color: { dark: "#30261e", light: "#ffffff" },
      }).then((v) => {
        if (active) setQr(v);
      });
    return () => {
      active = false;
    };
  }, [list.data]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>แนะนำเพื่อน</h1>
          <p className="muted">ชวนเพื่อนมาร่วมชุมชนคนรักพระเครื่อง</p>
        </div>
      </div>
      <State {...list} retry={list.reload}>
        {list.data && (
          <>
            <div className="panel referral-panel">
              {qr && (
                <img
                  src={qr}
                  alt="QR Code ลิงก์แนะนำเพื่อน"
                  width="200"
                  height="200"
                />
              )}
              <div>
                <span className="eyebrow">รหัสแนะนำของคุณ</span>
                <h2 className="referral-code">{list.data.code}</h2>
                <p className="break-all">{list.data.url}</p>
                <div className="button-row">
                  <Button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(list.data!.url)
                        .then(() => toast("คัดลอกลิงก์แล้ว"))
                        .catch(() => toast("คัดลอกไม่สำเร็จ"))
                    }
                  >
                    <Copy size={16} />
                    คัดลอกลิงก์
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (navigator.share)
                        void navigator
                          .share({
                            title: "มาร่วมตลาดพระเครื่อง",
                            url: list.data!.url,
                          })
                          .catch(() => {});
                      else
                        void navigator.clipboard
                          .writeText(list.data!.url)
                          .then(() => toast("คัดลอกลิงก์สำหรับแชร์แล้ว"));
                    }}
                  >
                    <Share2 size={16} />
                    แชร์ลิงก์
                  </Button>
                </div>
                <p className="muted">
                  นับเมื่อสมัครสมาชิกสำเร็จ
                  ไม่มีค่าคอมมิชชันหรือผลตอบแทนเป็นเงิน
                </p>
              </div>
            </div>
            <h2>ผู้แนะนำที่นับตามนโยบาย {list.data.counted} คน</h2>
            <p>ผู้สมัครผ่านลิงก์ทั้งหมด {list.data.total} คน</p>
            <State empty={!list.data.items.length}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อผู้ใช้</th>
                      <th>วันที่สมัคร</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.referred.username}
                        </td>
                        <td>{date(r.createdAt)}</td>
                        <td>
                          {r.referred.status === "ACTIVE"
                            ? "ใช้งานปกติ"
                            : "ระงับบัญชี"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </State>
            <Pagination
              {...list.data}
              onPage={(p) => setParams({ page: String(p) })}
            />
          </>
        )}
      </State>
    </>
  );
}
export function Favorites() {
  const [params, setParams] = useSearchParams(),
    list = useData<Page<Amulet>>(
      `/me/favorites?page=${params.get("page") ?? 1}`,
    );
  return (
    <>
      <h1>รายการโปรด</h1>
      <p className="muted">
        พระเครื่องที่คุณบันทึกไว้ แสดงเฉพาะประกาศที่ยังเผยแพร่
      </p>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="product-grid member-grid">
          {list.data?.items.map((a) => (
            <AmuletCard key={a.id} item={a} saved onSaved={list.reload} />
          ))}
        </div>
        {list.data && (
          <Pagination
            {...list.data}
            onPage={(p) => setParams({ page: String(p) })}
          />
        )}
      </State>
    </>
  );
}
export function Notifications() {
  const [params, setParams] = useSearchParams(),
    list = useData<Page<Notice> & { unread: number }>(
      `/me/notifications?page=${params.get("page") ?? 1}`,
    ),
    toast = useToast();
  useEffect(() => {
    const t = setInterval(list.reload, 30000);
    return () => clearInterval(t);
  }, [list.reload]);
  function read(id?: string) {
    void send("/me/notifications/read", id ? { id } : {})
      .then(list.reload)
      .catch((e) => toast(e.message));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>การแจ้งเตือน</h1>
          <p>{list.data?.unread ?? 0} รายการยังไม่อ่าน</p>
        </div>
        <Button variant="outline" onClick={() => read()}>
          อ่านทั้งหมด
        </Button>
      </div>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="notice-list panel">
          {list.data?.items.map((n) => (
            <article className={!n.readAt ? "unread" : ""} key={n.id}>
              <Link to={n.href} onClick={() => read(n.id)}>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                <small>{date(n.createdAt)}</small>
              </Link>
              {!n.readAt && (
                <Button size="sm" variant="outline" onClick={() => read(n.id)}>
                  อ่านแล้ว
                </Button>
              )}
            </article>
          ))}
        </div>
        {list.data && (
          <Pagination
            {...list.data}
            onPage={(p) => setParams({ page: String(p) })}
          />
        )}
      </State>
    </>
  );
}
