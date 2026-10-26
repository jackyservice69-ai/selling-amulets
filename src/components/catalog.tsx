import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  Eye,
  Store,
  ArrowUpRight,
  Copy,
  Phone,
  ExternalLink,
} from "lucide-react";
import { useAuth, send } from "../api";
import { Button, useToast } from "./ui";
import { type Amulet, type Contact, media, listingPrice, listingTypeLabel, date } from "../types";
export function AmuletCard({
  item,
  saved = false,
  onSaved,
}: {
  item: Amulet;
  saved?: boolean;
  onSaved?: () => void;
}) {
  const [favorite, setFavorite] = useState(saved),
    [busy, setBusy] = useState(false);
  const { user } = useAuth(),
    toast = useToast(),
    navigate = useNavigate();
  async function toggle() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      await send(`/me/favorites/${item.id}`, { saved: !favorite }, "PUT");
      setFavorite(!favorite);
      toast(favorite ? "นำออกจากรายการโปรดแล้ว" : "บันทึกรายการโปรดแล้ว");
      onSaved?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="amulet-card">
      <div className="card-picture">
        <Link to={`/amulet/${item.id}`} aria-label={`ดู ${item.title}`}>
          <img
            src={media(item.images[0]?.uploadId, true)}
            alt={item.title}
            width="600"
            height="450"
            loading="lazy"
          />
        </Link>
        {item.featured && <span className="featured-label">รายการแนะนำ</span>}
        <button
          className={`favorite ${favorite ? "saved" : ""}`}
          onClick={() => void toggle()}
          disabled={busy}
          aria-label={favorite ? "นำออกจากรายการโปรด" : "เพิ่มรายการโปรด"}
          aria-pressed={favorite}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="card-content">
        <p className="category-label">{item.category.name} · {listingTypeLabel(item.listingType)}</p>
        <h3>
          <Link to={`/amulet/${item.id}`}>{item.title}</Link>
        </h3>
        <p className="card-price">{listingPrice(item)}</p>
        <Link className="shop-link" to={`/shop/${item.shop.slug}`}>
          <Store size={13} />
          {item.shop.name}
        </Link>
        <div className="card-bottom">
          <span>{date(item.createdAt)}</span>
          <span>
            <Eye size={13} />
            {item.views.toLocaleString("th-TH")}
          </span>
          <Link
            to={`/amulet/${item.id}`}
            aria-label={`รายละเอียด ${item.title}`}
          >
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export const contactLabel: Record<string, string> = {
  PHONE: "โทรศัพท์",
  LINE: "LINE ID",
  LINE_URL: "LINE",
  FACEBOOK: "Facebook",
  MESSENGER: "Messenger",
  WEBSITE: "เว็บไซต์",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  OTHER: "ช่องทางอื่น",
};
export function Contacts({ contacts }: { contacts: Contact[] }) {
  const toast = useToast();
  return (
    <div className="contacts">
      {contacts.length === 0 && (
        <p className="muted">ร้านยังไม่ได้เปิดเผยช่องทางติดต่อ</p>
      )}
      {contacts.map((c, i) => (
        <div className="contact" key={c.id ?? i}>
          <div>
            <small>
              {contactLabel[c.type]}
              {c.primary ? " · ช่องทางหลัก" : ""}
            </small>
            <strong>{c.value}</strong>
          </div>
          {c.type === "PHONE" ? (
            <a
              className="btn btn-outline btn-icon"
              aria-label={`โทร ${c.value}`}
              href={`tel:${c.value}`}
            >
              <Phone size={17} />
            </a>
          ) : c.type === "LINE" ? null : (
            <a
              className="btn btn-outline btn-icon"
              aria-label={`เปิด ${contactLabel[c.type]}`}
              href={c.value}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={17} />
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`คัดลอก ${c.value}`}
            onClick={() =>
              void navigator.clipboard
                .writeText(c.value)
                .then(() => toast("คัดลอกข้อมูลติดต่อแล้ว"))
                .catch(() =>
                  toast("คัดลอกไม่สำเร็จ กรุณาคัดลอกข้อความด้วยตนเอง"),
                )
            }
          >
            <Copy size={17} />
          </Button>
        </div>
      ))}
    </div>
  );
}
