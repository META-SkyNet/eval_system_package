import React, { useState, useEffect, useMemo } from "react";
import { Plus, Copy, Check, X, AlertCircle, CheckCircle2, Clock, Zap, Key, FileCode, Activity, Database, ArrowRight, Send, Eye, Trash2, RefreshCw, Shield, Terminal, ChevronRight, ChevronDown, Play, Filter, Link2 } from "lucide-react";

const STORAGE_KEY = "eval_api_playground_v1";

// =================== CONSTANTS ===================
const ENDPOINTS = [
  {
    id: "work_events",
    method: "POST",
    path: "/api/v1/work-events",
    title: "Báo công việc hoàn thành / cập nhật",
    description: "CRM/ERP gọi endpoint này mỗi khi có công việc được đóng, huỷ, hoặc thay đổi trạng thái. Dùng external_id để tránh trùng lặp.",
    color: "#0369a1",
    exampleBody: {
      external_id: "CRM-ORD-2026-04-22-8847",
      event_type: "work_completed",
      job_code: "LAP_DH",
      employee_external_id: "CRM_EMP_042",
      quantity: 1,
      status: "completed_ontime",
      completed_at: "2026-04-22T14:30:00Z",
      metadata: {
        order_id: "ORD-8847",
        customer_district: "Cầu Giấy",
        note: "Khách yêu cầu lắp thêm van khóa"
      }
    }
  },
  {
    id: "incidents",
    method: "POST",
    path: "/api/v1/incidents",
    title: "Báo sự vụ / sự cố",
    description: "Khi có khách khen, khách khiếu nại, sự cố thiệt hại, sáng kiến — gọi endpoint này. Có thể gắn với work event qua related_work_external_id.",
    color: "#b91c1c",
    exampleBody: {
      external_id: "CRM-COMPLAINT-2026-04-22-12",
      category: "customer_complaint",
      severity: "heavy",
      employee_external_id: "CRM_EMP_042",
      source: "customer",
      occurred_at: "2026-04-22T15:00:00Z",
      description: "Khách phản ánh giao muộn 3 tiếng",
      reported_by: "CSKH - Nguyễn Thị X",
      related_work_external_id: "CRM-ORD-2026-04-22-8847"
    }
  },
  {
    id: "employee_map",
    method: "POST",
    path: "/api/v1/employee-mapping",
    title: "Đồng bộ nhân viên",
    description: "Tạo hoặc cập nhật map giữa employee ID của CRM và employee trong hệ thống đánh giá. Gọi khi có NV mới hoặc đổi phòng.",
    color: "#7c3aed",
    exampleBody: {
      employee_external_id: "CRM_EMP_042",
      full_name: "Nguyễn Văn Nam",
      department_code: "DELIVERY",
      role: "NV Lắp đặt",
      active: true
    }
  },
  {
    id: "scorecard",
    method: "GET",
    path: "/api/v1/employees/{employee_external_id}/scorecard",
    title: "Lấy bảng điểm nhân viên",
    description: "CRM/ERP kéo về để hiển thị trên dashboard. Có thể lọc theo khoảng thời gian.",
    color: "#059669",
    queryParams: [
      { name: "period_from", example: "2026-04-01" },
      { name: "period_to", example: "2026-04-30" },
    ],
    exampleResponse: {
      employee_external_id: "CRM_EMP_042",
      full_name: "Nguyễn Văn Nam",
      department: "DELIVERY",
      period: { from: "2026-04-01", to: "2026-04-30" },
      work_points: { total: 87.5, ontime_rate: 94, breakdown: [{ job_code: "LAP_DH", qty: 8, points: 80 }, { job_code: "GIAO_NHO", qty: 15, points: 15 }] },
      events: { positive: 3, negative: 1, net_score: 4 },
      final_rank: "A"
    }
  },
];

const STATUS_CODES = {
  pending: { label: "Chờ xử lý", color: "#94a3b8" },
  processed: { label: "Đã xử lý", color: "#059669" },
  failed: { label: "Lỗi", color: "#dc2626" },
  dead_letter: { label: "Dead letter", color: "#b91c1c" },
};

