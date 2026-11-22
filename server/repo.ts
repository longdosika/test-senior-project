import type { Pool } from "pg";

export type Role = "admin" | "user";
export type TaskStatus = "todo" | "doing" | "done";
export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "doing", "done"];

export type User = { id: string; email: string; displayName: string; role: Role; createdAt: string };
export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
export type StoredFile = {
  id: string;
  ownerId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
};
export type Payment = {
  id: string;
  userId: string;
  provider: string;
  providerChargeId: string;
  amountSatang: number;
  currency: string;
  status: "successful" | "pending" | "failed";
  createdAt: string;
};
export type QuizQuestion = { id: string; prompt: string; choices: string[]; answerIndex: number };
export type QuizSummary = { id: string; title: string; questionCount: number; createdAt: string };
export type PushSubscriptionRow = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

const iso = (v: Date | string): string => new Date(v).toISOString();

// ---------- users & sessions ----------

type UserRow = { id: string; email: string; display_name: string; role: Role; created_at: Date | string };
const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  role: r.role,
  createdAt: iso(r.created_at),
});

export async function insertUser(
  db: Pool,
  u: { id: string; email: string; passwordHash: string; displayName: string; role: Role },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (id, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, display_name, role, created_at`,
    [u.id, u.email, u.passwordHash, u.displayName, u.role],
  );
  return toUser(rows[0]);
}

export async function findUserWithHashByEmail(
  db: Pool,
  email: string,
): Promise<{ user: User; passwordHash: string } | null> {
  const { rows } = await db.query<UserRow & { password_hash: string }>(
    "SELECT id, email, display_name, role, created_at, password_hash FROM users WHERE email = $1",
    [email],
  );
  if (rows.length === 0) return null;
  return { user: toUser(rows[0]), passwordHash: rows[0].password_hash };
}

export async function findUserById(db: Pool, id: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    "SELECT id, email, display_name, role, created_at FROM users WHERE id = $1",
    [id],
  );
  return rows.length ? toUser(rows[0]) : null;
}

export async function insertSession(db: Pool, tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    tokenHash,
    userId,
    expiresAt,
  ]);
}

export async function findUserBySession(db: Pool, tokenHash: string, now: Date): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT u.id, u.email, u.display_name, u.role, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [tokenHash, now],
  );
  return rows.length ? toUser(rows[0]) : null;
}

export async function deleteSession(db: Pool, tokenHash: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

// ---------- tasks ----------

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};
const TASK_COLS = "id, title, description, status, created_by, created_at, updated_at";
const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  createdBy: r.created_by,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export async function insertTask(
  db: Pool,
  t: { id: string; title: string; description: string; status: TaskStatus; createdBy: string },
): Promise<Task> {
  const { rows } = await db.query<TaskRow>(
    `INSERT INTO tasks (id, title, description, status, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${TASK_COLS}`,
    [t.id, t.title, t.description, t.status, t.createdBy],
  );
  return toTask(rows[0]);
}

export async function getTask(db: Pool, id: string): Promise<Task | null> {
  const { rows } = await db.query<TaskRow>(`SELECT ${TASK_COLS} FROM tasks WHERE id = $1`, [id]);
  return rows.length ? toTask(rows[0]) : null;
}

export async function saveTask(db: Pool, t: Task): Promise<Task> {
  const { rows } = await db.query<TaskRow>(
    `UPDATE tasks SET title = $2, description = $3, status = $4, updated_at = $5
     WHERE id = $1 RETURNING ${TASK_COLS}`,
    [t.id, t.title, t.description, t.status, new Date()],
  );
  return toTask(rows[0]);
}

export async function deleteTask(db: Pool, id: string): Promise<boolean> {
  const res = await db.query("DELETE FROM tasks WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

export type TaskQuery = {
  userId?: string;
  q?: string;
  status?: TaskStatus;
  limit: number;
  offset: number;
};

/** Lists tasks with optional owner, status and text filters (newest first). */
export async function listTasks(db: Pool, query: TaskQuery): Promise<{ items: Task[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.userId) {
    params.push(query.userId);
    where.push(`created_by = $${params.length}`);
  }
  if (query.status) {
    params.push(query.status);
    where.push(`status = $${params.length}`);
  }
  if (query.q) {
    // Strip LIKE wildcards so user input is matched literally.
    params.push(`%${query.q.replace(/[%_\\]/g, "")}%`);
    where.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const count = await db.query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM tasks ${clause}`, params);
  const { rows } = await db.query<TaskRow>(
    `SELECT ${TASK_COLS} FROM tasks ${clause} ORDER BY created_at DESC, id DESC LIMIT ${Math.floor(query.limit)} OFFSET ${Math.floor(query.offset)}`,
    params,
  );
  return { items: rows.map(toTask), total: Number(count.rows[0].n) };
}

export async function taskCounts(db: Pool, userId?: string): Promise<{ total: number; done: number; byStatus: Record<TaskStatus, number> }> {
  const params: unknown[] = [];
  const clause = userId ? "WHERE created_by = $1" : "";
  if (userId) params.push(userId);
  const { rows } = await db.query<{ status: TaskStatus; n: number | string }>(
    `SELECT status, COUNT(*) AS n FROM tasks ${clause} GROUP BY status`,
    params,
  );
  const byStatus: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const r of rows) byStatus[r.status] = Number(r.n);
  return {
    total: byStatus.todo + byStatus.doing + byStatus.done,
    done: byStatus.done,
    byStatus,
  };
}

