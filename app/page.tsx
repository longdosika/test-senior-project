"use client";

import { useState } from "react";
import { SPRINTS, countTasks, progressPercent, taskKey } from "../lib/tasks";

export default function Home() {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const percent = progressPercent(done);

  function toggle(key: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <main id="main">
      <h1>Senior Project</h1>
      <p className="meta">
        ความคืบหน้า {done.size} / {countTasks()} งาน
      </p>

      <div
        className="progress"
        role="progressbar"
        aria-label="ความคืบหน้าโดยรวม"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div style={{ width: `${percent}%` }} />
      </div>

      {SPRINTS.map((sprint) => (
        <section className="sprint" key={sprint.id} aria-labelledby={`${sprint.id}-title`}>
          <h2 id={`${sprint.id}-title`}>
            {sprint.title}
          </h2>
          <p className="meta">{sprint.weeks}</p>
          <ul className="tasks">
            {sprint.tasks.map((task, i) => {
              const key = taskKey(sprint.id, i);
              return (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={done.has(key)}
                      onChange={() => toggle(key)}
                    />
                    <span>{task}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
