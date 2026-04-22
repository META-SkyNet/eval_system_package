import React, { useState, useEffect, useMemo } from "react";
import { Plus, FileText, GitBranch, Clock, Edit3, ChevronRight, Users, X, Check, Trash2, Eye, History, AlertCircle, ThumbsUp, ThumbsDown, Zap, User, Calendar, Filter, TrendingUp, MessageCircle, Shield, Package, Briefcase, Activity, Layers } from "lucide-react";

const STORAGE_KEY = "eval_system_v3";

const DEFAULT_DEPARTMENTS = [
  { id: "delivery", name: "Giao hàng", color: "#c2410c" },
  { id: "sales", name: "Bán hàng", color: "#0369a1" },
  { id: "warehouse", name: "Kho", color: "#4d7c0f" },
  { id: "warranty", name: "Bảo hành", color: "#7c2d12" },
  { id: "accounting", name: "Kế toán", color: "#9f1239" },
  { id: "ecommerce", name: "TMĐT", color: "#be185d" },
];

const PILLAR_TYPES = {
  quantitative: { label: "Kết quả định lượng", color: "#0f766e", defaultWeight: 50 },
  qualitative: { label: "Chất lượng & Thái độ (360°)", color: "#b45309", defaultWeight: 30 },
  feedback: { label: "Phản hồi & Sự cố", color: "#9f1239", defaultWeight: 20 },
};

const QUESTION_TYPES = {
  number: "Số liệu thô",
  work_points: "Điểm công",
  work_count: "Số việc loại...",
  work_quality: "Tỷ lệ đạt chất lượng",
  scale: "Thang 1-5",
  yesno: "Có/Không",
  event: "Sự vụ (±)",
};

const EVENT_CATEGORIES = {
  customer_praise: { label: "Khách khen", icon: ThumbsUp, color: "#059669", polarity: "+" },
  customer_complaint: { label: "Khách phàn nàn", icon: ThumbsDown, color: "#dc2626", polarity: "-" },
  incident_damage: { label: "Sự cố / Thiệt hại", icon: AlertCircle, color: "#b91c1c", polarity: "-" },
  initiative: { label: "Sáng kiến / Chủ động", icon: Zap, color: "#0891b2", polarity: "+" },
  extra_effort: { label: "Làm thêm / Xông xáo", icon: TrendingUp, color: "#7c3aed", polarity: "+" },
  absence: { label: "Nghỉ / Không chăm", icon: X, color: "#ea580c", polarity: "-" },
  teamwork: { label: "Hỗ trợ đồng đội", icon: Users, color: "#0369a1", polarity: "+" },
  skill_issue: { label: "Thiếu kỹ năng / Sai sót", icon: AlertCircle, color: "#9333ea", polarity: "-" },
};

const SEVERITY = {
  light: { label: "Nhẹ", multiplier: 1, color: "#94a3b8" },
  medium: { label: "Trung bình", multiplier: 2, color: "#eab308" },
  heavy: { label: "Nặng", multiplier: 4, color: "#dc2626" },
};

const SOURCE_TYPES = {
  customer: { label: "Từ khách hàng", icon: MessageCircle },
  internal: { label: "Nội bộ", icon: Users },
  automatic: { label: "Tự động / Hệ thống", icon: Zap },
};

const WORK_STATUS = {
  completed_ontime: { label: "Hoàn thành đúng hạn", color: "#059669" },
  completed_late: { label: "Hoàn thành trễ", color: "#eab308" },
  completed_issue: { label: "Hoàn thành có lỗi", color: "#ea580c" },
  failed: { label: "Thất bại", color: "#dc2626" },
};

