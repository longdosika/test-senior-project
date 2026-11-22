import { ADMIN_EMAIL, PASSWORD, sessionFor, uniqueEmail } from "./support";
import { expect, test } from "./fixtures";

/**
 * Flow 3: an admin logs in, reads the dashboard, grants a badge to a student
 * from the gamification table, and downloads the CSV task report.
 */
test("admin flow: log in, read the dashboard, grant a badge and download the CSV report", async ({ page }) => {
  const student = uniqueEmail("student.badge");
  await sessionFor(student, "Badge Student");

  await page.goto("/account");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Total users")).toBeVisible();

  // Gamification: grant the quiz-taker badge to the student's row.
  const row = page.getByRole("row").filter({ hasText: student });
  await expect(row).toBeVisible();
  await row.getByLabel("Choose a badge").selectOption("quiz-taker");
  await row.getByRole("button", { name: "Grant badge" }).click();
  await expect(row.getByRole("status")).toHaveText("Badge granted");
  await expect(row.locator(".badge-list")).toContainText("Quiz Taker");

  // Report download.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tasks-report.csv");
});