// ---------- files ----------

type FileRow = {
  id: string;
  owner_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: Date | string;
};
const toFile = (r: FileRow): StoredFile => ({
  id: r.id,
  ownerId: r.owner_id,
  filename: r.filename,
  contentType: r.content_type,
  sizeBytes: Number(r.size_bytes),
  storageKey: r.storage_key,
  createdAt: iso(r.created_at),
});

export async function insertFile(db: Pool, f: Omit<StoredFile, "createdAt">): Promise<StoredFile> {
  const { rows } = await db.query<FileRow>(
    `INSERT INTO files (id, owner_id, filename, content_type, size_bytes, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, owner_id, filename, content_type, size_bytes, storage_key, created_at`,
    [f.id, f.ownerId, f.filename, f.contentType, f.sizeBytes, f.storageKey],
  );
  return toFile(rows[0]);
}

export async function getFile(db: Pool, id: string): Promise<StoredFile | null> {
  const { rows } = await db.query<FileRow>(
    "SELECT id, owner_id, filename, content_type, size_bytes, storage_key, created_at FROM files WHERE id = $1",
    [id],
  );
  return rows.length ? toFile(rows[0]) : null;
}

export async function countFilesByOwner(db: Pool, ownerId: string): Promise<number> {
  const { rows } = await db.query<{ n: number | string }>("SELECT COUNT(*) AS n FROM files WHERE owner_id = $1", [
    ownerId,
  ]);
  return Number(rows[0].n);
}

// ---------- payments ----------

type PaymentRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_charge_id: string;
  amount_satang: number;
  currency: string;
  status: Payment["status"];
  created_at: Date | string;
};
const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  userId: r.user_id,
  provider: r.provider,
  providerChargeId: r.provider_charge_id,
  amountSatang: Number(r.amount_satang),
  currency: r.currency,
  status: r.status,
  createdAt: iso(r.created_at),
});

export async function insertPayment(db: Pool, p: Omit<Payment, "createdAt">): Promise<Payment> {
  const { rows } = await db.query<PaymentRow>(
    `INSERT INTO payments (id, user_id, provider, provider_charge_id, amount_satang, currency, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, provider, provider_charge_id, amount_satang, currency, status, created_at`,
    [p.id, p.userId, p.provider, p.providerChargeId, p.amountSatang, p.currency, p.status],
  );
  return toPayment(rows[0]);
}

export async function paidTotalSatang(db: Pool): Promise<number> {
  const { rows } = await db.query<{ total: number | string | null }>(
    "SELECT SUM(amount_satang) AS total FROM payments WHERE status = 'successful'",
  );
  return Number(rows[0].total ?? 0);
}

// ---------- quizzes ----------

export async function insertQuiz(
  db: Pool,
  quiz: { id: string; title: string; createdBy: string; questions: Array<{ id: string; prompt: string; choices: string[]; answerIndex: number }> },
): Promise<void> {
  await db.query("INSERT INTO quizzes (id, title, created_by) VALUES ($1, $2, $3)", [quiz.id, quiz.title, quiz.createdBy]);
  for (const [position, q] of quiz.questions.entries()) {
    await db.query(
      "INSERT INTO quiz_questions (id, quiz_id, position, prompt, choices, answer_index) VALUES ($1, $2, $3, $4, $5, $6)",
      [q.id, quiz.id, position, q.prompt, JSON.stringify(q.choices), q.answerIndex],
    );
  }
}

export async function listQuizzes(db: Pool): Promise<QuizSummary[]> {
  const { rows } = await db.query<{ id: string; title: string; created_at: Date | string; n: number | string }>(
    `SELECT q.id, q.title, q.created_at, COUNT(qq.id) AS n
     FROM quizzes q LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
     GROUP BY q.id, q.title, q.created_at ORDER BY q.created_at DESC, q.id DESC`,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, questionCount: Number(r.n), createdAt: iso(r.created_at) }));
}

