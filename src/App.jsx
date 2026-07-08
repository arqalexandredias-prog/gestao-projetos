import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "alexandre-dias-gestao-projetos-v1";
const PAGE_STORAGE_KEY = "alexandre-dias-gestao-projetos-pagina-atual";
const CALENDAR_EVENTS_STORAGE_KEY = "alexandre-dias-gestao-projetos-eventos-calendario-v2";
const CALENDAR_VIEW_STORAGE_KEY = "alexandre-dias-gestao-projetos-calendario-view";
const CALENDAR_TAGS_STORAGE_KEY = "alexandre-dias-gestao-projetos-calendario-tags";
const CALENDAR_SELECTED_DATE_STORAGE_KEY =
  "alexandre-dias-gestao-projetos-calendario-data-selecionada";

const STATUS_OPTIONS = ["Orçamento", "A receber", "Parcial", "Recebido", "Cancelado"];
const PROJECT_FILTER_OPTIONS = ["Ativos", "Todos", ...STATUS_OPTIONS];
const VALID_PAGES = ["resumo", "projetos", "calendario"];

const CALENDAR_TAGS = [
  { id: "Projeto", label: "Projetos" },
  { id: "Cronograma", label: "Cronograma" },
  { id: "Aniversário", label: "Aniversários" },
  { id: "Compromissos", label: "Compromissos" },
  { id: "Financeiro", label: "Financeiro" },
];

const EVENT_COLORS = [
  "#c47a5a",
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#0f766e",
  "#9333ea",
];

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toISODate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseISODate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function loadActivePage() {
  try {
    const savedPage = localStorage.getItem(PAGE_STORAGE_KEY);
    return VALID_PAGES.includes(savedPage) ? savedPage : "resumo";
  } catch {
    return "resumo";
  }
}

function loadCalendarView() {
  try {
    const savedView = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);

    if (savedView === "semana") return "semana";
    if (savedView === "dia") return "dia";

    return "mes";
  } catch {
    return "mes";
  }
}

function loadSelectedCalendarDate() {
  try {
    const savedDate = localStorage.getItem(CALENDAR_SELECTED_DATE_STORAGE_KEY);
    return isValidDateString(savedDate) ? savedDate : todayISO();
  } catch {
    return todayISO();
  }
}

