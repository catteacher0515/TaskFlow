import type { Template } from "../../shared/types";

interface TemplateManagerProps {
  templates: Template[];
}

export function TemplateManager({ templates }: TemplateManagerProps) {
  return (
    <section className="panel" aria-labelledby="template-manager-title">
      <div className="panel-header">
        <h2 id="template-manager-title">模板管理</h2>
        <span className="muted-count">{templates.length}</span>
      </div>

      <div className="template-list">
        {templates.length > 0 ? (
          templates.map((template) => (
            <article className="template-card" key={template.id}>
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
                  <dt>推进对象</dt>
                  <dd>{template.progressObject?.name ?? "无"}</dd>
                </div>
              </dl>

              <p className="template-meta">推进对象：{template.progressObject?.name ?? "无"}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">暂无模板</p>
        )}
      </div>
    </section>
  );
}
