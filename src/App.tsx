import { lazy, Suspense, useEffect, useState } from "react";
import {
  createBrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  Bell,
  Heart,
  Plus,
  Menu,
  Store,
  ArrowRight,
  ShieldCheck,
  X,
  LogOut,
  UserRound,
} from "lucide-react";
import { useAuth, useData, send } from "./api";
import { Button, Modal, State, useToast } from "./components/ui";
import type { Notice, Page, Settings } from "./types";
import { date, media } from "./types";
import {
  Home,
  Catalog,
  Detail,
  Shops,
  ShopPage,
  InfoPage,
} from "./pages/public";
import { AuthPage } from "./pages/auth";
import { PopupSlideshow } from "./components/popup-slideshow";
const MemberLayout = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.MemberLayout })),
);
const MemberListings = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.MemberListings })),
);
const ListingEditor = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.ListingEditor })),
);
const ShopEditor = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.ShopEditor })),
);
const Profile = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.Profile })),
);
const Referrals = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.Referrals })),
);
const Favorites = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.Favorites })),
);
const Notifications = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.Notifications })),
);
const SupportPage = lazy(() => import("./pages/support").then(m => ({default:m.SupportPage})));
const AdminLayout = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminLayout })),
);
const AdminListings = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminListings })),
);
const AdminUsers = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminUsers })),
);
const AdminReports = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminReports })),
);
const AdminContent = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminContent })),
);
const AdminCategories = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminCategories })),
);
const AdminSettings = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminSettings })),
);
const AdminAudit = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminAudit })),
);
const AdminSocial = lazy(() => import("./pages/admin-extra").then(m=>({default:m.AdminSocial})));
function SearchBar({ className = "" }: { className?: string }) {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      noValidate
      className={`search-box ${className}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/catalog${q ? "?q=" + encodeURIComponent(q) : ""}`);
      }}
    >
      <Search size={18} />
      <label className="sr-only" htmlFor={`search-${className}`}>
        ค้นหาพระเครื่อง
      </label>
      <input
        id={`search-${className}`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาพระเครื่อง วัด หรือเกจิอาจารย์…"
      />
      {q && (
        <button
          type="button"
          aria-label="ล้างคำค้น"
          onClick={() => {
            setQ("");
            navigate("/catalog");
          }}
        >
          <X size={16} />
        </button>
      )}
      <button className="search-submit" type="submit">
        ค้นหา
      </button>
    </form>
  );
}
function NotificationBell() {
  const { user } = useAuth(),
    [open, setOpen] = useState(false),
    toast = useToast();
  const { data, error, loading, reload } = useData<
    Page<Notice> & { unread: number }
  >(user ? "/me/notifications?limit=5" : null);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload, user]);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`การแจ้งเตือน ${data?.unread ?? 0} รายการยังไม่อ่าน`}
        onClick={() => { if (user) reload(); setOpen(true); }}
      >
        <Bell size={20} />
        {!!data?.unread && (
          <span className="badge-dot">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="การแจ้งเตือน">
        {!user ? (
          <div className="empty">
            <Bell />
            <p>เข้าสู่ระบบเพื่อติดตามสถานะประกาศของคุณ</p>
            <Button asChild>
              <Link to="/login" onClick={() => setOpen(false)}>
                เข้าสู่ระบบ
              </Link>
            </Button>
          </div>
        ) : (
          <State
            loading={loading}
            error={error}
            retry={reload}
            empty={!data?.items.length}
          >
            <div className="notice-list">
              {data?.items.map((n) => (
                <Link
                  className={!n.readAt ? "unread" : ""}
                  key={n.id}
                  to={n.href}
                  onClick={() => {
                    void send("/me/notifications/read", { id: n.id })
                      .then(reload)
                      .catch((e) => toast(e.message));
                    setOpen(false);
                  }}
                >
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>{date(n.createdAt)}</small>
                </Link>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void send("/me/notifications/read")
                  .then(() => {
                    reload();
                    toast("อ่านการแจ้งเตือนทั้งหมดแล้ว");
                  })
                  .catch((e) => toast(e.message))
              }
            >
              ทำเครื่องหมายอ่านทั้งหมด
            </Button>
            <Link
              className="text-link"
              to="/dashboard/notifications"
              onClick={() => setOpen(false)}
            >
              ดูการแจ้งเตือนทั้งหมด <ArrowRight size={16} />
            </Link>
          </State>
        )}
      </Modal>
    </>
  );
}
function PopupManager() {
  const location = useLocation(), { user, loading, error } = useAuth();
  if (loading || error) return null;
  return <PopupSlideshow key={`${location.pathname}:${user?.id ?? "guest"}`} page={location.pathname} />;
}
function Shell() {
  const { user, logout, error, refresh } = useAuth(),
    [menuKey, setMenuKey] = useState<string | null>(null),
    toast = useToast(),
    location = useLocation();
  const { data: settings } = useData<Settings>("/settings");
  const menu = menuKey === location.key;
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${location.pathname.startsWith("/admin") ? "จัดการระบบ" : location.pathname.startsWith("/dashboard") ? "จัดการร้านค้า" : location.pathname === "/catalog" ? "ค้นหาพระเครื่อง" : location.pathname === "/login" ? "เข้าสู่ระบบ" : "ตลาดพระเครื่อง"} | Thai Amulet Market`;
  }, [location.pathname]);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.style.setProperty(
      "--primary",
      settings.primaryColor,
    );
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", settings.description);
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.append(favicon);
    }
    favicon.href = settings.faviconId
      ? media(settings.faviconId)
      : "/brand/mark.svg";
  }, [settings]);
  return (
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหาหลัก
      </a>
      <div className="top-strip">
        <div className="container">
          <span>
            <ShieldCheck size={13} /> พื้นที่พบปะของคนรักพระเครื่อง
          </span>
          <Link to="/guide">
            เริ่มต้นเปิดร้านกับเรา <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <Link className="brand" to="/">
            <span className="brand-mark">
              {settings?.logoId ? (
                <img
                  src={media(settings.logoId)}
                  alt=""
                  width="40"
                  height="40"
                />
              ) : (
                <img src="/brand/mark.svg" alt="" width="40" height="40" />
              )}
            </span>
            <span>
              <strong>{settings?.name ?? "ตลาดพระเครื่อง"}</strong>
              <small>THAI AMULET MARKET</small>
            </span>
          </Link>
          <SearchBar className="desktop-search" />
          <div className="header-actions">
            <Button variant="ghost" size="icon" asChild>
              <Link
                to={user ? "/dashboard/favorites" : "/login"}
                aria-label="รายการโปรด"
              >
                <Heart size={21} />
              </Link>
            </Button>
            <NotificationBell />
            <span className="header-divider" />
            {user ? (
              <Link className="account-link" to="/dashboard">
                <span className="avatar-small">
                  {user.profile.avatarId ? (
                    <img
                      src={media(user.profile.avatarId, true)}
                      alt=""
                      width="32"
                      height="32"
                    />
                  ) : (
                    user.profile.displayName[0]
                  )}
                </span>
                <span>{user.profile.displayName}</span>
              </Link>
            ) : (
              <Link className="login-link" to="/login">
                <UserRound size={17} />
                เข้าสู่ระบบ
              </Link>
            )}
            <Button asChild className="post-button">
              <Link to={user ? "/dashboard/new" : "/login"}>
                <Plus size={17} />
                ลงประกาศ
              </Link>
            </Button>
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="เปิดเมนู"
              aria-expanded={menu}
              onClick={() => setMenuKey(menu ? null : location.key)}
            >
              <Menu size={22} />
            </Button>
          </div>
        </div>
        <nav
          className={`main-nav ${menu ? "expanded" : ""}`}
          aria-label="เมนูหลัก"
        >
          <div className="container nav-inner">
            <NavLink to="/" end>
              หน้าแรก
            </NavLink>
            <NavLink to="/catalog">พระเครื่องทั้งหมด</NavLink>
            <NavLink to="/catalog?featured=true">พระเครื่องแนะนำ</NavLink>
            <NavLink to="/shops">ร้านพระเครื่อง</NavLink>
            <NavLink to="/guide">คู่มือการใช้งาน</NavLink>
            <NavLink to="/contact">ติดต่อเรา</NavLink>
            {user && <NavLink to="/dashboard">ร้านค้าของฉัน</NavLink>}
            {user && user.role !== "MEMBER" && (
              <NavLink to="/admin">หลังบ้าน</NavLink>
            )}
            <span className="nav-note">
              <Store size={14} /> เปิดร้านได้ฟรี ไม่มีค่าธรรมเนียม
            </span>
            {user && menu && (
              <button
                onClick={() =>
                  void logout()
                    .then(() => toast("ออกจากระบบแล้ว"))
                    .catch((e) => toast(e.message))
                }
              >
                <LogOut size={16} />
                ออกจากระบบ
              </button>
            )}
          </div>
        </nav>
        <div className="container mobile-search">
          <SearchBar className="phone-search" />
        </div>
      </header>
      {error && (
        <div className="connection-error">
          เชื่อมต่อระบบไม่ได้: {error}{" "}
          <button onClick={() => void refresh()}>ลองอีกครั้ง</button>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<State loading />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Link className="brand" to="/">
              <img src="/brand/mark.svg" alt="" width="38" height="38" />
              <span>
                <strong>{settings?.name ?? "ตลาดพระเครื่อง"}</strong>
                <small>THAI AMULET MARKET</small>
              </span>
            </Link>
            <p>{settings?.description ?? "พื้นที่พบปะของคนรักพระเครื่อง"}</p>
          </div>
          <div>
            <strong>สำรวจตลาดพระเครื่อง</strong>
            <Link to="/catalog">พระเครื่องทั้งหมด</Link>
            <Link to="/shops">ร้านพระเครื่อง</Link>
            <Link to="/catalog?sort=popular">พระเครื่องยอดเข้าชม</Link>
          </div>
          <div>
            <strong>สำหรับสมาชิก</strong>
            <Link to={settings?.registrationEnabled === false ? "/login" : "/register"}>{settings?.registrationEnabled === false ? "เข้าสู่ระบบสมาชิก" : "สมัครสมาชิก"}</Link>
            <Link to="/dashboard">จัดการร้านค้า</Link>
            <Link to="/guide">วิธีลงประกาศ</Link>
          </div>
          <div>
            <strong>ข้อมูลเว็บไซต์</strong>
            <Link to="/about">เกี่ยวกับเราและข้อควรทราบ</Link>
            <Link to="/privacy">ความเป็นส่วนตัว</Link>
            <Link to="/contact">ติดต่อผู้ดูแล</Link>
            {settings?.socialLinks.filter(s=>s.enabled).map(s=><a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()}{" "}
            {settings?.footer ?? "Thai Amulet Market"}
          </span>
          <span>ติดต่อผู้ขายโดยตรง · ไม่มีระบบชำระเงินภายในเว็บไซต์</span>
        </div>
      </footer>
      <PopupManager />
    </>
  );
}
function Guard({ admin = false }: { admin?: boolean }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading || error)
    return (
      <div className="container page">
        <State loading={loading} error={error} retry={() => void refresh()} />
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (admin && user.role === "MEMBER") return <InfoPage mode="forbidden" />;
  return (
    <Suspense fallback={<State loading />}>
      <Outlet />
    </Suspense>
  );
}
export const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: (
      <div className="container page">
        <h1>ไม่สามารถเปิดหน้านี้ได้</h1>
        <a href="/">กลับหน้าแรก</a>
      </div>
    ),
    children: [
      { path: "/", element: <Home /> },
      { path: "/catalog", element: <Catalog /> },
      { path: "/amulet/:id", element: <Detail /> },
      { path: "/shops", element: <Shops /> },
      { path: "/shop/:slug", element: <ShopPage /> },
      { path: "/login", element: <AuthPage /> },
      { path: "/register", element: <AuthPage register /> },
      ...["guide", "about", "privacy", "contact"].map((mode) => ({
        path: `/${mode}`,
        element: <InfoPage mode={mode} />,
      })),
      {
        element: <Guard />,
        children: [
          {
            path: "/dashboard",
            element: <MemberLayout />,
            children: [
              { index: true, element: <MemberListings /> },
              { path: "new", element: <ListingEditor /> },
              { path: "edit/:id", element: <ListingEditor /> },
              { path: "shop", element: <ShopEditor /> },
              { path: "profile", element: <Profile /> },
              { path: "referrals", element: <Referrals /> },
              { path: "favorites", element: <Favorites /> },
              { path: "notifications", element: <Notifications /> },
              { path: "support", element: <SupportPage /> },
              { path: "support/new", element: <SupportPage create /> },
              { path: "support/:id", element: <SupportPage /> },
            ],
          },
        ],
      },
      {
        element: <Guard admin />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminListings /> },
              { path: "users", element: <AdminUsers /> },
              { path: "reports", element: <AdminReports /> },
              { path: "support", element: <SupportPage staff /> },
              { path: "support/:id", element: <SupportPage staff /> },
              { path: "categories", element: <AdminCategories /> },
              { path: "content", element: <AdminContent /> },
              { path: "settings", element: <AdminSettings /> },
              { path: "social", element: <AdminSocial /> },
              { path: "audit", element: <AdminAudit /> },
            ],
          },
        ],
      },
      { path: "*", element: <InfoPage mode="notfound" /> },
    ],
  },
]);
