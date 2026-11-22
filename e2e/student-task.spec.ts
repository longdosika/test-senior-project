import { PASSWORD, uniqueEmail } from "./support";
import { expect, test } from "./fixtures";

/** Flow 1: a student registers, logs out, logs back in and creates a task. */
test("login flow: register, log out, log in again, then create a task", async ({ page }) => {
  const email = uniqueEmail("student.task");
  const title = "Write the senior project proposal";

  await page.goto("/account");
  await page.getByRole("group", { name: "mode" }).getByRole("button", { name: "Register" }).click();
  await page.getByLabel("Display name").fill("E2E Student");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Register" }).click();
  await expect(page.getByText(email)).toBeVisible();

  // The session is an httpOnly cookie: page JavaScript must not be able to read it.
  expect(await page.evaluate(() => document.cookie.includes("sp_session"))).toBe(false);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);

  // The form keeps the Register mode after logout, so switch to Log in explicitly.
  await page.getByRole("group", { name: "mode" }).getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "My tasks", level: 1 })).toBeVisible();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Thai and English, due Friday");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText(title)).toBeVisible();
});
