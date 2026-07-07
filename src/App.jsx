import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "gestao-projetos-arq-v2";

const WEEK_DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const SAMPLE_PROJECTS = [
  {
    id: "1",
    date: "2026-07-07",
    enterprise: "Paganini Tower",
    client: "Hilda",
    consultant: "Paula",
    projectName: "Ap. Completo",
    saleValue: 120000,
    commissionPercent: 5,
    receivedValue: 0,
  },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function parseMoneyBR(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(cleaned);
  return Number.isNaN(number) ? 0 : number;
}

function getCommissionTotal(project) {
  return (Number(project.saleValue || 0) * Number(project.commissionPercent || 0)) / 100;
}

function getPendingValue(project) {
  const pending = getCommissionTotal(project) - Number(project.receivedValue || 0);
  return pending > 0 ? pending : 0;
}

function getProjectStatus(project) {
  const total = getCommissionTotal(project);
  const received = Number(project.receivedValue || 0);

  if (received <= 0) return "a_receber";
  if (received >= total) return "recebido";
  return "parcial";
}

function getMonthLabel(date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function toMonthTitle(date) {
  const label = getMonthLabel(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthKeyFromISO(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameDay(dateA, dateB) {
  return dateA === dateB;
}

function buildCalendarDays(currentMonth) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];

  for (let i = 0; i < startDayOfWeek; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    days.push(iso);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SAMPLE_PROJECTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : SAMPLE_PROJECTS;
  } catch {
    return SAMPLE_PROJECTS;
  }
}

function App() {
  const [projects, setProjects] = useState(loadProjects);
  const [activeTab, setActiveTab] = useState("summary");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const first = SAMPLE_PROJECTS[0]?.date || new Date().toISOString().slice(0, 10);
    const d = new Date(`${first}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(SAMPLE_PROJECTS[0]?.date || new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const monthKey = getMonthKeyFromDate(currentMonth);

  const projectsOfMonth = useMemo(() => {
    return projects.filter((project) => getMonthKeyFromISO(project.date) === monthKey);
  }, [projects, monthKey]);

  const selectedDateProjects = useMemo(() => {
    return projects
      .filter((project) => project.date === selectedDate)
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [projects, selectedDate]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const searchBase = [
          project.client,
          project.enterprise,
          project.consultant,
          project.projectName,
          formatDateBR(project.date),
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchBase.includes(searchTerm.toLowerCase());

        if (statusFilter === "todos") return matchesSearch;
        return matchesSearch && getProjectStatus(project) === statusFilter;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const sold = projectsOfMonth.reduce((acc, item) => acc + Number(item.saleValue || 0), 0);
    const commission = projectsOfMonth.reduce((acc, item) => acc + getCommissionTotal(item), 0);
    const received = projectsOfMonth.reduce((acc, item) => acc + Number(item.receivedValue || 0), 0);
    const pending = projectsOfMonth.reduce((acc, item) => acc + getPendingValue(item), 0);

    return {
      sold,
      commission,
      received,
      pending,
      activeProjects: projectsOfMonth.length,
    };
  }, [projectsOfMonth]);

  const upcomingProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  }, [projects]);

  const pendingProjects = useMemo(() => {
    return projects.filter((project) => getPendingValue(project) > 0).slice(0, 5);
  }, [projects]);

  const receiveProgress = summary.commission > 0 ? (summary.received / summary.commission) * 100 : 0;

  function openNewProject(date = selectedDate) {
    setEditingProject({
      id: null,
      date: date || new Date().toISOString().slice(0, 10),
      enterprise: "",
      client: "",
      consultant: "Paula",
      projectName: "",
      saleValue: "",
      commissionPercent: "5",
      receivedValue: "",
    });
    setIsModalOpen(true);
  }

  function openEditProject(project) {
    setEditingProject({
      ...project,
      saleValue: Number(project.saleValue || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      receivedValue: Number(project.receivedValue || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      commissionPercent: String(project.commissionPercent ?? 5),
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProject(null);
  }

  function handleSaveProject(formValues) {
    const normalized = {
      id: formValues.id || uid(),
      date: formValues.date,
      enterprise: formValues.enterprise.trim(),
      client: formValues.client.trim(),
      consultant: formValues.consultant.trim(),
      projectName: formValues.projectName.trim(),
      saleValue: parseMoneyBR(formValues.saleValue),
      commissionPercent: Number(formValues.commissionPercent || 0),
      receivedValue: parseMoneyBR(formValues.receivedValue),
    };

    setProjects((prev) => {
      const exists = prev.some((item) => item.id === normalized.id);

      if (exists) {
        return prev.map((item) => (item.id === normalized.id ? normalized : item));
      }

      return [...prev, normalized];
    });

    setSelectedDate(normalized.date);
    setCurrentMonth(new Date(`${normalized.date}T12:00:00`));
    closeModal();
  }

  function handleDeleteProject(projectId) {
    const confirmed = window.confirm("Deseja excluir este lançamento?");
    if (!confirmed) return;

    setProjects((prev) => prev.filter((item) => item.id !== projectId));
  }

  function handleMarkReceived(projectId) {
    setProjects((prev) =>
      prev.map((item) => {
        if (item.id !== projectId) return item;
        return {
          ...item,
          receivedValue: getCommissionTotal(item),
        };
      })
    );
  }

  function goToPreviousMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function goToCurrentMonth() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setCurrentMonth(firstDay);
    setSelectedDate(now.toISOString().slice(0, 10));
  }

  const calendarDays = buildCalendarDays(currentMonth);

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <div className="sidebar__brand-text">
              <h1>Alexandre Dias | Interiores</h1>
              <span>Gestão de Projetos</span>
            </div>
          </div>

          <nav className="sidebar__nav">
            <button
              className={`sidebar__nav-button ${activeTab === "summary" ? "is-active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              Resumo
            </button>

            <button
              className={`sidebar__nav-button ${activeTab === "projects" ? "is-active" : ""}`}
              onClick={() => setActiveTab("projects")}
            >
              Projetos
            </button>

            <button
              className={`sidebar__nav-button ${activeTab === "calendar" ? "is-active" : ""}`}
              onClick={() => setActiveTab("calendar")}
            >
              Calendário
            </button>
          </nav>

          <div className="sidebar__footer">
            <strong>Alexandre Dias</strong>
            <span>Arquitetura & Interiores</span>
          </div>
        </aside>

        <main className="content">
          <header className="topbar">
            <div className="topbar__brand">
              <h2>Alexandre Dias | Interiores</h2>
              <span>Gestão de Projetos</span>
            </div>

            <div className="topbar__actions">
              <button className="ghost-button" onClick={() => setActiveTab("calendar")}>
                Calendário
              </button>
              <button className="primary-button" onClick={() => openNewProject()}>
                + Novo projeto
              </button>
            </div>
          </header>

          <div className="mobile-tabs">
            <button
              className={`mobile-tabs__button ${activeTab === "summary" ? "is-active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              Resumo
            </button>
            <button
              className={`mobile-tabs__button ${activeTab === "projects" ? "is-active" : ""}`}
              onClick={() => setActiveTab("projects")}
            >
              Projetos
            </button>
            <button
              className={`mobile-tabs__button ${activeTab === "calendar" ? "is-active" : ""}`}
              onClick={() => setActiveTab("calendar")}
            >
              Calendário
            </button>
          </div>

          {activeTab === "summary" && (
            <section className="page">
              <div className="hero-card">
                <h3>
                  Vamos criar algo incrível, <span>Alexandre?</span>
                </h3>
              </div>

              <div className="stats-grid">
                <SummaryCard
                  title="Vendido no mês"
                  value={formatCurrency(summary.sold)}
                  description="Sem orçamentos e cancelados"
                  tone="neutral"
                />
                <SummaryCard
                  title="Projetos ativos"
                  value={summary.activeProjects}
                  description="Em aberto no período"
                  tone="neutral"
                />
                <SummaryCard
                  title="Recebido"
                  value={formatCurrency(summary.received)}
                  description="Comissão já recebida"
                  tone="success"
                />
                <SummaryCard
                  title="A receber"
                  value={formatCurrency(summary.pending)}
                  description="Comissão pendente"
                  tone="danger"
                />
              </div>

              <div className="dashboard-grid">
                <section className="panel panel--large">
                  <div className="panel__header">
                    <div>
                      <span className="eyebrow">Próximos</span>
                      <h4>Lançamentos</h4>
                    </div>
                    <button className="link-button" onClick={() => setActiveTab("calendar")}>
                      Ver calendário
                    </button>
                  </div>

                  <div className="list-stack">
                    {upcomingProjects.length ? (
                      upcomingProjects.map((project) => (
                        <button
                          key={project.id}
                          className="list-card"
                          onClick={() => openEditProject(project)}
                        >
                          <div>
                            <strong>{project.client}</strong>
                            <span>{project.enterprise}</span>
                          </div>
                          <small>{formatDateBR(project.date)}</small>
                        </button>
                      ))
                    ) : (
                      <div className="empty-box">Nenhum próximo lançamento cadastrado.</div>
                    )}
                  </div>
                </section>

                <div className="dashboard-side">
                  <section className="panel">
                    <div className="panel__header">
                      <div>
                        <span className="eyebrow">Atenção</span>
                        <h4>Comissões a receber</h4>
                      </div>
                      <button className="link-button" onClick={() => setActiveTab("projects")}>
                        Ver tudo
                      </button>
                    </div>

                    {pendingProjects.length ? (
                      <div className="mini-list">
                        {pendingProjects.map((project) => (
                          <div key={project.id} className="mini-list__item">
                            <div>
                              <strong>{project.client}</strong>
                              <span>{project.enterprise}</span>
                            </div>
                            <b>{formatCurrency(getPendingValue(project))}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-box">Nenhuma comissão pendente neste período.</div>
                    )}
                  </section>

                  <section className="panel">
                    <span className="eyebrow">Progresso</span>
                    <h4>Recebimento do mês</h4>
                    <div className="progress-value">{Math.round(receiveProgress)}%</div>
                    <small>
                      {formatCurrency(summary.received)} de {formatCurrency(summary.commission)}
                    </small>
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${Math.min(receiveProgress, 100)}%` }}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}

          {activeTab === "projects" && (
            <section className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Lista compacta</span>
                  <h3>Projetos</h3>
                </div>
                <button className="primary-button" onClick={() => openNewProject()}>
                  + Novo projeto
                </button>
              </div>

              <div className="filter-panel">
                <input
                  className="text-input"
                  placeholder="Buscar por data, empreendimento, cliente ou consultor"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                  className="text-input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="a_receber">A receber</option>
                  <option value="parcial">Parcial</option>
                  <option value="recebido">Recebido</option>
                </select>
              </div>

              <div className="projects-list">
                {filteredProjects.length ? (
                  filteredProjects.map((project) => (
                    <article key={project.id} className="project-card">
                      <div className="project-card__top">
                        <small>{formatDateBR(project.date)}</small>
                        <span className={`status-chip status-chip--${getProjectStatus(project)}`}>
                          {getProjectStatus(project) === "a_receber" && "A receber"}
                          {getProjectStatus(project) === "parcial" && "Parcial"}
                          {getProjectStatus(project) === "recebido" && "Recebido"}
                        </span>
                      </div>

                      <div className="project-card__main">
                        <div>
                          <h4>{project.client}</h4>
                          <p>{project.enterprise}</p>
                        </div>
                        <strong>{formatCurrency(getPendingValue(project))}</strong>
                      </div>

                      <div className="project-card__meta">
                        <span>Projeto: {project.projectName}</span>
                        <span>Consultor: {project.consultant}</span>
                      </div>

                      <div className="project-card__actions">
                        <button className="secondary-button" onClick={() => openEditProject(project)}>
                          Editar
                        </button>
                        <button className="secondary-button" onClick={() => handleMarkReceived(project.id)}>
                          Recebido
                        </button>
                        <button className="danger-button" onClick={() => handleDeleteProject(project.id)}>
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-box">Nenhum projeto encontrado com esses filtros.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === "calendar" && (
            <section className="page">
              <div className="calendar-header">
                <div>
                  <h3 className="calendar-month-title">{toMonthTitle(currentMonth)}</h3>
                </div>

                <div className="calendar-controls">
                  <button className="secondary-button secondary-button--wide" onClick={goToPreviousMonth}>
                    ← Mês anterior
                  </button>
                  <button className="secondary-button secondary-button--wide" onClick={goToCurrentMonth}>
                    Hoje
                  </button>
                  <button className="secondary-button secondary-button--wide" onClick={goToNextMonth}>
                    Próximo mês →
                  </button>
                  <button className="primary-button primary-button--wide" onClick={() => openNewProject(selectedDate)}>
                    + Novo projeto
                  </button>
                </div>
              </div>

              <div className="calendar-card">
                <div className="calendar-grid calendar-grid--weekdays">
                  {WEEK_DAYS.map((label) => (
                    <div key={label} className="calendar-weekday">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="calendar-grid calendar-grid--days">
                  {calendarDays.map((isoDate, index) => {
                    if (!isoDate) {
                      return <div key={`empty-${index}`} className="calendar-day calendar-day--empty" />;
                    }

                    const events = projects.filter((project) => project.date === isoDate);
                    const isSelected = isSameDay(isoDate, selectedDate);
                    const isToday = isSameDay(isoDate, new Date().toISOString().slice(0, 10));

                    return (
                      <button
                        key={isoDate}
                        className={`calendar-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                        onClick={() => setSelectedDate(isoDate)}
                      >
                        <span className="calendar-day__number">{Number(isoDate.slice(-2))}</span>

                        <div className="calendar-day__events">
                          {events.slice(0, 2).map((event) => (
                            <span key={event.id} className="calendar-event-pill">
                              {event.client}
                            </span>
                          ))}

                          {events.length > 2 && (
                            <span className="calendar-event-more">+{events.length - 2}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="selected-day-panel">
                <div className="panel__header">
                  <div>
                    <span className="eyebrow">Dia selecionado</span>
                    <h4>{formatDateBR(selectedDate)}</h4>
                  </div>
                  <button className="primary-button" onClick={() => openNewProject(selectedDate)}>
                    + Novo projeto
                  </button>
                </div>

                {selectedDateProjects.length ? (
                  <div className="projects-list">
                    {selectedDateProjects.map((project) => (
                      <article key={project.id} className="project-card">
                        <div className="project-card__top">
                          <small>{formatDateBR(project.date)}</small>
                          <span className={`status-chip status-chip--${getProjectStatus(project)}`}>
                            {getProjectStatus(project) === "a_receber" && "A receber"}
                            {getProjectStatus(project) === "parcial" && "Parcial"}
                            {getProjectStatus(project) === "recebido" && "Recebido"}
                          </span>
                        </div>

                        <div className="project-card__main">
                          <div>
                            <h4>{project.client}</h4>
                            <p>{project.enterprise}</p>
                          </div>
                          <strong>{formatCurrency(getPendingValue(project))}</strong>
                        </div>

                        <div className="project-card__meta">
                          <span>Projeto: {project.projectName}</span>
                          <span>Consultor: {project.consultant}</span>
                        </div>

                        <div className="project-card__actions">
                          <button className="secondary-button" onClick={() => openEditProject(project)}>
                            Editar
                          </button>
                          <button className="secondary-button" onClick={() => handleMarkReceived(project.id)}>
                            Recebido
                          </button>
                          <button className="danger-button" onClick={() => handleDeleteProject(project.id)}>
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-box">Nenhum projeto lançado para esta data.</div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {isModalOpen && editingProject && (
        <ProjectModal
          values={editingProject}
          onClose={closeModal}
          onSave={handleSaveProject}
        />
      )}
    </>
  );
}

function SummaryCard({ title, value, description, tone = "neutral" }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span className="summary-card__title">{title}</span>
      <strong className="summary-card__value">{value}</strong>
      <small className="summary-card__description">{description}</small>
    </article>
  );
}

function ProjectModal({ values, onClose, onSave }) {
  const [form, setForm] = useState(values);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.date || !form.enterprise || !form.client || !form.projectName) {
      window.alert("Preencha data, empreendimento, cliente e projeto.");
      return;
    }

    onSave(form);
  }

  const isEditing = Boolean(form.id);

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-card__header">
          <div>
            <span className="eyebrow">{isEditing ? "Editar lançamento" : "Novo lançamento"}</span>
            <h3>{isEditing ? "Editar projeto" : "Cadastrar projeto"}</h3>
          </div>

          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>Data</span>
              <input
                type="date"
                className="text-input"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
              />
            </label>

            <label>
              <span>Empreendimento</span>
              <input
                className="text-input"
                value={form.enterprise}
                onChange={(e) => handleChange("enterprise", e.target.value)}
                placeholder="Ex: Paganini Tower"
              />
            </label>

            <label>
              <span>Cliente</span>
              <input
                className="text-input"
                value={form.client}
                onChange={(e) => handleChange("client", e.target.value)}
                placeholder="Ex: Hilda"
              />
            </label>

            <label>
              <span>Consultor de venda</span>
              <input
                className="text-input"
                value={form.consultant}
                onChange={(e) => handleChange("consultant", e.target.value)}
                placeholder="Ex: Paula"
              />
            </label>

            <label>
              <span>Projeto</span>
              <input
                className="text-input"
                value={form.projectName}
                onChange={(e) => handleChange("projectName", e.target.value)}
                placeholder="Ex: Ap. Completo"
              />
            </label>

            <label>
              <span>Valor</span>
              <input
                className="text-input"
                value={form.saleValue}
                onChange={(e) => handleChange("saleValue", e.target.value)}
                placeholder="Ex: 120.000,00"
              />
            </label>

            <label>
              <span>Comissão %</span>
              <input
                className="text-input"
                value={form.commissionPercent}
                onChange={(e) => handleChange("commissionPercent", e.target.value)}
                placeholder="Ex: 5"
              />
            </label>

            <label>
              <span>Comissão recebida</span>
              <input
                className="text-input"
                value={form.receivedValue}
                onChange={(e) => handleChange("receivedValue", e.target.value)}
                placeholder="Ex: 0,00"
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;