const seedLogs = () => ([
  {
    id: "log_1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    endpoint: "work_events",
    method: "POST",
    status: "processed",
    external_id: "CRM-ORD-2026-04-22-8847",
    source: "CRM Bitrix24",
    payload: {
      external_id: "CRM-ORD-2026-04-22-8847",
      event_type: "work_completed",
      job_code: "LAP_DH",
      employee_external_id: "CRM_EMP_042",
      quantity: 1,
      status: "completed_ontime",
      completed_at: "2026-04-22T14:30:00Z"
    },
    response: { ok: true, work_log_id: "wl_5f3a2b", action: "created" }
  },
  {
    id: "log_2",
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    endpoint: "incidents",
    method: "POST",
    status: "processed",
    external_id: "CRM-COMPLAINT-2026-04-22-12",
    source: "CRM Bitrix24",
    payload: {
      external_id: "CRM-COMPLAINT-2026-04-22-12",
      category: "customer_complaint",
      severity: "heavy",
      employee_external_id: "CRM_EMP_042",
      related_work_external_id: "CRM-ORD-2026-04-22-8847",
      description: "Khách phản ánh giao muộn 3 tiếng"
    },
    response: { ok: true, event_id: "evt_8a9c", linked_to_work: "wl_5f3a2b" }
  },
  {
    id: "log_3",
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    endpoint: "work_events",
    method: "POST",
    status: "dead_letter",
    external_id: "CRM-ORD-2026-04-22-8849",
    source: "CRM Bitrix24",
    payload: {
      external_id: "CRM-ORD-2026-04-22-8849",
      job_code: "LAP_CUSTOM_XYZ",
      employee_external_id: "CRM_EMP_042",
      quantity: 1
    },
    response: { ok: false, error_code: "UNKNOWN_JOB_CODE", error: "job_code 'LAP_CUSTOM_XYZ' không có trong catalog Giao hàng. Cần định nghĩa trước hoặc gửi loại khác." }
  },
  {
    id: "log_4",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    endpoint: "work_events",
    method: "POST",
    status: "failed",
    external_id: "CRM-ORD-2026-04-22-8850",
    source: "ERP SAP",
    payload: {
      external_id: "CRM-ORD-2026-04-22-8850",
      job_code: "GIAO_NHO",
      employee_external_id: "UNKNOWN_EMP_999",
      quantity: 3
    },
    response: { ok: false, error_code: "EMPLOYEE_NOT_MAPPED", error: "employee_external_id 'UNKNOWN_EMP_999' chưa được map. Gọi /employee-mapping trước." }
  },
  {
    id: "log_5",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    endpoint: "work_events",
    method: "POST",
    status: "processed",
    external_id: "CRM-ORD-2026-04-22-8847",
    source: "CRM Bitrix24",
    payload: {
      external_id: "CRM-ORD-2026-04-22-8847",
      event_type: "work_updated",
      status: "completed_issue",
      note: "Khách phàn nàn muộn"
    },
    response: { ok: true, work_log_id: "wl_5f3a2b", action: "updated (idempotent match by external_id)" }
  },
]);