export async function getQuizWithAnswers(
  db: Pool,
  id: string,
): Promise<{ id: string; title: string; questions: QuizQuestion[] } | null> {
  const quiz = await db.query<{ id: string; title: string }>("SELECT id, title FROM quizzes WHERE id = $1", [id]);
  if (quiz.rows.length === 0) return null;
  const { rows } = await db.query<{ id: string; prompt: string; choices: string; answer_index: number }>(
    "SELECT id, prompt, choices, answer_index FROM quiz_questions WHERE quiz_id = $1 ORDER BY position",
    [id],
  );
  return {
    id: quiz.rows[0].id,
    title: quiz.rows[0].title,
    questions: rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      choices: JSON.parse(r.choices) as string[],
      answerIndex: Number(r.answer_index),
    })),
  };
}

export async function insertQuizAttempt(
  db: Pool,
  a: { id: string; quizId: string; userId: string; score: number; total: number },
): Promise<void> {
  await db.query(
    "INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total) VALUES ($1, $2, $3, $4, $5)",
    [a.id, a.quizId, a.userId, a.score, a.total],
  );
}

export async function quizAttemptStats(
  db: Pool,
  userId: string,
): Promise<{ attempts: number; bestPercent: number }> {
  const { rows } = await db.query<{ score: number; total: number }>(
    "SELECT score, total FROM quiz_attempts WHERE user_id = $1",
    [userId],
  );
  let bestPercent = 0;
  for (const r of rows) {
    if (r.total > 0) bestPercent = Math.max(bestPercent, Math.round((Number(r.score) / Number(r.total)) * 100));
  }
  return { attempts: rows.length, bestPercent };
}

// ---------- badges ----------

/** Every user with the badge ids they hold, oldest account first. Used by the admin badge view. */
export async function usersWithBadges(db: Pool): Promise<Array<{ user: User; badgeIds: string[] }>> {
  const users = await db.query<UserRow>(
    "SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at, id",
  );
  const badges = await db.query<{ user_id: string; badge_id: string }>("SELECT user_id, badge_id FROM user_badges");
  const byUser = new Map<string, string[]>();
  for (const b of badges.rows) byUser.set(b.user_id, [...(byUser.get(b.user_id) ?? []), b.badge_id]);
  return users.rows.map((r) => ({ user: toUser(r), badgeIds: byUser.get(r.id) ?? [] }));
}

export async function earnedBadgeIds(db: Pool, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ badge_id: string }>("SELECT badge_id FROM user_badges WHERE user_id = $1", [userId]);
  return rows.map((r) => r.badge_id);
}

/** Awards a badge if not already held. Returns true when newly awarded. */
export async function awardBadge(db: Pool, userId: string, badgeId: string): Promise<boolean> {
  const existing = await db.query("SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2", [userId, badgeId]);
  if ((existing.rowCount ?? 0) > 0) return false;
  await db.query("INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)", [userId, badgeId]);
  return true;
}

// ---------- push subscriptions ----------

export async function upsertPushSubscription(
  db: Pool,
  s: { id: string; userId: string; endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const existing = await db.query("SELECT 1 FROM push_subscriptions WHERE endpoint = $1", [s.endpoint]);
  if ((existing.rowCount ?? 0) > 0) {
    await db.query("UPDATE push_subscriptions SET user_id = $2, p256dh = $3, auth = $4 WHERE endpoint = $1", [
      s.endpoint,
      s.userId,
      s.p256dh,
      s.auth,
    ]);
    return;
  }
  await db.query(
    "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)",
    [s.id, s.userId, s.endpoint, s.p256dh, s.auth],
  );
}

export async function listPushSubscriptions(db: Pool, userId?: string): Promise<PushSubscriptionRow[]> {
  const { rows } = userId
    ? await db.query<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>(
        "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
        [userId],
      )
    : await db.query<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>(
        "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions",
      );
  return rows.map((r) => ({ id: r.id, userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
}

// ---------- admin analytics ----------

export async function userCount(db: Pool): Promise<number> {
  const { rows } = await db.query<{ n: number | string }>("SELECT COUNT(*) AS n FROM users");
  return Number(rows[0].n);
}

export async function allQuizAverage(db: Pool): Promise<{ attempts: number; averagePercent: number }> {
  const { rows } = await db.query<{ score: number | string; total: number | string }>(
    "SELECT score, total FROM quiz_attempts",
  );
  if (rows.length === 0) return { attempts: 0, averagePercent: 0 };
  const sum = rows.reduce((acc, r) => {
    const total = Number(r.total);
    return acc + (total > 0 ? (Number(r.score) / total) * 100 : 0);
  }, 0);
  return { attempts: rows.length, averagePercent: Math.round(sum / rows.length) };
}

export async function allTasksForExport(db: Pool): Promise<Array<Task & { ownerEmail: string }>> {
  const { rows } = await db.query<TaskRow & { email: string }>(
    `SELECT t.id, t.title, t.description, t.status, t.created_by, t.created_at, t.updated_at, u.email
     FROM tasks t JOIN users u ON u.id = t.created_by ORDER BY t.created_at, t.id`,
  );
  return rows.map((r) => ({ ...toTask(r), ownerEmail: r.email }));
}