// =================== SEED ===================
const seedData = () => ({
  employees: [
    { id: "emp_nam", name: "Nguyễn Văn Nam", departmentId: "delivery", role: "NV Giao hàng" },
    { id: "emp_binh", name: "Trần Văn Bình", departmentId: "delivery", role: "NV Giao hàng" },
    { id: "emp_cuong", name: "Lê Minh Cường", departmentId: "delivery", role: "NV Lắp đặt" },
    { id: "emp_tuan", name: "Đỗ Anh Tuấn", departmentId: "warehouse", role: "NV Kho" },
    { id: "emp_long", name: "Phan Hải Long", departmentId: "warranty", role: "KTV Bảo hành" },
    { id: "emp_hoa", name: "Phạm Thị Hoa", departmentId: "sales", role: "NV Bán hàng" },
  ],

  // ====== Work Unit Catalogs — mỗi phòng ban định nghĩa loại việc riêng ======
  workCatalogs: [
    {
      id: "cat_delivery",
      departmentId: "delivery",
      name: "Danh mục công việc Giao hàng",
      unitTypes: [
        { id: "wt_d1", code: "GIAO_NHO", name: "Giao đơn nhỏ (≤5kg)", points: 1, note: "đồ gia dụng nhỏ, giao nhanh" },
        { id: "wt_d2", code: "GIAO_LON", name: "Giao đơn cồng kềnh", points: 3, note: "cần 2 người, xe tải" },
        { id: "wt_d3", code: "LAP_CB", name: "Lắp đặt cơ bản", points: 5, note: "tủ lạnh, máy giặt đơn giản" },
        { id: "wt_d4", code: "LAP_DH", name: "Lắp đặt điều hòa", points: 10, note: "bao gồm đi ống, test" },
        { id: "wt_d5", code: "LAP_BNL", name: "Lắp bình nóng lạnh", points: 8, note: "cần đi điện/nước" },
        { id: "wt_d6", code: "GIAO_LAP", name: "Giao + lắp trọn gói", points: 12, note: "cho các SP cao cấp" },
      ],
    },
    {
      id: "cat_warehouse",
      departmentId: "warehouse",
      name: "Danh mục công việc Kho",
      unitTypes: [
        { id: "wt_w1", code: "PICK_1", name: "Pick 1 SKU đơn lẻ", points: 0.5, note: "" },
        { id: "wt_w2", code: "PICK_N", name: "Pick đơn phức tạp (>5 SKU)", points: 2, note: "" },
        { id: "wt_w3", code: "NHAP_PL", name: "Nhập 1 pallet", points: 3, note: "bao gồm kiểm đếm" },
        { id: "wt_w4", code: "KIEM_KE", name: "Kiểm kê 1 khu", points: 8, note: "cuối tháng/quý" },
        { id: "wt_w5", code: "SAP_XEP", name: "Sắp xếp, gộp vị trí", points: 1.5, note: "" },
      ],
    },
    {
      id: "cat_warranty",
      departmentId: "warranty",
      name: "Danh mục công việc Bảo hành",
      unitTypes: [
        { id: "wt_b1", code: "TV_PHONE", name: "Tư vấn qua điện thoại", points: 1, note: "<15 phút" },
        { id: "wt_b2", code: "DI_KIEM", name: "Đến nhà khách kiểm tra", points: 4, note: "chẩn đoán lỗi" },
        { id: "wt_b3", code: "SUA_TC", name: "Sửa chữa tại chỗ", points: 6, note: "có linh kiện sẵn" },
        { id: "wt_b4", code: "MANG_XUONG", name: "Mang về xưởng sửa", points: 10, note: "bao gồm vận chuyển" },
        { id: "wt_b5", code: "THAY_BH", name: "Thay thế bảo hành", points: 5, note: "đổi máy mới" },
      ],
    },
  ],

  // ====== Work Logs — ghi nhận công việc thực tế của NV ======
  workLogs: [
    {
      id: "wl_1", employeeId: "emp_nam", workTypeId: "wt_d1",
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "completed_ontime", quantity: 8, note: "", relatedEventId: null,
    },
    {
      id: "wl_2", employeeId: "emp_nam", workTypeId: "wt_d3",
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "completed_ontime", quantity: 2, note: "", relatedEventId: null,
    },
    {
      id: "wl_3", employeeId: "emp_cuong", workTypeId: "wt_d4",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_ontime", quantity: 3, note: "đủ tiêu chuẩn", relatedEventId: null,
    },
    {
      id: "wl_4", employeeId: "emp_cuong", workTypeId: "wt_d5",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_ontime", quantity: 1, note: "", relatedEventId: null,
    },
    {
      id: "wl_5", employeeId: "emp_binh", workTypeId: "wt_d2",
      completedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      status: "completed_issue", quantity: 1, note: "làm vỡ kính tủ", relatedEventId: "evt_2",
    },
    {
      id: "wl_6", employeeId: "emp_tuan", workTypeId: "wt_w1",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_ontime", quantity: 42, note: "", relatedEventId: null,
    },
    {
      id: "wl_7", employeeId: "emp_tuan", workTypeId: "wt_w3",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_ontime", quantity: 5, note: "", relatedEventId: null,
    },
    {
      id: "wl_8", employeeId: "emp_long", workTypeId: "wt_b2",
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "completed_ontime", quantity: 3, note: "", relatedEventId: null,
    },
    {
      id: "wl_9", employeeId: "emp_long", workTypeId: "wt_b3",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_ontime", quantity: 2, note: "", relatedEventId: null,
    },
    {
      id: "wl_10", employeeId: "emp_long", workTypeId: "wt_b4",
      completedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: "completed_late", quantity: 1, note: "thiếu linh kiện, phải chờ", relatedEventId: null,
    },
  ],

  templates: [
    {
      id: "tpl_delivery_1", departmentId: "delivery",
      name: "Đánh giá NV Giao hàng",
      description: "Áp dụng cho đội giao & lắp đặt",
      activeVersionId: "v_d1",
      versions: [{
        id: "v_d1", versionNumber: "1.0", status: "published",
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        publishedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
        pillars: [
          {
            id: "p1", type: "quantitative", weight: 50,
            questions: [
              { id: "q1", label: "Tổng điểm công trong kỳ", type: "work_points", weight: 60, workTypeIds: null },
              { id: "q2", label: "Tỷ lệ công việc đúng hạn (%)", type: "work_quality", weight: 25, workTypeIds: null },
              { id: "q3", label: "Số đơn lắp đặt (tất cả loại)", type: "work_count", weight: 15, workTypeIds: ["wt_d3", "wt_d4", "wt_d5", "wt_d6"] },
            ],
          },
          {
            id: "p2", type: "qualitative", weight: 30,
            questions: [
              { id: "q5", label: "Chăm chỉ, chịu khó cày", type: "scale", weight: 30, linkedEventCategories: ["absence", "extra_effort"] },
              { id: "q6", label: "Tay nghề kỹ thuật", type: "scale", weight: 35, linkedEventCategories: ["skill_issue"] },
              { id: "q7", label: "Thái độ với khách hàng", type: "scale", weight: 20 },
              { id: "q8", label: "Hợp tác đồng đội", type: "scale", weight: 15, linkedEventCategories: ["teamwork"] },
            ],
          },
          {
            id: "p3", type: "feedback", weight: 20,
            questions: [
              { id: "q10", label: "Khách khen", type: "event", weight: 40, linkedEventCategories: ["customer_praise"] },
              { id: "q11", label: "Khiếu nại từ khách", type: "event", weight: 40, linkedEventCategories: ["customer_complaint"] },
              { id: "q12", label: "Sự cố / thiệt hại", type: "event", weight: 20, linkedEventCategories: ["incident_damage"] },
            ],
          },
        ],
      }],
    },
    {
      id: "tpl_wh_1", departmentId: "warehouse",
      name: "Đánh giá NV Kho",
      description: "Áp dụng cho đội kho & xuất nhập",
      activeVersionId: "v_wh1",
      versions: [{
        id: "v_wh1", versionNumber: "1.0", status: "published",
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
        publishedAt: new Date(Date.now() - 86400000 * 19).toISOString(),
        pillars: [
          {
            id: "p1", type: "quantitative", weight: 50,
            questions: [
              { id: "q1", label: "Tổng điểm công", type: "work_points", weight: 50, workTypeIds: null },
              { id: "q2", label: "Tỷ lệ đúng hạn (%)", type: "work_quality", weight: 30, workTypeIds: null },
              { id: "q3", label: "Số lần kiểm kê chính xác", type: "work_count", weight: 20, workTypeIds: ["wt_w4"] },
            ],
          },
          {
            id: "p2", type: "qualitative", weight: 30,
            questions: [
              { id: "q5", label: "Chăm chỉ", type: "scale", weight: 30, linkedEventCategories: ["absence", "extra_effort"] },
              { id: "q6", label: "Cẩn thận, chính xác", type: "scale", weight: 40, linkedEventCategories: ["skill_issue"] },
              { id: "q7", label: "Hợp tác", type: "scale", weight: 30, linkedEventCategories: ["teamwork"] },
            ],
          },
          {
            id: "p3", type: "feedback", weight: 20,
            questions: [
              { id: "q10", label: "Sáng kiến cải tiến", type: "event", weight: 50, linkedEventCategories: ["initiative"] },
              { id: "q11", label: "Sai sót, thất thoát", type: "event", weight: 50, linkedEventCategories: ["incident_damage", "skill_issue"] },
            ],
          },
        ],
      }],
    },
    {
      id: "tpl_war_1", departmentId: "warranty",
      name: "Đánh giá KTV Bảo hành",
      description: "Áp dụng cho đội bảo hành tại nhà khách & xưởng",
      activeVersionId: "v_war1",
      versions: [{
        id: "v_war1", versionNumber: "1.0", status: "published",
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        publishedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
        pillars: [
          {
            id: "p1", type: "quantitative", weight: 50,
            questions: [
              { id: "q1", label: "Tổng điểm công", type: "work_points", weight: 40, workTypeIds: null },
              { id: "q2", label: "Tỷ lệ xử lý đúng hạn (%)", type: "work_quality", weight: 35, workTypeIds: null },
              { id: "q3", label: "Số ca sửa tại chỗ (khỏi mang xưởng)", type: "work_count", weight: 25, workTypeIds: ["wt_b3"] },
            ],
          },
          {
            id: "p2", type: "qualitative", weight: 30,
            questions: [
              { id: "q5", label: "Tay nghề kỹ thuật", type: "scale", weight: 40, linkedEventCategories: ["skill_issue"] },
              { id: "q6", label: "Thái độ với khách", type: "scale", weight: 30 },
              { id: "q7", label: "Chủ động, chịu khó", type: "scale", weight: 30, linkedEventCategories: ["extra_effort", "absence"] },
            ],
          },
          {
            id: "p3", type: "feedback", weight: 20,
            questions: [
              { id: "q10", label: "Khách khen", type: "event", weight: 50, linkedEventCategories: ["customer_praise"] },
              { id: "q11", label: "Khách phàn nàn", type: "event", weight: 50, linkedEventCategories: ["customer_complaint"] },
            ],
          },
        ],
      }],
    },
  ],

  events: [
    {
      id: "evt_1", employeeId: "emp_nam", category: "customer_praise", severity: "medium", source: "customer",
      occurredAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      reportedBy: "Phạm Thị Hoa (Bán hàng)",
      description: "Khách ở Cầu Giấy khen giao nhanh, lắp đặt cẩn thận",
      status: "confirmed", createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "evt_2", employeeId: "emp_binh", category: "incident_damage", severity: "heavy", source: "internal",
      occurredAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      reportedBy: "Đỗ Anh Tuấn (Kho)",
      description: "Làm vỡ kính tủ khi vận chuyển. Thiệt hại ~2tr.",
      status: "pending", createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "evt_3", employeeId: "emp_long", category: "customer_praise", severity: "light", source: "customer",
      occurredAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      reportedBy: "CSKH",
      description: "Khách gọi khen KTV đến đúng giờ, giải thích rõ ràng",
      status: "confirmed", createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],
});

// =================== HELPERS ===================
function calculatePoints(workLog, workType) {
  if (!workType) return 0;
  return workLog.quantity * workType.points;
}

function getEmployeeWorkStats(employeeId, workLogs, workCatalogs) {
  const allTypes = workCatalogs.flatMap((c) => c.unitTypes);
  const logs = workLogs.filter((l) => l.employeeId === employeeId);
  let totalPoints = 0;
  let ontimeCount = 0;
  let totalCount = 0;
  const byType = {};

  logs.forEach((l) => {
    const wt = allTypes.find((t) => t.id === l.workTypeId);
    if (!wt) return;
    const pts = l.quantity * wt.points;
    totalPoints += pts;
    totalCount += l.quantity;
    if (l.status === "completed_ontime") ontimeCount += l.quantity;
    if (!byType[l.workTypeId]) byType[l.workTypeId] = { name: wt.name, code: wt.code, qty: 0, points: 0 };
    byType[l.workTypeId].qty += l.quantity;
    byType[l.workTypeId].points += pts;
  });

  return {
    totalPoints: Math.round(totalPoints * 10) / 10,
    ontimeRate: totalCount > 0 ? Math.round((ontimeCount / totalCount) * 100) : 0,
    totalCount,
    byType: Object.values(byType),
  };
}

// =================== MAIN ===================
export default function EvaluationSystem() {
  const [data, setData] = useState({ templates: [], employees: [], events: [], workCatalogs: [], workLogs: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [mode, setMode] = useState("browse");
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showNewWorkLogModal, setShowNewWorkLogModal] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) setData(JSON.parse(result.value));
        else {
          const seeded = seedData();
          setData(seeded);
          await window.storage.set(STORAGE_KEY, JSON.stringify(seeded));
        }
      } catch {
        setData(seedData());
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next)); }
    catch { showNotif("Lỗi lưu", "error"); }
  };

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const selectedTemplate = data.templates.find((t) => t.id === selectedTemplateId);
  const selectedVersion = selectedTemplate?.versions.find((v) => v.id === selectedVersionId);

  // Template ops
  const createTemplate = (departmentId, name, description) => {
    const newTpl = {
      id: `tpl_${Date.now()}`, departmentId, name, description, activeVersionId: null,
      versions: [{
        id: `v_${Date.now()}`, versionNumber: "1.0", status: "draft",
        createdAt: new Date().toISOString(),
        pillars: Object.entries(PILLAR_TYPES).map(([type, info], i) => ({
          id: `p${i + 1}`, type, weight: info.defaultWeight, questions: [],
        })),
      }],
    };
    persist({ ...data, templates: [...data.templates, newTpl] });
    setSelectedTemplateId(newTpl.id);
    setSelectedVersionId(newTpl.versions[0].id);
    setMode("edit");
    showNotif("Đã tạo template");
  };

  const deleteTemplate = (id) => {
    if (!confirm("Xoá template?")) return;
    persist({ ...data, templates: data.templates.filter((t) => t.id !== id) });
    if (selectedTemplateId === id) { setSelectedTemplateId(null); setSelectedVersionId(null); }
    showNotif("Đã xoá");
  };

  const createNewVersion = (templateId, baseVersionId) => {
    const tpl = data.templates.find((t) => t.id === templateId);
    const base = tpl.versions.find((v) => v.id === baseVersionId);
    const maxV = Math.max(...tpl.versions.map((v) => parseFloat(v.versionNumber)));
    const newV = {
      id: `v_${Date.now()}`, versionNumber: (Math.floor(maxV) + 1) + ".0",
      status: "draft", createdAt: new Date().toISOString(), basedOn: base.versionNumber,
      pillars: JSON.parse(JSON.stringify(base.pillars)),
    };
    persist({
      ...data,
      templates: data.templates.map((t) => t.id === templateId ? { ...t, versions: [...t.versions, newV] } : t),
    });
    setSelectedVersionId(newV.id);
    setMode("edit");
    showNotif(`Đã tạo v${newV.versionNumber}`);
  };

  const publishVersion = (templateId, versionId) => {
    persist({
      ...data,
      templates: data.templates.map((t) => {
        if (t.id !== templateId) return t;
        return {
          ...t, activeVersionId: versionId,
          versions: t.versions.map((v) => {
            if (v.id === versionId) return { ...v, status: "published", publishedAt: new Date().toISOString() };
            if (v.status === "published") return { ...v, status: "archived" };
            return v;
          }),
        };
      }),
    });
    setMode("view");
    showNotif("Đã publish");
  };

  const updateVersion = (templateId, versionId, updater) => {
    persist({
      ...data,
      templates: data.templates.map((t) => t.id !== templateId ? t : {
        ...t, versions: t.versions.map((v) => v.id === versionId ? updater(v) : v),
      }),
    });
  };

  // Event ops
  const createEvent = (ev) => {
    persist({ ...data, events: [{ id: `evt_${Date.now()}`, createdAt: new Date().toISOString(), status: "pending", ...ev }, ...data.events] });
    showNotif("Đã ghi nhận sự vụ");
  };
  const updateEventStatus = (id, status) => {
    persist({ ...data, events: data.events.map((e) => e.id === id ? { ...e, status, confirmedAt: new Date().toISOString() } : e) });
    showNotif("Đã cập nhật");
  };
  const deleteEvent = (id) => {
    if (!confirm("Xoá sự vụ?")) return;
    persist({ ...data, events: data.events.filter((e) => e.id !== id) });
    showNotif("Đã xoá");
  };

  // Work log ops
  const createWorkLog = (log) => {
    persist({ ...data, workLogs: [{ id: `wl_${Date.now()}`, ...log }, ...data.workLogs] });
    showNotif("Đã log công việc");
  };
  const deleteWorkLog = (id) => {
    if (!confirm("Xoá log này?")) return;
    persist({ ...data, workLogs: data.workLogs.filter((l) => l.id !== id) });
    showNotif("Đã xoá");
  };

  // Work type ops
  const updateWorkType = (catalogId, typeId, patch) => {
    persist({
      ...data,
      workCatalogs: data.workCatalogs.map((c) => c.id !== catalogId ? c : {
        ...c, unitTypes: c.unitTypes.map((t) => t.id === typeId ? { ...t, ...patch } : t),
      }),
    });
  };
  const addWorkType = (catalogId) => {
    const newType = { id: `wt_${Date.now()}`, code: "MOI", name: "Loại việc mới", points: 1, note: "" };
    persist({
      ...data,
      workCatalogs: data.workCatalogs.map((c) => c.id !== catalogId ? c : { ...c, unitTypes: [...c.unitTypes, newType] }),
    });
  };
  const deleteWorkType = (catalogId, typeId) => {
    if (!confirm("Xoá loại công việc? (các log đã có vẫn giữ)")) return;
    persist({
      ...data,
      workCatalogs: data.workCatalogs.map((c) => c.id !== catalogId ? c : {
        ...c, unitTypes: c.unitTypes.filter((t) => t.id !== typeId),
      }),
    });
  };

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className={`px-5 py-3 rounded-lg shadow-lg border ${notification.type === "error" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
            {notification.msg}
          </div>
        </div>
      )}

      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-3xl text-stone-900 tracking-tight" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                  Hệ thống Đánh giá Nhân viên
                </h1>
                <span className="text-xs text-stone-400 uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>v3.0</span>
              </div>
              <p className="text-sm text-stone-500 mt-1" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                Template · Loại công việc · Log công việc · Sự vụ · Bảng điểm
              </p>
            </div>
            <div className="flex gap-2">
              {view === "events" && <button onClick={() => setShowNewEventModal(true)} className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-md hover:bg-stone-700 text-sm"><Plus size={16} /> Ghi nhận sự vụ</button>}
              {view === "templates" && <button onClick={() => setShowNewTemplateModal(true)} className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-md hover:bg-stone-700 text-sm"><Plus size={16} /> Template mới</button>}
              {view === "worklogs" && <button onClick={() => setShowNewWorkLogModal(true)} className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-md hover:bg-stone-700 text-sm"><Plus size={16} /> Log công việc</button>}
            </div>
          </div>

          <div className="flex gap-1 border-b border-stone-200 -mb-5 overflow-x-auto">
            {[
              { id: "templates", label: "Templates", icon: FileText, count: data.templates.length },
              { id: "worktypes", label: "Loại công việc", icon: Layers, count: data.workCatalogs.reduce((s, c) => s + c.unitTypes.length, 0) },
              { id: "worklogs", label: "Log công việc", icon: Briefcase, count: data.workLogs.length },
              { id: "events", label: "Sự vụ", icon: AlertCircle, count: data.events.length },
              { id: "scorecard", label: "Bảng điểm", icon: TrendingUp, count: data.employees.length },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setView(tab.id)} className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${view === tab.id ? "border-stone-900 text-stone-900 font-medium" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
                <tab.icon size={14} />
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${view === tab.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === "templates" && (
        <TemplatesView data={data} selectedTemplate={selectedTemplate} selectedVersion={selectedVersion}
          setSelectedTemplateId={setSelectedTemplateId} setSelectedVersionId={setSelectedVersionId}
          selectedTemplateId={selectedTemplateId} mode={mode} setMode={setMode}
          onCreateModal={() => setShowNewTemplateModal(true)} onDelete={deleteTemplate}
          onCreateVersion={createNewVersion} onPublish={publishVersion} onUpdate={updateVersion} />
      )}
      {view === "worktypes" && (
        <WorkTypesView data={data} onUpdate={updateWorkType} onAdd={addWorkType} onDelete={deleteWorkType} />
      )}
      {view === "worklogs" && (
        <WorkLogsView data={data} onCreate={() => setShowNewWorkLogModal(true)} onDelete={deleteWorkLog} />
      )}
      {view === "events" && (
        <EventsView data={data} onCreate={() => setShowNewEventModal(true)} onUpdateStatus={updateEventStatus} onDelete={deleteEvent} />
      )}
      {view === "scorecard" && <ScorecardView data={data} />}

      {showNewTemplateModal && <NewTemplateModal onClose={() => setShowNewTemplateModal(false)} onCreate={(d, n, desc) => { createTemplate(d, n, desc); setShowNewTemplateModal(false); }} />}
      {showNewEventModal && <NewEventModal employees={data.employees} onClose={() => setShowNewEventModal(false)} onCreate={(e) => { createEvent(e); setShowNewEventModal(false); }} />}
      {showNewWorkLogModal && <NewWorkLogModal employees={data.employees} workCatalogs={data.workCatalogs} onClose={() => setShowNewWorkLogModal(false)} onCreate={(l) => { createWorkLog(l); setShowNewWorkLogModal(false); }} />}

      <style>{`@keyframes slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .animate-slide-in { animation: slide-in 0.3s ease-out; }`}</style>
    </div>
  );
}

// =================== WORK TYPES VIEW — Danh mục loại công việc theo phòng ===================
function WorkTypesView({ data, onUpdate, onAdd, onDelete }) {
  const [editMode, setEditMode] = useState({});
  const [selectedCatalogId, setSelectedCatalogId] = useState(data.workCatalogs[0]?.id);
  const catalog = data.workCatalogs.find((c) => c.id === selectedCatalogId);
  const dept = catalog ? DEFAULT_DEPARTMENTS.find((d) => d.id === catalog.departmentId) : null;

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Danh mục loại công việc</h2>
        <p className="text-sm text-stone-500" style={{ fontStyle: "italic" }}>
          Mỗi phòng định nghĩa các loại việc riêng, kèm <strong>điểm công</strong> thể hiện độ nặng/phức tạp. Đây là nền tảng để so sánh công bằng giữa các nhân viên làm việc khác nhau.
        </p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {data.workCatalogs.map((c) => {
          const d = DEFAULT_DEPARTMENTS.find((x) => x.id === c.departmentId);
          const isSel = c.id === selectedCatalogId;
          return (
            <button key={c.id} onClick={() => setSelectedCatalogId(c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm whitespace-nowrap ${isSel ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 hover:border-stone-400"}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d?.color }} />
              {d?.name}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSel ? "bg-white/20" : "bg-stone-100"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {c.unitTypes.length}
              </span>
            </button>
          );
        })}
      </div>

      {catalog && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between" style={{ backgroundColor: `${dept?.color}08`, borderLeft: `4px solid ${dept?.color}` }}>
            <div>
              <div className="text-sm font-medium text-stone-900">{catalog.name}</div>
              <div className="text-xs text-stone-500 mt-0.5">{catalog.unitTypes.length} loại công việc đã định nghĩa</div>
            </div>
            <button onClick={() => onAdd(catalog.id)} className="flex items-center gap-1.5 text-xs bg-stone-900 text-white px-3 py-1.5 rounded-md hover:bg-stone-700">
              <Plus size={12} /> Thêm loại
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Mã</th>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tên loại công việc</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Điểm công</th>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Ghi chú</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {catalog.unitTypes.map((t) => {
                const isEditing = editMode[t.id];
                return (
                  <tr key={t.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input type="text" value={t.code} onChange={(e) => onUpdate(catalog.id, t.id, { code: e.target.value.toUpperCase() })} className="w-24 px-2 py-1 text-xs border border-stone-200 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                      ) : (
                        <code className="text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.code}</code>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input type="text" value={t.name} onChange={(e) => onUpdate(catalog.id, t.id, { name: e.target.value })} className="w-full px-2 py-1 text-sm border border-stone-200 rounded" />
                      ) : (
                        <span className="text-sm text-stone-900">{t.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" step="0.5" value={t.points} onChange={(e) => onUpdate(catalog.id, t.id, { points: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm border border-stone-200 rounded text-right" />
                      ) : (
                        <span className="text-base font-medium text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{t.points}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input type="text" value={t.note || ""} onChange={(e) => onUpdate(catalog.id, t.id, { note: e.target.value })} placeholder="(tuỳ chọn)" className="w-full px-2 py-1 text-xs border border-stone-200 rounded" />
                      ) : (
                        <span className="text-xs text-stone-500" style={{ fontStyle: "italic" }}>{t.note || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditMode({ ...editMode, [t.id]: !isEditing })} className={`p-1.5 rounded hover:bg-stone-100 ${isEditing ? "text-emerald-700" : "text-stone-500"}`}>
                          {isEditing ? <Check size={13} /> : <Edit3 size={13} />}
                        </button>
                        <button onClick={() => onDelete(catalog.id, t.id)} className="p-1.5 rounded hover:bg-rose-50 text-stone-400 hover:text-rose-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-5 py-3 bg-stone-50/50 text-xs text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            ⓘ Điểm công cao = việc nặng/phức tạp hơn. Ban đầu ước lượng, sau đó hiệu chỉnh theo thực tế.
          </div>
        </div>
      )}
    </div>
  );
}

// =================== WORK LOGS VIEW ===================
function WorkLogsView({ data, onCreate, onDelete }) {
  const [filters, setFilters] = useState({ employeeId: "", workTypeId: "", status: "" });
  const allTypes = data.workCatalogs.flatMap((c) => c.unitTypes);

  const filtered = useMemo(() => {
    return data.workLogs.filter((l) => {
      if (filters.employeeId && l.employeeId !== filters.employeeId) return false;
      if (filters.workTypeId && l.workTypeId !== filters.workTypeId) return false;
      if (filters.status && l.status !== filters.status) return false;
      return true;
    }).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }, [data.workLogs, filters]);

  const totalPoints = filtered.reduce((s, l) => {
    const wt = allTypes.find((t) => t.id === l.workTypeId);
    return s + (wt ? l.quantity * wt.points : 0);
  }, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng log" value={data.workLogs.length} sub="bản ghi công việc" color="#0f766e" />
        <StatCard label="Tổng điểm công (lọc)" value={Math.round(totalPoints * 10) / 10} sub="sau khi lọc" color="#0369a1" />
        <StatCard label="Hoàn thành đúng hạn" value={data.workLogs.filter((l) => l.status === "completed_ontime").length} sub="bản ghi" color="#059669" />
        <StatCard label="Có vấn đề" value={data.workLogs.filter((l) => l.status === "completed_issue" || l.status === "failed" || l.status === "completed_late").length} sub="cần xem xét" color="#dc2626" />
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-stone-400" />
          <span className="text-xs uppercase tracking-widest text-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Lọc:</span>
          <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả NV</option>
            {data.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select value={filters.workTypeId} onChange={(e) => setFilters({ ...filters, workTypeId: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả loại việc</option>
            {data.workCatalogs.map((c) => {
              const d = DEFAULT_DEPARTMENTS.find((x) => x.id === c.departmentId);
              return (
                <optgroup key={c.id} label={d?.name || c.name}>
                  {c.unitTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                </optgroup>
              );
            })}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(filters.employeeId || filters.workTypeId || filters.status) && (
            <button onClick={() => setFilters({ employeeId: "", workTypeId: "", status: "" })} className="text-xs text-stone-500 hover:text-stone-900 underline">Xoá lọc</button>
          )}
          <div className="ml-auto text-xs text-stone-500">{filtered.length}/{data.workLogs.length}</div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="mx-auto text-stone-300 mb-3" size={32} />
            <div className="text-sm text-stone-500 mb-4">Chưa có log phù hợp</div>
            <button onClick={onCreate} className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-700 text-sm">
              <Plus size={14} /> Log công việc đầu tiên
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Ngày</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Nhân viên</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Loại việc</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SL</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Điểm</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-stone-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Trạng thái</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const emp = data.employees.find((e) => e.id === log.employeeId);
                const wt = allTypes.find((t) => t.id === log.workTypeId);
                const st = WORK_STATUS[log.status];
                const points = wt ? log.quantity * wt.points : 0;
                const relatedEvent = data.events.find((e) => e.id === log.relatedEventId);
                return (
                  <tr key={log.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3 text-xs text-stone-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(log.completedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-900">{emp?.name || "?"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{wt?.code}</code>
                        <span className="text-sm text-stone-800">{wt?.name || "—"}</span>
                        {relatedEvent && (
                          <span className="text-[10px] text-rose-600 flex items-center gap-0.5" title="Sự vụ liên quan">
                            <AlertCircle size={10} />
                          </span>
                        )}
                      </div>
                      {log.note && <div className="text-xs text-stone-500 mt-0.5" style={{ fontStyle: "italic" }}>{log.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-stone-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{log.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{points}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded" style={{ backgroundColor: `${st?.color}15`, color: st?.color, fontFamily: "'JetBrains Mono', monospace" }}>
                        {st?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDelete(log.id)} className="text-stone-300 hover:text-rose-600 p-1"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// =================== SCORECARD — Tích hợp work points + events ===================
function ScorecardView({ data }) {
  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Bảng điểm tổng hợp theo nhân viên</h2>
        <p className="text-sm text-stone-500" style={{ fontStyle: "italic" }}>
          Kết hợp <strong>điểm công</strong> từ work logs + <strong>điểm sự vụ</strong> từ events đã xác nhận
        </p>
      </div>

      <div className="space-y-3">
        {data.employees.map((emp) => {
          const dept = DEFAULT_DEPARTMENTS.find((d) => d.id === emp.departmentId);
          const workStats = getEmployeeWorkStats(emp.id, data.workLogs, data.workCatalogs);
          const empEvents = data.events.filter((e) => e.employeeId === emp.id && e.status === "confirmed");
          const positive = empEvents.filter((e) => EVENT_CATEGORIES[e.category]?.polarity === "+");
          const negative = empEvents.filter((e) => EVENT_CATEGORIES[e.category]?.polarity === "-");
          const positiveScore = positive.reduce((s, e) => s + SEVERITY[e.severity].multiplier, 0);
          const negativeScore = negative.reduce((s, e) => s + SEVERITY[e.severity].multiplier, 0);
          const eventNet = positiveScore - negativeScore;

          return (
            <div key={emp.id} className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0" style={{ backgroundColor: dept?.color || "#78716c" }}>
                  {emp.name.split(" ").pop()[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-medium text-stone-900">{emp.name}</span>
                    <span className="text-xs text-stone-500">· {emp.role}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest" style={{ backgroundColor: `${dept?.color}15`, color: dept?.color, fontFamily: "'JetBrains Mono', monospace" }}>{dept?.name}</span>
                  </div>
                </div>
              </div>

              {/* 2 khối song song: Work + Events */}
              <div className="grid grid-cols-2 gap-4">
                {/* WORK */}
                <div className="bg-stone-50/70 rounded-md p-4 border border-stone-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={13} className="text-stone-500" />
                    <span className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Điểm công</span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-3xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>{workStats.totalPoints}</span>
                    <span className="text-xs text-stone-500">từ {workStats.totalCount} việc · đúng hạn {workStats.ontimeRate}%</span>
                  </div>

                  {workStats.byType.length > 0 ? (
                    <div className="space-y-1.5">
                      {workStats.byType.slice(0, 4).map((bt) => (
                        <div key={bt.code} className="flex items-center text-xs">
                          <code className="bg-white px-1.5 py-0.5 rounded text-[10px] text-stone-600 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{bt.code}</code>
                          <span className="flex-1 text-stone-700 truncate">{bt.name}</span>
                          <span className="text-stone-500 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>×{bt.qty}</span>
                          <span className="font-medium text-stone-900 w-10 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(bt.points * 10) / 10}</span>
                        </div>
                      ))}
                      {workStats.byType.length > 4 && <div className="text-xs text-stone-400 italic">+{workStats.byType.length - 4} loại khác</div>}
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">Chưa có log công việc</div>
                  )}
                </div>

                {/* EVENTS */}
                <div className="bg-stone-50/70 rounded-md p-4 border border-stone-100">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={13} className="text-stone-500" />
                    <span className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Điểm sự vụ</span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className={`text-3xl ${eventNet >= 0 ? "text-emerald-700" : "text-rose-700"}`} style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                      {eventNet > 0 ? "+" : ""}{eventNet}
                    </span>
                    <span className="text-xs text-stone-500">+{positiveScore} / −{negativeScore}</span>
                  </div>

                  {empEvents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(EVENT_CATEGORIES).map(([k, v]) => {
                        const count = empEvents.filter((e) => e.category === k).length;
                        if (count === 0) return null;
                        const Icon = v.icon;
                        return (
                          <div key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: `${v.color}15`, color: v.color }}>
                            <Icon size={10} /> {v.label} <strong>{count}</strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">Chưa có sự vụ</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== EVENTS & TEMPLATES VIEW (giữ nguyên từ v2) ===================
function EventsView({ data, onCreate, onUpdateStatus, onDelete }) {
  const [filters, setFilters] = useState({ employeeId: "", category: "", status: "", severity: "" });
  const filtered = useMemo(() => data.events.filter((e) => {
    if (filters.employeeId && e.employeeId !== filters.employeeId) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (filters.severity && e.severity !== filters.severity) return false;
    return true;
  }).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)), [data.events, filters]);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng sự vụ" value={data.events.length} sub={`${data.events.filter((e) => e.status === "pending").length} chờ xác nhận`} color="#0f766e" />
        <StatCard label="Tích cực" value={data.events.filter((e) => EVENT_CATEGORIES[e.category]?.polarity === "+").length} sub="khen, sáng kiến" color="#059669" />
        <StatCard label="Tiêu cực" value={data.events.filter((e) => EVENT_CATEGORIES[e.category]?.polarity === "-").length} sub="khiếu nại, sự cố" color="#dc2626" />
        <StatCard label="Mức nặng" value={data.events.filter((e) => e.severity === "heavy").length} sub="cần xem xét" color="#b91c1c" />
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-stone-400" />
          <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả NV</option>
            {data.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả loại</option>
            {Object.entries(EVENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả mức độ</option>
            {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="text-xs px-3 py-1.5 border border-stone-200 rounded bg-white">
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="disputed">Tranh luận</option>
          </select>
          <div className="ml-auto text-xs text-stone-500">{filtered.length}/{data.events.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white border border-dashed border-stone-300 rounded-lg p-12 text-center">
            <AlertCircle className="mx-auto text-stone-300 mb-3" size={32} />
            <button onClick={onCreate} className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-700 text-sm">
              <Plus size={14} /> Ghi nhận sự vụ đầu tiên
            </button>
          </div>
        )}
        {filtered.map((ev) => <EventCard key={ev.id} event={ev} employees={data.employees} onUpdateStatus={onUpdateStatus} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="text-xs uppercase tracking-widest text-stone-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      <div className="text-3xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>{value}</div>
      <div className="text-xs text-stone-400 mt-1">{sub}</div>
    </div>
  );
}

function EventCard({ event, employees, onUpdateStatus, onDelete }) {
  const emp = employees.find((e) => e.id === event.employeeId);
  const cat = EVENT_CATEGORIES[event.category];
  const sev = SEVERITY[event.severity];
  const src = SOURCE_TYPES[event.source];
  const Icon = cat?.icon || AlertCircle;
  const SrcIcon = src?.icon || Users;
  return (
    <div className="bg-white border border-stone-200 rounded-lg hover:border-stone-300">
      <div className="p-4 flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat?.color}15` }}>
          <Icon size={18} style={{ color: cat?.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-medium text-stone-900">{emp?.name || "?"}</span>
            <span className="text-xs text-stone-500">· {emp?.role}</span>
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded font-medium" style={{ backgroundColor: `${cat?.color}15`, color: cat?.color, fontFamily: "'JetBrains Mono', monospace" }}>{cat?.polarity} {cat?.label}</span>
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded" style={{ backgroundColor: `${sev?.color}20`, color: sev?.color, fontFamily: "'JetBrains Mono', monospace" }}>{sev?.label} ×{sev?.multiplier}</span>
            <StatusBadge status={event.status} />
          </div>
          <div className="text-sm text-stone-700 mb-2">{event.description}</div>
          <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={11} />{new Date(event.occurredAt).toLocaleDateString("vi-VN")}</span>
            <span className="flex items-center gap-1"><SrcIcon size={11} />{src?.label}</span>
            <span className="flex items-center gap-1"><User size={11} />{event.reportedBy}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          {event.status === "pending" && (
            <>
              <button onClick={() => onUpdateStatus(event.id, "confirmed")} className="text-xs flex items-center gap-1 px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded"><Check size={12} /> Xác nhận</button>
              <button onClick={() => onUpdateStatus(event.id, "disputed")} className="text-xs flex items-center gap-1 px-2 py-1 text-amber-700 hover:bg-amber-50 rounded"><Shield size={12} /> Tranh luận</button>
            </>
          )}
          <button onClick={() => onDelete(event.id)} className="text-xs flex items-center gap-1 px-2 py-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "pending") return <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded bg-stone-100 text-stone-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Chờ xác nhận</span>;
  if (status === "confirmed") return <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded bg-emerald-100 text-emerald-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>✓ Xác nhận</span>;
  if (status === "disputed") return <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded bg-amber-100 text-amber-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>⚠ Tranh luận</span>;
  return null;
}

function TemplatesView({ data, selectedTemplate, selectedVersion, setSelectedTemplateId, setSelectedVersionId, selectedTemplateId, mode, setMode, onCreateModal, onDelete, onCreateVersion, onPublish, onUpdate }) {
  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8 flex gap-8">
      <aside className="w-[340px] flex-shrink-0">
        <div className="text-xs uppercase tracking-widest text-stone-400 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Templates · {data.templates.length}</div>
        <div className="space-y-2">
          {data.templates.map((tpl) => {
            const dept = DEFAULT_DEPARTMENTS.find((d) => d.id === tpl.departmentId);
            const active = tpl.versions.find((v) => v.id === tpl.activeVersionId);
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <button key={tpl.id} onClick={() => { setSelectedTemplateId(tpl.id); setSelectedVersionId(tpl.activeVersionId || tpl.versions[tpl.versions.length - 1].id); setMode("view"); }} className={`w-full text-left p-4 rounded-md border ${isSelected ? "bg-white border-stone-400 shadow-sm" : "bg-white/50 border-stone-200 hover:border-stone-300"}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dept?.color }} />
                  <span className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{dept?.name}</span>
                </div>
                <div className="text-sm text-stone-900 font-medium">{tpl.name}</div>
                <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1"><GitBranch size={11} />{tpl.versions.length}</span>
                  {active && <span className="flex items-center gap-1 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />v{active.versionNumber}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {!selectedTemplate ? (
          <div className="bg-white border border-stone-200 rounded-lg p-16 text-center">
            <FileText size={28} className="text-stone-400 mx-auto mb-4" />
            <h2 className="text-xl text-stone-900 mb-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Chọn template</h2>
            <button onClick={onCreateModal} className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-md hover:bg-stone-700 text-sm mt-4"><Plus size={16} /> Tạo mới</button>
          </div>
        ) : (
          <TemplateDetail template={selectedTemplate} selectedVersion={selectedVersion} mode={mode} setMode={setMode} setSelectedVersionId={setSelectedVersionId} data={data}
            onDelete={() => onDelete(selectedTemplate.id)} onCreateVersion={(b) => onCreateVersion(selectedTemplate.id, b)}
            onPublish={(v) => onPublish(selectedTemplate.id, v)} onUpdate={(u) => onUpdate(selectedTemplate.id, selectedVersion.id, u)} />
        )}
      </main>
    </div>
  );
}

function TemplateDetail({ template, selectedVersion, mode, setMode, setSelectedVersionId, data, onDelete, onCreateVersion, onPublish, onUpdate }) {
  const dept = DEFAULT_DEPARTMENTS.find((d) => d.id === template.departmentId);
  const isActive = selectedVersion?.id === template.activeVersionId;
  const canEdit = selectedVersion?.status === "draft";
  // Lấy catalog của phòng ban này
  const deptCatalog = data.workCatalogs.find((c) => c.departmentId === template.departmentId);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest mb-2" style={{ backgroundColor: `${dept?.color}15`, color: dept?.color, fontFamily: "'JetBrains Mono', monospace" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dept?.color }} />{dept?.name}
            </span>
            <h2 className="text-2xl text-stone-900 mt-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>{template.name}</h2>
            {template.description && <p className="text-sm text-stone-600 mt-1" style={{ fontStyle: "italic" }}>{template.description}</p>}
          </div>
          <button onClick={onDelete} className="text-stone-400 hover:text-rose-600 p-2 rounded-md hover:bg-rose-50"><Trash2 size={16} /></button>
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto">
            {[...template.versions].reverse().map((v) => {
              const isSel = v.id === selectedVersion?.id;
              const isAct = v.id === template.activeVersionId;
              return (
                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setMode("view"); }} className={`flex-shrink-0 px-3 py-2 rounded-md border text-xs ${isSel ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 hover:border-stone-400"}`}>
                  <div className="flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <span className="font-medium">v{v.versionNumber}</span>
                    {isAct && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-emerald-300" : "bg-emerald-500"}`} />}
                    <span className={`text-[10px] uppercase ${isSel ? "text-stone-300" : "text-stone-500"}`}>{v.status === "draft" ? "nháp" : v.status === "published" ? "active" : "cũ"}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => onCreateVersion(selectedVersion.id)} className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded text-stone-600 hover:bg-stone-100 whitespace-nowrap">
            <GitBranch size={12} /> Version mới
          </button>
        </div>
      </div>

      {selectedVersion && (
        <VersionEditor version={selectedVersion} mode={mode} setMode={setMode} canEdit={canEdit} isActive={isActive} deptCatalog={deptCatalog}
          onPublish={() => onPublish(selectedVersion.id)} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function VersionEditor({ version, mode, setMode, canEdit, isActive, deptCatalog, onPublish, onUpdate }) {
  const totalWeight = version.pillars.reduce((s, p) => s + (p.weight || 0), 0);
  const weightOk = totalWeight === 100;

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-lg text-stone-900" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>v{version.versionNumber}</span>
            {version.status === "draft" && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Nháp</span>}
            {version.status === "published" && isActive && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>}
            {version.status === "archived" && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-stone-200 text-stone-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Cũ</span>}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            <Clock size={11} className="inline mr-1" />{new Date(version.createdAt).toLocaleDateString("vi-VN")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && mode !== "edit" && <button onClick={() => setMode("edit")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-100"><Edit3 size={12} /> Sửa</button>}
          {canEdit && mode === "edit" && <button onClick={() => setMode("view")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-100"><Eye size={12} /> Xem</button>}
          {canEdit && <button onClick={onPublish} disabled={!weightOk} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-700 text-white rounded-md hover:bg-emerald-800 disabled:opacity-40"><Check size={12} /> Publish</button>}
        </div>
      </div>

      {canEdit && !weightOk && (
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
          ⚠ Tổng trọng số: <strong>{totalWeight}%</strong> — cần 100% để publish.
        </div>
      )}

      <div className="p-6 space-y-5">
        {version.pillars.map((pillar, pIdx) => (
          <PillarBlock key={pillar.id} pillar={pillar} pIdx={pIdx} editable={mode === "edit" && canEdit} deptCatalog={deptCatalog}
            onUpdatePillar={(patch) => onUpdate((v) => ({ ...v, pillars: v.pillars.map((p) => p.id === pillar.id ? { ...p, ...patch } : p) }))}
            onUpdateQuestion={(qid, patch) => onUpdate((v) => ({ ...v, pillars: v.pillars.map((p) => p.id === pillar.id ? { ...p, questions: p.questions.map((q) => q.id === qid ? { ...q, ...patch } : q) } : p) }))}
            onAddQuestion={() => {
              const newQ = { id: `q_${Date.now()}`, label: "Chỉ số mới", type: "scale", weight: 10, linkedEventCategories: [], workTypeIds: null };
              onUpdate((v) => ({ ...v, pillars: v.pillars.map((p) => p.id === pillar.id ? { ...p, questions: [...p.questions, newQ] } : p) }));
            }}
            onDeleteQuestion={(qid) => onUpdate((v) => ({ ...v, pillars: v.pillars.map((p) => p.id === pillar.id ? { ...p, questions: p.questions.filter((q) => q.id !== qid) } : p) }))}
          />
        ))}
      </div>

      <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 text-xs text-stone-500 flex justify-between" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <span>{version.pillars.reduce((s, p) => s + p.questions.length, 0)} chỉ số · {version.pillars.length} trụ cột</span>
        <span className={weightOk ? "text-emerald-700" : "text-amber-700"}>Σ {totalWeight}% {weightOk && "✓"}</span>
      </div>
    </div>
  );
}

function PillarBlock({ pillar, pIdx, editable, deptCatalog, onUpdatePillar, onUpdateQuestion, onAddQuestion, onDeleteQuestion }) {
  const info = PILLAR_TYPES[pillar.type];
  const [expandedQ, setExpandedQ] = useState(null);

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: `${info.color}0a`, borderLeft: `3px solid ${info.color}` }}>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs font-medium text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{String(pIdx + 1).padStart(2, "0")}</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-stone-900">{info.label}</div>
            <div className="text-[11px] text-stone-500 mt-0.5">{pillar.questions.length} chỉ số</div>
          </div>
        </div>
        {editable ? (
          <div className="flex items-center gap-1.5">
            <input type="number" value={pillar.weight} onChange={(e) => onUpdatePillar({ weight: Number(e.target.value) })} className="w-14 px-2 py-1 text-xs border border-stone-300 rounded text-right" />
            <span className="text-xs text-stone-500">%</span>
          </div>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded" style={{ backgroundColor: `${info.color}20`, color: info.color, fontFamily: "'JetBrains Mono', monospace" }}>{pillar.weight}%</span>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {pillar.questions.length === 0 && <div className="px-4 py-6 text-center text-xs text-stone-400 italic">Chưa có chỉ số</div>}
        {pillar.questions.map((q, qIdx) => {
          const isWorkBased = q.type === "work_points" || q.type === "work_count" || q.type === "work_quality";
          return (
            <div key={q.id}>
              <div className="px-4 py-2.5 hover:bg-stone-50 flex items-center gap-3">
                <span className="text-[10px] text-stone-400 w-6" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{String(qIdx + 1).padStart(2, "0")}</span>
                {editable ? (
                  <>
                    <input type="text" value={q.label} onChange={(e) => onUpdateQuestion(q.id, { label: e.target.value })} className="flex-1 text-sm px-2 py-1 border border-transparent rounded hover:border-stone-200 focus:border-stone-400 focus:outline-none bg-transparent" />
                    <select value={q.type} onChange={(e) => onUpdateQuestion(q.id, { type: e.target.value })} className="text-xs px-2 py-1 border border-stone-200 rounded bg-white">
                      {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" value={q.weight} onChange={(e) => onUpdateQuestion(q.id, { weight: Number(e.target.value) })} className="w-14 px-2 py-1 text-xs border border-stone-200 rounded text-right" />
                      <span className="text-[11px] text-stone-400">%</span>
                    </div>
                    <button onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)} className="text-[10px] px-2 py-1 border border-stone-200 rounded hover:border-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {isWorkBased ? `work (${q.workTypeIds?.length ?? "all"})` : `sự vụ (${q.linkedEventCategories?.length || 0})`}
                    </button>
                    <button onClick={() => onDeleteQuestion(q.id)} className="text-stone-300 hover:text-rose-600 p-1"><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-stone-800">{q.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{QUESTION_TYPES[q.type]}</span>
                    <span className="text-xs text-stone-600 w-10 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{q.weight}%</span>
                  </>
                )}
              </div>

              {/* View: linked events */}
              {!editable && q.linkedEventCategories && q.linkedEventCategories.length > 0 && (
                <div className="px-4 pb-2 ml-9 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↳ sự vụ:</span>
                  {q.linkedEventCategories.map((ec) => {
                    const cat = EVENT_CATEGORIES[ec];
                    if (!cat) return null;
                    const I = cat.icon;
                    return <span key={ec} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}><I size={9} /> {cat.label}</span>;
                  })}
                </div>
              )}

              {/* View: linked work types */}
              {!editable && isWorkBased && q.workTypeIds && q.workTypeIds.length > 0 && deptCatalog && (
                <div className="px-4 pb-2 ml-9 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↳ loại việc:</span>
                  {q.workTypeIds.map((wid) => {
                    const wt = deptCatalog.unitTypes.find((t) => t.id === wid);
                    if (!wt) return null;
                    return <code key={wid} className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{wt.code}</code>;
                  })}
                </div>
              )}
              {!editable && isWorkBased && !q.workTypeIds && (
                <div className="px-4 pb-2 ml-9 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↳ tính trên: <strong className="text-stone-600">tất cả loại việc</strong></span>
                </div>
              )}

              {/* Edit panel */}
              {editable && expandedQ === q.id && (
                <div className="px-4 pb-3 ml-9 bg-stone-50/70 pt-2">
                  {isWorkBased ? (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        Chọn loại việc để tính ({q.workTypeIds === null ? "hiện đang tính tất cả" : `${q.workTypeIds.length} loại được chọn`})
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => onUpdateQuestion(q.id, { workTypeIds: null })} className={`text-[11px] px-2 py-1 rounded border ${q.workTypeIds === null ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}>Tất cả loại việc</button>
                        <button onClick={() => onUpdateQuestion(q.id, { workTypeIds: [] })} className={`text-[11px] px-2 py-1 rounded border ${Array.isArray(q.workTypeIds) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}>Chọn cụ thể</button>
                      </div>
                      {Array.isArray(q.workTypeIds) && deptCatalog && (
                        <div className="flex flex-wrap gap-1.5">
                          {deptCatalog.unitTypes.map((t) => {
                            const isLinked = q.workTypeIds.includes(t.id);
                            return (
                              <button key={t.id} onClick={() => {
                                const next = isLinked ? q.workTypeIds.filter((x) => x !== t.id) : [...q.workTypeIds, t.id];
                                onUpdateQuestion(q.id, { workTypeIds: next });
                              }} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${isLinked ? "border-stone-900 bg-stone-100" : "border-stone-200 opacity-60 hover:opacity-100"}`}>
                                <code className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.code}</code>
                                <span>{t.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Gắn loại sự vụ</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(EVENT_CATEGORIES).map(([k, v]) => {
                          const I = v.icon;
                          const isLinked = q.linkedEventCategories?.includes(k);
                          return (
                            <button key={k} onClick={() => {
                              const current = q.linkedEventCategories || [];
                              const next = isLinked ? current.filter((x) => x !== k) : [...current, k];
                              onUpdateQuestion(q.id, { linkedEventCategories: next });
                            }} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${isLinked ? "border-stone-900" : "border-stone-200 opacity-50 hover:opacity-100"}`}
                              style={{ backgroundColor: isLinked ? `${v.color}15` : "white", color: isLinked ? v.color : "#78716c" }}>
                              <I size={10} /> {v.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {editable && (
          <button onClick={onAddQuestion} className="w-full px-4 py-2.5 text-xs text-stone-500 hover:text-stone-900 hover:bg-stone-50 flex items-center justify-center gap-1.5 border-t border-dashed border-stone-200">
            <Plus size={12} /> Thêm chỉ số
          </button>
        )}
      </div>
    </div>
  );
}

// =================== MODALS ===================
function NewTemplateModal({ onClose, onCreate }) {
  const [departmentId, setDepartmentId] = useState(DEFAULT_DEPARTMENTS[0].id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl text-stone-900 mb-5" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Tạo template mới</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Phòng ban</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm bg-white">
              {DEFAULT_DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tên</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900">Huỷ</button>
          <button onClick={() => name.trim() && onCreate(departmentId, name.trim(), description.trim())} disabled={!name.trim()} className="px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-40">Tạo</button>
        </div>
      </div>
    </div>
  );
}

function NewEventModal({ employees, onClose, onCreate }) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id || "", category: "customer_praise", severity: "medium",
    source: "internal", occurredAt: new Date().toISOString().slice(0, 16),
    reportedBy: "", description: "",
  });
  const update = (k, v) => setForm({ ...form, [k]: v });
  const submit = () => {
    if (!form.description.trim() || !form.reportedBy.trim()) return;
    onCreate({ ...form, occurredAt: new Date(form.occurredAt).toISOString(), description: form.description.trim(), reportedBy: form.reportedBy.trim() });
  };
  const cat = EVENT_CATEGORIES[form.category];
  const Icon = cat?.icon || AlertCircle;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat?.color}15` }}>
            <Icon size={20} style={{ color: cat?.color }} />
          </div>
          <h3 className="text-xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Ghi nhận sự vụ</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Nhân viên *</label>
            <select value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm bg-white">
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Thời điểm</label>
            <input type="datetime-local" value={form.occurredAt} onChange={(e) => update("occurredAt", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Loại sự vụ</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(EVENT_CATEGORIES).map(([k, v]) => {
                const I = v.icon;
                const active = form.category === k;
                return <button key={k} onClick={() => update("category", k)} className={`flex items-center gap-1.5 px-2 py-2 rounded-md border text-xs ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}><I size={13} style={{ color: active ? "#fff" : v.color }} /><span className="truncate">{v.label}</span></button>;
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Mức độ</label>
            <div className="flex gap-2">
              {Object.entries(SEVERITY).map(([k, v]) => {
                const active = form.severity === k;
                return <button key={k} onClick={() => update("severity", k)} className={`flex-1 px-3 py-2 rounded-md border text-xs ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}>{v.label} ×{v.multiplier}</button>;
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Nguồn</label>
            <div className="flex gap-2">
              {Object.entries(SOURCE_TYPES).map(([k, v]) => {
                const I = v.icon;
                const active = form.source === k;
                return <button key={k} onClick={() => update("source", k)} className={`flex-1 px-2 py-2 rounded-md border text-xs flex items-center justify-center gap-1 ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}><I size={12} /> {v.label}</button>;
              })}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Người ghi nhận *</label>
            <input type="text" value={form.reportedBy} onChange={(e) => update("reportedBy", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Mô tả *</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900">Huỷ</button>
          <button onClick={submit} disabled={!form.description.trim() || !form.reportedBy.trim()} className="px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-40">Ghi nhận</button>
        </div>
      </div>
    </div>
  );
}

function NewWorkLogModal({ employees, workCatalogs, onClose, onCreate }) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id || "",
    workTypeId: workCatalogs[0]?.unitTypes[0]?.id || "",
    quantity: 1,
    status: "completed_ontime",
    completedAt: new Date().toISOString().slice(0, 16),
    note: "",
    relatedEventId: null,
  });
  const update = (k, v) => setForm({ ...form, [k]: v });

  // Tự động chọn catalog theo phòng của nhân viên
  const emp = employees.find((e) => e.id === form.employeeId);
  const relevantCatalog = workCatalogs.find((c) => c.departmentId === emp?.departmentId);
  const availableTypes = relevantCatalog?.unitTypes || [];
  const currentType = availableTypes.find((t) => t.id === form.workTypeId);

  // Nếu workType hiện tại không thuộc catalog của nv, reset về type đầu
  useEffect(() => {
    if (emp && availableTypes.length > 0 && !availableTypes.find((t) => t.id === form.workTypeId)) {
      setForm((f) => ({ ...f, workTypeId: availableTypes[0].id }));
    }
  }, [form.employeeId]);

  const totalPoints = currentType ? form.quantity * currentType.points : 0;

  const submit = () => {
    if (!form.workTypeId) return;
    onCreate({ ...form, completedAt: new Date(form.completedAt).toISOString() });
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-stone-100">
            <Briefcase size={20} className="text-stone-700" />
          </div>
          <div>
            <h3 className="text-xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Log công việc</h3>
            <p className="text-xs text-stone-500">Ghi nhận công việc đã hoàn thành</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Nhân viên</label>
            <select value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm bg-white">
              {employees.map((emp) => {
                const d = DEFAULT_DEPARTMENTS.find((x) => x.id === emp.departmentId);
                return <option key={emp.id} value={emp.id}>{emp.name} — {emp.role} ({d?.name})</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Loại công việc (tự lọc theo phòng của NV)
            </label>
            {availableTypes.length === 0 ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠ Phòng của NV này chưa có danh mục công việc. Vào tab "Loại công việc" để thêm.
              </div>
            ) : (
              <select value={form.workTypeId} onChange={(e) => update("workTypeId", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm bg-white">
                {availableTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name} ({t.points} điểm/đv)</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Số lượng</label>
              <input type="number" min="1" step="1" value={form.quantity} onChange={(e) => update("quantity", Number(e.target.value))} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Ngày hoàn thành</label>
              <input type="datetime-local" value={form.completedAt} onChange={(e) => update("completedAt", e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" />
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-md p-3 flex items-center justify-between">
            <span className="text-xs text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Điểm công tính được</span>
            <span className="text-2xl text-stone-900" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
              {form.quantity} × {currentType?.points || 0} = <strong>{Math.round(totalPoints * 10) / 10}</strong>
            </span>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Trạng thái</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(WORK_STATUS).map(([k, v]) => {
                const active = form.status === k;
                return <button key={k} onClick={() => update("status", k)} className={`px-3 py-2 rounded-md border text-xs ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400"}`}>{v.label}</button>;
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Ghi chú (tuỳ chọn)</label>
            <input type="text" value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="VD: khách khó tính, phải giải thích nhiều..." className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900">Huỷ</button>
          <button onClick={submit} disabled={!form.workTypeId} className="px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-40">Ghi nhận</button>
        </div>
      </div>
    </div>
  );
}
