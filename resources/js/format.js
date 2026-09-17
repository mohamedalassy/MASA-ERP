/**
 * تنسيق الأرقام والتواريخ — موحّد لكل الشاشات.
 *
 * دالة money مكرّرة حاليًا في أكثر من ٢٠ ملف بصيغ مختلفة قليلًا،
 * وده بيخلي نفس الرقم يظهر بشكلين في شاشتين.
 */

export const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** للرسوم البيانية: 1.2M / 340K */
export const compactMoney = (value) => {
  const number = Number(value || 0);

  if (Math.abs(number) >= 1_000_000) {
    return (number / 1_000_000).toFixed(1) + "M";
  }

  if (Math.abs(number) >= 1_000) {
    return (number / 1_000).toFixed(0) + "K";
  }

  return String(Math.round(number));
};

export const percent = (value, digits = 1) =>
  Number(value || 0).toFixed(digits) + "%";

export const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const formatMonth = (value) => {
  if (!value) return "—";

  const [year, month] = String(value).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
  });
};

/** رقم آمن — بديل parseFloat اللي بيرجع NaN. */
export const num = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * مقارنة مبالغ بفرق مقبول.
 * نفس المنطق المستخدم في الباك إند — abs(diff) < 0.01
 * بدل === اللي بيفشل على أرقام عشرية.
 */
export const amountsEqual = (a, b) => Math.abs(num(a) - num(b)) < 0.01;
