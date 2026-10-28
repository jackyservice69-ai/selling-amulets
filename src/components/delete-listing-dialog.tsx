import { useState } from "react";
import { send } from "../api";
import type { Amulet } from "../types";
import { Button, FormMessage, Modal, Textarea, useToast } from "./ui";

export function DeleteListingDialog({ listing, managed = false, onClose, onDeleted }: {
  listing: Amulet;
  managed?: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await send(`/${managed ? "admin" : "me"}/amulets/${listing.id}`,
        { version: listing.version, ...(managed ? { reason } : {}) }, "DELETE");
      toast("ลบประกาศแล้ว");
      onDeleted();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return <Modal open onOpenChange={(open) => { if (!open && !busy) onClose(); }}
    title="ลบประกาศ" initialFocusSelector="[data-cancel-delete]">
    <p>ต้องการลบ “{listing.title}” ใช่หรือไม่?</p>
    <p>ประกาศจะหายจากรายการและหน้าสาธารณะ หากต้องการลงอีกครั้งต้องสร้างประกาศใหม่</p>
    <form noValidate onSubmit={(e) => { e.preventDefault(); void remove(); }}>
      {managed && <>
        <Textarea label="เหตุผลการลบ" name="reason" required minLength={5} maxLength={2000}
          value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} aria-describedby="delete-reason-hint" />
        <p className="muted" id="delete-reason-hint">อย่างน้อย 5 ตัวอักษร ระบบจะแจ้งเหตุผลให้เจ้าของประกาศทราบ</p>
      </>}
      <FormMessage error={error} />
      <div className="button-row">
        <Button type="button" variant="outline" data-cancel-delete disabled={busy} onClick={onClose}>ยกเลิก</Button>
        <Button type="submit" variant="danger" busy={busy}>ยืนยันลบประกาศ</Button>
      </div>
    </form>
  </Modal>;
}
