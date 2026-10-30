import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "@/services/api";

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface SendCodeResult {
  ok: boolean;
  delivered: boolean;
  /** 仅开发环境且未配置 SMTP 时返回 */
  devCode?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  code: string;
  displayName?: string;
}

/**
 * 会话状态（F-01）。
 * Cookie Session 由后端下发（httpOnly），前端不保存 token。
 */
export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserSummary | null>(null);
  const loading = ref(false);
  /** 是否已完成一次 /me 探测，供路由守卫使用 */
  const hydrated = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  async function fetchMe(): Promise<void> {
    if (hydrated.value) return;

    try {
      const me = await api<{ user: UserSummary }>("/me");
      user.value = me.user;
    } catch {
      user.value = null;
    } finally {
      hydrated.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    try {
      const res = await api<{ user: UserSummary }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      user.value = res.user;
      hydrated.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function register(input: RegisterInput): Promise<void> {
    loading.value = true;
    try {
      const res = await api<{ user: UserSummary }>("/auth/register", {
        method: "POST",
        body: input,
      });
      user.value = res.user;
      hydrated.value = true;
    } finally {
      loading.value = false;
    }
  }

  function sendCode(email: string): Promise<SendCodeResult> {
    return api<SendCodeResult>("/auth/send-code", {
      method: "POST",
      body: { email },
    });
  }

  async function logout(): Promise<void> {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } finally {
      clearSession();
    }
  }

  /** 仅清空本地会话状态，用于 401 全局拦截 */
  function clearSession(): void {
    user.value = null;
    hydrated.value = true;
  }

  return {
    user,
    loading,
    hydrated,
    isAuthenticated,
    login,
    register,
    sendCode,
    logout,
    fetchMe,
    clearSession,
  };
});