function loadActiveCalendarTags() {
  try {
    const saved = localStorage.getItem(CALENDAR_TAGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    const validTagIds = CALENDAR_TAGS.map((tag) => tag.id);

    if (!Array.isArray(parsed)) return validTagIds;

    const filtered = parsed.filter((tagId) => validTagIds.includes(tagId));
    return filtered.length ? filtered : validTagIds;
  } catch {
    return CALENDAR_TAGS.map((tag) => tag.id);
  }
}

function formatMoneyInput(value) {
  const cleaned = String(value || "")
    .replace(/\./g, "")
    .replace(/[^\d,]/g, "");

  const hasComma = cleaned.includes(",");
  const [integerPartRaw, decimalPartRaw = ""] = cleaned.split(",");

  const integerDigits = integerPartRaw.replace(/\D/g, "");
  const decimalDigits = decimalPartRaw.replace(/\D/g, "").slice(0, 2);

  const integerFormatted = integerDigits
    ? new Intl.NumberFormat("pt-BR").format(Number(integerDigits))
    : "";

  if (hasComma) return `${integerFormatted},${decimalDigits}`;
  return integerFormatted;
}

function formatMoneyInputFromNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function parseMoney(value) {
  if (typeof value === "number") return value;

  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parsePercent(value) {
  const normalized = String(value || "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return "-";

  return `${day}/${month}/${year}`;
}

function formatLongDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(monthString) {
  if (!monthString) return "Todos os meses";

  const [year, month] = monthString.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatAdjacentMonthLabel(monthString, offset) {
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(date);
}

function formatWeekLabel(dateString) {
  const date = parseISODate(dateString);
  const firstDay = addDays(date, -date.getDay());
  const lastDay = addDays(firstDay, 6);

  const start = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(firstDay);

  const end = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(lastDay);

  return `${start} — ${end}`;
}

function getCommission(project) {
  const amount = Number(project.amount) || 0;
  const percent = Number(project.commissionPercent) || 0;
  return amount * (percent / 100);
}

function getReceivedCommission(project) {
  const commission = getCommission(project);
  const received = Number(project.receivedAmount) || 0;

  return Math.min(Math.max(received, 0), commission);
}

function getPendingCommission(project) {
  return Math.max(getCommission(project) - getReceivedCommission(project), 0);
}

function getDisplayStatus(project) {
  if (project.status === "Orçamento" || project.status === "Cancelado") {
    return project.status;
  }

  const commission = getCommission(project);
  const received = getReceivedCommission(project);
  const pending = getPendingCommission(project);

  if (project.status === "A receber") return "A receber";
  if (commission > 0 && pending <= 0) return "Recebido";
  if (received > 0 && pending > 0) return "Parcial";

  return project.status || "A receber";
}

function isSold(project) {
  return project.status !== "Orçamento" && project.status !== "Cancelado";
}

function isActiveProject(project) {
  const status = getDisplayStatus(project);
  return status !== "Recebido" && status !== "Cancelado";
}

function getProjectTitle(project) {
  return project.development || project.project || "Projeto sem nome";
}

function getProjectClient(project) {
  return project.client || "Cliente sem nome";
}

function formatProjectCode(number) {
  return `P-${String(number).padStart(3, "0")}`;
}

function getProjectCode(index) {
  return formatProjectCode(index + 1);
}

function normalizeProjectCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^P-?(\d+)$/i);

  if (!match) return raw;
  return formatProjectCode(Number(match[1]));
}

function getProjectCodeNumber(value) {
  const match = String(value || "").match(/^P-(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function getProjectOrderValue(project) {
  return [
    project.date || "",
    project.deliveryDate || "",
    project.createdAt || project.updatedAt || "",
    project.id || "",
  ].join("|");
}

function normalizeProjectCodes(projects) {
  const ordered = [...projects].sort((a, b) => {
    const orderA = getProjectOrderValue(a);
    const orderB = getProjectOrderValue(b);

    return orderA.localeCompare(orderB);
  });

  const codeById = new Map();

  ordered.forEach((project, index) => {
    codeById.set(project.id, formatProjectCode(index + 1));
  });

  return projects.map((project, index) => {
    const tasks = normalizeProjectTasks(project.tasks);
    const taskProgress = getTaskProgress(tasks);

    return {
      ...project,
      tasks,
      taskProgress: taskProgress.percent,
      tasksTotal: taskProgress.total,
      tasksDone: taskProgress.done,
      createdAt: project.createdAt || project.updatedAt || project.date || "",
      projectCode:
        codeById.get(project.id) ||
        normalizeProjectCode(project.projectCode) ||
        getProjectCode(index),
    };
  });
}

function getNextProjectCode(projects) {
  const normalizedProjects = normalizeProjectCodes(projects);
  const maxNumber = normalizedProjects.reduce((max, project) => {
    return Math.max(max, getProjectCodeNumber(project.projectCode));
  }, 0);

  return formatProjectCode(maxNumber + 1);
}

function getUniqueProjectCode(projects, requestedCode, editingId) {
  const normalizedRequested = normalizeProjectCode(requestedCode);
  const fallbackCode = getNextProjectCode(projects);
  const code = normalizedRequested || fallbackCode;

  const alreadyExists = projects.some((project) => {
    if (project.id === editingId) return false;
    return normalizeProjectCode(project.projectCode) === code;
  });

  if (!alreadyExists) return code;

  return fallbackCode;
}

function getProjectDeadline(project) {
  return project.deliveryDate || project.date || "";
}

function getProjectPayments(project) {
  const payments = Array.isArray(project.payments) ? project.payments : [];

  return [...payments].sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";

    if (dateA !== dateB) return dateB.localeCompare(dateA);

    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function getPaymentsTotal(project) {
  return getProjectPayments(project).reduce((sum, payment) => {
    return sum + (Number(payment.amount) || 0);
  }, 0);
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "AD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getDaysUntil(dateString) {
  if (!isValidDateString(dateString)) return null;

  const today = parseISODate(todayISO());
  const date = parseISODate(dateString);
  const diff = date.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDaysUntil(dateString) {
  const days = getDaysUntil(dateString);

  if (days === null) return "Sem data";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days > 1) return `em ${days} dias`;
  if (days === -1) return "ontem";

  return `há ${Math.abs(days)} dias`;
}

function emptyProjectForm(date = todayISO(), projectCode = "") {
  return {
    projectCode,
    date,
    deliveryDate: "",
    development: "",
    client: "",
    clientEmail: "",
    clientPhone: "",
    consultant: "",
    project: "",
    amount: "",
    commissionPercent: "3",
    receivedAmount: "",
    receivedDate: "",
    status: "A receber",
    note: "",
    color: EVENT_COLORS[0],
  };
}

function emptyCalendarEvent(date = todayISO(), tag = "Compromissos") {
  return {
    id: "",
    title: "",
    date,
    tag,
    startTime: "",
    endTime: "",
    color: EVENT_COLORS[1],
    description: "",
  };
}

function emptyPaymentForm() {
  return {
    amount: "",
    date: todayISO(),
    note: "",
  };
}

const DEFAULT_PROJECT_TASKS = [
  "Briefing / alinhamento inicial",
  "Estudo de layout",
  "Modelagem 3D",
  "Marcenaria / detalhamento",
  "Renderização",
  "Revisões do cliente",
  "Apresentação final",
  "Entrega dos arquivos",
];

function emptyTaskForm() {
  return {
    title: "",
    dueDate: "",
    priority: "Normal",
    note: "",
  };
}

function normalizeProjectTasks(tasks) {
  if (!Array.isArray(tasks)) return [];

  return tasks
    .map((task, index) => ({
      id: task.id || createId(),
      title: String(task.title || "").trim(),
      dueDate: isValidDateString(task.dueDate) ? task.dueDate : "",
      priority: task.priority || "Normal",
      note: String(task.note || "").trim(),
      completed: Boolean(task.completed),
      position: Number.isFinite(Number(task.position)) ? Number(task.position) : index + 1,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    }))
    .filter((task) => task.title)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.position !== b.position) return a.position - b.position;

      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

function getProjectTasks(project) {
  return normalizeProjectTasks(project?.tasks);
}

function getTaskProgress(tasks) {
  const normalizedTasks = normalizeProjectTasks(tasks);

  if (!normalizedTasks.length) {
    return {
      total: 0,
      done: 0,
      percent: 0,
    };
  }

  const done = normalizedTasks.filter((task) => task.completed).length;

  return {
    total: normalizedTasks.length,
    done,
    percent: Math.round((done / normalizedTasks.length) * 100),
  };
}

function getTaskProgressLabel(project) {
  const progress = getTaskProgress(getProjectTasks(project));

  if (!progress.total) return "Checklist";

  return `${progress.done}/${progress.total} concluídas · ${progress.percent}%`;
}

function getTaskPriorityClass(priority) {
  const normalized = String(priority || "").toLowerCase();

  if (normalized === "alta") return "status-cancelado";
  if (normalized === "baixa") return "status-recebido";

  return "status-parcial";
}

function withProjectTasks(project, tasks) {
  const normalizedTasks = normalizeProjectTasks(tasks);
  const progress = getTaskProgress(normalizedTasks);

  return {
    ...project,
    tasks: normalizedTasks,
    taskProgress: progress.percent,
    tasksTotal: progress.total,
    tasksDone: progress.done,
    updatedAt: new Date().toISOString(),
  };
}

function loadProjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return normalizeProjectCodes(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function loadCalendarEvents() {
  try {
    const saved = localStorage.getItem(CALENDAR_EVENTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function getStatusClass(status) {
  const map = {
    Orçamento: "orcamento",
    "A receber": "a-receber",
    Parcial: "parcial",
    Recebido: "recebido",
    Cancelado: "cancelado",
  };

  return map[status] || "padrao";
}

function getMonthCells(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const start = addDays(firstDay, -firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const iso = toISODate(date);

    return {
      iso,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: iso === todayISO(),
    };
  });
}

function getWeekCells(dateString) {
  const date = parseISODate(dateString);
  const firstDay = addDays(date, -date.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const weekDate = addDays(firstDay, index);
    const iso = toISODate(weekDate);

    return {
      iso,
      day: weekDate.getDate(),
      isCurrentMonth: true,
      isToday: iso === todayISO(),
    };
  });
}

function getDayCells(dateString) {
  const date = parseISODate(dateString);
  const iso = toISODate(date);

  return [
    {
      iso,
      day: date.getDate(),
      isCurrentMonth: true,
      isToday: iso === todayISO(),
    },
  ];
}

function getTagLabel(tagId) {
  return CALENDAR_TAGS.find((tag) => tag.id === tagId)?.label || tagId;
}

function BrandLogo() {
  return (
    <div className="brand-wordmark">
      <div className="brand-copy">
        <strong>
          Alexandre Dias <em>| Interiores</em>
        </strong>
        <span>Gestão de Projetos</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status status-${getStatusClass(status)}`}>{status}</span>;
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-field">
      <span>Cor no calendário</span>

      <div className="color-options">
        {EVENT_COLORS.map((color) => (
          <button
            type="button"
            key={color}
            className={`color-dot ${value === color ? "active" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Selecionar cor ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, helper, tone = "neutral" }) {
  return (
    <article className={`summary-card summary-card-${tone}`}>
      <div className="summary-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}

function ProjectTable({ projects, onEdit, onDelete, onMarkReceived, emptyMessage }) {
  if (!projects.length) return <div className="empty-state">{emptyMessage}</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Data</th>
            <th>Prazo</th>
            <th>Empreendimento</th>
            <th>Cliente</th>
            <th>Consultor</th>
            <th>Projeto</th>
            <th>Valor</th>
            <th>Comissão</th>
            <th>Recebido</th>
            <th>Falta receber</th>
            <th>Status</th>
            <th className="actions-col">Ações</th>
          </tr>
        </thead>

        <tbody>
          {projects.map((item, index) => {
            const pendingCommission = getPendingCommission(item);

            return (
              <tr key={item.id}>
                <td>{item.projectCode || getProjectCode(index)}</td>
                <td>{formatDate(item.date)}</td>
                <td>{formatDate(getProjectDeadline(item))}</td>
                <td>{item.development || "-"}</td>
                <td>{item.client || "-"}</td>
                <td>{item.consultant || "-"}</td>
                <td>{item.project || "-"}</td>
                <td>{formatCurrency(item.amount)}</td>
                <td>{formatCurrency(getCommission(item))}</td>
                <td>{formatCurrency(getReceivedCommission(item))}</td>
                <td>
                  <span
                    className={`money-pill ${
                      pendingCommission > 0 ? "money-pending" : "money-ok"
                    }`}
                  >
                    {formatCurrency(pendingCommission)}
                  </span>
                </td>
                <td>
                  <StatusBadge status={getDisplayStatus(item)} />
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => onEdit(item)}>
                      Editar
                    </button>

                    {getDisplayStatus(item) !== "Recebido" ? (
                      <button type="button" onClick={() => onMarkReceived(item.id)}>
                        Recebido
                      </button>
                    ) : null}

                    <button type="button" className="danger" onClick={() => onDelete(item.id)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectMobileList({ projects, emptyMessage, onOpenDetails }) {
  if (!projects.length) return <div className="empty-state">{emptyMessage}</div>;

  return (
    <div className="projects-premium-list">
      <div className="projects-premium-head">
        <span>Código</span>
        <span>Projeto</span>
      </div>

      {projects.map((project, index) => {
        const code = project.projectCode || getProjectCode(index);

        return (
          <button
            type="button"
            key={project.id}
            className="projects-premium-row"
            onClick={() => onOpenDetails(project, code)}
          >
            <span className="projects-premium-code">{code}</span>

            <span className="projects-premium-info">
              <strong>{getProjectTitle(project)}</strong>
              <small>{getProjectClient(project)}</small>
            </span>

            <span
              className="projects-premium-status"
              style={{ backgroundColor: project.color || EVENT_COLORS[0] }}
            />
          </button>
        );
      })}
    </div>
  );
}

function ProjectSectionModal({
  type,
  project,
  hideValues,
  onClose,
  onAddPayment,
  onDeletePayment,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onCreateDefaultTasks,
}) {
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);

  const title = getProjectTitle(project);
  const client = getProjectClient(project);
  const deadline = getProjectDeadline(project);
  const commission = getCommission(project);
  const received = getReceivedCommission(project);
  const pending = getPendingCommission(project);
  const progress = commission ? Math.min(Math.round((received / commission) * 100), 100) : 0;
  const payments = getProjectPayments(project);
  const paymentsTotal = getPaymentsTotal(project);
  const tasks = getProjectTasks(project);
  const taskProgress = getTaskProgress(tasks);

  const titles = {
    pagamentos: "Pagamentos",
    cronograma: "Cronograma",
    tarefas: "Tarefas",
    arquivos: "Arquivos",
    orcamentos: "Orçamentos",
    diario: "Diário",
  };

  function money(value) {
    return hideValues ? "••••••" : formatCurrency(value);
  }

  function submitPayment(event) {
    event.preventDefault();

    const saved = onAddPayment(project.id, paymentForm);

    if (saved) {
      setPaymentForm(emptyPaymentForm());
    }
  }

  function submitTask(event) {
    event.preventDefault();

    const saved = onAddTask(project.id, taskForm);

    if (saved) {
      setTaskForm(emptyTaskForm());
    }
  }

  return (
    <div className="project-section-popup-backdrop" onClick={onClose}>
      <section className="project-section-popup" onClick={(event) => event.stopPropagation()}>
        <div className="project-section-popup-header">
          <div>
            <p>{client}</p>
            <h3>{titles[type] || "Seção do projeto"}</h3>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {type === "pagamentos" ? (
          <div className="project-section-popup-body">
            <form className="project-payment-form" onSubmit={submitPayment}>
              <label>
                Valor recebido
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  placeholder="Ex: 1.500,00"
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: formatMoneyInput(event.target.value),
                    }))
                  }
                />
              </label>

              <label>
                Data
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="project-payment-form-wide">
                Observação
                <input
                  type="text"
                  value={paymentForm.note}
                  placeholder="Ex: primeira parcela / sinal / repasse"
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Registrar pagamento</button>
            </form>

            <div className="project-payment-total">
              <span>Total registrado</span>
              <strong>{money(paymentsTotal)}</strong>
            </div>

            {payments.length ? (
              <div className="project-payment-list">
                {payments.map((payment) => (
                  <article key={payment.id} className="project-payment-item">
                    <div>
                      <strong>{money(payment.amount)}</strong>
                      <span>{formatDate(payment.date)}</span>
                      {payment.note ? <small>{payment.note}</small> : null}
                    </div>

                    <button type="button" onClick={() => onDeletePayment(project.id, payment.id)}>
                      Excluir
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="project-payment-empty">Nenhum pagamento registrado ainda.</p>
            )}
          </div>
        ) : null}

        {type === "cronograma" ? (
          <div className="project-section-popup-body">
            <div className="project-section-info-list">
              <div>
                <span>Projeto</span>
                <strong>{title}</strong>
              </div>

              <div>
                <span>Data do projeto</span>
                <strong>{project.date ? formatDate(project.date) : "Sem data"}</strong>
              </div>

              <div>
                <span>Prazo de entrega</span>
                <strong>{deadline ? formatDate(deadline) : "Sem prazo"}</strong>
              </div>

              <div>
                <span>Status do prazo</span>
                <strong>{deadline ? formatDaysUntil(deadline) : "Sem data"}</strong>
              </div>
            </div>
          </div>
        ) : null}

        {type === "orcamentos" ? (
          <div className="project-section-popup-body">
            <div className="project-section-info-list">
              <div>
                <span>Total vendido</span>
                <strong>{money(project.amount)}</strong>
              </div>

              <div>
                <span>Comissão</span>
                <strong>{money(commission)}</strong>
              </div>

              <div>
                <span>Recebido</span>
                <strong>{money(received)}</strong>
              </div>

              <div>
                <span>A receber</span>
                <strong>{money(pending)}</strong>
              </div>

              <div>
                <span>Progresso</span>
                <strong>{progress}% pago</strong>
              </div>
            </div>
          </div>
        ) : null}

        {type === "diario" ? (
          <div className="project-section-popup-body">
            {project.note ? (
              <p className="project-section-text">{project.note}</p>
            ) : (
              <div className="project-section-empty">Nenhum registro no diário ainda.</div>
            )}
          </div>
        ) : null}

        {type === "tarefas" ? (
          <div className="project-section-popup-body">
            <div className="project-payment-total">
              <span>Progresso das tarefas</span>
              <strong>{taskProgress.percent}%</strong>
            </div>

            <div className="project-detail-progress">
              <i style={{ width: `${taskProgress.percent}%` }} />
            </div>

            <p className="project-payment-empty">
              {taskProgress.done} de {taskProgress.total} tarefas concluídas. Ao marcar uma tarefa,
              o progresso do projeto é atualizado automaticamente.
            </p>

            <form className="project-payment-form" onSubmit={submitTask}>
              <label className="project-payment-form-wide">
                Nova tarefa
                <input
                  type="text"
                  value={taskForm.title}
                  placeholder="Ex: Finalizar layout da cozinha"
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Prazo
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Prioridade
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                </select>
              </label>

              <label className="project-payment-form-wide">
                Observação
                <input
                  type="text"
                  value={taskForm.note}
                  placeholder="Ex: aguardar retorno do cliente"
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Adicionar tarefa</button>
            </form>

            {!tasks.length ? (
              <div className="project-section-empty">
                <p>Nenhuma tarefa cadastrada ainda.</p>

                <button type="button" onClick={() => onCreateDefaultTasks(project.id)}>
                  Criar checklist padrão
                </button>
              </div>
            ) : (
              <div className="project-payment-list">
                {tasks.map((task) => (
                  <article key={task.id} className="project-payment-item">
                    <div>
                      <strong
                        style={{
                          textDecoration: task.completed ? "line-through" : "none",
                          opacity: task.completed ? 0.55 : 1,
                        }}
                      >
                        {task.title}
                      </strong>

                      <span>{task.dueDate ? formatDate(task.dueDate) : "Sem prazo"}</span>

                      <small>
                        <StatusBadge status={task.priority || "Normal"} />
                      </small>

                      {task.note ? <small>{task.note}</small> : null}
                    </div>

                    <div className="row-actions">
                      <button type="button" onClick={() => onToggleTask(project.id, task.id)}>
                        {task.completed ? "Reabrir" : "Concluir"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteTask(project.id, task.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {type === "arquivos" ? (
          <div className="project-section-popup-body">
            <div className="project-section-empty">
              A área de arquivos vai entrar aqui depois, para guardar links, referências e documentos.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProjectDetailModal({
  details,
  onClose,
  onEdit,
  onAddPayment,
  onDeletePayment,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onCreateDefaultTasks,
}) {
  const [hideValues, setHideValues] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const { project, code } = details;

  const status = getDisplayStatus(project);
  const title = getProjectTitle(project);
  const client = getProjectClient(project);
  const deadline = getProjectDeadline(project);
  const commission = getCommission(project);
  const received = getReceivedCommission(project);
  const pending = getPendingCommission(project);
  const progress = commission ? Math.min(Math.round((received / commission) * 100), 100) : 0;
  const daysUntil = getDaysUntil(deadline);
  const paymentsTotal = getPaymentsTotal(project);
  const taskProgress = getTaskProgress(getProjectTasks(project));

  function money(value) {
    return hideValues ? "••••••" : formatCurrency(value);
  }

  return (
    <div className="project-detail-backdrop">
      <section className="project-detail-sheet">
        <button type="button" className="project-detail-close" onClick={onClose}>
          ×
        </button>

        <div className="project-detail-hero">
          <div className="project-detail-hero-grid" />

          <div className="project-detail-hero-top">
            <span>Projeto · cód. {code}</span>
            <strong>{status}</strong>
          </div>

          <h2>{title}</h2>
          <p>para {client}</p>

          <span className="project-detail-type">
            <i />
            {project.project || "Projeto de interiores"}
          </span>
        </div>

        <div className="project-detail-actions">
          <button type="button" onClick={() => onEdit(project)}>
            ✎ Editar projeto
          </button>

          <button type="button" onClick={() => setHideValues((current) => !current)}>
            {hideValues ? "👁 Mostrar valores" : "◌ Ocultar valores"}
          </button>
        </div>

        <div className="project-detail-summary-grid">
          <article className="project-detail-card">
            <span>Recebimento</span>
            <strong>{progress}%</strong>
            <small>{money(received)} recebido</small>
            <div className="project-detail-progress">
              <i style={{ width: `${progress}%` }} />
            </div>
          </article>

          <article className="project-detail-card green">
            <span>Comissão</span>
            <strong>{money(commission)}</strong>
            <small>
              {project.commissionPercent || 0}% sobre {money(project.amount)}
            </small>
          </article>

          <article className="project-detail-card orange">
            <span>A receber</span>
            <strong>{money(pending)}</strong>
            <small>{pending > 0 ? "Pendente" : "Tudo recebido"}</small>
          </article>

          <article className="project-detail-card sand">
            <span>Prazo de entrega</span>
            <strong>{daysUntil === null ? "—" : formatDaysUntil(deadline)}</strong>
            <small>{deadline ? `Entrega em ${formatDate(deadline)}` : "Sem prazo definido"}</small>
          </article>
        </div>

        <div className="project-detail-section">
          <h3>Cliente</h3>

          <div className="project-detail-client">
            <div className="project-detail-avatar">{getInitials(client)}</div>

            <div>
              <strong>{client}</strong>
              <span>
                {project.consultant ? `Consultor: ${project.consultant}` : "Consultor não informado"}
              </span>

              <div className="project-detail-contact-list">
                <span>
                  <b>E-mail:</b> {project.clientEmail || "Não informado"}
                </span>
                <span>
                  <b>Telefone:</b> {project.clientPhone || "Não informado"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="project-detail-section">
          <h3>Próximas datas</h3>

          <div className="project-detail-date-list">
            <div>
              <span>Data do projeto</span>
              <strong>{project.date ? formatDate(project.date) : "Sem data"}</strong>
            </div>

            <div>
              <span>Prazo de entrega</span>
              <strong>{deadline ? formatDate(deadline) : "Sem prazo"}</strong>
            </div>

            <div>
              <span>Status do prazo</span>
              <strong>{deadline ? formatDaysUntil(deadline) : "Sem data"}</strong>
            </div>
          </div>
        </div>

        <div className="project-detail-section">
          <h3>Financeiro</h3>

          <div className="project-detail-finance">
            <span>Total vendido</span>
            <strong>{money(project.amount)}</strong>

            <span>Comissão calculada</span>
            <strong>{money(commission)}</strong>

            <span>Recebido</span>
            <strong className="ok">{money(received)}</strong>

            <span>A receber</span>
            <strong className="warn">{money(pending)}</strong>
          </div>
        </div>

        <div className="project-detail-section">
          <h3>Seções do projeto</h3>

          <div className="project-detail-shortcuts">
            <button type="button" onClick={() => setActiveSection("pagamentos")}>
              <span>💸</span>
              <strong>Pagamentos</strong>
              <small>{money(paymentsTotal)} registrado</small>
            </button>

            <button type="button" onClick={() => setActiveSection("cronograma")}>
              <span>📅</span>
              <strong>Cronograma</strong>
              <small>{deadline ? formatDate(deadline) : "Sem data"}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("tarefas")}>
              <span>✓</span>
              <strong>Tarefas</strong>
              <small>{getTaskProgressLabel(project)}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("arquivos")}>
              <span>📁</span>
              <strong>Arquivos</strong>
              <small>Em breve</small>
            </button>

            <button type="button" onClick={() => setActiveSection("orcamentos")}>
              <span>🧾</span>
              <strong>Orçamentos</strong>
              <small>{money(project.amount)}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("diario")}>
              <span>✍</span>
              <strong>Diário</strong>
              <small>{project.note ? "1 registro" : "Sem registros"}</small>
            </button>
          </div>
        </div>

        {project.note ? (
          <div className="project-detail-section">
            <h3>Observações</h3>
            <p className="project-detail-note">{project.note}</p>
          </div>
        ) : null}

        {activeSection ? (
          <ProjectSectionModal
            type={activeSection}
            project={project}
            hideValues={hideValues}
            onClose={() => setActiveSection(null)}
            onAddPayment={onAddPayment}
            onDeletePayment={onDeletePayment}
            onAddTask={onAddTask}
            onToggleTask={onToggleTask}
            onDeleteTask={onDeleteTask}
            onCreateDefaultTasks={onCreateDefaultTasks}
          />
        ) : null}
      </section>
    </div>
  );
}

function ProjectFormModal({ form, setForm, editingId, onClose, onSubmit }) {
  const commission = parseMoney(form.amount) * (parsePercent(form.commissionPercent) / 100);

  let receivedPreview = parseMoney(form.receivedAmount);

  if (form.status === "A receber" || form.status === "Orçamento" || form.status === "Cancelado") {
    receivedPreview = 0;
  }

  if (form.status === "Recebido") {
    receivedPreview = commission;
  }

  receivedPreview = Math.min(Math.max(receivedPreview, 0), commission);
  const pendingPreview = Math.max(commission - receivedPreview, 0);

  function handleStatusChange(nextStatus) {
    setForm((prev) => {
      const nextCommission = parseMoney(prev.amount) * (parsePercent(prev.commissionPercent) / 100);

      if (nextStatus === "A receber" || nextStatus === "Orçamento" || nextStatus === "Cancelado") {
        return {
          ...prev,
          status: nextStatus,
          receivedAmount: "",
          receivedDate: "",
        };
      }

      if (nextStatus === "Recebido") {
        return {
          ...prev,
          status: nextStatus,
          receivedAmount: formatMoneyInputFromNumber(nextCommission),
          receivedDate: prev.receivedDate || todayISO(),
        };
      }

      return {
        ...prev,
        status: nextStatus,
      };
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal project-modal">
        <div className="modal-header">
          <div>
            <p>{editingId ? "Editar projeto" : "Novo projeto"}</p>
            <h2>{editingId ? "Editar cliente/projeto" : "Cadastrar cliente/projeto"}</h2>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="project-form">
          <label>
            Código
            <input
              type="text"
              value={form.projectCode}
              placeholder="Ex: P-001"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, projectCode: event.target.value }))
              }
            />
          </label>

          <label>
            Data do projeto
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </label>

          <label>
            Prazo de entrega
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deliveryDate: event.target.value }))
              }
            />
          </label>

          <label>
            Empreendimento
            <input
              type="text"
              value={form.development}
              placeholder="Ex: Paganini Tower"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, development: event.target.value }))
              }
            />
          </label>

          <label>
            Cliente
            <input
              type="text"
              value={form.client}
              placeholder="Ex: Maria"
              onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
              required
            />
          </label>

          <label>
            E-mail do cliente
            <input
              type="email"
              value={form.clientEmail}
              placeholder="Ex: cliente@email.com"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clientEmail: event.target.value }))
              }
            />
          </label>

          <label>
            Telefone do cliente
            <input
              type="tel"
              value={form.clientPhone}
              placeholder="Ex: (47) 99999-9999"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, clientPhone: event.target.value }))
              }
            />
          </label>

          <label>
            Consultor de venda
            <input
              type="text"
              value={form.consultant}
              placeholder="Ex: Paula"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, consultant: event.target.value }))
              }
            />
          </label>

          <label>
            Projeto
            <input
              type="text"
              value={form.project}
              placeholder="Ex: Apto completo"
              onChange={(event) => setForm((prev) => ({ ...prev, project: event.target.value }))}
              required
            />
          </label>

          <label>
            Valor
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              placeholder="Ex: 150.000,00"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, amount: formatMoneyInput(event.target.value) }))
              }
              required
            />
          </label>

          <label>
            Comissão %
            <input
              type="text"
              inputMode="decimal"
              value={form.commissionPercent}
              placeholder="Ex: 3"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, commissionPercent: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Comissão recebida
            <input
              type="text"
              inputMode="decimal"
              value={form.receivedAmount}
              placeholder="Ex: 3.750,00"
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  receivedAmount: formatMoneyInput(event.target.value),
                  status:
                    formatMoneyInput(event.target.value).trim() !== "" && prev.status === "A receber"
                      ? "Parcial"
                      : prev.status,
                }))
              }
              disabled={
                form.status === "A receber" ||
                form.status === "Orçamento" ||
                form.status === "Cancelado"
              }
            />
          </label>

          <label>
            Data do recebimento
            <input
              type="date"
              value={form.receivedDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, receivedDate: event.target.value }))
              }
              disabled={
                form.status === "A receber" ||
                form.status === "Orçamento" ||
                form.status === "Cancelado"
              }
            />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(event) => handleStatusChange(event.target.value)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <div className="form-wide">
            <ColorPicker
              value={form.color || EVENT_COLORS[0]}
              onChange={(color) => setForm((prev) => ({ ...prev, color }))}
            />
          </div>

          <label className="form-wide">
            Observação
            <textarea
              rows="3"
              value={form.note}
              placeholder="Ex: Recebi metade da comissão. Falta receber o restante no próximo repasse."
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </label>

          <div className="form-preview">
            <div>
              <small>Comissão calculada</small>
              <strong>{formatCurrency(commission)}</strong>
            </div>

            <div>
              <small>Já recebido</small>
              <strong>{formatCurrency(receivedPreview)}</strong>
            </div>

            <div>
              <small>Falta receber</small>
              <strong>{formatCurrency(pendingPreview)}</strong>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>

            <button type="submit" className="primary-button">
              {editingId ? "Salvar alterações" : "Cadastrar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarEventFormModal({ eventForm, setEventForm, onClose, onSubmit }) {
  const isEditing = Boolean(eventForm.id);

  return (
    <div className="calendar-form-backdrop">
      <div className="calendar-form-modal">
        <div className="calendar-form-header">
          <div>
            <p>{isEditing ? "Editar compromisso" : "Novo compromisso"}</p>
            <h2>{isEditing ? "Editar anotação" : "Cadastrar anotação"}</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="calendar-event-form" onSubmit={onSubmit}>
          <label>
            Título
            <input
              type="text"
              value={eventForm.title}
              placeholder="Ex: Reunião com cliente"
              onChange={(event) =>
                setEventForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Data
            <input
              type="date"
              value={eventForm.date}
              onChange={(event) => setEventForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </label>

          <div className="event-time-grid">
            <label>
              Início
              <input
                type="time"
                value={eventForm.startTime}
                onChange={(event) =>
                  setEventForm((prev) => ({ ...prev, startTime: event.target.value }))
                }
              />
            </label>

            <label>
              Fim
              <input
                type="time"
                value={eventForm.endTime}
                onChange={(event) =>
                  setEventForm((prev) => ({ ...prev, endTime: event.target.value }))
                }
              />
            </label>
          </div>

          <label>
            Tag
            <select
              value={eventForm.tag}
              onChange={(event) => setEventForm((prev) => ({ ...prev, tag: event.target.value }))}
            >
              {CALENDAR_TAGS.filter((tag) => tag.id !== "Projeto").map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
            </select>
          </label>

          <ColorPicker
            value={eventForm.color || EVENT_COLORS[1]}
            onChange={(color) => setEventForm((prev) => ({ ...prev, color }))}
          />

          <label>
            Observação
            <textarea
              rows="3"
              value={eventForm.description}
              placeholder="Detalhes opcionais"
              onChange={(event) =>
                setEventForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>

          <div className="calendar-form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>

            <button type="submit" className="primary-button">
              {isEditing ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarCreateTypeModal({ date, onClose, onChooseProject, onChooseEvent }) {
  return (
    <div className="calendar-form-backdrop">
      <div className="calendar-choice-modal">
        <div className="calendar-form-header">
          <div>
            <p>Cadastrar em {formatDate(date)}</p>
            <h2>O que você quer adicionar?</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="calendar-choice-list">
          <button type="button" onClick={onChooseProject}>
            <strong>Projeto</strong>
            <span>Abre o cadastro de cliente/projeto</span>
          </button>

          {CALENDAR_TAGS.filter((tag) => tag.id !== "Projeto").map((tag) => (
            <button type="button" key={tag.id} onClick={() => onChooseEvent(tag.id)}>
              <strong>{tag.label}</strong>
              <span>Cadastra uma anotação no calendário</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project, onEdit }) {
  return (
    <button type="button" className="project-line" onClick={() => onEdit(project)}>
      <div className="project-line-icon">$</div>

      <div>
        <strong>{project.client || "Cliente sem nome"}</strong>
        <span>{project.development || project.project || "Projeto sem empreendimento"}</span>
      </div>

      <div className="project-line-value">
        <strong>{formatCurrency(getPendingCommission(project))}</strong>
        <span>{getDisplayStatus(project)}</span>
      </div>
    </button>
  );
}

function CalendarPage({
  month,
  setMonth,
  projects,
  calendarEvents,
  activeCalendarTags,
  setActiveCalendarTags,
  selectedCalendarDate,
  setSelectedCalendarDate,
  calendarView,
  setCalendarView,
  onOpenCreateChoice,
  onEditProject,
  onEditCalendarEvent,
  onDeleteCalendarEvent,
}) {
  const detailRef = useRef(null);
  const monthToUse = month || todayISO().slice(0, 7);
  const previousMonthLabel = formatAdjacentMonthLabel(monthToUse, -1);
  const nextMonthLabel = formatAdjacentMonthLabel(monthToUse, 1);

  const calendarCells =
    calendarView === "dia"
      ? getDayCells(selectedCalendarDate)
      : calendarView === "semana"
        ? getWeekCells(selectedCalendarDate)
        : getMonthCells(monthToUse);

  const projectCalendarEvents = useMemo(() => {
    return projects.flatMap((project) => {
      const title = getProjectTitle(project);
      const client = getProjectClient(project);
      const deadline = getProjectDeadline(project);

      const projectEvent = {
        id: `project-${project.id}`,
        kind: "project",
        tag: "Projeto",
        title: client,
        subtitle: title,
        description: project.note || "",
        date: project.date,
        color: project.color || EVENT_COLORS[0],
        project,
      };

      if (!deadline || deadline === project.date) {
        return [projectEvent];
      }

      const deadlineEvent = {
        id: `project-deadline-${project.id}`,
        kind: "project",
        tag: "Cronograma",
        title: `Entrega: ${title}`,
        subtitle: client,
        description: `Prazo de entrega do projeto ${title}.`,
        date: deadline,
        color: project.color || EVENT_COLORS[4],
        project,
      };

      return [projectEvent, deadlineEvent];
    });
  }, [projects]);

  const allCalendarEvents = useMemo(() => {
    return [...projectCalendarEvents, ...calendarEvents];
  }, [projectCalendarEvents, calendarEvents]);

  const filteredCalendarEvents = useMemo(() => {
    return allCalendarEvents.filter((event) => activeCalendarTags.includes(event.tag));
  }, [allCalendarEvents, activeCalendarTags]);

  const eventsByDate = useMemo(() => {
    return filteredCalendarEvents.reduce((acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [filteredCalendarEvents]);

  const selectedDayEvents = useMemo(() => {
    return filteredCalendarEvents
      .filter((event) => event.date === selectedCalendarDate)
      .sort((a, b) => {
        const timeA = a.startTime || "99:99";
        const timeB = b.startTime || "99:99";
        return timeA.localeCompare(timeB);
      });
  }, [filteredCalendarEvents, selectedCalendarDate]);

  function changeMonth(direction) {
    const [year, monthNumber] = monthToUse.split("-").map(Number);
    const next = new Date(year, monthNumber - 1 + direction, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    setMonth(nextMonth);
  }

  function changeWeek(direction) {
    const currentDate = parseISODate(selectedCalendarDate);
    const nextDate = addDays(currentDate, direction * 7);
    const nextDateISO = toISODate(nextDate);

    setSelectedCalendarDate(nextDateISO);
    setMonth(nextDateISO.slice(0, 7));
  }

  function changeDay(direction) {
    const currentDate = parseISODate(selectedCalendarDate);
    const nextDate = addDays(currentDate, direction);
    const nextDateISO = toISODate(nextDate);

    setSelectedCalendarDate(nextDateISO);
    setMonth(nextDateISO.slice(0, 7));
  }

  function toggleTag(tagId) {
    setActiveCalendarTags((current) => {
      if (current.includes(tagId)) {
        return current.filter((tag) => tag !== tagId);
      }

      return [...current, tagId];
    });
  }

  function selectDay(date) {
    setSelectedCalendarDate(date);
    localStorage.setItem(CALENDAR_SELECTED_DATE_STORAGE_KEY, date);

    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function getCalendarTitle() {
    if (calendarView === "dia") return formatLongDate(selectedCalendarDate);
    if (calendarView === "semana") return formatWeekLabel(selectedCalendarDate);

    return formatMonthLabel(monthToUse);
  }

  function getPreviousLabel() {
    if (calendarView === "dia") return "Dia";
    if (calendarView === "semana") return "Semana";

    return previousMonthLabel;
  }

  function getNextLabel() {
    if (calendarView === "dia") return "Dia";
    if (calendarView === "semana") return "Semana";

    return nextMonthLabel;
  }

  function goToPreviousPeriod() {
    if (calendarView === "dia") {
      changeDay(-1);
      return;
    }

    if (calendarView === "semana") {
      changeWeek(-1);
      return;
    }

    changeMonth(-1);
  }

  function goToNextPeriod() {
    if (calendarView === "dia") {
      changeDay(1);
      return;
    }

    if (calendarView === "semana") {
      changeWeek(1);
      return;
    }

    changeMonth(1);
  }

  const calendarGridStyle = calendarView === "dia" ? { gridTemplateColumns: "1fr" } : undefined;

  return (
    <section className="calendar-reference-page">
      <div className="calendar-reference-header">
        <div>
          <h1>{getCalendarTitle()}</h1>
        </div>
      </div>

      <div className="calendar-tag-tabs">
        <button
          type="button"
          className={calendarView === "mes" ? "active" : ""}
          onClick={() => setCalendarView("mes")}
        >
          Mês
        </button>

        <button
          type="button"
          className={calendarView === "semana" ? "active" : ""}
          onClick={() => setCalendarView("semana")}
        >
          Semana
        </button>

        <button
          type="button"
          className={calendarView === "dia" ? "active" : ""}
          onClick={() => setCalendarView("dia")}
        >
          Dia
        </button>
      </div>

      <div className="calendar-tag-tabs">
        {CALENDAR_TAGS.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={activeCalendarTags.includes(tag.id) ? "active" : ""}
            onClick={() => toggleTag(tag.id)}
          >
            {tag.label}
          </button>
        ))}
      </div>

      <div className="calendar-month-nav">
        <button type="button" onClick={goToPreviousPeriod}>
          ← {getPreviousLabel()}
        </button>

        <button type="button" onClick={goToNextPeriod}>
          {getNextLabel()} →
        </button>
      </div>

      <div
        className={`reference-calendar-card ${
          calendarView === "semana" ? "week-view" : calendarView === "dia" ? "day-view" : ""
        }`}
      >
        <div className="reference-calendar-weekdays" style={calendarGridStyle}>
          {calendarView === "dia" ? (
            <span>Dia</span>
          ) : (
            <>
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </>
          )}
        </div>

        <div className="reference-calendar-grid" style={calendarGridStyle}>
          {calendarCells.map((cell) => {
            const dayEvents = eventsByDate[cell.iso] || [];
            const isSelected = selectedCalendarDate === cell.iso;
            const maxEvents = calendarView === "dia" ? 8 : 3;

            return (
              <button
                type="button"
                key={cell.iso}
                className={`reference-calendar-day ${!cell.isCurrentMonth ? "muted" : ""} ${
                  cell.isToday ? "today" : ""
                } ${isSelected ? "selected" : ""}`}
                onClick={() => selectDay(cell.iso)}
              >
                <span className="reference-day-number">{cell.day}</span>

                <div className="reference-day-events">
                  {dayEvents.slice(0, maxEvents).map((event) => (
                    <span
                      key={event.id}
                      className="reference-event-pill"
                      style={{ borderLeftColor: event.color, color: event.color }}
                    >
                      {event.title}
                    </span>
                  ))}

                  {dayEvents.length > maxEvents ? (
                    <small className="reference-more-events">
                      +{dayEvents.length - maxEvents} mais
                    </small>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="calendar-day-details" ref={detailRef}>
        <div className="calendar-day-details-header">
          <div>
            <h2>{formatLongDate(selectedCalendarDate)}</h2>
          </div>

          <button type="button" onClick={() => onOpenCreateChoice(selectedCalendarDate)}>
            + Cadastrar
          </button>
        </div>

        <div className="calendar-day-details-body">
          <h3>Compromissos</h3>

          {selectedDayEvents.length ? (
            <div className="calendar-day-event-list">
              {selectedDayEvents.map((event) => (
                <article className="calendar-day-event-card" key={event.id}>
                  <span className="calendar-day-event-dot" style={{ backgroundColor: event.color }} />

                  <div className="calendar-day-event-content">
                    <div className="calendar-day-event-top">
                      <div>
                        <strong>{event.title}</strong>

                        {event.startTime || event.endTime ? (
                          <small>
                            {event.startTime || "--:--"}
                            {event.endTime ? ` – ${event.endTime}` : ""}
                          </small>
                        ) : null}
                      </div>

                      <span>{getTagLabel(event.tag)}</span>
                    </div>

                    {event.subtitle ? <p>{event.subtitle}</p> : null}
                    {event.description ? <p>{event.description}</p> : null}

                    <div className="calendar-day-event-actions">
                      {event.kind === "project" ? (
                        <button type="button" onClick={() => onEditProject(event.project)}>
                          Editar projeto
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => onEditCalendarEvent(event)}>
                            Editar
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => onDeleteCalendarEvent(event.id)}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="calendar-empty-day">
              Nenhum compromisso para as tags selecionadas neste dia.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const initialSelectedCalendarDate = loadSelectedCalendarDate();

  const [projects, setProjects] = useState(loadProjects);
  const [calendarEvents, setCalendarEvents] = useState(loadCalendarEvents);
  const [activePage, setActivePage] = useState(loadActivePage);
  const [calendarView, setCalendarView] = useState(loadCalendarView);

  const [form, setForm] = useState(emptyProjectForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(initialSelectedCalendarDate.slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("Ativos");
  const [search, setSearch] = useState("");

  const [activeCalendarTags, setActiveCalendarTags] = useState(loadActiveCalendarTags);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(initialSelectedCalendarDate);

  const [isCreateChoiceOpen, setIsCreateChoiceOpen] = useState(false);
  const [calendarEventForm, setCalendarEventForm] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem(PAGE_STORAGE_KEY, activePage);
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, calendarView);
  }, [calendarView]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_TAGS_STORAGE_KEY, JSON.stringify(activeCalendarTags));
  }, [activeCalendarTags]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_SELECTED_DATE_STORAGE_KEY, selectedCalendarDate);
  }, [selectedCalendarDate]);

  useEffect(() => {
    if (!projectDetails) return;

    const freshProject = projects.find((project) => project.id === projectDetails.project.id);

    if (!freshProject) {
      setProjectDetails(null);
      return;
    }

    if (freshProject !== projectDetails.project) {
      setProjectDetails({
        project: freshProject,
        code: freshProject.projectCode || projectDetails.code,
      });
    }
  }, [projects, projectDetails]);

  const monthProjects = useMemo(() => {
    if (!selectedMonth) return projects;
    return projects.filter((project) => project.date?.startsWith(selectedMonth));
  }, [projects, selectedMonth]);

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects
      .filter((project) => {
        const displayStatus = getDisplayStatus(project);

        if (statusFilter === "Ativos" && !isActiveProject(project)) return false;

        if (
          statusFilter !== "Todos" &&
          statusFilter !== "Ativos" &&
          displayStatus !== statusFilter
        ) {
          return false;
        }

        if (!term) return true;

        return [project.development, project.client, project.consultant, project.project]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        const codeA = getProjectCodeNumber(a.projectCode);
        const codeB = getProjectCodeNumber(b.projectCode);

        if (codeA !== codeB) return codeB - codeA;

        return getProjectOrderValue(b).localeCompare(getProjectOrderValue(a));
      });
  }, [projects, search, statusFilter]);

  const summary = useMemo(() => {
    const soldProjects = monthProjects.filter(isSold);

    return {
      sold: soldProjects.reduce((sum, project) => sum + Number(project.amount || 0), 0),
      commission: soldProjects.reduce((sum, project) => sum + getCommission(project), 0),
      received: soldProjects.reduce((sum, project) => sum + getReceivedCommission(project), 0),
      pending: soldProjects.reduce((sum, project) => sum + getPendingCommission(project), 0),
      active: monthProjects.filter(isActiveProject).length,
    };
  }, [monthProjects]);

  const nextProjects = useMemo(() => {
    return [...projects]
      .filter((project) => {
        const date = getProjectDeadline(project);
        return date >= todayISO() && project.status !== "Cancelado";
      })
      .sort((a, b) => getProjectDeadline(a).localeCompare(getProjectDeadline(b)))
      .slice(0, 5);
  }, [projects]);

  const pendingProjects = useMemo(() => {
    return [...monthProjects]
      .filter((project) => getPendingCommission(project) > 0 && project.status !== "Cancelado")
      .sort((a, b) => getPendingCommission(b) - getPendingCommission(a))
      .slice(0, 5);
  }, [monthProjects]);

  const progressPercent = summary.commission
    ? Math.min(Math.round((summary.received / summary.commission) * 100), 100)
    : 0;

  function openNewProject(date = todayISO()) {
    setEditingId(null);
    setForm(emptyProjectForm(date, getNextProjectCode(projects)));
    setIsFormOpen(true);
  }

  function openEditProject(project) {
    setEditingId(project.id);
    setForm({
      projectCode: project.projectCode || "",
      date: project.date || todayISO(),
      deliveryDate: project.deliveryDate || "",
      development: project.development || "",
      client: project.client || "",
      clientEmail: project.clientEmail || "",
      clientPhone: project.clientPhone || "",
      consultant: project.consultant || "",
      project: project.project || "",
      amount: formatMoneyInputFromNumber(project.amount),
      commissionPercent: String(project.commissionPercent || "3"),
      receivedAmount: formatMoneyInputFromNumber(project.receivedAmount),
      receivedDate: project.receivedDate || "",
      status: project.status || "A receber",
      note: project.note || "",
      color: project.color || EVENT_COLORS[0],
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyProjectForm());
    setIsFormOpen(false);
  }

  function saveProject(event) {
    event.preventDefault();

    const existingProject = projects.find((item) => item.id === editingId);

    const amount = parseMoney(form.amount);
    const commissionPercent = parsePercent(form.commissionPercent);
    const commission = amount * (commissionPercent / 100);

    let receivedAmount = parseMoney(form.receivedAmount);
    let receivedDate = form.receivedDate;
    let status = form.status;

    if (status === "A receber" || status === "Orçamento" || status === "Cancelado") {
      receivedAmount = 0;
      receivedDate = "";
    }

    if (status === "Recebido") {
      receivedAmount = commission;
      receivedDate = receivedDate || todayISO();
    }

    if (status === "Parcial") {
      receivedAmount = Math.min(Math.max(receivedAmount, 0), commission);

      if (receivedAmount <= 0) {
        status = "A receber";
        receivedDate = "";
      } else if (commission > 0 && receivedAmount >= commission) {
        status = "Recebido";
        receivedAmount = commission;
        receivedDate = receivedDate || todayISO();
      } else {
        receivedDate = receivedDate || todayISO();
      }
    }

    const payload = {
      id: editingId || createId(),
      projectCode: getUniqueProjectCode(projects, form.projectCode, editingId),
      date: form.date,
      deliveryDate: form.deliveryDate,
      development: form.development.trim(),
      client: form.client.trim(),
      clientEmail: form.clientEmail.trim(),
      clientPhone: form.clientPhone.trim(),
      consultant: form.consultant.trim(),
      project: form.project.trim(),
      amount,
      commissionPercent,
      receivedAmount,
      receivedDate,
      status,
      note: form.note.trim(),
      color: form.color || EVENT_COLORS[0],
      payments: existingProject?.payments || [],
      tasks: getProjectTasks(existingProject),
      taskProgress: existingProject?.taskProgress || 0,
      tasksTotal: existingProject?.tasksTotal || 0,
      tasksDone: existingProject?.tasksDone || 0,
      createdAt: existingProject?.createdAt || existingProject?.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      setProjects((current) =>
        normalizeProjectCodes(current.map((item) => (item.id === editingId ? payload : item)))
      );
    } else {
      setProjects((current) => normalizeProjectCodes([payload, ...current]));
    }

    setSelectedCalendarDate(payload.deliveryDate || payload.date);
    setSelectedMonth((payload.deliveryDate || payload.date).slice(0, 7));
    setProjectDetails(null);
    closeForm();
  }

  function deleteProject(id) {
    const confirmDelete = window.confirm("Tem certeza que deseja excluir este projeto?");
    if (!confirmDelete) return;

    setProjects((current) => normalizeProjectCodes(current.filter((project) => project.id !== id)));
    setProjectDetails(null);
  }

  function markAsReceived(id) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) =>
          project.id === id
            ? {
                ...project,
                status: "Recebido",
                receivedAmount: getCommission(project),
                receivedDate: project.receivedDate || todayISO(),
                updatedAt: new Date().toISOString(),
              }
            : project
        )
      )
    );
  }

  function addProjectPayment(projectId, paymentFormPayload) {
    const amount = parseMoney(paymentFormPayload.amount);

    if (amount <= 0) {
      window.alert("Informe um valor recebido.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const commission = getCommission(project);
          const currentReceived = getReceivedCommission(project);
          const nextReceived =
            commission > 0 ? Math.min(currentReceived + amount, commission) : currentReceived + amount;

          let nextStatus = project.status;

          if (project.status !== "Cancelado") {
            if (commission > 0 && nextReceived >= commission) {
              nextStatus = "Recebido";
            } else if (nextReceived > 0) {
              nextStatus = "Parcial";
            } else {
              nextStatus = "A receber";
            }
          }

          const newPayment = {
            id: createId(),
            amount,
            date: paymentFormPayload.date || todayISO(),
            note: String(paymentFormPayload.note || "").trim(),
            createdAt: new Date().toISOString(),
          };

          return {
            ...project,
            payments: [...getProjectPayments(project), newPayment],
            receivedAmount: nextReceived,
            receivedDate: newPayment.date,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        })
      )
    );

    return true;
  }

  function deleteProjectPayment(projectId, paymentId) {
    const confirmDelete = window.confirm("Excluir este pagamento?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const paymentToRemove = getProjectPayments(project).find((payment) => payment.id === paymentId);
          const removedAmount = Number(paymentToRemove?.amount) || 0;
          const remainingPayments = getProjectPayments(project).filter((payment) => payment.id !== paymentId);

          const commission = getCommission(project);
          const nextReceived = Math.max(getReceivedCommission(project) - removedAmount, 0);

          let nextStatus = project.status;

          if (project.status !== "Cancelado") {
            if (nextReceived <= 0) {
              nextStatus = "A receber";
            } else if (commission > 0 && nextReceived >= commission) {
              nextStatus = "Recebido";
            } else {
              nextStatus = "Parcial";
            }
          }

          return {
            ...project,
            payments: remainingPayments,
            receivedAmount: nextReceived,
            receivedDate: remainingPayments[0]?.date || "",
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        })
      )
    );
  }


  function addProjectTask(projectId, taskFormPayload) {
    const title = String(taskFormPayload.title || "").trim();

    if (!title) {
      window.alert("Informe o nome da tarefa.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentTasks = getProjectTasks(project);
          const newTask = {
            id: createId(),
            title,
            dueDate: isValidDateString(taskFormPayload.dueDate) ? taskFormPayload.dueDate : "",
            priority: taskFormPayload.priority || "Normal",
            note: String(taskFormPayload.note || "").trim(),
            completed: false,
            position: currentTasks.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return withProjectTasks(project, [...currentTasks, newTask]);
        })
      )
    );

    return true;
  }

  function toggleProjectTask(projectId, taskId) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextTasks = getProjectTasks(project).map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed: !task.completed,
                  updatedAt: new Date().toISOString(),
                }
              : task
          );

          return withProjectTasks(project, nextTasks);
        })
      )
    );
  }

  function deleteProjectTask(projectId, taskId) {
    const confirmDelete = window.confirm("Excluir esta tarefa?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextTasks = getProjectTasks(project).filter((task) => task.id !== taskId);

          return withProjectTasks(project, nextTasks);
        })
      )
    );
  }

  function createDefaultProjectTasks(projectId) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentTasks = getProjectTasks(project);
          if (currentTasks.length) return project;

          const defaultTasks = DEFAULT_PROJECT_TASKS.map((title, index) => ({
            id: createId(),
            title,
            dueDate: "",
            priority: index <= 2 ? "Alta" : "Normal",
            note: "",
            completed: false,
            position: index + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          return withProjectTasks(project, defaultTasks);
        })
      )
    );
  }

  function openProjectDetails(project, code) {
    setProjectDetails({ project, code });
  }

  function editProjectFromDetails(project) {
    setProjectDetails(null);
    openEditProject(project);
  }

  function openCreateChoice(date) {
    setSelectedCalendarDate(date);
    setIsCreateChoiceOpen(true);
  }

  function chooseProjectFromCalendar() {
    setIsCreateChoiceOpen(false);
    openNewProject(selectedCalendarDate);
  }

  function chooseCalendarEvent(tag) {
    setIsCreateChoiceOpen(false);
    setCalendarEventForm(emptyCalendarEvent(selectedCalendarDate, tag));
  }

  function editCalendarEvent(event) {
    setCalendarEventForm({
      id: event.id,
      title: event.title || "",
      date: event.date || selectedCalendarDate,
      tag: event.tag || "Compromissos",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      color: event.color || EVENT_COLORS[1],
      description: event.description || "",
    });
  }

  function saveCalendarEvent(event) {
    event.preventDefault();

    if (!calendarEventForm.title.trim()) {
      window.alert("Informe o título.");
      return;
    }

    const payload = {
      ...calendarEventForm,
      id: calendarEventForm.id || createId(),
      kind: "manual",
      title: calendarEventForm.title.trim(),
      description: calendarEventForm.description.trim(),
      updatedAt: new Date().toISOString(),
    };

    setCalendarEvents((current) => {
      const exists = current.some((item) => item.id === payload.id);

      if (exists) {
        return current.map((item) => (item.id === payload.id ? payload : item));
      }

      return [payload, ...current];
    });

    setSelectedCalendarDate(payload.date);
    setSelectedMonth(payload.date.slice(0, 7));
    setCalendarEventForm(null);
  }

  function deleteCalendarEvent(id) {
    const confirmDelete = window.confirm("Deseja excluir este compromisso?");
    if (!confirmDelete) return;

    setCalendarEvents((current) => current.filter((event) => event.id !== id));
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo />
        </div>

        <nav>
          <button
            type="button"
            className={activePage === "resumo" ? "active" : ""}
            onClick={() => setActivePage("resumo")}
          >
            <span>⌂</span>
            Resumo
          </button>

          <button
            type="button"
            className={activePage === "projetos" ? "active" : ""}
            onClick={() => setActivePage("projetos")}
          >
            <span>□</span>
            Projetos
          </button>

          <button
            type="button"
            className={activePage === "calendario" ? "active" : ""}
            onClick={() => setActivePage("calendario")}
          >
            <span>◷</span>
            Calendário
          </button>
        </nav>

        <div className="sidebar-footer">
          <strong>AD</strong>

          <div>
            <strong>Alexandre Dias</strong>
            <span>Arquitetura & Interiores</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="topbar-brand">
            <BrandLogo />
          </div>
        </header>

        <div className="mobile-tabs">
          <button
            type="button"
            className={activePage === "resumo" ? "active" : ""}
            onClick={() => setActivePage("resumo")}
          >
            Resumo
          </button>

          <button
            type="button"
            className={activePage === "projetos" ? "active" : ""}
            onClick={() => setActivePage("projetos")}
          >
            Projetos
          </button>

          <button
            type="button"
            className={activePage === "calendario" ? "active" : ""}
            onClick={() => setActivePage("calendario")}
          >
            Calendário
          </button>
        </div>

        {activePage === "resumo" ? (
          <section className="page-section">
            <section className="hero welcome-card">
              <h1>
                Vamos criar algo incrível, <span>Alexandre?</span>
              </h1>
            </section>

            <section className="summary-grid">
              <SummaryCard
                icon="▢"
                label="Vendido no mês"
                value={formatCurrency(summary.sold)}
                helper="Sem orçamentos e cancelados"
              />

              <SummaryCard
                icon="▱"
                label="Projetos ativos"
                value={String(summary.active)}
                helper="Em aberto no período"
              />

              <SummaryCard
                icon="↓"
                label="Recebido"
                value={formatCurrency(summary.received)}
                helper="Comissão já recebida"
                tone="received"
              />

              <SummaryCard
                icon="↑"
                label="A receber"
                value={formatCurrency(summary.pending)}
                helper="Comissão pendente"
                tone="pending"
              />
            </section>

            <section className="dashboard-grid">
              <div className="panel side-panel">
                <div className="panel-header compact">
                  <div>
                    <p>Próximos</p>
                    <h2>Lançamentos</h2>
                  </div>

                  <button type="button" onClick={() => setActivePage("calendario")}>
                    Ver calendário
                  </button>
                </div>

                <div className="project-lines">
                  {nextProjects.length ? (
                    nextProjects.map((project) => (
                      <button
                        type="button"
                        className="launch-line"
                        key={project.id}
                        onClick={() => openEditProject(project)}
                      >
                        <div>
                          <strong>{project.client || "Cliente sem nome"}</strong>
                          <span>{project.development || project.project || "Projeto"}</span>
                        </div>

                        <span>{formatDate(getProjectDeadline(project))}</span>
                      </button>
                    ))
                  ) : (
                    <div className="soft-empty">Nenhum próximo lançamento cadastrado.</div>
                  )}
                </div>
              </div>

              <aside className="side-stack">
                <div className="panel side-panel">
                  <div className="panel-header compact">
                    <div>
                      <p>Atenção</p>
                      <h2>Comissões a receber</h2>
                    </div>

                    <button type="button" onClick={() => setActivePage("projetos")}>
                      Ver tudo
                    </button>
                  </div>

                  <div className="project-lines">
                    {pendingProjects.length ? (
                      pendingProjects.map((project) => (
                        <ProjectListItem key={project.id} project={project} onEdit={openEditProject} />
                      ))
                    ) : (
                      <div className="soft-empty">Nenhuma comissão pendente neste período.</div>
                    )}
                  </div>
                </div>

                <div className="panel side-panel">
                  <div className="panel-header compact">
                    <div>
                      <p>Progresso</p>
                      <h2>Recebimento do mês</h2>
                    </div>
                  </div>

                  <div className="progress-card">
                    <div>
                      <strong>{progressPercent}%</strong>
                      <span>
                        {formatCurrency(summary.received)} de {formatCurrency(summary.commission)}
                      </span>
                    </div>

                    <div className="progress-track">
                      <i style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              </aside>
            </section>

            <footer className="quote-bar">
              “Arquitetura é transformar necessidades em experiências.” <span>— Alexandre Dias</span>
            </footer>
          </section>
        ) : null}

        {activePage === "projetos" ? (
          <section className="page-section">
            <section className="hero hero-small">
              <div>
                <p>Controle</p>
                <h1>Projetos</h1>
                <small>Lista premium para acompanhar clientes, comissões e recebimentos.</small>
              </div>

              <button type="button" className="primary-button" onClick={() => openNewProject()}>
                + Novo projeto
              </button>
            </section>

            <div className="filters">
              <input
                type="search"
                value={search}
                placeholder="Buscar por nome do cliente ou projeto..."
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="project-filter-select">
                <span>Exibindo:</span>

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {PROJECT_FILTER_OPTIONS.map((filter) => (
                    <option key={filter} value={filter}>
                      {filter}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ProjectMobileList
              projects={visibleProjects}
              onOpenDetails={openProjectDetails}
              emptyMessage="Nenhum projeto encontrado com esses filtros."
            />

            <div className="projects-table-desktop">
              <ProjectTable
                projects={visibleProjects}
                onEdit={openEditProject}
                onDelete={deleteProject}
                onMarkReceived={markAsReceived}
                emptyMessage="Nenhum projeto encontrado com esses filtros."
              />
            </div>
          </section>
        ) : null}

        {activePage === "calendario" ? (
          <CalendarPage
            month={selectedMonth || todayISO().slice(0, 7)}
            setMonth={setSelectedMonth}
            projects={projects}
            calendarEvents={calendarEvents}
            activeCalendarTags={activeCalendarTags}
            setActiveCalendarTags={setActiveCalendarTags}
            selectedCalendarDate={selectedCalendarDate}
            setSelectedCalendarDate={setSelectedCalendarDate}
            calendarView={calendarView}
            setCalendarView={setCalendarView}
            onOpenCreateChoice={openCreateChoice}
            onEditProject={openEditProject}
            onEditCalendarEvent={editCalendarEvent}
            onDeleteCalendarEvent={deleteCalendarEvent}
          />
        ) : null}
      </section>

      {isFormOpen ? (
        <ProjectFormModal
          form={form}
          setForm={setForm}
          editingId={editingId}
          onClose={closeForm}
          onSubmit={saveProject}
        />
      ) : null}

      {isCreateChoiceOpen ? (
        <CalendarCreateTypeModal
          date={selectedCalendarDate}
          onClose={() => setIsCreateChoiceOpen(false)}
          onChooseProject={chooseProjectFromCalendar}
          onChooseEvent={chooseCalendarEvent}
        />
      ) : null}

      {calendarEventForm ? (
        <CalendarEventFormModal
          eventForm={calendarEventForm}
          setEventForm={setCalendarEventForm}
          onClose={() => setCalendarEventForm(null)}
          onSubmit={saveCalendarEvent}
        />
      ) : null}

      {projectDetails ? (
        <ProjectDetailModal
          details={projectDetails}
          onClose={() => setProjectDetails(null)}
          onEdit={editProjectFromDetails}
          onAddPayment={addProjectPayment}
          onDeletePayment={deleteProjectPayment}
          onAddTask={addProjectTask}
          onToggleTask={toggleProjectTask}
          onDeleteTask={deleteProjectTask}
          onCreateDefaultTasks={createDefaultProjectTasks}
        />
      ) : null}
    </main>
  );
}