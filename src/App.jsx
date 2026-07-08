import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "alexandre-dias-gestao-projetos-v1";
const PAGE_STORAGE_KEY = "alexandre-dias-gestao-projetos-pagina-atual";
const CALENDAR_EVENTS_STORAGE_KEY = "alexandre-dias-gestao-projetos-eventos-calendario-v2";
const CALENDAR_VIEW_STORAGE_KEY = "alexandre-dias-gestao-projetos-calendario-visualizacao";

const STATUS_OPTIONS = ["Orçamento", "A receber", "Parcial", "Recebido", "Cancelado"];
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

function addMonths(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(date);
}

function getShortMonthNameFromDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(date);
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
    return savedView === "semana" ? "semana" : "mes";
  } catch {
    return "mes";
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

  const date = parseISODate(dateString);

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

function formatWeekLabel(selectedDate) {
  const date = parseISODate(selectedDate);
  const start = addDays(date, -date.getDay());
  const end = addDays(start, 6);

  const startDay = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(start);

  const endDay = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end);

  return `${startDay} – ${endDay}`;
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

function emptyProjectForm(date = todayISO()) {
  return {
    date,
    development: "",
    client: "",
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

function loadProjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
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

function getWeekCells(selectedDate) {
  const date = parseISODate(selectedDate);
  const start = addDays(date, -date.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const weekDate = addDays(start, index);
    const iso = toISODate(weekDate);

    return {
      iso,
      day: weekDate.getDate(),
      isCurrentMonth: true,
      isToday: iso === todayISO(),
    };
  });
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
            <th>Data</th>
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
          {projects.map((item) => {
            const pendingCommission = getPendingCommission(item);

            return (
              <tr key={item.id}>
                <td>{formatDate(item.date)}</td>
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
            Data
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
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

  const monthDate = useMemo(() => {
    const [year, monthNumber] = monthToUse.split("-").map(Number);
    return new Date(year, monthNumber - 1, 1);
  }, [monthToUse]);

  const previousMonthDate = addMonths(monthDate, -1);
  const nextMonthDate = addMonths(monthDate, 1);

  const calendarCells =
    calendarView === "semana" ? getWeekCells(selectedCalendarDate) : getMonthCells(monthToUse);

  const projectCalendarEvents = useMemo(() => {
    return projects.map((project) => ({
      id: `project-${project.id}`,
      kind: "project",
      tag: "Projeto",
      title: project.client || project.development || project.project || "Projeto",
      subtitle: project.development || project.project || "",
      description: project.note || "",
      date: project.date,
      color: project.color || EVENT_COLORS[0],
      project,
    }));
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

  function goToPreviousPeriod() {
    if (calendarView === "semana") {
      const previousWeek = addDays(parseISODate(selectedCalendarDate), -7);
      setSelectedCalendarDate(toISODate(previousWeek));
      setMonth(getMonthKey(previousWeek));
      return;
    }

    setMonth(getMonthKey(previousMonthDate));
  }

  function goToNextPeriod() {
    if (calendarView === "semana") {
      const nextWeek = addDays(parseISODate(selectedCalendarDate), 7);
      setSelectedCalendarDate(toISODate(nextWeek));
      setMonth(getMonthKey(nextWeek));
      return;
    }

    setMonth(getMonthKey(nextMonthDate));
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
    setMonth(date.slice(0, 7));

    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  return (
    <section className="calendar-reference-page">
      <div className="calendar-reference-header">
        <div>
          <h1>{calendarView === "semana" ? formatWeekLabel(selectedCalendarDate) : formatMonthLabel(monthToUse)}</h1>
        </div>

        <div className="calendar-view-toggle">
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
        </div>
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
          ← {calendarView === "semana" ? "Semana" : getShortMonthNameFromDate(previousMonthDate)}
        </button>

        <button type="button" onClick={goToNextPeriod}>
          {calendarView === "semana" ? "Semana" : getShortMonthNameFromDate(nextMonthDate)} →
        </button>
      </div>

      <div className={`reference-calendar-card ${calendarView === "semana" ? "week-view" : ""}`}>
        <div className="reference-calendar-weekdays">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        <div className="reference-calendar-grid">
          {calendarCells.map((cell) => {
            const dayEvents = eventsByDate[cell.iso] || [];
            const isSelected = selectedCalendarDate === cell.iso;

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
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="reference-event-pill"
                      style={{ borderLeftColor: event.color, color: event.color }}
                    >
                      {event.title}
                    </span>
                  ))}

                  {dayEvents.length > 3 ? (
                    <small className="reference-more-events">+{dayEvents.length - 3} mais</small>
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
  const [projects, setProjects] = useState(loadProjects);
  const [calendarEvents, setCalendarEvents] = useState(loadCalendarEvents);
  const [activePage, setActivePage] = useState(loadActivePage);
  const [calendarView, setCalendarView] = useState(loadCalendarView);

  const [form, setForm] = useState(emptyProjectForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const [activeCalendarTags, setActiveCalendarTags] = useState(CALENDAR_TAGS.map((tag) => tag.id));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayISO());

  const [isCreateChoiceOpen, setIsCreateChoiceOpen] = useState(false);
  const [calendarEventForm, setCalendarEventForm] = useState(null);

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

  const monthProjects = useMemo(() => {
    if (!selectedMonth) return projects;
    return projects.filter((project) => project.date?.startsWith(selectedMonth));
  }, [projects, selectedMonth]);

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return monthProjects
      .filter((project) => {
        if (statusFilter !== "Todos" && getDisplayStatus(project) !== statusFilter) return false;
        if (!term) return true;

        return [
          project.date,
          project.development,
          project.client,
          project.consultant,
          project.project,
          getDisplayStatus(project),
          project.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthProjects, search, statusFilter]);

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
      .filter((project) => project.date >= todayISO() && project.status !== "Cancelado")
      .sort((a, b) => a.date.localeCompare(b.date))
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
    setForm(emptyProjectForm(date));
    setIsFormOpen(true);
  }

  function openEditProject(project) {
    setEditingId(project.id);
    setForm({
      date: project.date || todayISO(),
      development: project.development || "",
      client: project.client || "",
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
      date: form.date,
      development: form.development.trim(),
      client: form.client.trim(),
      consultant: form.consultant.trim(),
      project: form.project.trim(),
      amount,
      commissionPercent,
      receivedAmount,
      receivedDate,
      status,
      note: form.note.trim(),
      color: form.color || EVENT_COLORS[0],
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      setProjects((current) => current.map((item) => (item.id === editingId ? payload : item)));
    } else {
      setProjects((current) => [payload, ...current]);
    }

    setSelectedCalendarDate(payload.date);
    setSelectedMonth(payload.date.slice(0, 7));
    closeForm();
  }

  function deleteProject(id) {
    const confirmDelete = window.confirm("Tem certeza que deseja excluir este projeto?");
    if (!confirmDelete) return;

    setProjects((current) => current.filter((project) => project.id !== id));
  }

  function markAsReceived(id) {
    setProjects((current) =>
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
    );
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

                        <span>{formatDate(project.date)}</span>
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
                <small>Lista compacta para acompanhar clientes, comissões e recebimentos.</small>
              </div>

              <button type="button" className="primary-button" onClick={() => openNewProject()}>
                + Novo projeto
              </button>
            </section>

            <div className="filters">
              <input
                type="search"
                value={search}
                placeholder="Buscar por cliente, empreendimento, consultor ou projeto..."
                onChange={(event) => setSearch(event.target.value)}
              />

              <button type="button" className="calendar-open-button" onClick={() => setActivePage("calendario")}>
                <span>📅</span>
                {formatMonthLabel(selectedMonth)}
              </button>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="Todos">Todos</option>

                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => setSelectedMonth("")}>
                Ver todos
              </button>
            </div>

            <ProjectTable
              projects={visibleProjects}
              onEdit={openEditProject}
              onDelete={deleteProject}
              onMarkReceived={markAsReceived}
              emptyMessage="Nenhum projeto encontrado com esses filtros."
            />
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
    </main>
  );
}