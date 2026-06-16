import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { RecurrenceRule, Template } from "../../shared/types";

interface NewProjectPanelProps {
  templates: Template[];
  onCreateProject: (input: { title: string; templateId: string; recurrence: RecurrenceRule }) => Promise<void>;
}

const recurrenceLabels: Record<RecurrenceRule["kind"], string> = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  workdays: "工作日",
  custom_interval: "自定义间隔"
};

export function NewProjectPanel({ templates, onCreateProject }: NewProjectPanelProps) {
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId, templates]
  );
  const recurrence = selectedTemplate?.recurrence.defaultRule ?? { kind: "none" as const };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedTemplate) {
      return;
    }

    await onCreateProject({
      title: trimmedTitle,
      templateId: selectedTemplate.id,
      recurrence
    });
    setTitle("");
  }

  return (
    <section className="panel page-panel" aria-labelledby="new-project-title">
      <div className="page-header">
        <p className="eyebrow">任务入口</p>
        <h2 id="new-project-title">新建任务</h2>
      </div>

      <form className="create-project-form" onSubmit={handleSubmit}>
        <label>
          <span>任务名称</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：整理播客选题"
          />
        </label>

        <label>
          <span>任务模板</span>
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-summary">
          <span>重复</span>
          <strong>{recurrenceLabels[recurrence.kind]}</strong>
        </div>

        <button className="primary-action" type="submit" disabled={!title.trim() || !selectedTemplate}>
          创建任务
        </button>
      </form>

      <div className="template-choice-list" aria-label="可用模板">
        {templates.map((template) => (
          <article className={`template-choice${template.id === selectedTemplate?.id ? " selected" : ""}`} key={template.id}>
            <div>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </div>
            <dl>
              <div>
                <dt>阶段</dt>
                <dd>{template.stages.length}</dd>
              </div>
              <div>
                <dt>槽位</dt>
                <dd>{template.slots.length}</dd>
              </div>
              <div>
                <dt>默认重复</dt>
                <dd>{recurrenceLabels[template.recurrence.defaultRule.kind]}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
