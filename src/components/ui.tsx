import {
  createContext,
  useContext,
  useState,
  useId,
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type ComponentProps,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  X,
  LoaderCircle,
  TriangleAlert,
  PackageOpen,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ApiError } from "../api";
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
const variants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      outline: "btn-outline",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
    size: { default: "", icon: "btn-icon", sm: "btn-sm" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  busy = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variants> & { asChild?: boolean; busy?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(variants({ variant, size }), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <>
          <LoaderCircle className="spin" size={17} />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  initialFocusSelector,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  initialFocusSelector?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content
          ref={content}
          className="modal-content"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            opener.current = document.activeElement as HTMLElement | null;
            const target = initialFocusSelector ? content.current?.querySelector<HTMLElement>(initialFocusSelector) : null;
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const target = opener.current?.isConnected
              ? opener.current
              : document.querySelector<HTMLElement>("main");
            target?.focus({ preventScroll: true });
          }}
        >
          <div className="modal-heading">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Field({
  label,
  name,
  children,
  error,
  hint,
  ...props
}: {
  label: string;
  name?: string;
  children?: ReactNode;
  error?: string;
  hint?: string;
} & ComponentProps<"input">) {
  const auto = useId(),
    id = props.id ?? name ?? auto;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        <div className="field-control">{children}</div>
      ) : (
        <input
          {...props}
          id={id}
          name={name}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="error-text">
          {error}
        </small>
      )}
    </div>
  );
}
export function Select({
  label,
  id,
  children,
  ...props
}: { label: string } & ComponentProps<"select">) {
  const auto = useId();
  return (
    <div className="field">
      <label htmlFor={id ?? auto}>{label}</label>
      <select {...props} id={id ?? auto}>
        {children}
      </select>
    </div>
  );
}
export function Textarea({
  label,
  id,
  ...props
}: { label: string } & ComponentProps<"textarea">) {
  const auto = useId();
  return (
    <div className="field">
      <label htmlFor={id ?? auto}>{label}</label>
      <textarea {...props} id={id ?? auto} className="resize-none" rows={5} />
    </div>
  );
}
export function PasswordField({
  label = "รหัสผ่าน",
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  const [show, setShow] = useState(false),
    id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password">
        <input {...props} id={id} type={show ? "text" : "password"} />
        <button
          type="button"
          aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
export function FormMessage({ error }: { error: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const errorId = useId();
  useEffect(() => {
    if (!error) return;
    const form = box.current?.closest("form");
    const fields = error instanceof ApiError ? error.fields : [];
    const invalid: { input: HTMLElement; described: string | null }[] = [];
    fields.forEach((f) => {
      const input = form?.querySelector<HTMLElement>(
        `[name="${CSS.escape(f.field)}"]`,
      );
      if (input) {
        input.setAttribute("aria-invalid", "true");
        invalid.push({
          input,
          described: input.getAttribute("aria-describedby"),
        });
        input.setAttribute("aria-describedby", errorId);
      }
    });
    (invalid[0]?.input ?? box.current)?.focus();
    return () =>
      invalid.forEach(({ input, described }) => {
        input.removeAttribute("aria-invalid");
        if (described) input.setAttribute("aria-describedby", described);
        else input.removeAttribute("aria-describedby");
      });
  }, [error, errorId]);
  if (!error) return null;
  return (
    <div
      ref={box}
      id={errorId}
      tabIndex={-1}
      role="alert"
      className="form-error"
    >
      <TriangleAlert size={18} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {error instanceof ApiError && error.fields.length > 0 && (
          <ul>
            {error.fields.map((f, i) => (
              <li key={i}>
                {fieldNames[f.field] ? `${fieldNames[f.field]}: ` : ""}
                {f.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
const fieldNames: Record<string, string> = {
  username: "ชื่อผู้ใช้",
  displayName: "ชื่อที่ใช้แสดง",
  password: "รหัสผ่าน",
  confirmPassword: "ยืนยันรหัสผ่านใหม่",
  reason: "เหตุผล",
  title: "ชื่อพระเครื่อง",
  description: "รายละเอียด",
  categoryId: "หมวดหมู่",
  listingType: "ประเภทประกาศ",
  imageIds: "รูปภาพ",
  price: "ราคา",
  ref: "รหัสแนะนำ",
  currentPassword: "รหัสผ่านปัจจุบัน",
};
export function State({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  retry?: () => void;
  children?: ReactNode;
}) {
  if (loading)
    return (
      <div className="skeleton-grid" role="status" aria-label="กำลังโหลดข้อมูล">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="empty">
        <TriangleAlert />
        <h2>โหลดข้อมูลไม่สำเร็จ</h2>
        <p>{error}</p>
        <Button variant="outline" onClick={retry}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <PackageOpen size={36} />
        <h2>ยังไม่มีรายการในส่วนนี้</h2>
        <p>ลองเปลี่ยนคำค้นหรือกลับมาดูใหม่อีกครั้ง</p>
      </div>
    );
  return children;
}
export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  if (total <= limit) return null;
  return (
    <nav className="pagination" aria-label="เปลี่ยนหน้ารายการ">
      <Button
        variant="outline"
        size="icon"
        aria-label="หน้าก่อนหน้า"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={18} />
      </Button>
      <span>
        หน้า {page} จาก {Math.ceil(total / limit)} ·{" "}
        {total.toLocaleString("th-TH")} รายการ
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="หน้าถัดไป"
        disabled={page * limit >= total}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={18} />
      </Button>
    </nav>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <ToastContext.Provider value={setMessage}>
      {children}
      <div
        className={cn("toast", message && "visible")}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
