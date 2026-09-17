import { MessageCircle, Search, Send, Users } from "lucide-react";
import "../../../css/missing-pages.css";

const threads = [
  { name: "فريق المشاريع", last: "تم تحديث حالة المشروع", badge: 3 },
  { name: "قسم المالية", last: "تمت مراجعة الدفعة", badge: 1 },
  { name: "المشتريات", last: "عرض المورد وصل", badge: 0 },
];

export default function ChatPanel() {
  return (
    <main className="masa-page masa-chat-page" dir="rtl">
      <header className="masa-page-head">
        <div>
          <span className="masa-eyebrow">MASA Connect</span>
          <h1>الدردشة الداخلية</h1>
          <p>واجهة جاهزة للربط لاحقًا بخدمة المحادثات والإشعارات.</p>
        </div>
      </header>

      <section className="masa-chat-shell">
        <aside className="masa-chat-list">
          <label className="masa-search">
            <Search size={17} />
            <input placeholder="ابحث عن محادثة..." />
          </label>
          {threads.map((thread) => (
            <button type="button" className="masa-thread" key={thread.name}>
              <span className="masa-thread-avatar"><Users size={18} /></span>
              <span>
                <strong>{thread.name}</strong>
                <small>{thread.last}</small>
              </span>
              {thread.badge > 0 && <b>{thread.badge}</b>}
            </button>
          ))}
        </aside>

        <section className="masa-chat-window">
          <div className="masa-chat-empty">
            <span className="masa-icon masa-icon--violet"><MessageCircle size={28} /></span>
            <h2>اختر محادثة</h2>
            <p>ستظهر الرسائل هنا بعد ربط وحدة الدردشة بالـ API.</p>
          </div>
          <div className="masa-message-box">
            <input placeholder="اكتب رسالة..." disabled />
            <button type="button" disabled><Send size={18} /></button>
          </div>
        </section>
      </section>
    </main>
  );
}
