import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "alexandre-dias-gestao-projetos-v1";

const STATUS_OPTIONS = ["Orçamento", "A receber", "Parcial", "Recebido", "Cancelado"];

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  if (hasComma) {
    return `${integerFormatted},${decimalDigits}`;
  }

  return integerFormatted;
}

function formatMoneyInputFromNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

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

  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return "-";

  return `${day}/${month}/${year}`;
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

function emptyProjectForm() {
  return {
    date: todayISO(),
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

function StatusBadge({ status }) {
  return <span className={`status status-${getStatusClass(status)}`}>{status}</span>;
}

function SummaryCard({ label, value, helper }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function ProjectTable({ projects, onEdit, onDelete, onMarkReceived, emptyMessage }) {
  if (!projects.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

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
      <div className="modal">
        <div className="modal-header">
          <div>
            <p>{editingId ? "Editar lançamento" : "Novo lançamento"}</p>
            <h2>{editingId ? "Editar projeto" : "Cadastrar projeto"}</h2>
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
              placeholder="Ex: Brava Home Resort"
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
              placeholder="Ex: Cozinha, dormitório, apto completo"
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

function CalendarModal({
  month,
  setMonth,
  selectedDate,
  setSelectedDate,
  projects,
  onClose,
  onEdit,
  onDelete,
  onMarkReceived,
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const startWeekday = firstDay.getDay();

  const cells = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(date);
  }

  const projectsByDate = projects.reduce((acc, project) => {
    if (!acc[project.date]) acc[project.date] = [];
    acc[project.date].push(project);
    return acc;
  }, {});

  const selectedDayProjects = selectedDate
    ? [...(projectsByDate[selectedDate] || [])].sort((a, b) => a.client.localeCompare(b.client))
    : [];

  function changeMonth(direction) {
    const next = new Date(year, monthNumber - 1 + direction, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    setMonth(nextMonth);
    setSelectedDate(null);
  }

  function goToCurrentMonth() {
    setMonth(todayISO().slice(0, 7));
    setSelectedDate(null);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal calendar-modal">
        <div className="modal-header">
          <div>
            <p>Calendário de projetos</p>
            <h2>{formatMonthLabel(month)}</h2>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="calendar-toolbar">
          <button type="button" onClick={() => changeMonth(-1)}>
            ← Mês anterior
          </button>

          <button type="button" onClick={goToCurrentMonth}>
            Mês atual
          </button>

          <button type="button" onClick={() => changeMonth(1)}>
            Próximo mês →
          </button>
        </div>

        <div className="calendar-grid calendar-weekdays">
          <span>Dom</span>
          <span>Seg</span>
          <span>Ter</span>
          <span>Qua</span>
          <span>Qui</span>
          <span>Sex</span>
          <span>Sáb</span>
        </div>

        <div className="calendar-grid">
          {cells.map((date, index) => {
            const dayProjects = date ? projectsByDate[date] || [] : [];
            const day = date ? Number(date.slice(-2)) : "";
            const isSelected = date && selectedDate === date;

            return (
              <button
                key={`${date || "empty"}-${index}`}
                type="button"
                className={`calendar-day ${!date ? "is-empty" : ""} ${
                  dayProjects.length ? "has-projects" : ""
                } ${isSelected ? "is-selected" : ""}`}
                disabled={!date}
                onClick={() => setSelectedDate(date)}
              >
                <strong>{day}</strong>

                {dayProjects.length ? (
                  <span>
                    {dayProjects.length} {dayProjects.length === 1 ? "projeto" : "projetos"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedDate ? (
          <div className="calendar-details">
            <div className="calendar-details-header">
              <div>
                <p>Projetos da data</p>
                <h3>{formatDate(selectedDate)}</h3>
              </div>
            </div>

            <ProjectTable
              projects={selectedDayProjects}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkReceived={onMarkReceived}
              emptyMessage="Nenhum projeto lançado nessa data."
            />
          </div>
        ) : (
          <div className="calendar-hint">
            Clique em uma data para ver os clientes e projetos registrados naquele dia.
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState(loadProjects);
  const [activePage, setActivePage] = useState("resumo");

  const [form, setForm] = useState(emptyProjectForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(todayISO().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const monthProjects = useMemo(() => {
    if (!selectedMonth) return projects;
    return projects.filter((project) => project.date?.startsWith(selectedMonth));
  }, [projects, selectedMonth]);

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return monthProjects
      .filter((project) => {
        if (statusFilter !== "Todos" && getDisplayStatus(project) !== statusFilter) {
          return false;
        }

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
    };
  }, [monthProjects]);

  function openNewProject() {
    setEditingId(null);
    setForm(emptyProjectForm());
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
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyProjectForm());
    setIsFormOpen(false);
  }

  function handleCalendarMonthChange(nextMonth) {
    setCalendarMonth(nextMonth);
    setSelectedMonth(nextMonth);
  }

  function openCalendar() {
    const monthToOpen = selectedMonth || todayISO().slice(0, 7);
    setCalendarMonth(monthToOpen);
    setSelectedDate(null);
    setIsCalendarOpen(true);
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
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      setProjects((current) => current.map((item) => (item.id === editingId ? payload : item)));
    } else {
      setProjects((current) => [payload, ...current]);
    }

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

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AD</div>

          <div>
            <strong>Alexandre Dias | Interiores</strong>
            <span>Gestão de Projetos</span>
          </div>
        </div>

        <nav>
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
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>Alexandre Dias | Interiores</p>
            <h1>Gestão de Projetos</h1>
          </div>

          <button type="button" className="primary-button" onClick={openNewProject}>
            + Novo projeto
          </button>
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
        </div>

        {activePage === "resumo" ? (
          <section className="page-section">
            <div className="section-header">
              <div>
                <p>Resumo financeiro</p>
                <h1>{formatMonthLabel(selectedMonth)}</h1>
              </div>

              <div className="filters-inline">
                <button type="button" className="calendar-open-button" onClick={openCalendar}>
                  <span>📅</span>
                  {formatMonthLabel(selectedMonth)}
                </button>
              </div>
            </div>

            <div className="summary-grid">
              <SummaryCard
                label="Vendido no mês"
                value={formatCurrency(summary.sold)}
                helper="Sem orçamentos e cancelados"
              />

              <SummaryCard
                label="Comissão prevista"
                value={formatCurrency(summary.commission)}
                helper="Total calculado"
              />

              <SummaryCard
                label="Recebido"
                value={formatCurrency(summary.received)}
                helper="Comissão já recebida"
              />

              <SummaryCard
                label="A receber"
                value={formatCurrency(summary.pending)}
                helper="Comissão pendente"
              />
            </div>
          </section>
        ) : null}

        {activePage === "projetos" ? (
          <section className="page-section">
            <div className="section-header">
              <div>
                <h1>Projetos</h1>
              </div>
            </div>

            <div className="filters">
              <input
                type="search"
                value={search}
                placeholder="Buscar por data, empreendimento, cliente, consultor ou projeto..."
                onChange={(event) => setSearch(event.target.value)}
              />

              <button type="button" className="calendar-open-button" onClick={openCalendar}>
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

      {isCalendarOpen ? (
        <CalendarModal
          month={calendarMonth}
          setMonth={handleCalendarMonthChange}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          projects={projects}
          onClose={() => setIsCalendarOpen(false)}
          onEdit={(project) => {
            setIsCalendarOpen(false);
            openEditProject(project);
          }}
          onDelete={deleteProject}
          onMarkReceived={markAsReceived}
        />
      ) : null}
    </main>
  );
}