// =================== MAIN ===================
export default function ApiIntegrationDesign() {
  const [data, setData] = useState({ logs: [], apiKeys: [], webhookConfig: null });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState(ENDPOINTS[0].id);
  const [playgroundBody, setPlaygroundBody] = useState(JSON.stringify(ENDPOINTS[0].exampleBody, null, 2));
  const [playgroundResponse, setPlaygroundResponse] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [logFilter, setLogFilter] = useState({ status: "", endpoint: "" });
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) setData(JSON.parse(result.value));
        else {
          const seeded = {
            logs: seedLogs(),
            apiKeys: [
              { id: "key_1", name: "CRM Bitrix24 Production", key: "evk_live_a7f3d9c2b4e5...", created_at: new Date(Date.now() - 86400000 * 30).toISOString(), last_used: new Date(Date.now() - 600000).toISOString(), active: true },
              { id: "key_2", name: "ERP SAP Integration", key: "evk_live_9d8e7c6b5a4...", created_at: new Date(Date.now() - 86400000 * 15).toISOString(), last_used: new Date(Date.now() - 1800000).toISOString(), active: true },
              { id: "key_3", name: "Staging test", key: "evk_test_f1e2d3c4b5a...", created_at: new Date(Date.now() - 86400000 * 5).toISOString(), last_used: null, active: true },
            ],
            webhookConfig: { base_url: "https://eval.company.vn", version: "v1", rate_limit: "100 req/s", retry_policy: "3 lần, exponential backoff" },
          };
          setData(seeded);
          await window.storage.set(STORAGE_KEY, JSON.stringify(seeded));
        }
      } catch {
        setData({ logs: seedLogs(), apiKeys: [], webhookConfig: null });
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const currentEndpoint = ENDPOINTS.find((e) => e.id === playgroundEndpoint);

  const selectEndpoint = (id) => {
    setPlaygroundEndpoint(id);
    const ep = ENDPOINTS.find((e) => e.id === id);
    if (ep.exampleBody) setPlaygroundBody(JSON.stringify(ep.exampleBody, null, 2));
    else setPlaygroundBody("");
    setPlaygroundResponse(null);
  };

  const simulateRequest = () => {
    let parsed;
    try { parsed = playgroundBody ? JSON.parse(playgroundBody) : {}; }
    catch (e) {
      setPlaygroundResponse({ ok: false, status: 400, error_code: "INVALID_JSON", error: e.message });
      return;
    }

    // Giả lập logic xử lý
    const ep = ENDPOINTS.find((e) => e.id === playgroundEndpoint);
    let response;

    if (ep.id === "work_events") {
      if (!parsed.job_code) response = { ok: false, status: 400, error_code: "MISSING_JOB_CODE", error: "job_code là bắt buộc" };
      else if (!parsed.employee_external_id) response = { ok: false, status: 400, error_code: "MISSING_EMPLOYEE", error: "employee_external_id là bắt buộc" };
      else if (!parsed.external_id) response = { ok: false, status: 400, error_code: "MISSING_EXTERNAL_ID", error: "external_id là bắt buộc để tránh trùng" };
      else if (parsed.job_code === "LAP_CUSTOM_XYZ") response = { ok: false, status: 422, error_code: "UNKNOWN_JOB_CODE", error: `job_code '${parsed.job_code}' không có trong catalog` };
      else response = { ok: true, status: 201, work_log_id: `wl_${Math.random().toString(36).substring(2, 8)}`, action: "created", message: `Đã ghi nhận công việc cho NV ${parsed.employee_external_id}` };
    } else if (ep.id === "incidents") {
      if (!parsed.category) response = { ok: false, status: 400, error_code: "MISSING_CATEGORY", error: "category là bắt buộc" };
      else if (!parsed.employee_external_id) response = { ok: false, status: 400, error_code: "MISSING_EMPLOYEE", error: "employee_external_id là bắt buộc" };
      else response = { ok: true, status: 201, event_id: `evt_${Math.random().toString(36).substring(2, 8)}`, linked_to_work: parsed.related_work_external_id ? `wl_${Math.random().toString(36).substring(2, 8)}` : null, initial_status: "pending_confirmation" };
    } else if (ep.id === "employee_map") {
      if (!parsed.employee_external_id) response = { ok: false, status: 400, error_code: "MISSING_EMPLOYEE_ID", error: "employee_external_id là bắt buộc" };
      else response = { ok: true, status: 200, internal_id: `emp_${Math.random().toString(36).substring(2, 6)}`, action: "upserted" };
    } else if (ep.id === "scorecard") {
      response = { ok: true, status: 200, ...ep.exampleResponse };
    }

    setPlaygroundResponse(response);

    // Thêm vào log (chỉ khi POST)
    if (ep.method === "POST") {
      const newLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        endpoint: ep.id,
        method: ep.method,
        status: response.ok ? "processed" : (response.error_code === "UNKNOWN_JOB_CODE" ? "dead_letter" : "failed"),
        external_id: parsed.external_id || "(không có)",
        source: "Playground",
        payload: parsed,
        response
      };
      persist({ ...data, logs: [newLog, ...data.logs] });
    }
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const retryLog = (logId) => {
    persist({
      ...data,
      logs: data.logs.map((l) => l.id === logId ? { ...l, status: "processed", response: { ...l.response, ok: true, message: "Đã replay thành công", retried_at: new Date().toISOString() } } : l)
    });
  };

  const deleteLog = (logId) => {
    persist({ ...data, logs: data.logs.filter((l) => l.id !== logId) });
  };

  const filteredLogs = useMemo(() => {
    return data.logs.filter((l) => {
      if (logFilter.status && l.status !== logFilter.status) return false;
      if (logFilter.endpoint && l.endpoint !== logFilter.endpoint) return false;
      return true;
    });
  }, [data.logs, logFilter]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-8 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-3xl tracking-tight text-zinc-100" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                  Integration API
                </h1>
                <span className="text-xs text-zinc-500 uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  for Employee Evaluation System
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-1.5" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
                Side-by-side integration với CRM / ERP · Event-driven · Idempotent · Dead letter
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              API v1 · online
            </div>
          </div>

          <div className="flex gap-1 border-b border-zinc-800 -mb-5 overflow-x-auto">
            {[
              { id: "overview", label: "Tổng quan", icon: FileCode },
              { id: "endpoints", label: "Endpoints", icon: Terminal },
              { id: "playground", label: "Playground", icon: Play },
              { id: "logs", label: "Integration Logs", icon: Activity },
              { id: "security", label: "Bảo mật & Keys", icon: Key },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-emerald-500 text-zinc-100 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-8 py-8">
        {tab === "overview" && <OverviewTab webhookConfig={data.webhookConfig} />}
        {tab === "endpoints" && <EndpointsTab copy={copy} copied={copied} />}
        {tab === "playground" && (
          <PlaygroundTab
            currentEndpoint={currentEndpoint}
            playgroundEndpoint={playgroundEndpoint}
            selectEndpoint={selectEndpoint}
            playgroundBody={playgroundBody}
            setPlaygroundBody={setPlaygroundBody}
            playgroundResponse={playgroundResponse}
            simulateRequest={simulateRequest}
            copy={copy}
            copied={copied}
          />
        )}
        {tab === "logs" && (
          <LogsTab
            logs={filteredLogs}
            allLogs={data.logs}
            expandedLog={expandedLog}
            setExpandedLog={setExpandedLog}
            logFilter={logFilter}
            setLogFilter={setLogFilter}
            onRetry={retryLog}
            onDelete={deleteLog}
            copy={copy}
            copied={copied}
          />
        )}
        {tab === "security" && <SecurityTab apiKeys={data.apiKeys} />}
      </div>
    </div>
  );
}

// =================== OVERVIEW ===================
function OverviewTab({ webhookConfig }) {
  return (
    <div className="space-y-6">
      {/* Architecture diagram */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
        <h2 className="text-xl mb-1 text-zinc-100" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Kiến trúc tích hợp</h2>
        <p className="text-sm text-zinc-500 mb-6" style={{ fontStyle: "italic" }}>
          Event-driven, một chiều từ CRM/ERP → Evaluation System. CRM không bao giờ phải đợi, và hệ thống đánh giá không đụng vào dữ liệu gốc của CRM.
        </p>

        <div className="grid grid-cols-3 gap-6 items-center">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 mb-3">
              <Database size={22} className="text-sky-400" />
            </div>
            <div className="text-sm font-medium text-zinc-100 mb-1">CRM / ERP</div>
            <div className="text-xs text-zinc-500">System of record</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-zinc-600 space-y-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <div>đơn hàng</div>
              <div>công việc</div>
              <div>khiếu nại</div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              POST /work-events
              <ArrowRight size={14} />
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              POST /incidents
              <ArrowRight size={14} />
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <ArrowRight size={14} className="rotate-180" />
              GET /scorecard
            </div>
            <div className="text-[10px] text-zinc-600 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>HTTPS + HMAC</div>
          </div>

          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
              <Activity size={22} className="text-emerald-400" />
            </div>
            <div className="text-sm font-medium text-zinc-100 mb-1">Evaluation System</div>
            <div className="text-xs text-zinc-500">System of aggregation</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-zinc-600 space-y-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <div>điểm công</div>
              <div>sự vụ</div>
              <div>bảng điểm</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nguyên tắc thiết kế */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: Zap, title: "Event-driven", desc: "CRM đẩy events khi có thay đổi. Không polling, không phụ thuộc lịch. Độ trễ < 2 giây." },
          { icon: Shield, title: "Idempotent", desc: "Mỗi event có external_id. Gửi lại cùng id = cập nhật, không tạo trùng. An toàn khi retry." },
          { icon: Link2, title: "External ID first", desc: "Mọi tham chiếu dùng external_id (employee, work). Tên nhân viên có thể đổi — id thì bền." },
          { icon: RefreshCw, title: "Dead letter queue", desc: "Event lỗi (sai format, chưa map) vào DLQ, không mất. Có thể replay sau khi fix." },
        ].map((p) => (
          <div key={p.title} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center">
                <p.icon size={16} className="text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-zinc-100">{p.title}</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Config */}
      {webhookConfig && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Cấu hình hiện tại</div>
          <div className="grid grid-cols-4 gap-4">
            <div><div className="text-[10px] uppercase text-zinc-600 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Base URL</div><div className="text-sm text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{webhookConfig.base_url}</div></div>
            <div><div className="text-[10px] uppercase text-zinc-600 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>API Version</div><div className="text-sm text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{webhookConfig.version}</div></div>
            <div><div className="text-[10px] uppercase text-zinc-600 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Rate limit</div><div className="text-sm text-zinc-200">{webhookConfig.rate_limit}</div></div>
            <div><div className="text-[10px] uppercase text-zinc-600 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Retry</div><div className="text-sm text-zinc-200">{webhookConfig.retry_policy}</div></div>
          </div>
        </div>
      )}

      {/* Quick start */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-base mb-4 text-zinc-100" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>Quick start cho DEV của CRM/ERP</h3>
        <ol className="space-y-3 text-sm text-zinc-300">
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>01.</span><span>Lấy API key từ admin (xem tab <strong>Bảo mật & Keys</strong>)</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>02.</span><span>Đồng bộ nhân viên một lần qua <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-sky-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>POST /employee-mapping</code> cho toàn bộ NV hiện có</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>03.</span><span>Gắn webhook trong CRM: mỗi khi đơn chuyển trạng thái "Hoàn thành" → gọi <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-sky-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>POST /work-events</code></span></li>
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>04.</span><span>Gắn webhook: mỗi khiếu nại / khen từ khách → gọi <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-sky-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>POST /incidents</code></span></li>
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>05.</span><span>Test qua tab <strong>Playground</strong> trước khi đẩy lên production</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>06.</span><span>Theo dõi tab <strong>Integration Logs</strong> để debug</span></li>
        </ol>
      </div>
    </div>
  );
}

// =================== ENDPOINTS ===================
function EndpointsTab({ copy, copied }) {
  const [expanded, setExpanded] = useState(ENDPOINTS[0].id);

  return (
    <div className="space-y-3">
      {ENDPOINTS.map((ep) => {
        const isOpen = expanded === ep.id;
        const curlSnippet = `curl -X ${ep.method} https://eval.company.vn${ep.path.replace("{employee_external_id}", "CRM_EMP_042")} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: evk_live_..." \\
  -H "X-Signature: hmac-sha256-hex..." \\${ep.method === "POST" && ep.exampleBody ? `
  -d '${JSON.stringify(ep.exampleBody, null, 2).split("\n").join("\n     ")}'` : ""}`;

        return (
          <div key={ep.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : ep.id)} className="w-full px-5 py-4 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left">
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-medium rounded ${ep.method === "POST" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {ep.method}
              </span>
              <code className="text-sm text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{ep.path}</code>
              <span className="text-sm text-zinc-500 flex-1">{ep.title}</span>
              {isOpen ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
            </button>

            {isOpen && (
              <div className="border-t border-zinc-800 px-5 py-5 space-y-5">
                <p className="text-sm text-zinc-400 leading-relaxed">{ep.description}</p>

                {ep.exampleBody && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Request body</span>
                      <button onClick={() => copy(JSON.stringify(ep.exampleBody, null, 2), `body_${ep.id}`)} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1">
                        {copied === `body_${ep.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copied === `body_${ep.id}` ? "Đã copy" : "Copy"}
                      </button>
                    </div>
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <code className="text-zinc-300">{JSON.stringify(ep.exampleBody, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {ep.queryParams && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Query parameters</div>
                    <div className="space-y-1">
                      {ep.queryParams.map((p) => (
                        <div key={p.name} className="flex items-center gap-3 text-xs">
                          <code className="bg-zinc-800 px-2 py-0.5 rounded text-sky-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</code>
                          <span className="text-zinc-500">=</span>
                          <code className="text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.example}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ep.exampleResponse && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Response body (200 OK)</span>
                      <button onClick={() => copy(JSON.stringify(ep.exampleResponse, null, 2), `resp_${ep.id}`)} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1">
                        {copied === `resp_${ep.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        Copy
                      </button>
                    </div>
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <code className="text-zinc-300">{JSON.stringify(ep.exampleResponse, null, 2)}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>cURL</span>
                    <button onClick={() => copy(curlSnippet, `curl_${ep.id}`)} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1">
                      {copied === `curl_${ep.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      Copy
                    </button>
                  </div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <code className="text-amber-300">{curlSnippet}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =================== PLAYGROUND ===================
function PlaygroundTab({ currentEndpoint, playgroundEndpoint, selectEndpoint, playgroundBody, setPlaygroundBody, playgroundResponse, simulateRequest, copy, copied }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {/* LEFT: Request builder */}
      <div className="space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-2">
            <Terminal size={14} className="text-zinc-500" />
            <span className="text-xs uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Request</span>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Endpoint</label>
              <div className="space-y-1.5">
                {ENDPOINTS.map((ep) => {
                  const sel = ep.id === playgroundEndpoint;
                  return (
                    <button key={ep.id} onClick={() => selectEndpoint(ep.id)}
                      className={`w-full text-left px-3 py-2 rounded border transition-all ${sel ? "bg-zinc-800 border-zinc-600" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-widest rounded ${ep.method === "POST" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {ep.method}
                        </span>
                        <code className="text-xs text-zinc-300" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{ep.path}</code>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Body (JSON)</label>
                {currentEndpoint?.exampleBody && (
                  <button onClick={() => setPlaygroundBody(JSON.stringify(currentEndpoint.exampleBody, null, 2))} className="text-xs text-zinc-500 hover:text-zinc-300">
                    Reset example
                  </button>
                )}
              </div>
              <textarea
                value={playgroundBody}
                onChange={(e) => setPlaygroundBody(e.target.value)}
                rows={14}
                className="w-full px-3 py-3 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:border-zinc-600"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                disabled={currentEndpoint?.method === "GET"}
                placeholder={currentEndpoint?.method === "GET" ? "GET request — không cần body" : ""}
              />
            </div>

            <button onClick={simulateRequest} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-md text-sm transition-colors">
              <Send size={14} /> Gửi request (giả lập)
            </button>

            <div className="text-[10px] text-zinc-600 text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ⓘ Đây là giả lập để test payload. Response thực tế từ server sẽ tương tự.
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Response */}
      <div className="space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-zinc-500" />
              <span className="text-xs uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Response</span>
            </div>
            {playgroundResponse && (
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest rounded ${playgroundResponse.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {playgroundResponse.status} {playgroundResponse.ok ? "OK" : "ERROR"}
                </span>
              </div>
            )}
          </div>

          <div className="p-5">
            {!playgroundResponse ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                <Send size={32} className="mb-3 opacity-30" />
                <div className="text-sm">Gửi request để xem response</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Body</span>
                  <button onClick={() => copy(JSON.stringify(playgroundResponse, null, 2), "response")} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1">
                    {copied === "response" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    Copy
                  </button>
                </div>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <code className={playgroundResponse.ok ? "text-emerald-300" : "text-rose-300"}>
                    {JSON.stringify(playgroundResponse, null, 2)}
                  </code>
                </pre>

                {!playgroundResponse.ok && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded p-3 text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium mb-1">Xử lý lỗi này trong CRM</div>
                      <div className="text-rose-300/80">
                        {playgroundResponse.error_code === "UNKNOWN_JOB_CODE" && "Job code chưa định nghĩa. Liên hệ admin Eval System để bổ sung vào catalog trước."}
                        {playgroundResponse.error_code === "EMPLOYEE_NOT_MAPPED" && "NV chưa được đồng bộ. Gọi /employee-mapping trước, rồi retry."}
                        {playgroundResponse.error_code === "MISSING_EXTERNAL_ID" && "Thiếu external_id. Mỗi request phải có id duy nhất từ CRM."}
                        {playgroundResponse.error_code === "INVALID_JSON" && "JSON không hợp lệ. Kiểm tra lại format."}
                        {!["UNKNOWN_JOB_CODE", "EMPLOYEE_NOT_MAPPED", "MISSING_EXTERNAL_ID", "INVALID_JSON"].includes(playgroundResponse.error_code) && "Kiểm tra lại payload và các trường bắt buộc."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation rules */}
        {currentEndpoint && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Validation rules</div>
            <ul className="text-xs text-zinc-400 space-y-1.5">
              {currentEndpoint.id === "work_events" && (
                <>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>external_id: bắt buộc, unique, giữ lại để retry an toàn</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>job_code: phải có trong catalog của phòng NV</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>employee_external_id: phải đã được map qua /employee-mapping</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>quantity: số nguyên dương</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>status: completed_ontime | completed_late | completed_issue | failed</li>
                </>
              )}
              {currentEndpoint.id === "incidents" && (
                <>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>category: customer_praise | customer_complaint | incident_damage | initiative | ...</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>severity: light | medium | heavy</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>source: customer | internal | automatic</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>related_work_external_id: tuỳ chọn, để liên kết với công việc</li>
                </>
              )}
              {currentEndpoint.id === "employee_map" && (
                <>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>department_code: DELIVERY | WAREHOUSE | WARRANTY | SALES | ...</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>Gọi upsert — tạo mới hoặc cập nhật theo employee_external_id</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>active=false để vô hiệu hoá NV (không xoá, giữ lịch sử)</li>
                </>
              )}
              {currentEndpoint.id === "scorecard" && (
                <>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>period_from / period_to: format YYYY-MM-DD</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span>Cache 5 phút phía server, gọi nhiều không sao</li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// =================== LOGS ===================
function LogsTab({ logs, allLogs, expandedLog, setExpandedLog, logFilter, setLogFilter, onRetry, onDelete, copy, copied }) {
  const stats = useMemo(() => {
    return {
      processed: allLogs.filter((l) => l.status === "processed").length,
      failed: allLogs.filter((l) => l.status === "failed").length,
      dead_letter: allLogs.filter((l) => l.status === "dead_letter").length,
      total: allLogs.length,
    };
  }, [allLogs]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Tổng events", value: stats.total, color: "#94a3b8" },
          { label: "Thành công", value: stats.processed, color: "#10b981" },
          { label: "Lỗi (có thể retry)", value: stats.failed, color: "#f59e0b" },
          { label: "Dead letter", value: stats.dead_letter, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.label}</div>
            <div className="text-3xl text-zinc-100" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
        <Filter size={14} className="text-zinc-500" />
        <select value={logFilter.status} onChange={(e) => setLogFilter({ ...logFilter, status: e.target.value })} className="text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-300">
          <option value="">Tất cả status</option>
          {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={logFilter.endpoint} onChange={(e) => setLogFilter({ ...logFilter, endpoint: e.target.value })} className="text-xs px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-300">
          <option value="">Tất cả endpoints</option>
          {ENDPOINTS.filter((e) => e.method === "POST").map((e) => <option key={e.id} value={e.id}>{e.path}</option>)}
        </select>
        {(logFilter.status || logFilter.endpoint) && (
          <button onClick={() => setLogFilter({ status: "", endpoint: "" })} className="text-xs text-zinc-500 hover:text-zinc-200">Xoá lọc</button>
        )}
        <div className="ml-auto text-xs text-zinc-500">{logs.length}/{allLogs.length}</div>
      </div>

      {/* Log list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-600">
            <Activity size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">Không có log nào phù hợp</div>
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLog === log.id;
            const st = STATUS_CODES[log.status];
            const ep = ENDPOINTS.find((e) => e.id === log.endpoint);
            return (
              <div key={log.id} className="border-b border-zinc-800 last:border-0">
                <button onClick={() => setExpandedLog(isExpanded ? null : log.id)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-zinc-800/30 text-left">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="text-xs text-zinc-500 w-24 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {new Date(log.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-widest rounded ${log.method === "POST" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {log.method}
                  </span>
                  <code className="text-xs text-zinc-400 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{ep?.path || log.endpoint}</code>
                  <code className="text-xs text-zinc-600 flex-1 truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{log.external_id}</code>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${st.color}15`, color: st.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {st.label}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{log.source}</span>
                  {isExpanded ? <ChevronDown size={14} className="text-zinc-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-5 py-4 bg-zinc-950/50 border-t border-zinc-800 grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Request payload</span>
                        <button onClick={() => copy(JSON.stringify(log.payload, null, 2), `pl_${log.id}`)} className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1">
                          {copied === `pl_${log.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                      <pre className="bg-zinc-900 border border-zinc-800 rounded p-3 text-[11px] overflow-x-auto max-h-64" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <code className="text-zinc-300">{JSON.stringify(log.payload, null, 2)}</code>
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Response</span>
                        <div className="flex items-center gap-2">
                          {(log.status === "failed" || log.status === "dead_letter") && (
                            <button onClick={() => onRetry(log.id)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                              <RefreshCw size={11} /> Replay
                            </button>
                          )}
                          <button onClick={() => onDelete(log.id)} className="text-zinc-500 hover:text-rose-400"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <pre className={`bg-zinc-900 border border-zinc-800 rounded p-3 text-[11px] overflow-x-auto max-h-64`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <code className={log.response.ok ? "text-emerald-300" : "text-rose-300"}>
                          {JSON.stringify(log.response, null, 2)}
                        </code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {stats.dead_letter > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="text-rose-200 font-medium mb-1">Có {stats.dead_letter} events trong Dead Letter Queue</div>
            <div className="text-rose-300/70 text-xs">
              Các events này không tự động xử lý được — thường vì job_code chưa có trong catalog hoặc employee chưa map. Sau khi fix nguyên nhân (thêm job_code, đồng bộ NV), bấm <strong>Replay</strong> trên từng log để xử lý lại.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== SECURITY ===================
function SecurityTab({ apiKeys }) {
  return (
    <div className="space-y-5">
      {/* HMAC signing */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-emerald-400" />
          <div>
            <h3 className="text-base text-zinc-100" style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}>HMAC Request Signing</h3>
            <p className="text-xs text-zinc-500">Xác thực mọi request là từ CRM thật sự, không bị giả mạo</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 mb-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Cách tạo signature</div>
          <pre className="text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <code className="text-zinc-300">
{`// Python example
import hmac, hashlib, json

secret = "evk_secret_..."  // Xem trong tab Security
timestamp = str(int(time.time()))
body = json.dumps(payload, separators=(',', ':'))

payload_to_sign = timestamp + "." + body
signature = hmac.new(
    secret.encode(),
    payload_to_sign.encode(),
    hashlib.sha256
).hexdigest()

headers = {
    "X-API-Key": "evk_live_...",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    "Content-Type": "application/json"
}`}
            </code>
          </pre>
        </div>

        <div className="text-xs text-zinc-400 space-y-1.5">
          <div className="flex items-start gap-2"><span className="text-emerald-400">✓</span>Timestamp trong request — reject nếu lệch &gt; 5 phút (chống replay attack)</div>
          <div className="flex items-start gap-2"><span className="text-emerald-400">✓</span>Signature tính trên timestamp + body — giả mạo nội dung sẽ fail</div>
          <div className="flex items-start gap-2"><span className="text-emerald-400">✓</span>Chỉ dùng HTTPS — không bao giờ gửi qua HTTP</div>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-zinc-500" />
            <span className="text-sm text-zinc-200">API Keys</span>
            <span className="text-xs text-zinc-500">({apiKeys.length})</span>
          </div>
          <button className="text-xs flex items-center gap-1.5 bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-md hover:bg-zinc-700">
            <Plus size={12} /> Tạo key mới
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tên</th>
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Key</th>
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tạo</th>
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Dùng gần nhất</th>
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((k) => (
              <tr key={k.id} className="border-b border-zinc-800 last:border-0">
                <td className="px-5 py-3 text-sm text-zinc-200">{k.name}</td>
                <td className="px-5 py-3">
                  <code className="text-xs text-zinc-400 bg-zinc-950 px-2 py-1 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{k.key}</code>
                </td>
                <td className="px-5 py-3 text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(k.created_at).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-5 py-3 text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {k.last_used ? new Date(k.last_used).toLocaleString("vi-VN") : "chưa dùng"}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${k.active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {k.active ? "Active" : "Revoked"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Best practices */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Best practices</div>
        <ul className="text-sm text-zinc-400 space-y-2">
          <li className="flex gap-3"><span className="text-emerald-400 flex-shrink-0">●</span><span>Mỗi hệ thống nguồn (CRM, ERP, POS...) có API key riêng — để tách biệt và dễ revoke</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 flex-shrink-0">●</span><span>Key secret không bao giờ commit vào git — dùng environment variable hoặc secret manager</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 flex-shrink-0">●</span><span>Rotate key định kỳ 6-12 tháng — support 2 key cùng lúc để rollover không ngắt dịch vụ</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 flex-shrink-0">●</span><span>Giới hạn IP whitelist nếu CRM chạy ở server cố định</span></li>
          <li className="flex gap-3"><span className="text-emerald-400 flex-shrink-0">●</span><span>Log mọi request (đã làm sẵn ở tab Integration Logs)</span></li>
        </ul>
      </div>
    </div>
  );
}
