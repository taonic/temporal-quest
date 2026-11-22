// @sandbox: a learner who builds in Java switches language. To Python, they keep their sandbox:
// every language's snapshot has Python (ADR 0003); the runner switches ./quest to Python and closes
// the terminals that opened in the Java project, so the next ones open in /workshop. To another
// language, a sandbox for it replaces theirs, without asking.
import { SIGNIN_KEY, SKIP_SANDBOX, WALK_EMAIL } from "../env.mjs";
import { allow, deleteLearner, signInApi } from "./accounts.mjs";
import { expect, showCode, storageKey, test } from "./fixtures.mjs";
import { MINUTE } from "./learner.mjs";

// A learner who builds in `from`, then switches to `to`: their terminals' folder before and after.
async function switchLanguage(browser, from, to, check) {
  test.skip(!SIGNIN_KEY, "needs E2E_SIGNIN_KEY");
  test.skip(SKIP_SANDBOX, "E2E_SKIP_SANDBOX is set");
  test.setTimeout(15 * MINUTE);
  const email = WALK_EMAIL(`switch-${from}-${to}`);
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
    await page.goto(`/?lang=${from}#/exercise/01-hello-temporal`);
    await showCode(page);
    await ready();
    await expect.poll(folder, { timeout: 2 * MINUTE }).toBe(`/workshop/langs/${from}/hello`);

    // ?lang=…: they build in another language now. Nobody asks them anything.
    await page.goto(`/?lang=${to}#/exercise/01-hello-temporal`);
    await showCode(page);
    await ready();
    await expect(page.getByText("Your sandbox is for another language")).toHaveCount(0);
    await check(folder);
  } finally {
    await context.close();
    await deleteLearner(email).catch((err) => console.log(`deleting ${email}: ${err.message}`));
  }
}

test("switching from Java to Python keeps the sandbox, and its terminals move to /workshop", { tag: ["@sandbox", "@java"] }, async ({ browser }) => {
  // The Java sandbox has Python: kept, its terminals now in the workshop.
  await switchLanguage(browser, "java", "python", (folder) =>
    expect.poll(folder, { message: "the terminal is still in the Java project", timeout: 2 * MINUTE }).toBe("/workshop"));
});

test("switching from Java to C# swaps the sandbox for a C# one, without asking", { tag: ["@sandbox", "@java", "@dotnet"] }, async ({ browser }) => {
  // C# needs .NET, which the Java sandbox hasn't: a C# one replaces it, its terminals in its project.
  await switchLanguage(browser, "java", "dotnet", (folder) =>
    expect.poll(folder, { message: "the terminal isn't in the C# project", timeout: 3 * MINUTE }).toBe("/workshop/langs/dotnet/hello"));
});
