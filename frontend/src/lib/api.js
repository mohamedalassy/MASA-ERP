const BASE =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/**
 * عميل API موحّد.
 *
 * حاليًا عنوان الـ API مكتوب يدويًا في ٣٨ ملف، و٢٧ منهم بدون
 * VITE_API_URL — فأي نشر بره localhost بيكسرهم. الملف ده يوحّد:
 *   - العنوان
 *   - الترويسات
 *   - معالجة الأخطاء (بيقرأ message أو أول خطأ في errors)
 *   - توكن المصادقة (لما Sanctum يتفعّل)
 *
 * الاستخدام:
 *   import { api } from "../lib/api";
 *
 *   const json = await api("/finance/accounts?active=true");
 *   const created = await api.post("/finance/accounts", payload);
 */

let authToken = null;

export function setAuthToken(token) {
  authToken = token;

  if (token) {
    localStorage.setItem("masa_token", token);
  } else {
    localStorage.removeItem("masa_token");
  }
}

export function loadAuthToken() {
  authToken = localStorage.getItem("masa_token");
  return authToken;
}

function buildHeaders(options) {
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  // FormData بتحدد الـ boundary بنفسها
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers.Authorization = "Bearer " + authToken;
  }

  return headers;
}

function extractError(json, status) {
  if (json?.message) return json.message;

  const first = Object.values(json?.errors || {}).flat()[0];
  if (first) return first;

  if (status === 401) return "انتهت الجلسة. سجّل الدخول من جديد.";
  if (status === 403) return "لا تملك صلاحية تنفيذ العملية.";
  if (status === 404) return "المسار غير موجود.";
  if (status === 422) return "البيانات المدخلة غير صحيحة.";

  return "تعذر تنفيذ العملية.";
}

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: buildHeaders(options),
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(extractError(json, res.status));
    error.status = res.status;
    error.errors = json?.errors || {};
    throw error;
  }

  return json;
}

api.get = (path, options = {}) => api(path, { ...options, method: "GET" });

api.post = (path, body, options = {}) =>
  api(path, { ...options, method: "POST", body });

api.put = (path, body, options = {}) =>
  api(path, { ...options, method: "PUT", body });

api.delete = (path, options = {}) =>
  api(path, { ...options, method: "DELETE" });

/** لتحميل عدة مصادر في نداء واحد مع معالجة أخطاء موحّدة. */
api.all = async (paths) => {
  const results = await Promise.all(
    paths.map((path) =>
      api(path).catch((error) => ({ __error: error.message }))
    )
  );

  return results;
};

export { BASE as API_BASE };
