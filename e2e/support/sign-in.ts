import type { Locator, Page, Route } from "@playwright/test";

// Helpers of e2e/sign-in.spec.ts (TOKI-023 R29 to R34). The server of TOKI-022 cannot be seeded yet
// (TOKI-008), so every answer of `/api/v1/auth/*` is a stub in the browser. Fake data only: the
// addresses are on example.com and the code is a made-up string of digits, not a real code.
export const ADDRESS = "ada@example.com";
export const CODE = "123456";
export const REQUEST_ID = "e2e-request-id-0001";

export const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: ADDRESS,
  displayName: "Ada",
  role: "member",
  language: "en",
};

export type Language = "en" | "vi";
export type Look = "calm" | "focus";

// The texts the tests look for, from packages/i18n (signIn, sessionEnded).
export const TEXT = {
  en: {
    email: "Email",
    sendCode: "Send code",
    codeTitle: "Check your email",
    code: "Code",
    signIn: "Sign in",
    changeEmail: "Use a different email",
    resend: "Resend code",
    sendNew: "Send a new code",
    expired: "This code has expired",
    locked: "This code is locked. Ask for a new one.",
    wrong: "That code is not right. 4 tries left.",
    tooMany: "You have asked for too many codes. Try again in 10 minutes.",
    tooSoon: "A code was just sent. Try again in 30 seconds.",
    network: "Could not connect. Check your network and try again.",
    general: "Something went wrong. Try again.",
    invalid: "Enter a valid email address",
    ended: "Your session has ended",
    signInAgain: "Sign in again",
  },
  vi: {
    email: "Email",
    sendCode: "Gửi mã",
    codeTitle: "Kiểm tra email của bạn",
    code: "Mã",
    signIn: "Đăng nhập",
    changeEmail: "Dùng email khác",
    resend: "Gửi lại mã",
    sendNew: "Gửi mã mới",
    expired: "Mã này đã hết hạn",
    locked: "Mã này đã bị khóa. Hãy yêu cầu mã mới.",
    wrong: "Mã không đúng. Còn 4 lần thử.",
    tooMany: "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau 10 phút.",
    tooSoon: "Vừa có mã được gửi. Hãy thử lại sau 30 giây.",
    network: "Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.",
    general: "Đã xảy ra lỗi. Hãy thử lại.",
    invalid: "Nhập một địa chỉ email hợp lệ",
    ended: "Phiên đăng nhập của bạn đã kết thúc",
    signInAgain: "Đăng nhập lại",
  },
} as const;

// One answer of a stubbed call: a body with a status, or a failure to connect.
export type Reply = { status: number; body?: unknown } | "abort";

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const refused = (
  status: number,
  code: string,
  details?: unknown,
): Reply => ({
  status,
  body: { error: { code, message: code, details } },
});

export const codeAccepted = (resendAfterSeconds = 0): Reply =>
  ok({ requestId: REQUEST_ID, expiresInSeconds: 600, resendAfterSeconds });

// What each stubbed call answers. `codes` and `sessions` are functions of the number of the call (from
// 1), so a case can say "the first call is accepted and the second is refused".
export type Script = {
  session: () => Reply;
  codes: (n: number) => Reply;
  sessions: (n: number) => Reply;
  workspace: () => Reply;
};

export const defaultScript = (): Script => ({
  session: () => refused(401, "unauthenticated"),
  codes: () => codeAccepted(),
  sessions: () => ok({ user: USER }),
  workspace: () => ok({ name: "Acme Studio" }),
});

export type Stub = {
  script: Script;
  /** Every request the page sent to `/api/v1/auth/`, as "METHOD path" with the body. */
  requests: { line: string; body: string | null }[];
  count: (line: string) => number;
};

async function answer(route: Route, reply: Reply): Promise<void> {
  if (reply === "abort") return route.abort("connectionrefused");
  await route.fulfill({
    status: reply.status,
    contentType: "application/json",
    body: reply.body === undefined ? "" : JSON.stringify(reply.body),
  });
}

export async function stubAuth(
  page: Page,
  overrides: Partial<Script> = {},
): Promise<Stub> {
  const stub: Stub = {
    script: { ...defaultScript(), ...overrides },
    requests: [],
    count: (line) => stub.requests.filter((r) => r.line === line).length,
  };
  await page.route("**/api/v1/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const line = `${request.method()} ${path}`;
    stub.requests.push({ line, body: request.postData() });
    const n = stub.count(line);
    switch (line) {
      case "GET /auth/session":
        return answer(route, stub.script.session());
      case "POST /auth/codes":
        return answer(route, stub.script.codes(n));
      case "POST /auth/sessions":
        return answer(route, stub.script.sessions(n));
      case "GET /auth/workspace":
        return answer(route, stub.script.workspace());
      default:
        return answer(route, refused(404, "not_found"));
    }
  });
  return stub;
}

// The device language the page reads before sign-in: platform storage `device` writes `toki:` + key.
export async function setDeviceLanguage(
  page: Page,
  language: Language,
): Promise<void> {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("toki:signIn.language", value);
    } catch {
      // storage blocked: the page falls back to English
    }
  }, language);
}

// Calm and Focus are chosen the way the app chooses them: the look is `device`, and the device asks for
// Focus with a dark colour scheme (applyAppearance in packages/ui-web).
export async function setLook(page: Page, look: Look): Promise<void> {
  await page.emulateMedia({ colorScheme: look === "focus" ? "dark" : "light" });
}

export function field(page: Page, kind: "email" | "code"): Locator {
  return kind === "email"
    ? page.locator('input[type="email"]')
    : page.locator('input[autocomplete="one-time-code"]');
}

export async function toCodeStep(page: Page, language: Language) {
  await field(page, "email").fill(ADDRESS);
  await page.getByRole("button", { name: TEXT[language].sendCode }).click();
  await field(page, "code").waitFor();
}

// The `shell` of the app (the signed-in page).
export async function openAppSignedIn(
  page: Page,
  stub: Stub,
  path = "/",
): Promise<void> {
  stub.script.session = () => ok({ user: USER });
  await page.goto(path);
  await page.getByTestId("shell").waitFor();
}

// A request the app makes while a screen shows, answered 401 `session_ended`: the call goes through
// the same module and 401 hook the app uses (apps/web/src/auth/services.ts).
export async function endSession(
  page: Page,
  stub: Stub,
  code = "session_ended",
): Promise<void> {
  stub.script.session = () => refused(401, code);
  await page.evaluate(async (url) => {
    const services = (await import(/* @vite-ignore */ url)) as {
      getAuthServices(): { calls: { readSession(): Promise<unknown> } };
    };
    await services.getAuthServices().calls.readSession();
  }, "/src/auth/services.ts");
}
