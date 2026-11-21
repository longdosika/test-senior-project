export type Sprint = {
  id: string;
  title: string;
  weeks: string;
  tasks: string[];
};

export const SPRINTS: Sprint[] = [
  {
    id: "sprint-1",
    title: "Proposal & Design",
    weeks: "สัปดาห์ 1–2",
    tasks: [
      "เขียน project proposal และส่งอาจารย์",
      "ออกแบบ database schema",
      "สร้าง wireframe หน้าจอหลัก",
      "ตั้งค่า development environment",
    ],
  },
  {
    id: "sprint-2",
    title: "Core Implementation",
    weeks: "สัปดาห์ 3–6",
    tasks: [
      "Setup project structure + CI/CD",
      "สร้าง database + migration",
      "พัฒนา Authentication",
      "พัฒนา core features ตามวัตถุประสงค์",
    ],
  },
  {
    id: "sprint-3",
    title: "Feature Complete",
    weeks: "สัปดาห์ 7–9",
    tasks: [
      "พัฒนา features ทั้งหมดให้ครบ",
      "Integration testing",
      "ทำ UI polish และ responsive",
      "User acceptance testing กับกลุ่มตัวอย่าง",
    ],
  },
  {
    id: "sprint-4",
    title: "Defense Preparation",
    weeks: "สัปดาห์ 10–12",
    tasks: [
      "เขียนรายงานฉบับสมบูรณ์",
      "สร้าง presentation slides",
      "ซ้อมนำเสนอ + รับ feedback",
      "Deploy production version",
      "Final documentation",
    ],
  },
];

/** Total number of tasks across all sprints. */
export function countTasks(sprints: Sprint[] = SPRINTS): number {
  return sprints.reduce((n, s) => n + s.tasks.length, 0);
}

/**
 * Progress as a whole percentage (0–100).
 * `done` is a set of keys in the form "<sprintId>:<taskIndex>".
 */
export function progressPercent(done: ReadonlySet<string>, sprints: Sprint[] = SPRINTS): number {
  const total = countTasks(sprints);
  if (total === 0) return 0;
  let completed = 0;
  for (const s of sprints) {
    s.tasks.forEach((_, i) => {
      if (done.has(taskKey(s.id, i))) completed += 1;
    });
  }
  return Math.round((completed / total) * 100);
}

export function taskKey(sprintId: string, index: number): string {
  return `${sprintId}:${index}`;
}
