import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { api, ApiError, useData } from "../api";
import { media, type Popup } from "../types";
import { Button, Modal } from "./ui";

export function PopupSlideshow({ page }: { page: string }) {
  const { data } = useData<Popup[]>(`/popups?page=${encodeURIComponent(page)}`);
  return data?.length ? <Slides items={data} page={page} /> : null;
}

function Slides({ items, page }: { items: Popup[]; page: string }) {
  const [ready, setReady] = useState<string[]>([]);
  const [current, setCurrent] = useState<Popup | null>(null);
  const [closed, setClosed] = useState(false);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const claimed = useRef(new Map<string, Popup>());
  const pending = useRef(false);
  const dismissed = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const retryId = useRef<string | null>(null);
  const index = current ? ready.indexOf(current.id) : -1;

  useEffect(() => {
    const connection = new AbortController();
    controller.current = connection;
    return () => connection.abort();
  }, []);
  useEffect(() => {
    if (closed) return;
    const timers = items.map(item => setTimeout(() => {
      setReady(ids => ids.includes(item.id) ? ids : [...ids, item.id]);
    }, item.delaySeconds * 1000));
    return () => timers.forEach(clearTimeout);
  }, [items, closed]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => { if (reduced.matches) setPaused(true); };
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motion);
    };
  }, []);

  const show = useCallback(async (id: string) => {
    if (pending.current || dismissed.current || document.hidden) return;
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const candidate = claimed.current.get(id) ?? items.find(item => item.id === id);
      if (!candidate || new Date(candidate.endsAt).getTime() < Date.now()) throw new ApiError("ประกาศสิ้นสุดแล้ว", 409);
      const slide = claimed.current.get(id) ?? await api<Popup>(`/popups/${id}/claim`, {
        method: "POST", body: JSON.stringify({ page }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (signal.aborted || dismissed.current) return;
      claimed.current.set(id, slide);
      retryId.current = null;
      setCurrent(slide);
    } catch (e) {
      if (signal.aborted || dismissed.current) return;
      if (e instanceof ApiError && [404, 409].includes(e.status)) {
        setReady(ids => ids.filter(value => value !== id));
        setCurrent(value => value?.id === id ? null : value);
      } else {
        if (!claimed.current.size) {
          // Optional announcements must not block the page or other slides.
          setReady(ids => ids.filter(value => value !== id));
        } else {
          retryId.current = id;
          setPaused(true);
          setError("โหลดประกาศถัดไปไม่สำเร็จ กรุณาลองอีกครั้ง");
        }
      }
    } finally {
      pending.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }, [items, page]);

  useEffect(() => {
    if (closed || current || busy || hidden || error || !ready.length) return;
    const timer = setTimeout(() => void show(ready[0]), 0);
    return () => clearTimeout(timer);
  }, [closed, current, busy, hidden, error, ready, show]);
  useEffect(() => {
    if (closed || !current || paused || hovered || hidden || busy || ready.length < 2) return;
    const timer = setTimeout(() => void show(ready[(index + 1) % ready.length]), 5000);
    return () => clearTimeout(timer);
  }, [closed, current, paused, hovered, hidden, busy, ready, index, show]);
  useEffect(() => {
    if (!current || closed) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = new Date(current.endsAt).getTime() - Date.now();
      if (remaining > 0) timer = setTimeout(check, Math.min(2147483647, remaining));
      else {
        setReady(ids => ids.filter(id => id !== current.id));
        setCurrent(null);
      }
    };
    timer = setTimeout(check, Math.min(2147483647, Math.max(0, new Date(current.endsAt).getTime() - Date.now())));
    return () => clearTimeout(timer);
  }, [current, closed]);

  function dismiss() {
    dismissed.current = true;
    controller.current?.abort();
    setClosed(true);
  }
  function move(id: string) {
    setPaused(true);
    void show(id);
  }
  return <Modal open={!closed && !!current} onOpenChange={open => { if (!open) dismiss(); }} title={current?.title ?? "ข่าวสาร"}>
    <div className="popup-slideshow" role="region" aria-label="ประกาศประชาสัมพันธ์" aria-roledescription="สไลด์ประกาศ"
      onPointerEnter={e => { if (e.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
      onKeyDownCapture={e => { if (e.key === "Tab") setPaused(true); }}>
      <div className="popup-slide" aria-live={paused ? "polite" : "off"} onFocusCapture={() => setPaused(true)}>
        {current?.imageId && <a href={media(current.imageId)} target="_blank" rel="noopener noreferrer" aria-label={`เปิดภาพ ${current.title} ขนาดเต็ม (แท็บใหม่)`} onClick={() => setPaused(true)}>
          <img className="popup-image" src={media(current.imageId)} alt={current.title} width="800" height="450" />
        </a>}
        <p className="preserve">{current?.body}</p>
        {current?.url && <a className="btn btn-primary" href={current.url} onClick={dismiss}>{current.buttonText || "ดูรายละเอียด"}</a>}
      </div>
      {ready.length > 1 && <>
        <div className="popup-controls">
          <Button variant="outline" size="icon" aria-label="ประกาศก่อนหน้า" disabled={busy} onClick={() => move(ready[(index - 1 + ready.length) % ready.length])}><ChevronLeft size={18} /></Button>
          <span aria-live="off">ประกาศที่ {index + 1} จาก {ready.length}</span>
          <Button variant="outline" size="icon" aria-label="ประกาศถัดไป" disabled={busy} onClick={() => move(ready[(index + 1) % ready.length])}><ChevronRight size={18} /></Button>
          <Button variant="ghost" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "เล่นอัตโนมัติ" : "หยุดสไลด์"}</Button>
        </div>
        <div className="popup-dots" aria-label="เลือกประกาศ">{ready.map((id, i) => <button key={id} type="button" aria-label={`ไปประกาศที่ ${i + 1}`} aria-current={id === current?.id ? "true" : undefined} disabled={busy} onClick={() => move(id)}><span /></button>)}</div>
      </>}
      {error && <div className="inline-note" role="alert">{error}<Button variant="outline" busy={busy} onClick={() => { if (retryId.current) void show(retryId.current); }}>ลองอีกครั้ง</Button></div>}
    </div>
  </Modal>;
}
