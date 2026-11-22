// @sandbox: a learner who builds in Java switches to Python, and keeps their sandbox: every
// language's snapshot has Python (ADR 0003). The runner switches ./quest to Python and closes the
// terminals that opened in the Java project, so the next ones open in /workshop.
import { SIGNIN_KEY, SKIP_SANDBOX, WALK_EMAIL } from "../env.mjs";
import { allow, deleteLearner, signInApi } from "./accounts.mjs";
import { expect, showCode, storageKey, test } from "./fixtures.mjs";
import { MINUTE } from "./learner.mjs";

test("switching from Java to Python keeps the sandbox, and its terminals move to /workshop", { tag: ["@sandbox", "@java"] }, async ({ browser }) => {
  test.skip(!SIGNIN_KEY, "needs E2E_SIGNIN_KEY");
  test.skip(SKIP_SANDBOX, "E2E_SKIP_SANDBOX is set");
  test.setTimeout(15 * MINUTE);
  const email = WALK_EMAIL("switch-java-python");
  await deleteLearner(email);
  await allow(email);
  const { api } = await signInApi(email, { profile: { name: "E2E switch", role: "Developer" } });
  const storageState = await api.storageState();
  await api.dispose();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", storageState });
  await context.addInitScript((key) => localStorage.setItem(key, "true"), storageKey("onboarded"));
  const page = await context.newPage();
  const commands = page.locator('.terminal-pane[aria-label="The commands terminal"]');
  // Types `pwd` into the commands terminal and waits for the folder it prints.
  const folder = async () => {
    await commands.locator(".xterm-helper-textarea").focus();
    await page.keyboard.type("clear; pwd\n");
    await expect(commands.locator(".xterm-rows")).toContainText(/\/workshop\S*\s*\n?.*\$/, { timeout: MINUTE });
    return ((await commands.locator(".xterm-rows").innerText()).match(/^(\/workshop\S*)$/m) ?? [])[1];
  };
  const ready = () => expect(page.locator(".sandbox-pill"), "the sandbox never got ready").toHaveText(/Sandbox ready/, { timeout: 8 * MINUTE });
  try {
    await page.goto("/?lang=java#/exercise/01-hello-temporal");
    await showCode(page);
    await ready();
    await expect.poll(folder, { timeout: 2 * MINUTE }).toBe("/workshop/langs/java/hello");

    // ?lang=python: they build in Python now. Not asked for a new sandbox: the Java one has Python.
    await page.goto("/?lang=python#/exercise/01-hello-temporal");
    await showCode(page);
    await ready();
    await expect(page.getByText("Your sandbox is for another language")).toHaveCount(0);
    await expect.poll(folder, { message: "the terminal is still in the Java project", timeout: 2 * MINUTE }).toBe("/workshop");
  } finally {
    await context.close();
    await deleteLearner(email).catch((err) => console.log(`deleting ${email}: ${err.message}`));
  }
});
