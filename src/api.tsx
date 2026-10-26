import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "./types";
let csrfToken: string | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...options.headers,
    },
  }).catch((e: Error) => {
    if (e.name === "AbortError") throw e;
    throw new ApiError(
      "เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
      503,
    );
  });
  const data = await response.json().catch(() => {
    throw new ApiError(
      "ไม่สามารถอ่านข้อมูลจากระบบได้ กรุณาลองอีกครั้ง",
      response.status,
    );
  });
  if (!response.ok)
    throw new ApiError(
      data.error ?? "ไม่สามารถเชื่อมต่อระบบได้",
      response.status,
      data.fields ?? [],
    );
  return data as T;
}
export const send = <T,>(path: string, body: unknown = {}, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  accept: (data: { user: User; csrf: string }) => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const d = await api<{ user: User | null; csrf: string | null }>(
        "/auth/me",
      );
      setUser(d.user);
      csrfToken = d.csrf;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อระบบไม่ได้");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User | null; csrf: string | null }>("/auth/me", {
      signal: controller.signal,
    })
      .then((d) => {
        if (!controller.signal.aborted) {
          setUser(d.user);
          csrfToken = d.csrf;
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "เชื่อมต่อระบบไม่ได้");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const accept = (d: { user: User; csrf: string }) => {
    setUser(d.user);
    csrfToken = d.csrf;
  };
  const logout = async () => {
    await send("/auth/logout");
    setUser(null);
    csrfToken = null;
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, accept, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
export function useData<T>(path: string | null) {
  const [result, setResult] = useState<{
      key: string;
      path: string;
      data: T | null;
      error: string;
    } | null>(null),
    [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((d) => {
        if (!controller.signal.aborted)
          setResult({ key, path, data: d, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            path,
            data: null,
            error: e instanceof Error ? e.message : "เชื่อมต่อระบบไม่ได้",
          });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: result?.path === path ? result.data : null,
    error: result?.key === key ? result.error : "",
    loading: path !== null && result?.key !== key,
    reload,
  };
}
