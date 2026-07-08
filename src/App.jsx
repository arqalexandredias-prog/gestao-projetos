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

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  const start = formatter.format(firstDay).replace(/\.$/, "");
  const end = formatter.format(lastDay).replace(/\.$/, "");
  const sameYear = firstDay.getFullYear() === lastDay.getFullYear();

  return sameYear
    ? `${start} — ${end} · ${lastDay.getFullYear()}`
    : `${start} ${firstDay.getFullYear()} — ${end} ${lastDay.getFullYear()}`;
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
    const schedule = normalizeProjectSchedule(project.schedule);
    const scheduleProgress = getScheduleProgress(schedule);
    const budgets = normalizeProjectBudgets(project.budgets);
    const budgetSummary = getBudgetSummary(budgets);
    const diaryEntries = normalizeProjectDiaryEntries(project.diaryEntries || project.diary);
    const diarySummary = getDiarySummary(diaryEntries);

    return {
      ...project,
      tasks,
      taskProgress: taskProgress.percent,
      tasksTotal: taskProgress.total,
      tasksDone: taskProgress.done,
      schedule,
      scheduleProgress: scheduleProgress.percent,
      scheduleTotal: scheduleProgress.total,
      scheduleDone: scheduleProgress.done,
      budgets,
      budgetsTotal: budgetSummary.totalItems,
      budgetsApprovedTotal: budgetSummary.approvedTotal,
      budgetsGrandTotal: budgetSummary.grandTotal,
      diaryEntries,
      diaryTotal: diarySummary.totalItems,
      diaryPinnedTotal: diarySummary.pinnedCount,
      diaryLastDate: diarySummary.lastDate,
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

const DEFAULT_PROJECT_SCHEDULE = [
  { title: "Briefing / alinhamento inicial", offset: 0 },
  { title: "Estudo de layout", offset: 2 },
  { title: "Modelagem 3D", offset: 5 },
  { title: "Revisão com cliente", offset: 8 },
  { title: "Renderização", offset: 10 },
  { title: "Ajustes finais", offset: 12 },
  { title: "Entrega final", offset: 14, useDeliveryDate: true },
];

const SCHEDULE_STATUS_OPTIONS = ["Pendente", "Em andamento", "Concluído"];

function emptyScheduleForm() {
  return {
    title: "",
    date: "",
    status: "Pendente",
    note: "",
  };
}

function normalizeScheduleStatus(status) {
  return SCHEDULE_STATUS_OPTIONS.includes(status) ? status : "Pendente";
}

function normalizeProjectSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];

  return schedule
    .map((item, index) => ({
      id: item.id || createId(),
      title: String(item.title || "").trim(),
      date: isValidDateString(item.date) ? item.date : "",
      status: normalizeScheduleStatus(item.status),
      note: String(item.note || "").trim(),
      position: Number.isFinite(Number(item.position)) ? Number(item.position) : index + 1,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.title)
    .sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      if (a.position !== b.position) return a.position - b.position;

      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

function getProjectSchedule(project) {
  return normalizeProjectSchedule(project?.schedule);
}

function getScheduleProgress(schedule) {
  const normalizedSchedule = normalizeProjectSchedule(schedule);

  if (!normalizedSchedule.length) {
    return {
      total: 0,
      done: 0,
      percent: 0,
    };
  }

  const done = normalizedSchedule.filter((item) => item.status === "Concluído").length;

  return {
    total: normalizedSchedule.length,
    done,
    percent: Math.round((done / normalizedSchedule.length) * 100),
  };
}

function getScheduleProgressLabel(project) {
  const progress = getScheduleProgress(getProjectSchedule(project));

  if (!progress.total) return "Criar etapas";

  return `${progress.done}/${progress.total} etapas · ${progress.percent}%`;
}

function getScheduleStatusClass(status) {
  if (status === "Concluído") return "status-recebido";
  if (status === "Em andamento") return "status-parcial";

  return "status-a-receber";
}

function getNextScheduleStatus(status) {
  if (status === "Pendente") return "Em andamento";
  if (status === "Em andamento") return "Concluído";

  return "Pendente";
}

function getDefaultScheduleDate(project, item, index) {
  if (item.useDeliveryDate && isValidDateString(project?.deliveryDate)) {
    return project.deliveryDate;
  }

  const baseDate = isValidDateString(project?.date) ? parseISODate(project.date) : parseISODate(todayISO());
  return toISODate(addDays(baseDate, Number.isFinite(Number(item.offset)) ? Number(item.offset) : index * 2));
}

function withProjectSchedule(project, schedule) {
  const normalizedSchedule = normalizeProjectSchedule(schedule);
  const progress = getScheduleProgress(normalizedSchedule);

  return {
    ...project,
    schedule: normalizedSchedule,
    scheduleProgress: progress.percent,
    scheduleTotal: progress.total,
    scheduleDone: progress.done,
    updatedAt: new Date().toISOString(),
  };
}


const FILE_CATEGORY_OPTIONS = [
  "Briefing",
  "Contrato",
  "Drive",
  "Referência",
  "Imagem",
  "PDF",
  "Orçamento",
  "Projeto",
  "Outros",
];

function emptyProjectFileForm() {
  return {
    title: "",
    url: "",
    category: "Drive",
    note: "",
  };
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;
  if (raw.includes(".")) return `https://${raw}`;

  return raw;
}

function normalizeFileCategory(category) {
  return FILE_CATEGORY_OPTIONS.includes(category) ? category : "Outros";
}

function normalizeProjectFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .map((file, index) => ({
      id: file.id || createId(),
      title: String(file.title || "").trim(),
      url: normalizeUrl(file.url),
      category: normalizeFileCategory(file.category),
      note: String(file.note || "").trim(),
      favorite: Boolean(file.favorite),
      position: Number.isFinite(Number(file.position)) ? Number(file.position) : index + 1,
      createdAt: file.createdAt || new Date().toISOString(),
      updatedAt: file.updatedAt || file.createdAt || new Date().toISOString(),
    }))
    .filter((file) => file.title || file.url)
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (a.position !== b.position) return a.position - b.position;

      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function getProjectFiles(project) {
  return normalizeProjectFiles(project?.files);
}

function getProjectFilesLabel(project) {
  const files = getProjectFiles(project);

  if (!files.length) return "Adicionar links";
  if (files.length === 1) return "1 arquivo salvo";

  return `${files.length} arquivos salvos`;
}

function withProjectFiles(project, files) {
  const normalizedFiles = normalizeProjectFiles(files);

  return {
    ...project,
    files: normalizedFiles,
    filesTotal: normalizedFiles.length,
    updatedAt: new Date().toISOString(),
  };
}

const BUDGET_STATUS_OPTIONS = ["Rascunho", "Enviado", "Aprovado", "Recusado"];

function emptyBudgetForm() {
  return {
    title: "",
    supplier: "",
    amount: "",
    date: todayISO(),
    status: "Rascunho",
    url: "",
    note: "",
  };
}

function normalizeBudgetStatus(status) {
  return BUDGET_STATUS_OPTIONS.includes(status) ? status : "Rascunho";
}

function normalizeProjectBudgets(budgets) {
  if (!Array.isArray(budgets)) return [];

  return budgets
    .map((budget, index) => ({
      id: budget.id || createId(),
      title: String(budget.title || "").trim(),
      supplier: String(budget.supplier || "").trim(),
      amount: Number(budget.amount) || 0,
      date: isValidDateString(budget.date) ? budget.date : "",
      status: normalizeBudgetStatus(budget.status),
      url: normalizeUrl(budget.url),
      note: String(budget.note || "").trim(),
      position: Number.isFinite(Number(budget.position)) ? Number(budget.position) : index + 1,
      createdAt: budget.createdAt || new Date().toISOString(),
      updatedAt: budget.updatedAt || budget.createdAt || new Date().toISOString(),
    }))
    .filter((budget) => budget.title || budget.supplier || budget.amount > 0 || budget.url)
    .sort((a, b) => {
      if (a.status === "Aprovado" && b.status !== "Aprovado") return -1;
      if (a.status !== "Aprovado" && b.status === "Aprovado") return 1;
      if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.position !== b.position) return a.position - b.position;

      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function getProjectBudgets(project) {
  return normalizeProjectBudgets(project?.budgets);
}

function getBudgetSummary(budgets) {
  const normalizedBudgets = normalizeProjectBudgets(budgets);
  const approvedBudgets = normalizedBudgets.filter((budget) => budget.status === "Aprovado");
  const sentBudgets = normalizedBudgets.filter((budget) => budget.status === "Enviado");
  const rejectedBudgets = normalizedBudgets.filter((budget) => budget.status === "Recusado");

  return {
    totalItems: normalizedBudgets.length,
    grandTotal: normalizedBudgets.reduce((sum, budget) => sum + (Number(budget.amount) || 0), 0),
    approvedCount: approvedBudgets.length,
    approvedTotal: approvedBudgets.reduce((sum, budget) => sum + (Number(budget.amount) || 0), 0),
    sentCount: sentBudgets.length,
    sentTotal: sentBudgets.reduce((sum, budget) => sum + (Number(budget.amount) || 0), 0),
    rejectedCount: rejectedBudgets.length,
  };
}

function getProjectBudgetsLabel(project) {
  const summary = getBudgetSummary(getProjectBudgets(project));

  if (!summary.totalItems) return "Criar orçamentos";
  if (summary.approvedTotal > 0) return `${formatCurrency(summary.approvedTotal)} aprovado`;

  return `${summary.totalItems} orçamento${summary.totalItems > 1 ? "s" : ""}`;
}

function getBudgetStatusClass(status) {
  if (status === "Aprovado") return "status-recebido";
  if (status === "Enviado") return "status-parcial";
  if (status === "Recusado") return "status-cancelado";

  return "status-a-receber";
}

function getNextBudgetStatus(status) {
  if (status === "Rascunho") return "Enviado";
  if (status === "Enviado") return "Aprovado";
  if (status === "Aprovado") return "Rascunho";

  return "Rascunho";
}

function withProjectBudgets(project, budgets) {
  const normalizedBudgets = normalizeProjectBudgets(budgets);
  const summary = getBudgetSummary(normalizedBudgets);

  return {
    ...project,
    budgets: normalizedBudgets,
    budgetsTotal: summary.totalItems,
    budgetsApprovedTotal: summary.approvedTotal,
    budgetsGrandTotal: summary.grandTotal,
    updatedAt: new Date().toISOString(),
  };
}

const DIARY_TYPE_OPTIONS = ["Registro", "Reunião", "Decisão", "Pendência", "Ideia", "Entrega"];

function emptyDiaryForm() {
  return {
    title: "",
    date: todayISO(),
    type: "Registro",
    text: "",
    nextStep: "",
  };
}

function normalizeDiaryType(type) {
  return DIARY_TYPE_OPTIONS.includes(type) ? type : "Registro";
}

function normalizeProjectDiaryEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry, index) => ({
      id: entry.id || createId(),
      title: String(entry.title || "").trim(),
      date: isValidDateString(entry.date) ? entry.date : todayISO(),
      type: normalizeDiaryType(entry.type),
      text: String(entry.text || entry.description || "").trim(),
      nextStep: String(entry.nextStep || "").trim(),
      pinned: Boolean(entry.pinned),
      position: Number.isFinite(Number(entry.position)) ? Number(entry.position) : index + 1,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
    }))
    .filter((entry) => entry.title || entry.text || entry.nextStep)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.position !== b.position) return a.position - b.position;

      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function getProjectDiary(project) {
  return normalizeProjectDiaryEntries(project?.diaryEntries || project?.diary);
}

function getDiarySummary(entries) {
  const normalizedEntries = normalizeProjectDiaryEntries(entries);

  return {
    totalItems: normalizedEntries.length,
    pinnedCount: normalizedEntries.filter((entry) => entry.pinned).length,
    lastDate: normalizedEntries[0]?.date || "",
  };
}

function getProjectDiaryLabel(project) {
  const entries = getProjectDiary(project);
  const summary = getDiarySummary(entries);

  if (summary.totalItems > 0) {
    return `${summary.totalItems} registro${summary.totalItems > 1 ? "s" : ""}`;
  }

  if (project?.note) return "1 observação";

  return "Criar diário";
}

function getDiaryTypeClass(type) {
  if (type === "Entrega") return "status-recebido";
  if (type === "Pendência") return "status-cancelado";
  if (type === "Decisão") return "status-parcial";
  if (type === "Reunião") return "status-a-receber";

  return "status-orcamento";
}

function withProjectDiary(project, entries) {
  const normalizedEntries = normalizeProjectDiaryEntries(entries);
  const summary = getDiarySummary(normalizedEntries);

  return {
    ...project,
    diaryEntries: normalizedEntries,
    diaryTotal: summary.totalItems,
    diaryPinnedTotal: summary.pinnedCount,
    diaryLastDate: summary.lastDate,
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

function BrandLogo({ compact = false } = {}) {
  return (
    <div
      className="brand-wordmark"
      style={
        compact
          ? {
              minHeight: "auto",
              gap: 0,
            }
          : undefined
      }
    >
      <div
        className="brand-copy"
        style={
          compact
            ? {
                gap: 4,
              }
            : undefined
        }
      >
        <strong
          style={
            compact
              ? {
                  fontSize: "clamp(0.96rem, 4vw, 1.12rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.05em",
                }
              : undefined
          }
        >
          Alexandre Dias <em>| Interiores</em>
        </strong>
        <span
          style={
            compact
              ? {
                  fontSize: "0.46rem",
                  letterSpacing: "0.28em",
                  lineHeight: 1,
                }
              : undefined
          }
        >
          Gestão de Projetos
        </span>
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

function SummaryCard({ icon, label, value, helper, tone = "neutral", onClick }) {
  const cardStyle = {
    width: "100%",
    minHeight: 76,
    padding: "11px 12px",
    textAlign: "left",
    cursor: onClick ? "pointer" : "default",
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr)",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
  };

  const content = (
    <>
      <div
        className="summary-icon"
        style={{
          width: 30,
          height: 30,
          marginBottom: 0,
          fontSize: "0.72rem",
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: "0.72rem",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>

        <strong
          style={{
            display: "block",
            fontSize: "1.06rem",
            lineHeight: 1.02,
            letterSpacing: "-0.05em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </strong>

        {helper ? (
          <small
            style={{
              display: "block",
              marginTop: 5,
              fontSize: "0.66rem",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {helper}
          </small>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`summary-card summary-card-${tone}`}
        onClick={onClick}
        style={cardStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`summary-card summary-card-${tone}`} style={cardStyle}>
      {content}
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
    <div className="projects-premium-list" style={{ borderRadius: 24, overflow: "hidden" }}>
      <div
        className="projects-premium-head"
        style={{ padding: "9px 16px", minHeight: 36, fontSize: "0.68rem", letterSpacing: "0.14em" }}
      >
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
            style={{
              minHeight: 68,
              padding: "9px 16px",
              gap: 10,
            }}
          >
            <span className="projects-premium-code" style={{ fontSize: "0.78rem" }}>{code}</span>

            <span className="projects-premium-info" style={{ gap: 2 }}>
              <strong style={{ fontSize: "0.84rem", lineHeight: 1.08 }}>{getProjectTitle(project)}</strong>
              <small style={{ fontSize: "0.68rem", lineHeight: 1.05 }}>{getProjectClient(project)}</small>
            </span>

            <span
              className="projects-premium-status"
              style={{ backgroundColor: project.color || EVENT_COLORS[0], width: 10, height: 10 }}
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
  onAddScheduleItem,
  onUpdateScheduleItemStatus,
  onDeleteScheduleItem,
  onCreateDefaultSchedule,
  onAddFile,
  onDeleteFile,
  onToggleFileFavorite,
  onAddBudget,
  onUpdateBudgetStatus,
  onDeleteBudget,
  onAddDiaryEntry,
  onToggleDiaryPin,
  onDeleteDiaryEntry,
}) {
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [fileForm, setFileForm] = useState(emptyProjectFileForm);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);
  const [diaryForm, setDiaryForm] = useState(emptyDiaryForm);

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
  const schedule = getProjectSchedule(project);
  const scheduleProgress = getScheduleProgress(schedule);
  const files = getProjectFiles(project);
  const favoriteFilesCount = files.filter((file) => file.favorite).length;
  const budgets = getProjectBudgets(project);
  const budgetSummary = getBudgetSummary(budgets);
  const diaryEntries = getProjectDiary(project);
  const diarySummary = getDiarySummary(diaryEntries);

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

  function submitSchedule(event) {
    event.preventDefault();

    const saved = onAddScheduleItem(project.id, scheduleForm);

    if (saved) {
      setScheduleForm(emptyScheduleForm());
    }
  }

  function submitFile(event) {
    event.preventDefault();

    const saved = onAddFile(project.id, fileForm);

    if (saved) {
      setFileForm(emptyProjectFileForm());
    }
  }

  function submitBudget(event) {
    event.preventDefault();

    const saved = onAddBudget(project.id, budgetForm);

    if (saved) {
      setBudgetForm(emptyBudgetForm());
    }
  }

  function submitDiary(event) {
    event.preventDefault();

    const saved = onAddDiaryEntry(project.id, diaryForm);

    if (saved) {
      setDiaryForm(emptyDiaryForm());
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

            <div className="project-payment-total">
              <span>Progresso do cronograma</span>
              <strong>{scheduleProgress.percent}%</strong>
            </div>

            <div className="project-detail-progress">
              <i style={{ width: `${scheduleProgress.percent}%` }} />
            </div>

            <p className="project-payment-empty">
              {scheduleProgress.done} de {scheduleProgress.total} etapas concluídas. As etapas com
              data aparecem automaticamente no calendário como Cronograma.
            </p>

            <form className="project-payment-form" onSubmit={submitSchedule}>
              <label className="project-payment-form-wide">
                Nova etapa
                <input
                  type="text"
                  value={scheduleForm.title}
                  placeholder="Ex: Revisão com cliente"
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Data
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Status
                <select
                  value={scheduleForm.status}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  {SCHEDULE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-payment-form-wide">
                Observação
                <input
                  type="text"
                  value={scheduleForm.note}
                  placeholder="Ex: aguardar aprovação antes de renderizar"
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Adicionar etapa</button>
            </form>

            {!schedule.length ? (
              <div className="project-section-empty">
                <p>Nenhuma etapa cadastrada ainda.</p>

                <button type="button" onClick={() => onCreateDefaultSchedule(project.id)}>
                  Criar cronograma padrão
                </button>
              </div>
            ) : (
              <div className="project-payment-list">
                {schedule.map((item) => (
                  <article key={item.id} className="project-payment-item">
                    <div>
                      <strong
                        style={{
                          textDecoration: item.status === "Concluído" ? "line-through" : "none",
                          opacity: item.status === "Concluído" ? 0.62 : 1,
                        }}
                      >
                        {item.title}
                      </strong>

                      <span>{item.date ? formatDate(item.date) : "Sem data"}</span>

                      <small>
                        <span className={`status ${getScheduleStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </small>

                      {item.note ? <small>{item.note}</small> : null}
                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateScheduleItemStatus(
                            project.id,
                            item.id,
                            getNextScheduleStatus(item.status)
                          )
                        }
                      >
                        {item.status === "Concluído" ? "Reabrir" : "Avançar"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteScheduleItem(project.id, item.id)}
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

        {type === "orcamentos" ? (
          <div className="project-section-popup-body">
            <div className="project-section-info-list">
              <div>
                <span>Valor do projeto</span>
                <strong>{money(project.amount)}</strong>
              </div>

              <div>
                <span>Total orçado</span>
                <strong>{money(budgetSummary.grandTotal)}</strong>
              </div>

              <div>
                <span>Aprovado</span>
                <strong>{money(budgetSummary.approvedTotal)}</strong>
              </div>

              <div>
                <span>Enviado</span>
                <strong>{money(budgetSummary.sentTotal)}</strong>
              </div>

              <div>
                <span>Comissão estimada</span>
                <strong>{money(commission)}</strong>
              </div>
            </div>

            <div className="project-payment-total">
              <span>Orçamentos cadastrados</span>
              <strong>{budgetSummary.totalItems}</strong>
            </div>

            <p className="project-payment-empty">
              Controle propostas, fornecedores, links e valores de orçamento dentro deste projeto.
              Use o status para separar rascunhos, enviados, aprovados e recusados.
            </p>

            <form className="project-payment-form" onSubmit={submitBudget}>
              <label className="project-payment-form-wide">
                Nome do orçamento
                <input
                  type="text"
                  value={budgetForm.title}
                  placeholder="Ex: Marcenaria cozinha / Marmoraria / Projeto executivo"
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Fornecedor
                <input
                  type="text"
                  value={budgetForm.supplier}
                  placeholder="Ex: Paula / Marmoraria X"
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      supplier: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Valor
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetForm.amount}
                  placeholder="Ex: 18.500,00"
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
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
                  value={budgetForm.date}
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Status
                <select
                  value={budgetForm.status}
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  {BUDGET_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-payment-form-wide">
                Link
                <input
                  type="text"
                  value={budgetForm.url}
                  placeholder="Ex: link do Drive, PDF ou proposta"
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="project-payment-form-wide">
                Observação
                <input
                  type="text"
                  value={budgetForm.note}
                  placeholder="Ex: cliente pediu revisão / aguardando retorno"
                  onChange={(event) =>
                    setBudgetForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Adicionar orçamento</button>
            </form>

            {!budgets.length ? (
              <div className="project-section-empty">
                Nenhum orçamento cadastrado ainda.
              </div>
            ) : (
              <div className="project-payment-list">
                {budgets.map((budget) => (
                  <article key={budget.id} className="project-payment-item">
                    <div>
                      <strong>{budget.title || budget.supplier || "Orçamento"}</strong>

                      <span>{budget.supplier || "Fornecedor não informado"}</span>

                      <small>
                        <span className={`status ${getBudgetStatusClass(budget.status)}`}>
                          {budget.status}
                        </span>
                      </small>

                      <small>
                        {money(budget.amount)} · {budget.date ? formatDate(budget.date) : "Sem data"}
                      </small>

                      {budget.url ? (
                        <small>
                          <a href={budget.url} target="_blank" rel="noreferrer">
                            Abrir proposta
                          </a>
                        </small>
                      ) : null}

                      {budget.note ? <small>{budget.note}</small> : null}
                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBudgetStatus(
                            project.id,
                            budget.id,
                            getNextBudgetStatus(budget.status)
                          )
                        }
                      >
                        {budget.status === "Aprovado" ? "Reabrir" : "Avançar"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onUpdateBudgetStatus(project.id, budget.id, "Recusado")}
                      >
                        Recusar
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteBudget(project.id, budget.id)}
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

        {type === "diario" ? (
          <div className="project-section-popup-body">
            <div className="project-section-info-list">
              <div>
                <span>Registros</span>
                <strong>{diarySummary.totalItems}</strong>
              </div>

              <div>
                <span>Fixados</span>
                <strong>{diarySummary.pinnedCount}</strong>
              </div>

              <div>
                <span>Último registro</span>
                <strong>{diarySummary.lastDate ? formatDate(diarySummary.lastDate) : "Sem data"}</strong>
              </div>

              <div>
                <span>Observação principal</span>
                <strong>{project.note ? "Existe" : "Vazia"}</strong>
              </div>
            </div>

            {project.note ? (
              <div className="project-section-text">
                <strong>Observação do cadastro</strong>
                <p>{project.note}</p>
              </div>
            ) : null}

            <p className="project-payment-empty">
              Use o diário para registrar decisões, combinados, pendências, reuniões e próximos passos
              sem misturar tudo nas observações gerais do projeto.
            </p>

            <form className="project-payment-form" onSubmit={submitDiary}>
              <label className="project-payment-form-wide">
                Título do registro
                <input
                  type="text"
                  value={diaryForm.title}
                  placeholder="Ex: Cliente aprovou layout da cozinha"
                  onChange={(event) =>
                    setDiaryForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Data
                <input
                  type="date"
                  value={diaryForm.date}
                  onChange={(event) =>
                    setDiaryForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Tipo
                <select
                  value={diaryForm.type}
                  onChange={(event) =>
                    setDiaryForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  {DIARY_TYPE_OPTIONS.map((typeOption) => (
                    <option key={typeOption} value={typeOption}>
                      {typeOption}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-payment-form-wide">
                Registro
                <textarea
                  rows="4"
                  value={diaryForm.text}
                  placeholder="Escreva o que aconteceu, o que foi decidido ou o que precisa lembrar..."
                  onChange={(event) =>
                    setDiaryForm((prev) => ({
                      ...prev,
                      text: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="project-payment-form-wide">
                Próximo passo
                <input
                  type="text"
                  value={diaryForm.nextStep}
                  placeholder="Ex: enviar revisão até sexta-feira"
                  onChange={(event) =>
                    setDiaryForm((prev) => ({
                      ...prev,
                      nextStep: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Salvar registro</button>
            </form>

            {!diaryEntries.length ? (
              <div className="project-section-empty">Nenhum registro no diário ainda.</div>
            ) : (
              <div className="project-payment-list">
                {diaryEntries.map((entry) => (
                  <article key={entry.id} className="project-payment-item">
                    <div>
                      <strong>{entry.pinned ? "★ " : ""}{entry.title || entry.type}</strong>

                      <span>{formatDate(entry.date)}</span>

                      <small>
                        <span className={`status ${getDiaryTypeClass(entry.type)}`}>
                          {entry.type}
                        </span>
                      </small>

                      {entry.text ? <small>{entry.text}</small> : null}

                      {entry.nextStep ? (
                        <small>
                          <b>Próximo passo:</b> {entry.nextStep}
                        </small>
                      ) : null}
                    </div>

                    <div className="row-actions">
                      <button type="button" onClick={() => onToggleDiaryPin(project.id, entry.id)}>
                        {entry.pinned ? "Desfixar" : "Fixar"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteDiaryEntry(project.id, entry.id)}
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
            <div className="project-payment-total">
              <span>Arquivos e referências</span>
              <strong>{files.length}</strong>
            </div>

            <p className="project-payment-empty">
              Guarde links de Drive, PDFs, imagens, contratos, orçamentos, referências e briefings
              dentro deste projeto. Os arquivos ficam salvos junto com o projeto.
            </p>

            <form className="project-payment-form" onSubmit={submitFile}>
              <label className="project-payment-form-wide">
                Nome do arquivo ou referência
                <input
                  type="text"
                  value={fileForm.title}
                  placeholder="Ex: Briefing aprovado / Pasta Drive / Referência cozinha"
                  onChange={(event) =>
                    setFileForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Categoria
                <select
                  value={fileForm.category}
                  onChange={(event) =>
                    setFileForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                >
                  {FILE_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="project-payment-form-wide">
                Link
                <input
                  type="text"
                  value={fileForm.url}
                  placeholder="Ex: https://drive.google.com/..."
                  onChange={(event) =>
                    setFileForm((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="project-payment-form-wide">
                Observação
                <input
                  type="text"
                  value={fileForm.note}
                  placeholder="Ex: versão final enviada ao cliente"
                  onChange={(event) =>
                    setFileForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit">Adicionar arquivo</button>
            </form>

            {!files.length ? (
              <div className="project-section-empty">
                Nenhum arquivo ou link salvo ainda.
              </div>
            ) : (
              <div className="project-payment-list">
                {files.map((file) => (
                  <article key={file.id} className="project-payment-item">
                    <div>
                      <strong>{file.favorite ? "★ " : ""}{file.title || file.url}</strong>

                      <span>{file.category}</span>

                      {file.url ? (
                        <small>
                          <a href={file.url} target="_blank" rel="noreferrer">
                            Abrir link
                          </a>
                        </small>
                      ) : null}

                      {file.note ? <small>{file.note}</small> : null}
                    </div>

                    <div className="row-actions">
                      <button type="button" onClick={() => onToggleFileFavorite(project.id, file.id)}>
                        {file.favorite ? "Remover destaque" : "Destacar"}
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteFile(project.id, file.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {favoriteFilesCount ? (
              <p className="project-payment-empty">
                {favoriteFilesCount} arquivo{favoriteFilesCount > 1 ? "s" : ""} em destaque aparece{favoriteFilesCount > 1 ? "m" : ""} primeiro na lista.
              </p>
            ) : null}
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
  onAddScheduleItem,
  onUpdateScheduleItemStatus,
  onDeleteScheduleItem,
  onCreateDefaultSchedule,
  onAddFile,
  onDeleteFile,
  onToggleFileFavorite,
  onAddBudget,
  onUpdateBudgetStatus,
  onDeleteBudget,
  onAddDiaryEntry,
  onToggleDiaryPin,
  onDeleteDiaryEntry,
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
  const scheduleProgress = getScheduleProgress(getProjectSchedule(project));
  const budgetSummary = getBudgetSummary(getProjectBudgets(project));
  const diarySummary = getDiarySummary(getProjectDiary(project));

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
              <small>
                {scheduleProgress.total ? getScheduleProgressLabel(project) : deadline ? formatDate(deadline) : "Criar etapas"}
              </small>
            </button>

            <button type="button" onClick={() => setActiveSection("tarefas")}>
              <span>✓</span>
              <strong>Tarefas</strong>
              <small>{getTaskProgressLabel(project)}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("arquivos")}>
              <span>📁</span>
              <strong>Arquivos</strong>
              <small>{getProjectFilesLabel(project)}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("orcamentos")}>
              <span>🧾</span>
              <strong>Orçamentos</strong>
              <small>{budgetSummary.totalItems ? getProjectBudgetsLabel(project) : money(project.amount)}</small>
            </button>

            <button type="button" onClick={() => setActiveSection("diario")}>
              <span>✍</span>
              <strong>Diário</strong>
              <small>{diarySummary.totalItems ? getProjectDiaryLabel(project) : project.note ? "1 observação" : "Criar diário"}</small>
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
            onAddScheduleItem={onAddScheduleItem}
            onUpdateScheduleItemStatus={onUpdateScheduleItemStatus}
            onDeleteScheduleItem={onDeleteScheduleItem}
            onCreateDefaultSchedule={onCreateDefaultSchedule}
            onAddFile={onAddFile}
            onDeleteFile={onDeleteFile}
            onToggleFileFavorite={onToggleFileFavorite}
            onAddBudget={onAddBudget}
            onUpdateBudgetStatus={onUpdateBudgetStatus}
            onDeleteBudget={onDeleteBudget}
            onAddDiaryEntry={onAddDiaryEntry}
            onToggleDiaryPin={onToggleDiaryPin}
            onDeleteDiaryEntry={onDeleteDiaryEntry}
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
      const scheduleEvents = getProjectSchedule(project)
        .filter((item) => isValidDateString(item.date))
        .map((item) => ({
          id: `project-schedule-${project.id}-${item.id}`,
          kind: "project",
          tag: "Cronograma",
          title: item.title,
          subtitle: `${client} · ${item.status}`,
          description: item.note || `Etapa do cronograma do projeto ${title}.`,
          date: item.date,
          color: project.color || EVENT_COLORS[4],
          project,
        }));

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
        return [projectEvent, ...scheduleEvents];
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

      return [projectEvent, deadlineEvent, ...scheduleEvents];
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

    if (calendarView === "semana") {
      const date = parseISODate(selectedCalendarDate);
      const firstDay = addDays(date, -date.getDay());
      const lastDay = addDays(firstDay, 6);

      const start = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
      })
        .format(firstDay)
        .replace(".", "");

      const end = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
      })
        .format(lastDay)
        .replace(".", "");

      return `${start} — ${end}`;
    }

    return formatMonthLabel(monthToUse);
  }

  function getCalendarEyebrow() {
    if (calendarView === "dia") return "Dia selecionado";
    if (calendarView === "semana") return "Semana";
    return "Calendário";
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

  const viewButtonStyle = (isActive) => ({
    minHeight: 30,
    borderRadius: 999,
    border: `1px solid ${isActive ? "rgba(45, 29, 23, 0.22)" : "rgba(45, 29, 23, 0.10)"}`,
    background: isActive
      ? "linear-gradient(135deg, #2d1d17, #3b281f)"
      : "rgba(255, 252, 245, 0.72)",
    color: isActive ? "#fff8ee" : "rgba(72, 52, 43, 0.78)",
    boxShadow: isActive ? "0 10px 22px rgba(45, 29, 23, 0.14)" : "none",
    fontSize: "0.68rem",
    fontWeight: 800,
    padding: "0 12px",
  });

  const tagButtonStyle = (isActive) => ({
    minHeight: 28,
    borderRadius: 999,
    border: `1px solid ${isActive ? "rgba(177, 111, 83, 0.30)" : "rgba(45, 29, 23, 0.10)"}`,
    background: isActive ? "rgba(177, 111, 83, 0.12)" : "rgba(255, 252, 245, 0.64)",
    color: isActive ? "#9b5d45" : "rgba(72, 52, 43, 0.64)",
    boxShadow: "none",
    fontSize: "0.62rem",
    fontWeight: 800,
    padding: "0 9px",
  });

  const navButtonStyle = {
    minHeight: 34,
    borderRadius: 14,
    border: "1px solid rgba(45, 29, 23, 0.10)",
    background: "rgba(255, 252, 245, 0.78)",
    color: "#7c5d4e",
    fontSize: "0.68rem",
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(45, 29, 23, 0.06)",
  };

  return (
    <section className="calendar-reference-page" style={{ gap: 9 }} data-build-marker="CALENDARIO_REFINO_FINAL_V2">
      <div
        className="calendar-reference-header"
        style={{
          marginTop: 0,
          marginBottom: 0,
          padding: "0 2px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 5px",
              color: "#9a7768",
              fontSize: "0.58rem",
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {getCalendarEyebrow()}
          </p>

          <h1
            style={{
              fontSize:
                calendarView === "semana"
                  ? "clamp(1.12rem, 5.2vw, 1.46rem)"
                  : "clamp(1.24rem, 5.6vw, 1.62rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.06em",
              textTransform: "none",
              maxWidth: "100%",
              margin: 0,
              color: "#241915",
            }}
          >
            {getCalendarTitle()}
          </h1>
        </div>
      </div>

      <div
        className="calendar-tag-tabs"
        style={{
          display: "flex",
          gap: 7,
          flexWrap: "nowrap",
          overflowX: "auto",
          padding: "1px 2px 3px",
          margin: 0,
        }}
      >
        <button
          type="button"
          className={calendarView === "mes" ? "active" : ""}
          onClick={() => setCalendarView("mes")}
          style={viewButtonStyle(calendarView === "mes")}
        >
          Mês
        </button>

        <button
          type="button"
          className={calendarView === "semana" ? "active" : ""}
          onClick={() => setCalendarView("semana")}
          style={viewButtonStyle(calendarView === "semana")}
        >
          Semana
        </button>

        <button
          type="button"
          className={calendarView === "dia" ? "active" : ""}
          onClick={() => setCalendarView("dia")}
          style={viewButtonStyle(calendarView === "dia")}
        >
          Dia
        </button>
      </div>

      <div
        className="calendar-tag-tabs"
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          padding: 0,
          margin: 0,
        }}
      >
        {CALENDAR_TAGS.map((tag) => {
          const isActive = activeCalendarTags.includes(tag.id);

          return (
            <button
              key={tag.id}
              type="button"
              className={isActive ? "active" : ""}
              onClick={() => toggleTag(tag.id)}
              style={tagButtonStyle(isActive)}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      <div
        className="calendar-month-nav"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          margin: "0",
        }}
      >
        <button type="button" onClick={goToPreviousPeriod} style={navButtonStyle}>
          ← {getPreviousLabel()}
        </button>

        <button type="button" onClick={goToNextPeriod} style={navButtonStyle}>
          {getNextLabel()} →
        </button>
      </div>

      <div
        className={`reference-calendar-card ${
          calendarView === "semana" ? "week-view" : calendarView === "dia" ? "day-view" : ""
        }`}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(45, 29, 23, 0.09)",
          background:
            "linear-gradient(180deg, rgba(255, 252, 246, 0.92), rgba(250, 245, 237, 0.82))",
          boxShadow: "0 16px 34px rgba(45, 29, 23, 0.07)",
          overflow: "hidden",
        }}
      >
        <div
          className="reference-calendar-weekdays"
          style={{
            ...calendarGridStyle,
            minHeight: 30,
            background: "rgba(255, 252, 246, 0.72)",
            borderBottom: "1px solid rgba(45, 29, 23, 0.08)",
          }}
        >
          {calendarView === "dia" ? (
            <span style={{ color: "#5a4034", fontSize: "0.62rem" }}>Dia</span>
          ) : (
            <>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((weekday) => (
                <span key={weekday} style={{ color: "#5a4034", fontSize: "0.62rem" }}>
                  {weekday}
                </span>
              ))}
            </>
          )}
        </div>

        <div className="reference-calendar-grid" style={calendarGridStyle}>
          {calendarCells.map((cell) => {
            const dayEvents = eventsByDate[cell.iso] || [];
            const isSelected = selectedCalendarDate === cell.iso;
            const maxEvents = calendarView === "dia" ? 8 : calendarView === "semana" ? 2 : 2;

            return (
              <button
                type="button"
                key={cell.iso}
                className={`reference-calendar-day ${!cell.isCurrentMonth ? "muted" : ""} ${
                  cell.isToday ? "today" : ""
                } ${isSelected ? "selected" : ""}`}
                onClick={() => selectDay(cell.iso)}
                style={{
                  minHeight: calendarView === "mes" ? 64 : calendarView === "semana" ? 82 : 72,
                  padding: "6px 5px",
                  borderColor: isSelected ? "#2d1d17" : "rgba(45, 29, 23, 0.07)",
                  background: isSelected
                    ? "linear-gradient(180deg, rgba(255,252,246,0.98), rgba(245,236,225,0.92))"
                    : cell.isToday
                      ? "rgba(177, 111, 83, 0.08)"
                      : "rgba(255, 252, 246, 0.36)",
                  boxShadow: isSelected ? "inset 0 0 0 1px rgba(45, 29, 23, 0.62)" : "none",
                }}
              >
                <span
                  className="reference-day-number"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: "inline-grid",
                    placeItems: "center",
                    marginLeft: "auto",
                    marginBottom: 4,
                    color: isSelected ? "#fff8ee" : cell.isToday ? "#9b5d45" : "#31221d",
                    background: isSelected ? "#2d1d17" : cell.isToday ? "rgba(177, 111, 83, 0.14)" : "transparent",
                    fontSize: "0.66rem",
                    fontWeight: 900,
                  }}
                >
                  {cell.day}
                </span>

                <div className="reference-day-events" style={{ gap: 3 }}>
                  {dayEvents.slice(0, maxEvents).map((event) => (
                    <span
                      key={event.id}
                      className="reference-event-pill"
                      style={{
                        borderLeftColor: event.color,
                        color: "#6d4d40",
                        background: "rgba(255, 248, 239, 0.78)",
                        border: "1px solid rgba(45, 29, 23, 0.07)",
                        borderLeftWidth: 3,
                        borderRadius: 7,
                        minHeight: 17,
                        padding: "1px 4px",
                        fontSize: "0.54rem",
                        fontWeight: 900,
                      }}
                    >
                      {event.title}
                    </span>
                  ))}

                  {dayEvents.length > maxEvents ? (
                    <small
                      className="reference-more-events"
                      style={{
                        color: "#9a7768",
                        fontSize: "0.54rem",
                        fontWeight: 900,
                      }}
                    >
                      +{dayEvents.length - maxEvents} mais
                    </small>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="calendar-day-details"
        ref={detailRef}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(45, 29, 23, 0.08)",
          background:
            "linear-gradient(180deg, rgba(255, 252, 246, 0.92), rgba(250, 245, 237, 0.82))",
          boxShadow: "0 16px 34px rgba(45, 29, 23, 0.07)",
          overflow: "hidden",
        }}
      >
        <div
          className="calendar-day-details-header"
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(45, 29, 23, 0.08)",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 4px",
                color: "#9a7768",
                fontSize: "0.54rem",
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Selecionado
            </p>

            <h2 style={{ fontSize: "0.92rem", lineHeight: 1.05, margin: 0 }}>
              {formatLongDate(selectedCalendarDate)}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onOpenCreateChoice(selectedCalendarDate)}
            style={{
              minHeight: 34,
              borderRadius: 13,
              background: "linear-gradient(135deg, #2d1d17, #3b281f)",
              color: "#fff8ee",
              border: 0,
              boxShadow: "0 10px 22px rgba(45, 29, 23, 0.14)",
              padding: "0 12px",
              fontSize: "0.68rem",
              fontWeight: 900,
            }}
          >
            + Cadastrar
          </button>
        </div>

        <div className="calendar-day-details-body" style={{ padding: 14 }}>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "0.9rem",
              letterSpacing: "-0.04em",
            }}
          >
            Compromissos
          </h3>

          {selectedDayEvents.length ? (
            <div className="calendar-day-event-list" style={{ gap: 8 }}>
              {selectedDayEvents.map((event) => (
                <article
                  className="calendar-day-event-card"
                  key={event.id}
                  style={{
                    padding: 10,
                    borderRadius: 16,
                    border: "1px solid rgba(45, 29, 23, 0.09)",
                    background: "rgba(255, 252, 246, 0.70)",
                    boxShadow: "none",
                  }}
                >
                  <span
                    className="calendar-day-event-dot"
                    style={{
                      backgroundColor: event.color,
                      width: 10,
                      height: 10,
                      marginTop: 5,
                    }}
                  />

                  <div className="calendar-day-event-content">
                    <div className="calendar-day-event-top">
                      <div>
                        <strong style={{ fontSize: "0.82rem", lineHeight: 1.08 }}>
                          {event.title}
                        </strong>

                        {event.startTime || event.endTime ? (
                          <small style={{ color: "#8a6a5b", fontSize: "0.66rem" }}>
                            {event.startTime || "--:--"}
                            {event.endTime ? ` – ${event.endTime}` : ""}
                          </small>
                        ) : null}
                      </div>

                      <span
                        style={{
                          borderRadius: 999,
                          background: "rgba(177, 111, 83, 0.10)",
                          color: "#9b5d45",
                          padding: "4px 8px",
                          fontSize: "0.52rem",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {getTagLabel(event.tag)}
                      </span>
                    </div>

                    {event.subtitle ? <p style={{ color: "#806052" }}>{event.subtitle}</p> : null}
                    {event.description ? <p style={{ color: "#806052" }}>{event.description}</p> : null}

                    <div className="calendar-day-event-actions">
                      {event.kind === "project" ? (
                        <button
                          type="button"
                          onClick={() => onEditProject(event.project)}
                          style={{
                            background: "rgba(45, 29, 23, 0.08)",
                            color: "#2d1d17",
                          }}
                        >
                          Editar projeto
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditCalendarEvent(event)}
                            style={{
                              background: "rgba(45, 29, 23, 0.08)",
                              color: "#2d1d17",
                            }}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => onDeleteCalendarEvent(event.id)}
                            style={{
                              background: "rgba(150, 40, 40, 0.10)",
                              color: "#8b2f2f",
                            }}
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
            <div
              className="calendar-empty-day"
              style={{
                minHeight: 64,
                borderRadius: 16,
                border: "1px dashed rgba(45, 29, 23, 0.14)",
                background: "rgba(255, 252, 246, 0.52)",
                color: "#806052",
                fontSize: "0.72rem",
              }}
            >
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
    const soldMonthProjects = monthProjects.filter(isSold);
    const soldProjects = projects.filter(isSold);

    return {
      sold: soldMonthProjects.reduce((sum, project) => sum + Number(project.amount || 0), 0),
      commission: soldProjects.reduce((sum, project) => sum + getCommission(project), 0),
      received: soldProjects.reduce((sum, project) => sum + getReceivedCommission(project), 0),
      pending: soldProjects.reduce((sum, project) => sum + getPendingCommission(project), 0),
      active: projects.filter(isActiveProject).length,
    };
  }, [monthProjects, projects]);

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

  const dashboardHub = useMemo(() => {
    const activeProjects = projects.filter(isActiveProject);

    const taskItems = projects.flatMap((project) =>
      getProjectTasks(project).map((task) => ({
        id: `task-${project.id}-${task.id}`,
        kind: "Tarefa",
        icon: "✓",
        title: task.title,
        date: task.dueDate,
        status: task.completed ? "Concluída" : "Pendente",
        project,
      }))
    );

    const scheduleItems = projects.flatMap((project) =>
      getProjectSchedule(project).map((item) => ({
        id: `schedule-${project.id}-${item.id}`,
        kind: "Cronograma",
        icon: "📅",
        title: item.title,
        date: item.date,
        status: item.status,
        project,
      }))
    );

    const budgetItems = projects.flatMap((project) =>
      getProjectBudgets(project).map((budget) => ({
        id: `budget-${project.id}-${budget.id}`,
        kind: "Orçamento",
        icon: "🧾",
        title: budget.title || budget.supplier || "Orçamento",
        date: budget.date,
        amount: budget.amount,
        status: budget.status,
        project,
      }))
    );

    const diaryItems = projects.flatMap((project) =>
      getProjectDiary(project).map((entry) => ({
        id: `diary-${project.id}-${entry.id}`,
        kind: entry.type || "Diário",
        icon: "✍",
        title: entry.title || entry.text || "Registro do diário",
        date: entry.date,
        pinned: entry.pinned,
        project,
      }))
    );

    const openTasks = taskItems.filter((item) => item.status !== "Concluída");
    const urgentTasks = openTasks
      .filter((item) => {
        const days = getDaysUntil(item.date);
        return days !== null && days <= 3;
      })
      .sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")));

    const openScheduleItems = scheduleItems.filter((item) => item.status !== "Concluído");
    const urgentScheduleItems = openScheduleItems
      .filter((item) => {
        const days = getDaysUntil(item.date);
        return days !== null && days <= 7;
      })
      .sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")));

    const sentBudgets = budgetItems
      .filter((item) => item.status === "Enviado")
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const pinnedDiary = diaryItems
      .filter((item) => item.pinned)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const budgetSummary = getBudgetSummary(budgetItems);

    const projectCards = activeProjects
      .map((project) => {
        const taskProgress = getTaskProgress(getProjectTasks(project));
        const scheduleProgress = getScheduleProgress(getProjectSchedule(project));
        const progressParts = [];

        if (taskProgress.total) progressParts.push(taskProgress.percent);
        if (scheduleProgress.total) progressParts.push(scheduleProgress.percent);

        const operationalProgress = progressParts.length
          ? Math.round(progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length)
          : 0;

        return {
          project,
          deadline: getProjectDeadline(project),
          operationalProgress,
          taskProgress,
          scheduleProgress,
          filesTotal: getProjectFiles(project).length,
          budgetsTotal: getProjectBudgets(project).length,
          diaryTotal: getProjectDiary(project).length,
        };
      })
      .sort((a, b) => {
        const dateA = a.deadline || "9999-99-99";
        const dateB = b.deadline || "9999-99-99";

        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return getProjectOrderValue(b.project).localeCompare(getProjectOrderValue(a.project));
      })
      .slice(0, 3);

    const focusItems = [
      ...urgentTasks.slice(0, 3),
      ...urgentScheduleItems.slice(0, 3),
      ...sentBudgets.slice(0, 2),
      ...pinnedDiary.slice(0, 2),
    ].slice(0, 6);

    return {
      activeProjects: activeProjects.length,
      tasksTotal: taskItems.length,
      tasksDone: taskItems.filter((item) => item.status === "Concluída").length,
      openTasks: openTasks.length,
      urgentTasks: urgentTasks.length,
      scheduleTotal: scheduleItems.length,
      scheduleDone: scheduleItems.filter((item) => item.status === "Concluído").length,
      openSchedule: openScheduleItems.length,
      urgentSchedule: urgentScheduleItems.length,
      filesTotal: projects.reduce((sum, project) => sum + getProjectFiles(project).length, 0),
      budgetItemsTotal: budgetSummary.totalItems,
      budgetApprovedTotal: budgetSummary.approvedTotal,
      budgetGrandTotal: budgetSummary.grandTotal,
      diaryTotal: diaryItems.length,
      pinnedDiaryTotal: pinnedDiary.length,
      projectCards,
      focusItems,
    };
  }, [projects]);

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
      schedule: getProjectSchedule(existingProject),
      scheduleProgress: existingProject?.scheduleProgress || 0,
      scheduleTotal: existingProject?.scheduleTotal || 0,
      scheduleDone: existingProject?.scheduleDone || 0,
      files: getProjectFiles(existingProject),
      filesTotal: getProjectFiles(existingProject).length,
      budgets: getProjectBudgets(existingProject),
      budgetsTotal: getProjectBudgets(existingProject).length,
      budgetsApprovedTotal: getBudgetSummary(getProjectBudgets(existingProject)).approvedTotal,
      budgetsGrandTotal: getBudgetSummary(getProjectBudgets(existingProject)).grandTotal,
      diaryEntries: getProjectDiary(existingProject),
      diaryTotal: getProjectDiary(existingProject).length,
      diaryPinnedTotal: getDiarySummary(getProjectDiary(existingProject)).pinnedCount,
      diaryLastDate: getDiarySummary(getProjectDiary(existingProject)).lastDate,
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

  function addProjectScheduleItem(projectId, scheduleFormPayload) {
    const title = String(scheduleFormPayload.title || "").trim();

    if (!title) {
      window.alert("Informe o nome da etapa.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentSchedule = getProjectSchedule(project);
          const newScheduleItem = {
            id: createId(),
            title,
            date: isValidDateString(scheduleFormPayload.date) ? scheduleFormPayload.date : "",
            status: normalizeScheduleStatus(scheduleFormPayload.status),
            note: String(scheduleFormPayload.note || "").trim(),
            position: currentSchedule.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return withProjectSchedule(project, [...currentSchedule, newScheduleItem]);
        })
      )
    );

    return true;
  }

  function updateProjectScheduleStatus(projectId, scheduleItemId, nextStatus) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextSchedule = getProjectSchedule(project).map((item) =>
            item.id === scheduleItemId
              ? {
                  ...item,
                  status: normalizeScheduleStatus(nextStatus),
                  updatedAt: new Date().toISOString(),
                }
              : item
          );

          return withProjectSchedule(project, nextSchedule);
        })
      )
    );
  }

  function deleteProjectScheduleItem(projectId, scheduleItemId) {
    const confirmDelete = window.confirm("Excluir esta etapa do cronograma?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextSchedule = getProjectSchedule(project).filter((item) => item.id !== scheduleItemId);

          return withProjectSchedule(project, nextSchedule);
        })
      )
    );
  }

  function createDefaultProjectSchedule(projectId) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentSchedule = getProjectSchedule(project);
          if (currentSchedule.length) return project;

          const defaultSchedule = DEFAULT_PROJECT_SCHEDULE.map((item, index) => ({
            id: createId(),
            title: item.title,
            date: getDefaultScheduleDate(project, item, index),
            status: "Pendente",
            note: "",
            position: index + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          return withProjectSchedule(project, defaultSchedule);
        })
      )
    );
  }


  function addProjectFile(projectId, fileFormPayload) {
    const title = String(fileFormPayload.title || "").trim();
    const url = normalizeUrl(fileFormPayload.url);
    const note = String(fileFormPayload.note || "").trim();

    if (!title && !url) {
      window.alert("Informe o nome do arquivo ou um link.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentFiles = getProjectFiles(project);
          const newFile = {
            id: createId(),
            title: title || url,
            url,
            category: normalizeFileCategory(fileFormPayload.category),
            note,
            favorite: false,
            position: currentFiles.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return withProjectFiles(project, [...currentFiles, newFile]);
        })
      )
    );

    return true;
  }

  function toggleProjectFileFavorite(projectId, fileId) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextFiles = getProjectFiles(project).map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  favorite: !file.favorite,
                  updatedAt: new Date().toISOString(),
                }
              : file
          );

          return withProjectFiles(project, nextFiles);
        })
      )
    );
  }

  function deleteProjectFile(projectId, fileId) {
    const confirmDelete = window.confirm("Excluir este arquivo/link do projeto?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextFiles = getProjectFiles(project).filter((file) => file.id !== fileId);

          return withProjectFiles(project, nextFiles);
        })
      )
    );
  }

  function addProjectBudget(projectId, budgetFormPayload) {
    const title = String(budgetFormPayload.title || "").trim();
    const supplier = String(budgetFormPayload.supplier || "").trim();
    const amount = parseMoney(budgetFormPayload.amount);
    const url = normalizeUrl(budgetFormPayload.url);
    const note = String(budgetFormPayload.note || "").trim();

    if (!title && !supplier && amount <= 0 && !url) {
      window.alert("Informe pelo menos o nome, fornecedor, valor ou link do orçamento.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentBudgets = getProjectBudgets(project);
          const newBudget = {
            id: createId(),
            title: title || supplier || "Orçamento",
            supplier,
            amount,
            date: isValidDateString(budgetFormPayload.date) ? budgetFormPayload.date : todayISO(),
            status: normalizeBudgetStatus(budgetFormPayload.status),
            url,
            note,
            position: currentBudgets.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return withProjectBudgets(project, [...currentBudgets, newBudget]);
        })
      )
    );

    return true;
  }

  function updateProjectBudgetStatus(projectId, budgetId, nextStatus) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextBudgets = getProjectBudgets(project).map((budget) =>
            budget.id === budgetId
              ? {
                  ...budget,
                  status: normalizeBudgetStatus(nextStatus),
                  updatedAt: new Date().toISOString(),
                }
              : budget
          );

          return withProjectBudgets(project, nextBudgets);
        })
      )
    );
  }

  function deleteProjectBudget(projectId, budgetId) {
    const confirmDelete = window.confirm("Excluir este orçamento do projeto?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextBudgets = getProjectBudgets(project).filter((budget) => budget.id !== budgetId);

          return withProjectBudgets(project, nextBudgets);
        })
      )
    );
  }

  function addProjectDiaryEntry(projectId, diaryFormPayload) {
    const title = String(diaryFormPayload.title || "").trim();
    const text = String(diaryFormPayload.text || "").trim();
    const nextStep = String(diaryFormPayload.nextStep || "").trim();

    if (!title && !text && !nextStep) {
      window.alert("Informe um título, registro ou próximo passo.");
      return false;
    }

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const currentEntries = getProjectDiary(project);
          const newEntry = {
            id: createId(),
            title: title || normalizeDiaryType(diaryFormPayload.type),
            date: isValidDateString(diaryFormPayload.date) ? diaryFormPayload.date : todayISO(),
            type: normalizeDiaryType(diaryFormPayload.type),
            text,
            nextStep,
            pinned: false,
            position: currentEntries.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return withProjectDiary(project, [...currentEntries, newEntry]);
        })
      )
    );

    return true;
  }

  function toggleProjectDiaryPin(projectId, diaryEntryId) {
    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextEntries = getProjectDiary(project).map((entry) =>
            entry.id === diaryEntryId
              ? {
                  ...entry,
                  pinned: !entry.pinned,
                  updatedAt: new Date().toISOString(),
                }
              : entry
          );

          return withProjectDiary(project, nextEntries);
        })
      )
    );
  }

  function deleteProjectDiaryEntry(projectId, diaryEntryId) {
    const confirmDelete = window.confirm("Excluir este registro do diário?");
    if (!confirmDelete) return;

    setProjects((current) =>
      normalizeProjectCodes(
        current.map((project) => {
          if (project.id !== projectId) return project;

          const nextEntries = getProjectDiary(project).filter((entry) => entry.id !== diaryEntryId);

          return withProjectDiary(project, nextEntries);
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
        <header
          className="topbar"
          style={{
            padding: "10px 0 9px",
            marginBottom: 8,
          }}
        >
          <div className="topbar-brand">
            <BrandLogo compact />
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
          <section className="page-section" style={{ gap: 10 }}>
            <section
              className="hero welcome-card"
              style={{
                minHeight: "auto",
                padding: "12px 16px",
                marginBottom: 12,
                borderRadius: 22,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(1.42rem, 5.6vw, 2rem)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.065em",
                }}
              >
                Vamos criar algo incrível, <span>Alexandre?</span>
              </h1>
            </section>

            <section className="summary-grid" style={{ gap: 10, marginBottom: 12 }}>
              <SummaryCard
                icon="▢"
                label="Vendido no mês"
                value={formatCurrency(summary.sold)}
                helper="Abrir projetos"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("Todos");
                  setActivePage("projetos");
                }}
              />

              <SummaryCard
                icon="▱"
                label="Projetos ativos"
                value={String(summary.active)}
                helper="Ver lista ativa"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("Ativos");
                  setActivePage("projetos");
                }}
              />

              <SummaryCard
                icon="↓"
                label="Recebido"
                value={formatCurrency(summary.received)}
                helper="Comissões recebidas"
                tone="received"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("Recebido");
                  setActivePage("projetos");
                }}
              />

              <SummaryCard
                icon="↑"
                label="A receber"
                value={formatCurrency(summary.pending)}
                helper="Pendentes e parciais"
                tone="pending"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("Ativos");
                  setActivePage("projetos");
                }}
              />
            </section>

            <section className="dashboard-grid" style={{ gap: 10, marginTop: 2 }}>
              <div
                className="panel side-panel"
                style={{
                  padding: 14,
                  borderRadius: 22,
                }}
              >
                <div className="panel-header compact" style={{ marginBottom: 8 }}>
                  <div>
                    <p>Central</p>
                    <h2 style={{ fontSize: "1.18rem", lineHeight: 1.02 }}>Projetos em andamento</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePage("projetos")}
                    style={{ fontSize: "0.82rem", lineHeight: 1.05 }}
                  >
                    Ver projetos
                  </button>
                </div>

                <div
                  className="project-lines"
                  style={{
                    display: "grid",
                    gap: 6,
                    maxHeight: 166,
                    overflowY: "auto",
                    paddingRight: 2,
                  }}
                >
                  {dashboardHub.projectCards.length ? (
                    <>
                      {dashboardHub.projectCards.map((item) => {
                        const deadlineLabel = item.deadline ? formatDaysUntil(item.deadline) : "Sem prazo";

                        return (
                          <button
                            type="button"
                            className="launch-line"
                            key={item.project.id}
                            onClick={() => openProjectDetails(item.project, item.project.projectCode)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto minmax(0, 1fr) auto",
                              alignItems: "center",
                              gap: 8,
                              padding: "7px 9px",
                              minHeight: 44,
                              borderRadius: 15,
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 26,
                                borderRadius: 999,
                                backgroundColor: item.project.color || EVENT_COLORS[0],
                              }}
                            />

                            <div style={{ minWidth: 0 }}>
                              <strong
                                style={{
                                  display: "block",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  fontSize: "0.86rem",
                                  lineHeight: 1.05,
                                  marginTop: 1,
                                }}
                              >
                                {getProjectClient(item.project)}
                              </strong>

                              <span
                                style={{
                                  display: "block",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  fontSize: "0.72rem",
                                  lineHeight: 1.12,
                                }}
                              >
                                {item.project.projectCode || "Sem código"} · {getProjectTitle(item.project)}
                              </span>
                            </div>

                            <span style={{ whiteSpace: "nowrap", fontSize: "0.72rem" }}>{deadlineLabel}</span>
                          </button>
                        );
                      })}

                      {summary.active > dashboardHub.projectCards.length ? (
                        <button
                          type="button"
                          className="soft-empty"
                          onClick={() => setActivePage("projetos")}
                          style={{ cursor: "pointer", padding: "8px 10px", borderRadius: 15, fontSize: "0.75rem" }}
                        >
                          +{summary.active - dashboardHub.projectCards.length} projetos ativos na aba Projetos
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div
                      className="soft-empty"
                      style={{ padding: "10px 10px", minHeight: 0, borderRadius: 15, fontSize: "0.76rem" }}
                    >
                      Nenhum projeto ativo para acompanhar agora.
                    </div>
                  )}
                </div>
              </div>

              <aside className="side-stack">
                <div
                  className="panel side-panel"
                  style={{ padding: 14, borderRadius: 22 }}
                >
                  <div className="panel-header compact" style={{ marginBottom: 8 }}>
                    <div>
                      <p>Atenção</p>
                      <h2 style={{ fontSize: "1.12rem", lineHeight: 1.02 }}>Prioridades do dia</h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePage("calendario")}
                      style={{ fontSize: "0.82rem", lineHeight: 1.05 }}
                    >
                      Calendário
                    </button>
                  </div>

                  <div className="project-lines">
                    {dashboardHub.focusItems.length ? (
                      dashboardHub.focusItems.map((item) => (
                        <button
                          type="button"
                          className="launch-line"
                          key={item.id}
                          onClick={() => openProjectDetails(item.project, item.project.projectCode)}
                          style={{ padding: "7px 9px", minHeight: 44, borderRadius: 15 }}
                        >
                          <div>
                            <strong>
                              {item.icon} {item.title}
                            </strong>
                            <span>
                              {item.kind} · {getProjectClient(item.project)}
                              {item.amount ? ` · ${formatCurrency(item.amount)}` : ""}
                            </span>
                          </div>

                          <span>{item.date ? formatDaysUntil(item.date) : item.status || "Fixado"}</span>
                        </button>
                      ))
                    ) : (
                      <div
                        className="soft-empty"
                        style={{ padding: "10px 10px", minHeight: 0, borderRadius: 15, fontSize: "0.76rem" }}
                      >
                        Nenhuma tarefa, etapa ou orçamento urgente agora.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="panel side-panel"
                  style={{ padding: 14, borderRadius: 22 }}
                >
                  <div className="panel-header compact" style={{ marginBottom: 8 }}>
                    <div>
                      <p>Próximos</p>
                      <h2 style={{ fontSize: "1.12rem", lineHeight: 1.02 }}>Entregas e lançamentos</h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePage("calendario")}
                      style={{ fontSize: "0.82rem", lineHeight: 1.05 }}
                    >
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
                          onClick={() => openProjectDetails(project, project.projectCode)}
                          style={{ padding: "7px 9px", minHeight: 44, borderRadius: 15 }}
                        >
                          <div>
                            <strong>{project.client || "Cliente sem nome"}</strong>
                            <span>{project.development || project.project || "Projeto"}</span>
                          </div>

                          <span>{formatDate(getProjectDeadline(project))}</span>
                        </button>
                      ))
                    ) : (
                      <div
                        className="soft-empty"
                        style={{ padding: "10px 10px", minHeight: 0, borderRadius: 15, fontSize: "0.76rem" }}
                      >
                        Nenhum próximo lançamento cadastrado.
                      </div>
                    )}
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
          <section className="page-section" data-build-marker="PROJETOS_SEM_CABECALHO_V2">
            <section
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                marginBottom: 8,
                padding: "0 4px 0 0",
              }}
            >
              <button
                type="button"
                className="primary-button"
                onClick={() => openNewProject()}
                style={{
                  width: "fit-content",
                  minWidth: 118,
                  minHeight: 30,
                  padding: "0 12px",
                  borderRadius: 13,
                  fontSize: "0.68rem",
                  letterSpacing: "-0.02em",
                  boxShadow: "0 8px 18px rgba(45, 29, 23, 0.12)",
                }}
              >
                + Novo projeto
              </button>
            </section>

            <div className="filters" style={{ marginTop: 0, padding: 14, borderRadius: 22 }}>
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
          onAddScheduleItem={addProjectScheduleItem}
          onUpdateScheduleItemStatus={updateProjectScheduleStatus}
          onDeleteScheduleItem={deleteProjectScheduleItem}
          onCreateDefaultSchedule={createDefaultProjectSchedule}
          onAddFile={addProjectFile}
          onDeleteFile={deleteProjectFile}
          onToggleFileFavorite={toggleProjectFileFavorite}
          onAddBudget={addProjectBudget}
          onUpdateBudgetStatus={updateProjectBudgetStatus}
          onDeleteBudget={deleteProjectBudget}
          onAddDiaryEntry={addProjectDiaryEntry}
          onToggleDiaryPin={toggleProjectDiaryPin}
          onDeleteDiaryEntry={deleteProjectDiaryEntry}
        />
      ) : null}
    </main>
  );
}