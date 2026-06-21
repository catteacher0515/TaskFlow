import { useState } from "react";
import type { AppState } from "../../shared/types";

type EmotionViewMode = "calendar" | "list";

export interface EmotionsPageProps {
  state: AppState;
  onUpsertEmotionEntry: (input: {
    date: string;
    emoji: string;
    shortNote: string;
    detail: string;
  }) => Promise<void>;
}

export function EmotionsPage({ state, onUpsertEmotionEntry }: EmotionsPageProps) {
  const [viewMode, setViewMode] = useState<EmotionViewMode>("calendar");

  void state;
  void onUpsertEmotionEntry;

  return (
    <section className="page-heading" aria-labelledby="emotions-page-title">
      <div className="page-header">
        <p className="eyebrow">情绪记录</p>
        <h2 id="emotions-page-title">情绪</h2>
      </div>
      <div className="segmented-control" aria-label="情绪视图切换">
        <button
          type="button"
          aria-pressed={viewMode === "calendar"}
          className={viewMode === "calendar" ? "active" : ""}
          onClick={() => setViewMode("calendar")}
        >
          月历
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "list"}
          className={viewMode === "list" ? "active" : ""}
          onClick={() => setViewMode("list")}
        >
          列表
        </button>
      </div>
    </section>
  );
}
