import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import Modal from "../ui/Modal";

const TASKS_COLLECTION = "projectTasks";
const PROJECTS_COLLECTION = "projects";

const INITIAL_TASK_FORM = {
  title: "",
  note: "",
  dueDate: "",
  priority: "normal",
};

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

function getProjectTitle(project) {
  return (
    project?.title ||
    project?.name ||
    project?.projectName ||
    project?.scope ||
    "Projeto"
  );
}

function formatDate(value) {
  if (!value) return "Sem prazo";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Sem prazo";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTaskProgress(tasks) {
  if (!tasks.length) {
    return {
      total: 0,
      done: 0,
      percent: 0,
    };
  }

  const done = tasks.filter((task) => task.completed).length;

  return {
    total: tasks.length,
    done,
    percent: Math.round((done / tasks.length) * 100),
  };
}

function getPriorityLabel(priority) {
  if (priority === "alta") return "Alta";
  if (priority === "baixa") return "Baixa";
  return "Normal";
}

function getPriorityStyle(priority) {
  if (priority === "alta") {
    return {
      borderColor: "rgba(255, 120, 120, 0.35)",
      background: "rgba(255, 120, 120, 0.08)",
      color: "rgb(255, 180, 180)",
    };
  }

  if (priority === "baixa") {
    return {
      borderColor: "rgba(160, 210, 180, 0.28)",
      background: "rgba(160, 210, 180, 0.08)",
      color: "rgb(190, 230, 200)",
    };
  }

  return {
    borderColor: "rgba(255, 255, 255, 0.12)",
    background: "rgba(255, 255, 255, 0.06)",
    color: "var(--text-soft)",
  };
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    const positionA = Number.isFinite(Number(a.position))
      ? Number(a.position)
      : 999;
    const positionB = Number.isFinite(Number(b.position))
      ? Number(b.position)
      : 999;

    if (positionA !== positionB) return positionA - positionB;

    const dateA = a.dueDate ? new Date(`${a.dueDate}T12:00:00`).getTime() : 0;
    const dateB = b.dueDate ? new Date(`${b.dueDate}T12:00:00`).getTime() : 0;

    return dateA - dateB;
  });
}

