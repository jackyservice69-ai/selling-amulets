import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  SlidersHorizontal,
  ShieldCheck,
  MessageCircle,
  Store,
  Plus,
  Search,
  Flag,
  Eye,
  BookOpen,
  Check,
  Heart,
} from "lucide-react";
import { useAuth, useData, send } from "../api";
import {
  Button,
  Field,
  Select,
  Textarea,
  State,
  Pagination,
  Modal,
  FormMessage,
  useToast,
} from "../components/ui";
import { AmuletCard, Contacts } from "../components/catalog";
import {
  type Amulet,
  type Category,
  type Page,
  type Shop,
  type Banner,
  type Announcement,
  type Settings,
  media,
  listingPrice,
  listingTypeLabel,
  date,
} from "../types";
function SectionTitle({
  eyebrow,
  title,
  to,
  children,
}: {
  eyebrow?: string;
  title: string;
  to?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {to ? (
        <Link className="text-link" to={to}>
          ดูทั้งหมด <ArrowRight size={17} />
        </Link>
      ) : (
        children
      )}
    </div>
  );
}
export function Home() {
  const { data: site } = useData<Settings>("/settings");
  const { data: categories } = useData<Category[]>("/categories"),
    latest = useData<Page<Amulet>>("/amulets?limit=8"),
    featured = useData<Page<Amulet>>("/amulets?featured=true&limit=4"),
    popular = useData<Page<Amulet>>("/amulets?sort=popular&limit=4"),
    shops = useData<Page<Shop>>("/shops?featured=true&limit=3"),
    content = useData<{ banners: Banner[]; announcements: Announcement[] }>(
      "/content",
    );
  return (
    <>
      <section className="hero-section">
        <div className="container hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />
              แหล่งรวมพระเครื่องและวัตถุมงคล
            </div>
            <h1>
              เรื่องราวแห่งศรัทธา
              <br />
              คุณค่าที่<span>ส่งต่อกันได้</span>
            </h1>
            <p>
              ค้นพบพระเครื่องที่คุณตามหา จากร้านค้าและนักสะสม
              <br className="desktop-only" />
              ในพื้นที่ที่ให้ความสำคัญกับทุกรายละเอียด
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link to="/catalog">
                  สำรวจพระเครื่อง <ArrowRight size={18} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={site?.registrationEnabled === false ? "/login" : "/register"}>
                  <Store size={18} />
                  {site?.registrationEnabled === false ? "เข้าสู่ระบบสมาชิก" : "เปิดร้านของคุณ"}
                </Link>
              </Button>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={17} /> ตรวจประกาศก่อนเผยแพร่
              </span>
              <span>
                <MessageCircle size={17} /> ติดต่อเจ้าของร้านโดยตรง
              </span>
            </div>
          </div>
          <div className="hero-art">
            <img
              src={site?.heroId ? media(site.heroId) : "/brand/hero.webp"}
              alt="ภาพประกอบพระสมเด็จบนแท่นไม้สำหรับสาธิตเว็บไซต์"
              fetchPriority="high"
              width="680"
              height="580"
            />
            <div className="hero-art-label">
              <span>คัดสรรเรื่องราว • ส่งต่อคุณค่า</span>
              <strong>พระเครื่องและวัตถุสะสม</strong>
              <small>ภาพประกอบเพื่อสาธิต</small>
            </div>
          </div>
        </div>
      </section>
      <section className="container category-section">
        <SectionTitle title="ค้นหาตามหมวดหมู่" to="/catalog" />
        <div className="category-grid">
          {categories?.slice(0, 6).map((c) => (
            <Link
              key={c.id}
              to={`/catalog?category=${c.id}`}
              className="category-tile"
            >
              <strong>{c.name}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="เพิ่งเข้ามาในตลาด"
          title="พระเครื่องลงใหม่"
          to="/catalog"
        />
        <State
          {...latest}
          empty={!latest.data?.items.length}
          retry={latest.reload}
        >
          <div className="product-grid">
            {latest.data?.items.map((a) => (
              <AmuletCard key={a.id} item={a} />
            ))}
          </div>
        </State>
      </section>
      <div className="container">
        <aside className="trust-banner">
          <div className="trust-icon">
            <ShieldCheck size={30} />
          </div>
          <div>
            <h2>รู้จักก่อนสะสม สอบถามก่อนตัดสินใจ</h2>
            <p>
              {site?.notice ??
                "ราคาจากผู้ลงประกาศ โปรดตรวจสอบรายละเอียดและติดต่อร้านค้าโดยตรง การอนุมัติประกาศไม่ใช่การรับรองความแท้"}
            </p>
          </div>
          <Link to="/guide">
            อ่านคู่มือ <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
      {!!featured.data?.items.length && (
        <section className="container section">
          <SectionTitle
            eyebrow="น่าสนใจสำหรับนักสะสม"
            title="พระเครื่องแนะนำ"
            to="/catalog?featured=true"
          />
          <div className="product-grid">
            {featured.data.items.map((a) => (
              <AmuletCard key={a.id} item={a} />
            ))}
          </div>
        </section>
      )}
      <section className="shops-section">
        <div className="container">
          <SectionTitle
            eyebrow="รู้จักคนที่รักในสิ่งเดียวกัน"
            title="ร้านพระเครื่องแนะนำ"
            to="/shops"
          />
          <State
            {...shops}
            empty={!shops.data?.items.length}
            retry={shops.reload}
          >
            <div className="shop-grid">
              {shops.data?.items.map((s) => (
                <ShopCard key={s.id} shop={s} />
              ))}
            </div>
          </State>
        </div>
      </section>
      {!!popular.data?.items.length && (
        <section className="container section">
          <SectionTitle
            title="พระเครื่องยอดเข้าชม"
            to="/catalog?sort=popular"
          />
          <div className="product-grid">
            {popular.data.items.map((a) => (
              <AmuletCard key={a.id} item={a} />
            ))}
          </div>
        </section>
      )}
      {!!content.data?.banners.length && (
        <section className="container section">
          <SectionTitle title="ประชาสัมพันธ์" />
          <div className="shop-grid">
            {content.data.banners.map((b) => (
              <a className="promo-banner" key={b.id} href={b.url}>
                {b.imageId && (
                  <img
                    src={media(b.imageId)}
                    alt=""
                    width="600"
                    height="240"
                    loading="lazy"
                  />
                )}
                <h3>
                  {b.title} <ArrowRight size={16} />
                </h3>
              </a>
            ))}
          </div>
        </section>
      )}
      <section className="container section">
        <div className="join-banner">
          <div>
            <span className="eyebrow">เริ่มต้นเรื่องราวของคุณ</span>
            <h2>มีพระเครื่องที่อยากส่งต่อ?</h2>
            <p>เปิดร้านและลงประกาศได้ฟรี ให้คนที่สนใจค้นพบสิ่งสะสมของคุณ</p>
          </div>
          <Button asChild>
            <Link to="/dashboard/new">
              <Plus size={18} />
              เริ่มลงประกาศ
            </Link>
          </Button>
        </div>
      </section>
      {!!content.data?.announcements.length && (
        <section className="container section news-section">
          <SectionTitle title="ข่าวสารจากตลาดพระเครื่อง" />
          {content.data.announcements.map((n) => (
            <details key={n.id}>
              <summary>
                <BookOpen size={18} />
                {n.title}
                <span>{date(n.createdAt)}</span>
              </summary>
              <p className="preserve">{n.body}</p>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
function ShopCard({ shop: s }: { shop: Shop }) {
  return (
    <Link to={`/shop/${s.slug}`} className="shop-card">
      <div className="shop-avatar">
        {s.logoId ? (
          <img src={media(s.logoId, true)} alt="" width="64" height="64" />
        ) : (
          <Store size={27} />
        )}
      </div>
      <div>
        <h3>{s.name}</h3>
        <p>{s.description || "ร้านพระเครื่องและวัตถุสะสม"}</p>
        <small>
          {s._count?.amulets ?? 0} ประกาศ · {s.views.toLocaleString("th-TH")}{" "}
          เข้าชม
        </small>
      </div>
      <ArrowRight size={18} />
    </Link>
  );
}
export function Catalog() {
  const [params, setParams] = useSearchParams();
  const categories = useData<Category[]>("/categories"),
    list = useData<Page<Amulet>>(`/amulets?${params}`),
    [q, setQ] = useState(params.get("q") ?? ""),
    [filters, setFilters] = useState(false);
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <Link to="/">หน้าแรก</Link>
        <ChevronRight size={13} />
        <span>พระเครื่องทั้งหมด</span>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ค้นพบสิ่งสะสมที่มีคุณค่า</span>
          <h1>
            {params.get("featured") === "true"
              ? "พระเครื่องแนะนำ"
              : "พระเครื่องทั้งหมด"}
          </h1>
          <p className="muted">
            เลือกชมพระเครื่อง วัตถุมงคล และของสะสมจากร้านค้า
          </p>
        </div>
        <Button variant="outline" onClick={() => setFilters(!filters)}>
          <SlidersHorizontal size={17} />
          ตัวกรอง
        </Button>
      </div>
      <div className="catalog-toolbar">
        <form
          noValidate
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", q);
          }}
        >
          <Search size={18} />
          <label className="sr-only" htmlFor="catalog-search">
            ค้นหารายการ
          </label>
          <input
            id="catalog-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ชื่อพระ วัด เกจิ หรือร้านค้า"
          />
          {q && (
            <button
              type="button"
              aria-label="ล้างคำค้น"
              onClick={() => {
                setQ("");
                set("q", "");
              }}
            >
              <XIcon />
            </button>
          )}
          <button type="submit" className="search-submit">
            ค้นหา
          </button>
        </form>
        <Select
          label="เรียงรายการ"
          value={params.get("sort") ?? "newest"}
          onChange={(e) => set("sort", e.target.value)}
        >
          <option value="newest">ลงใหม่ล่าสุด</option>
          <option value="price_asc">ราคาน้อยไปมาก</option>
          <option value="price_desc">ราคามากไปน้อย</option>
          <option value="popular">ยอดเข้าชมสูงสุด</option>
        </Select>
      </div>
      <div className="category-chips">
        <button
          className={!params.get("category") ? "active" : ""}
          onClick={() => set("category", "")}
        >
          ทั้งหมด
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            className={params.get("category") === c.id ? "active" : ""}
            onClick={() => set("category", c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {filters && (
        <form
          noValidate
          className="filter-panel panel"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              next = new URLSearchParams(params);
            for (const key of ["min", "max"]) {
              const val = String(f.get(key) ?? "");
              if (val) next.set(key, val);
              else next.delete(key);
            }
            next.delete("page");
            setParams(next);
          }}
        >
          <Field
            label="ราคาต่ำสุด (บาท)"
            name="min"
            type="number"
            min="0"
            defaultValue={params.get("min") ?? ""}
          />
          <Field
            label="ราคาสูงสุด (บาท)"
            name="max"
            type="number"
            min="0"
            defaultValue={params.get("max") ?? ""}
          />
          <Button type="submit">ใช้ตัวกรอง</Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setParams({});
              setQ("");
            }}
          >
            ล้างทั้งหมด
          </Button>
        </form>
      )}
      <p className="result-count">
        {list.loading
          ? "กำลังค้นหา…"
          : `พบ ${list.data?.total.toLocaleString("th-TH") ?? 0} รายการ`}
      </p>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="product-grid">
          {list.data?.items.map((a) => (
            <AmuletCard key={a.id} item={a} />
          ))}
        </div>
        {list.data && (
          <Pagination
            {...list.data}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        )}
      </State>
    </div>
  );
}
function XIcon() {
  return <span aria-hidden="true">×</span>;
}
export function Detail() {
  const { id } = useParams(),
    item = useData<Amulet>(`/amulets/${id}`),
    [image, setImage] = useState(0),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("ข้อมูลที่น่าสงสัย"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const { user } = useAuth(),
    toast = useToast();
  const similar = useData<Page<Amulet>>(
      item.data ? `/amulets?category=${item.data.categoryId}&limit=5` : null,
    ),
    sameShop = useData<Page<Amulet>>(
      item.data ? `/amulets?shop=${item.data.shop.slug}&limit=5` : null,
    );
  async function submitReport() {
    setBusy(true);
    setError(null);
    try {
      await send(`/amulets/${id}/reports`, { reason, details });
      setReport(false);
      toast("ส่งรายงานให้ผู้ดูแลแล้ว");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const a = item.data;
  return (
    <div className="container page">
      <State {...item} retry={item.reload}>
        {a && (
          <>
            <div className="breadcrumbs">
              <Link to="/">หน้าแรก</Link>
              <ChevronRight size={13} />
              <Link to="/catalog">พระเครื่องทั้งหมด</Link>
              <ChevronRight size={13} />
              <span>{a.category.name}</span>
            </div>
            <div className="detail-grid">
              <div>
                <div className="detail-image">
                  <img
                    src={media(a.images[image]?.uploadId)}
                    alt={`${a.title} ภาพที่ ${image + 1}`}
                    width="800"
                    height="800"
                  />
                </div>
                <div className="thumbnails">
                  {a.images.map((im, i) => (
                    <button
                      key={im.uploadId}
                      aria-label={`ดูภาพที่ ${i + 1}`}
                      aria-pressed={image === i}
                      onClick={() => setImage(i)}
                    >
                      <img
                        src={media(im.uploadId, true)}
                        alt=""
                        width="100"
                        height="100"
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="detail-info">
                <span className="eyebrow">{a.category.name} · {listingTypeLabel(a.listingType)}</span>
                <h1>{a.title}</h1>
                <div className="detail-meta">
                  <span>
                    <Eye size={15} />
                    {a.views} เข้าชม
                  </span>
                  <span>ลงประกาศ {date(a.createdAt)}</span>
                </div>
                <p className="detail-price">{listingPrice(a)}</p>
                <p className="muted">
                  {a.listingType === "SHOW" ? "ประกาศเพื่อแบ่งปันให้ชม ไม่เปิดขาย" : "ราคาอ้างอิงจากผู้ลงประกาศ · ติดต่อร้านค้าเพื่อสอบถามรายละเอียด"}
                </p>
                <dl className="facts">
                  {[
                    ["วัด / สำนัก", a.temple],
                    ["เกจิอาจารย์", a.master],
                    ["ปีที่สร้าง", a.year],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "ไม่ได้ระบุ"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="seller-box">
                  <Link className="seller-heading" to={`/shop/${a.shop.slug}`}>
                    <div className="shop-avatar">
                      {a.shop.logoId ? (
                        <img
                          src={media(a.shop.logoId, true)}
                          alt=""
                          width="48"
                          height="48"
                        />
                      ) : (
                        <Store size={24} />
                      )}
                    </div>
                    <div>
                      <small>ลงประกาศโดย</small>
                      <h2>{a.shop.name}</h2>
                    </div>
                    <ArrowRight size={18} />
                  </Link>
                  <Contacts contacts={a.shop.contacts ?? []} />
                </div>
                <div className="detail-buttons">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!user) {
                        toast("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด");
                        return;
                      }
                      void send(`/me/favorites/${a.id}`, { saved: true }, "PUT")
                        .then(() => toast("บันทึกรายการโปรดแล้ว"))
                        .catch((e) => toast(e.message));
                    }}
                  >
                    <Heart size={17} />
                    บันทึกรายการโปรด
                  </Button>
                  <Button variant="ghost" onClick={() => setReport(true)}>
                    <Flag size={16} />
                    รายงานประกาศ
                  </Button>
                </div>
              </div>
            </div>
            <section className="panel detail-description">
              <h2>รายละเอียดพระเครื่อง</h2>
              <p className="preserve">{a.description}</p>
              <aside className="inline-note">
                <ShieldCheck size={20} />
                ข้อมูลประวัติและความแท้เป็นข้อมูลจากผู้ลงประกาศ
                เว็บไซต์ตรวจสอบความเหมาะสมของประกาศและไม่รับรองความแท้อัตโนมัติ
              </aside>
            </section>
            <section className="section">
              <SectionTitle
                title="ประกาศอื่นจากร้านนี้"
                to={`/shop/${a.shop.slug}`}
              />
              <div className="product-grid">
                {sameShop.data?.items
                  .filter((i) => i.id !== id)
                  .slice(0, 4)
                  .map((i) => (
                    <AmuletCard key={i.id} item={i} />
                  ))}
              </div>
            </section>
            <section className="section">
              <SectionTitle
                title="พระเครื่องในหมวดเดียวกัน"
                to={`/catalog?category=${a.categoryId}`}
              />
              <div className="product-grid">
                {similar.data?.items
                  .filter((i) => i.id !== id)
                  .slice(0, 4)
                  .map((i) => (
                    <AmuletCard key={i.id} item={i} />
                  ))}
              </div>
            </section>
          </>
        )}
      </State>
      <Modal open={report} onOpenChange={setReport} title="รายงานประกาศ">
        {user ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submitReport();
            }}
          >
            <Select
              label="เหตุผล"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {[
                "ข้อมูลไม่เหมาะสม",
                "รูปภาพไม่ตรงกับรายละเอียด",
                "ข้อมูลที่น่าสงสัย",
                "เนื้อหาซ้ำ",
                "ช่องทางติดต่อไม่ถูกต้อง",
                "อื่น ๆ",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Textarea
              label="รายละเอียดเพิ่มเติม"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <FormMessage error={error} />
            <Button type="submit" busy={busy}>
              ส่งรายงาน
            </Button>
          </form>
        ) : (
          <>
            <p>กรุณาเข้าสู่ระบบเพื่อส่งรายงาน</p>
            <Button asChild>
              <Link to="/login">เข้าสู่ระบบ</Link>
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
export function Shops() {
  const [params, setParams] = useSearchParams(),
    list = useData<Page<Shop>>(`/shops?${params}`);
  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ชุมชนคนรักพระเครื่อง</span>
          <h1>ร้านพระเครื่อง</h1>
          <p>เลือกชมสิ่งสะสมและรู้จักร้านค้าที่คุณสนใจ</p>
        </div>
        <Store size={40} />
      </div>
      <State {...list} retry={list.reload} empty={!list.data?.items.length}>
        <div className="shop-grid">
          {list.data?.items.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
        {list.data && (
          <Pagination
            {...list.data}
            onPage={(p) => setParams({ page: String(p) })}
          />
        )}
      </State>
    </div>
  );
}
export function ShopPage() {
  const { slug } = useParams(),
    [params, setParams] = useSearchParams(),
    shop = useData<Shop>(`/shops/${slug}`),
    items = useData<Page<Amulet>>(
      `/amulets?shop=${slug}&page=${params.get("page") ?? 1}`,
    );
  const s = shop.data;
  return (
    <div className="container page">
      <State {...shop} retry={shop.reload}>
        {s && (
          <>
            <div
              className="shop-cover"
              style={
                s.coverId
                  ? { backgroundImage: `url(${media(s.coverId)})` }
                  : undefined
              }
            >
              <span>THAI AMULET MARKET / COLLECTOR'S STORE</span>
            </div>
            <div className="shop-profile">
              <div className="shop-avatar large">
                {s.logoId ? (
                  <img src={media(s.logoId)} alt="" width="88" height="88" />
                ) : (
                  <Store size={36} />
                )}
              </div>
              <div>
                <h1>{s.name}</h1>
                <p>
                  <Check size={15} /> เปิดร้าน · สมาชิกตั้งแต่{" "}
                  {date(s.createdAt)} · {s._count?.amulets ?? 0} ประกาศ ·{" "}
                  {s.views} เข้าชม
                </p>
              </div>
            </div>
            <div className="shop-about panel">
              <p className="preserve">
                {s.description || "ยินดีต้อนรับสู่ร้านพระเครื่อง"}
              </p>
              <Contacts contacts={s.contacts ?? []} />
            </div>
            <SectionTitle title="พระเครื่องในร้าน" />
            <State
              {...items}
              retry={items.reload}
              empty={!items.data?.items.length}
            >
              <div className="product-grid">
                {items.data?.items.map((a) => (
                  <AmuletCard key={a.id} item={a} />
                ))}
              </div>
              {items.data && (
                <Pagination
                  {...items.data}
                  onPage={(p) => setParams({ page: String(p) })}
                />
              )}
            </State>
          </>
        )}
      </State>
    </div>
  );
}
export function InfoPage({ mode }: { mode: string }) {
  const { data } = useData<Settings>("/settings");
  const title: Record<string, string> = {
    guide: "เริ่มต้นสะสมและเปิดร้าน",
    about: "เกี่ยวกับตลาดพระเครื่อง",
    privacy: "ความเป็นส่วนตัว",
    contact: "ติดต่อเรา",
    forbidden: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
    notfound: "ไม่พบหน้าที่คุณต้องการ",
  };
  return (
    <div className="container page info-page">
      <span className="eyebrow">THAI AMULET MARKET</span>
      <h1>{title[mode]}</h1>
      <div className="panel">
        {mode === "guide" ? (
          <>
            <h2>จากสิ่งสะสม สู่เรื่องราวที่ส่งต่อ</h2>
            <ol className="guide-steps">
              <li>
                <strong>สมัครสมาชิกและตั้งค่าร้าน</strong>
                <p>
                  ตั้งชื่อร้าน อัปโหลดโลโก้
                  และเลือกช่องทางติดต่อที่ต้องการเปิดเผย
                </p>
              </li>
              <li>
                <strong>ถ่ายภาพและกรอกรายละเอียด</strong>
                <p>
                  เพิ่มภาพชัดเจน ระบุชื่อ หมวดหมู่ ราคา และข้อมูลตามจริง
                  สามารถเก็บแบบร่างก่อนส่งได้
                </p>
              </li>
              <li>
                <strong>ส่งให้ผู้ดูแลตรวจสอบ</strong>
                <p>
                  ประกาศจะยังไม่ปรากฏต่อสาธารณะจนได้รับอนุมัติ
                  ดูผลและเหตุผลได้จากกระดิ่งแจ้งเตือน
                </p>
              </li>
              <li>
                <strong>ติดต่อร้านค้าโดยตรง</strong>
                <p>
                  เว็บไซต์ไม่มีระบบซื้อขายหรือชำระเงิน ตรวจสอบข้อมูล ความแท้
                  และเงื่อนไขกับผู้ลงประกาศก่อนตัดสินใจ
                </p>
              </li>
            </ol>
            <Button asChild>
              <Link to={data?.registrationEnabled === false ? "/login" : "/register"}>
                {data?.registrationEnabled === false ? "เข้าสู่ระบบสมาชิก" : "สมัครสมาชิก"} <ArrowRight size={17} />
              </Link>
            </Button>
          </>
        ) : mode === "about" ? (
          <>
            <h2>พื้นที่สำหรับคนรักพระเครื่อง</h2>
            <p>
              ตลาดพระเครื่องเป็นพื้นที่ลงประกาศพระเครื่อง วัตถุมงคล และของสะสม
              สมาชิกเปิดร้านและติดต่อกันได้โดยตรง
            </p>
            <p>
              ทุกประกาศผ่านการตรวจสอบความเหมาะสมก่อนเผยแพร่
              การอนุมัติไม่ได้รับรองความแท้ ประวัติ หรือมูลค่า
              ราคาทั้งหมดเป็นข้อมูลจากผู้ลงประกาศ ไม่มีการชำระเงิน กระเป๋าเงิน
              หรือผลตอบแทนแนะนำเพื่อนภายในเว็บไซต์
            </p>
            <p>
              ข้อมูลที่มีคำว่า “ตัวอย่าง”
              และภาพประกอบสำหรับสาธิตไม่ใช่ประกาศสินค้าจริง
            </p>
          </>
        ) : mode === "privacy" ? (
          <>
            <h2>ข้อมูลสมาชิกและช่องทางติดต่อ</h2>
            <p>
              เบอร์โทรในโปรไฟล์ รหัสผ่าน และ Session
              ไม่แสดงผ่านหน้าสาธารณะ
              ช่องทางติดต่อร้านจะปรากฏเฉพาะรายการที่คุณเลือกเปิดเผย
            </p>
            <p>
              ระบบใช้คุกกี้สำหรับการเข้าสู่ระบบ การนับยอดเข้าชมรายวัน
              และจำความถี่ของประกาศประชาสัมพันธ์
              ผู้ดูแลที่มีสิทธิ์สามารถตรวจสอบข้อมูลเพื่อดูแลระบบและรายงานประกาศได้
            </p>
            <p>
              ติดต่อผู้ดูแลเพื่อสอบถามการจัดการข้อมูลบัญชีของคุณ:{" "}
              {data?.contact}
            </p>
          </>
        ) : mode === "contact" ? (
          <>
            <h2>ช่องทางติดต่อเว็บไซต์</h2>
            <p>{data?.contact ?? "กำลังโหลดช่องทางติดต่อ…"}</p>
            <div className="button-row">{data?.socialLinks.filter(s=>s.enabled).map(s=><a className="btn btn-outline" key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
            <p><Link className="text-link" to="/dashboard/support/new">แจ้งเรื่องถึงผู้ดูแลผ่านระบบ</Link></p>
            <p>
              หากมีปัญหากับประกาศ ให้เปิดหน้ารายละเอียดและเลือก “รายงานประกาศ”
              เพื่อส่งให้ผู้ดูแลตรวจสอบ
            </p>
          </>
        ) : (
          <>
            <p>ตรวจสอบที่อยู่เว็บไซต์หรือกลับไปยังหน้าตลาดพระเครื่อง</p>
            <Button asChild>
              <Link to="/">กลับหน้าแรก</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
