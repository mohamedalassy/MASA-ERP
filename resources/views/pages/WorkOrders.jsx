import { useEffect, useMemo, useState } from "react";

import {
  Search,
  FolderKanban,
  Building2,
  CalendarDays,
  ArrowLeft,
  Filter,
  RefreshCcw,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const stageNames = {
  crm: "CRM",
  pricing: "التسعير",
  purchasing: "المشتريات",
  finance: "المالية",
  execution: "التنفيذ",
  closed: "الإغلاق",
};

const priorityNames = {
  high: "عالية",
  normal: "عادية",
  low: "منخفضة",
};

const formatMoney = (value) => {
  const number = Number(value || 0);

  return `${number.toLocaleString("en-US")} ر.س`;
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-CA");
};

export default function WorkOrders({
  stage = "all",
  onOpenProject,
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (stage && stage !== "all") {
        params.set("stage", stage);
      }

      const url =
        params.toString().length > 0
          ? `${API_URL}/projects?${params.toString()}`
          : `${API_URL}/projects`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل أوامر العمل"
        );
      }

      setProjects(result.data || []);
    } catch (error) {
      console.error("WorkOrders load error:", error);

      setError(
        error.message ||
          "حدث خطأ أثناء تحميل أوامر العمل"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [stage]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const normalizedSearch =
        search.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        project.project_code
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        project.name
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        project.customer_name
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesPriority =
        priority === "all" ||
        project.priority === priority;

      return matchesSearch && matchesPriority;
    });
  }, [projects, search, priority]);

  const title =
    stage === "all"
      ? "أوامر العمل"
      : `أوامر عمل ${stageNames[stage] || stage}`;

  return (
    <div className="work-orders-page" dir="rtl">
      <div className="work-orders-header">
        <div>
          <span className="work-orders-kicker">
            إدارة المشاريع
          </span>

          <h1>{title}</h1>

          <p>
            متابعة المشاريع الموجودة داخل القسم الحالي
            وفتح ملف المشروع بالكامل.
          </p>
        </div>

        <div className="work-orders-count-card">
          <FolderKanban size={20} />

          <div>
            <strong>
              {filteredProjects.length}
            </strong>

            <span>أمر عمل</span>
          </div>
        </div>
      </div>

      <div className="work-orders-toolbar">
        <div className="work-orders-search">
          <Search size={18} />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="ابحث برقم المشروع أو الاسم أو العميل..."
          />
        </div>

        <div className="work-orders-filter">
          <Filter size={17} />

          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value)
            }
          >
            <option value="all">
              كل الأولويات
            </option>

            <option value="high">
              عالية
            </option>

            <option value="normal">
              عادية
            </option>

            <option value="low">
              منخفضة
            </option>
          </select>
        </div>

        <button
          type="button"
          className="work-orders-refresh"
          onClick={loadProjects}
        >
          <RefreshCcw size={17} />
          تحديث
        </button>
      </div>

      {loading && (
        <div className="work-orders-state">
          جاري تحميل أوامر العمل...
        </div>
      )}

      {!loading && error && (
        <div className="work-orders-state error">
          <strong>
            تعذر تحميل أوامر العمل
          </strong>

          <span>{error}</span>
        </div>
      )}

      {!loading &&
        !error &&
        filteredProjects.length === 0 && (
          <div className="work-orders-empty">
            <FolderKanban size={36} />

            <strong>
              لا توجد أوامر عمل
            </strong>

            <span>
              لا توجد مشاريع في هذا القسم حاليًا.
            </span>
          </div>
        )}

      {!loading &&
        !error &&
        filteredProjects.length > 0 && (
          <div className="work-orders-table-card">
            <div className="work-orders-table-head">
              <span>رقم المشروع</span>
              <span>المشروع</span>
              <span>العميل</span>
              <span>القسم الحالي</span>
              <span>الأولوية</span>
              <span>القيمة</span>
              <span>تاريخ الإنشاء</span>
              <span></span>
            </div>

            <div className="work-orders-table-body">
              {filteredProjects.map(
                (project) => (
                  <div
                    className="work-orders-row"
                    key={project.id}
                  >
                    <div>
                      <span className="work-order-code">
                        {project.project_code}
                      </span>
                    </div>

                    <div className="work-order-project">
                      <div className="work-order-project-icon">
                        <FolderKanban size={17} />
                      </div>

                      <div>
                        <strong>
                          {project.name}
                        </strong>

                        <span>
                          {project.project_type ||
                            "مشروع"}
                        </span>
                      </div>
                    </div>

                    <div className="work-order-customer">
                      <Building2 size={15} />

                      <span>
                        {project.customer_name}
                      </span>
                    </div>

                    <div>
                      <span className="work-order-stage">
                        {stageNames[
                          project.current_stage
                        ] ||
                          project.current_stage}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`work-order-priority ${
                          project.priority || "normal"
                        }`}
                      >
                        {priorityNames[
                          project.priority
                        ] ||
                          project.priority ||
                          "عادية"}
                      </span>
                    </div>

                    <div>
                      <strong className="work-order-value">
                        {formatMoney(
                          project.total_value
                        )}
                      </strong>
                    </div>

                    <div className="work-order-date">
                      <CalendarDays size={14} />

                      <span>
                        {formatDate(
                          project.created_at
                        )}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="work-order-open"
                        onClick={() =>
                          onOpenProject?.(
                            project.id
                          )
                        }
                      >
                        فتح
                        <ArrowLeft size={15} />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </div>
  );
}