export default function ProjectTasksModal({
  project,
  onClose,
  onChanged,
  projectsCollectionName = PROJECTS_COLLECTION,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(INITIAL_TASK_FORM);

  const projectId = project?.id;

  const progress = useMemo(() => getTaskProgress(tasks), [tasks]);
  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);

  async function syncProjectProgress(nextTasks) {
    if (!projectId) return;

    const nextProgress = getTaskProgress(nextTasks);

    try {
      await updateDoc(doc(db, projectsCollectionName, projectId), {
        taskProgress: nextProgress.percent,
        progress: nextProgress.percent,
        tasksTotal: nextProgress.total,
        tasksDone: nextProgress.done,
        updatedAt: serverTimestamp(),
      });

      if (typeof onChanged === "function") {
        onChanged({
          taskProgress: nextProgress.percent,
          progress: nextProgress.percent,
          tasksTotal: nextProgress.total,
          tasksDone: nextProgress.done,
        });
      }
    } catch (error) {
      console.warn("Erro ao atualizar progresso do projeto:", error);
    }
  }

  async function loadTasks() {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const tasksQuery = query(
        collection(db, TASKS_COLLECTION),
        where("projectId", "==", projectId)
      );

      const snapshot = await getDocs(tasksQuery);

      const data = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

      const nextTasks = sortTasks(data);

      setTasks(nextTasks);
      await syncProjectProgress(nextTasks);
    } catch (error) {
      console.warn("Erro ao carregar tarefas:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!projectId || !form.title.trim()) return;

    setSaving(true);

    try {
      const payload = {
        projectId,
        title: form.title.trim(),
        note: form.note.trim(),
        dueDate: form.dueDate || "",
        priority: form.priority || "normal",
        completed: false,
        position: tasks.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const created = await addDoc(collection(db, TASKS_COLLECTION), payload);

      const nextTasks = sortTasks([
        ...tasks,
        {
          id: created.id,
          ...payload,
        },
      ]);

      setTasks(nextTasks);
      setForm(INITIAL_TASK_FORM);
      await syncProjectProgress(nextTasks);
    } catch (error) {
      console.warn("Erro ao salvar tarefa:", error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task) {
    const nextCompleted = !task.completed;

    const nextTasks = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            completed: nextCompleted,
          }
        : item
    );

    setTasks(nextTasks);

    try {
      await updateDoc(doc(db, TASKS_COLLECTION, task.id), {
        completed: nextCompleted,
        completedAt: nextCompleted ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      await syncProjectProgress(nextTasks);
    } catch (error) {
      console.warn("Erro ao atualizar tarefa:", error);
      await loadTasks();
    }
  }

  async function deleteTask(task) {
    const confirmDelete = window.confirm(`Excluir "${task.title}"?`);

    if (!confirmDelete) return;

    const nextTasks = tasks.filter((item) => item.id !== task.id);

    setTasks(nextTasks);

    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, task.id));
      await syncProjectProgress(nextTasks);
    } catch (error) {
      console.warn("Erro ao excluir tarefa:", error);
      await loadTasks();
    }
  }

  async function createDefaultTasks() {
    if (!projectId || tasks.length > 0) return;

    setSaving(true);

    try {
      const createdTasks = [];

      for (let index = 0; index < DEFAULT_PROJECT_TASKS.length; index += 1) {
        const payload = {
          projectId,
          title: DEFAULT_PROJECT_TASKS[index],
          note: "",
          dueDate: "",
          priority: index <= 2 ? "alta" : "normal",
          completed: false,
          position: index + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const created = await addDoc(collection(db, TASKS_COLLECTION), payload);

        createdTasks.push({
          id: created.id,
          ...payload,
        });
      }

      const nextTasks = sortTasks(createdTasks);

      setTasks(nextTasks);
      await syncProjectProgress(nextTasks);
    } catch (error) {
      console.warn("Erro ao criar checklist padrão:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Tarefas do projeto" onClose={onClose}>
      <div
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <header
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 24,
            padding: 18,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          }}
        >
          <span
            style={{
              display: "block",
              marginBottom: 8,
              color: "var(--text-soft)",
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
            }}
          >
            Checklist
          </span>

          <strong
            style={{
              display: "block",
              color: "var(--text)",
              fontSize: "1.15rem",
              letterSpacing: "-0.04em",
            }}
          >
            {getProjectTitle(project)}
          </strong>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 18,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 8,
                overflow: "hidden",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: `${progress.percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, var(--accent), rgba(255,255,255,0.85))",
                  transition: "width 240ms ease",
                }}
              />
            </div>

            <strong
              style={{
                minWidth: 54,
                textAlign: "right",
                color: "var(--text)",
                fontSize: "0.92rem",
              }}
            >
              {progress.percent}%
            </strong>
          </div>

          <p
            style={{
              margin: "10px 0 0",
              color: "var(--text-soft)",
              fontSize: "0.86rem",
              lineHeight: 1.5,
            }}
          >
            {progress.done} de {progress.total} tarefas concluídas. Esse
            percentual atualiza automaticamente o progresso do projeto.
          </p>
        </header>

        {!projectId && (
          <p
            style={{
              margin: 0,
              color: "var(--text-soft)",
              lineHeight: 1.5,
            }}
          >
            Salve o projeto antes de cadastrar tarefas.
          </p>
        )}

        {projectId && (
          <>
            <form className="ui-form" onSubmit={handleSubmit}>
              <label className="ui-field">
                <span>Nova tarefa</span>

                <input
                  name="title"
                  value={form.title}
                  placeholder="Ex: Finalizar layout da cozinha"
                  required
                  onChange={handleChange}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px",
                  gap: 12,
                }}
              >
                <label className="ui-field">
                  <span>Prazo</span>

                  <input
                    name="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={handleChange}
                  />
                </label>

                <label className="ui-field">
                  <span>Prioridade</span>

                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
              </div>

              <label className="ui-field">
                <span>Observação</span>

                <textarea
                  name="note"
                  value={form.note}
                  rows={3}
                  placeholder="Detalhe rápido, combinado ou lembrete..."
                  onChange={handleChange}
                />
              </label>

              <div className="ui-form-actions">
                {tasks.length === 0 && (
                  <button
                    className="ui-button"
                    type="button"
                    disabled={saving}
                    onClick={createDefaultTasks}
                  >
                    Criar checklist padrão
                  </button>
                )}

                <button
                  className="ui-button primary"
                  type="submit"
                  disabled={saving || !form.title.trim()}
                >
                  {saving ? "Salvando..." : "Adicionar tarefa"}
                </button>
              </div>
            </form>

            <section
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {loading ? (
                <p
                  style={{
                    margin: 0,
                    color: "var(--text-soft)",
                  }}
                >
                  Carregando tarefas...
                </p>
              ) : sortedTasks.length > 0 ? (
                sortedTasks.map((task) => (
                  <article
                    key={task.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 20,
                      border: task.completed
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: task.completed
                        ? "rgba(255,255,255,0.025)"
                        : "rgba(255,255,255,0.045)",
                      opacity: task.completed ? 0.62 : 1,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={
                        task.completed
                          ? "Marcar como pendente"
                          : "Marcar como concluída"
                      }
                      onClick={() => toggleTask(task)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        border: task.completed
                          ? "1px solid var(--accent)"
                          : "1px solid rgba(255,255,255,0.20)",
                        background: task.completed
                          ? "var(--accent)"
                          : "rgba(255,255,255,0.04)",
                        color: task.completed ? "#111" : "var(--text-soft)",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                      }}
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          textDecoration: task.completed
                            ? "line-through"
                            : "none",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {task.title}
                      </strong>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 7,
                          color: "var(--text-soft)",
                          fontSize: "0.76rem",
                        }}
                      >
                        <span>{formatDate(task.dueDate)}</span>

                        <span
                          style={{
                            border: "1px solid",
                            borderRadius: 999,
                            padding: "2px 8px",
                            ...getPriorityStyle(task.priority),
                          }}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>

                        {task.completed && <span>Concluída</span>}
                      </div>

                      {task.note && (
                        <p
                          style={{
                            margin: "8px 0 0",
                            color: "var(--text-soft)",
                            fontSize: "0.82rem",
                            lineHeight: 1.45,
                          }}
                        >
                          {task.note}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="ui-button"
                      onClick={() => deleteTask(task)}
                      style={{
                        minHeight: 34,
                        padding: "0 12px",
                        fontSize: "0.72rem",
                      }}
                    >
                      Excluir
                    </button>
                  </article>
                ))
              ) : (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    border: "1px dashed rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    Nenhuma tarefa ainda.
                  </strong>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-soft)",
                      lineHeight: 1.5,
                    }}
                  >
                    Adicione tarefas manualmente ou use o checklist padrão para
                    começar rápido.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}