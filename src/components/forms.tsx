import { useEffect, useRef, useState } from "react";
import { useBlocker, useBeforeUnload } from "react-router-dom";
import { Upload, ArrowLeft, ArrowRight, Trash2, X } from "lucide-react";
import { api, useData } from "../api";
import { media, type Settings } from "../types";
import { Button, Modal, FormMessage } from "./ui";
import { prepareImage } from "../lib/prepare-image";
export function UnsavedGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  return (
    <Modal
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
      title="ยังมีข้อมูลที่ไม่ได้บันทึก"
    >
      <p>หากออกจากหน้านี้ ข้อมูลที่ยังไม่ได้บันทึกจะหายไป</p>
      <div className="button-row">
        <Button
          variant="outline"
          onClick={() => blocker.state === "blocked" && blocker.reset()}
        >
          อยู่ในหน้านี้
        </Button>
        <Button
          variant="danger"
          onClick={() => blocker.state === "blocked" && blocker.proceed()}
        >
          ออกโดยไม่บันทึก
        </Button>
      </div>
    </Modal>
  );
}
export function ImageUpload({
  ids,
  onChange,
  max: maxOverride,
  label = "รูปภาพพระเครื่อง",
  onBusy,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  label?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [progress, setProgress] = useState("");
  const { data: settings } = useData<Settings>("/settings");
  const max = maxOverride ?? settings?.maxImages ?? 12;
  const maxMb = settings?.maxImageMb ?? 8;
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (files.length + ids.length > max) {
      setError(`เพิ่มรูปได้สูงสุด ${max} ภาพ`);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError(null);
    let next = [...ids];
    const controller = new AbortController();
    abort.current = controller;
    try {
      for (const [i, file] of Array.from(files).entries()) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error("รองรับเฉพาะ JPG, PNG และ WebP");
        if (file.size > maxMb * 1024 * 1024)
          throw new Error(`ขนาดภาพต้องไม่เกิน ${maxMb} MB`);
        setProgress(`กำลังอัปโหลดและบีบอัด ${i + 1} / ${files.length}`);
        const f = new FormData();
        f.append("image", await prepareImage(file,controller.signal));
        const result = await api<{ id: string }>("/uploads", {
          method: "POST",
          body: f,
          signal: controller.signal,
        });
        next = [...next, result.id];
        onChange(next);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      setBusy(false);
      onBusy?.(false);
      setProgress("");
    }
  }
  function move(i: number, delta: number) {
    const next = [...ids];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    onChange(next);
  }
  return (
    <div className="upload-field">
      <p className="field-label">{label}</p>
      <div className="upload-grid">
        {ids.map((id, i) => (
          <div className="upload-preview" key={id}>
            <img
              src={media(id, true)}
              alt={`ภาพที่ ${i + 1}${i === 0 ? " ภาพหลัก" : ""}`}
              width="160"
              height="160"
            />
            {i === 0 && <small>ภาพหลัก</small>}
            {max > 1 && <Button
              type="button"
              variant="ghost"
              size="sm"
              className="set-primary-image"
              aria-label={`ตั้งภาพ ${i + 1} เป็นรูปหลัก`}
              aria-pressed={i === 0}
              disabled={busy || i === 0}
              onClick={() => onChange([id, ...ids.filter(value => value !== id)])}
            >{i === 0 ? "รูปหลัก" : "ตั้งเป็นรูปหลัก"}</Button>}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`เลื่อนภาพ ${i + 1} ไปก่อนหน้า`}
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowLeft size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`เลื่อนภาพ ${i + 1} ไปถัดไป`}
                disabled={busy || i === ids.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowRight size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ลบภาพ ${i + 1}`}
                disabled={busy}
                onClick={() => onChange(ids.filter((_, n) => n !== i))}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <label className={`upload-drop ${busy ? "busy" : ""}`}>
        <Upload size={24} />
        <strong>{busy ? progress : "เลือกรูปภาพหรือลากไฟล์มาที่นี่"}</strong>
        <span>
          JPG, PNG, WebP · สูงสุด {max} ภาพ · ไม่เกิน {maxMb} MB/ภาพ ·
          เลือกรูปหลักได้จากปุ่มใต้ภาพ
        </span>
        <span>ระบบย่อขนาดและบีบอัดเป็น WebP ก่อนบันทึกอัตโนมัติ</span>
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={max > 1}
          disabled={busy || ids.length >= max}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {busy && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => abort.current?.abort()}
        >
          <X size={15} />
          ยกเลิกอัปโหลด
        </Button>
      )}
      <FormMessage error={error} />
    </div>
  );
}
