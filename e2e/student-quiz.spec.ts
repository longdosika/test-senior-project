import { PASSWORD, QUIZ_TITLE, sessionFor, uniqueEmail } from "./support";
import { expect, test } from "./fixtures";

/** Flow 2: a student logs in, opens the seeded quiz, answers it and sees a server-side score. */
test("quiz flow: log in, answer every question, see the score and the quiz-taker badge", async ({ page }) => {
  const email = uniqueEmail("student.quiz");
  await sessionFor(email, "Quiz Student"); // registers the account through the API

  await page.goto("/account");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/quiz");
  const entry = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: QUIZ_TITLE }) });
  await entry.getByRole("button", { name: "Quiz", exact: true }).click();

  // Choices are only sent after the quiz is opened; pick the correct answer for both questions.
  await expect(page.getByRole("heading", { name: QUIZ_TITLE, level: 2 })).toBeVisible();
  await page.getByRole("radio", { name: "2 weeks" }).check();
  await page.getByRole("radio", { name: "Product Owner" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();

  await expect(page.getByRole("heading", { name: "Score: 2 / 2 (100%)" })).toBeVisible();
  await expect(page.getByText("New badges")).toBeVisible();
  await expect(page.getByText("Quiz Taker", { exact: true })).toBeVisible();
});
