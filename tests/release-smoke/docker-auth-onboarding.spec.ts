import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL =
  process.env.PAPERCLIP_RELEASE_SMOKE_EMAIL ??
  process.env.SMOKE_ADMIN_EMAIL ??
  "smoke-admin@paperclip.local";
const ADMIN_PASSWORD =
  process.env.PAPERCLIP_RELEASE_SMOKE_PASSWORD ??
  process.env.SMOKE_ADMIN_PASSWORD ??
  "paperclip-smoke-password";

const COMPANY_NAME = `Release-Smoke-${Date.now()}`;
const AGENT_NAME = "CEO";
const TASK_TITLE = "Release smoke task";

async function signIn(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);

  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
}

async function openOnboarding(page: Page) {
  const wizardHeading = page.locator("h3", { hasText: "Name your company" });
  const startButton = page.getByRole("button", { name: "Start Onboarding" });

  await expect(wizardHeading.or(startButton)).toBeVisible({ timeout: 20_000 });

  if (await startButton.isVisible()) {
    await startButton.click();
  }

  await expect(wizardHeading).toBeVisible({ timeout: 10_000 });
}

test.describe("Docker authenticated onboarding smoke", () => {
  test("logs in, completes onboarding, and triggers the first CEO run", async ({
    page,
  }) => {
    await signIn(page);
    await openOnboarding(page);

    await page.locator('input[placeholder="Acme Corp"]').fill(COMPANY_NAME);
    await page.getByRole("button", { name: "Next" }).click();

    // The wizard may include a "Define your mission" step between company name and agent creation.
    const missionHeading = page.locator("h3", { hasText: "Define your mission" });
    const agentHeading = page.locator("h3").filter({
      hasText: /Create your (first agent|team lead)/,
    });
    await expect(missionHeading.or(agentHeading)).toBeVisible({ timeout: 10_000 });
    if (await missionHeading.isVisible()) {
      await page
        .getByPlaceholder("What is your team trying to achieve?")
        .fill("Release smoke mission");
      await page.getByRole("button", { name: "Confirm mission" }).click();
    }

    await expect(agentHeading).toBeVisible({ timeout: 10_000 });

    const agentInput = page.locator(
      'input[placeholder="CEO"], input[placeholder="Chief of staff"]'
    );
    await agentInput.clear();
    await agentInput.fill(AGENT_NAME);
    await page.getByRole("button", { name: "Next" }).click();

    // The wizard may include a "Connect a model" step after agent naming.
    const modelHeading = page.locator("h3", { hasText: "Connect a model" });
    const taskHeading = page.locator("h3", { hasText: "Give it something to do" });
    await expect(modelHeading.or(taskHeading)).toBeVisible({ timeout: 10_000 });
    if (await modelHeading.isVisible()) {
      // Select Claude Code adapter so the agent is not created with adapterType "process".
      await page.getByRole("button", { name: /Claude Code/ }).click();
      await page.getByRole("button", { name: /Give it a heartbeat|Next/ }).click();
    }

    await expect(taskHeading).toBeVisible({ timeout: 10_000 });
    await page
      .locator('input[placeholder="e.g. Research competitor pricing"]')
      .fill(TASK_TITLE);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.locator("h3", { hasText: "Ready to launch" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(COMPANY_NAME)).toBeVisible();
    await expect(page.getByText(AGENT_NAME)).toBeVisible();
    await expect(page.getByText(TASK_TITLE)).toBeVisible();

    await page.getByRole("button", { name: "Create & Open Task" }).click();
    await expect(page).toHaveURL(/\/issues\//, { timeout: 10_000 });

    const baseUrl = new URL(page.url()).origin;

    const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
    expect(companiesRes.ok()).toBe(true);
    const companies = (await companiesRes.json()) as Array<{ id: string; name: string }>;
    const company = companies.find((entry) => entry.name === COMPANY_NAME);
    expect(company).toBeTruthy();

    const agentsRes = await page.request.get(
      `${baseUrl}/api/companies/${company!.id}/agents`
    );
    expect(agentsRes.ok()).toBe(true);
    const agents = (await agentsRes.json()) as Array<{
      id: string;
      name: string;
      role: string;
      adapterType: string;
    }>;
    const ceoAgent = agents.find((entry) => entry.name === AGENT_NAME);
    expect(ceoAgent).toBeTruthy();
    expect(ceoAgent!.role).toBe("ceo");
    expect(ceoAgent!.adapterType).not.toBe("process");

    const issuesRes = await page.request.get(
      `${baseUrl}/api/companies/${company!.id}/issues`
    );
    expect(issuesRes.ok()).toBe(true);
    const issues = (await issuesRes.json()) as Array<{
      id: string;
      title: string;
      assigneeAgentId: string | null;
    }>;
    const issue = issues.find((entry) => entry.title === TASK_TITLE);
    expect(issue).toBeTruthy();
    expect(issue!.assigneeAgentId).toBe(ceoAgent!.id);

    await expect.poll(
      async () => {
        const runsRes = await page.request.get(
          `${baseUrl}/api/companies/${company!.id}/heartbeat-runs?agentId=${ceoAgent!.id}`
        );
        expect(runsRes.ok()).toBe(true);
        const runs = (await runsRes.json()) as Array<{
          agentId: string;
          invocationSource: string;
          status: string;
        }>;
        const latestRun = runs.find((entry) => entry.agentId === ceoAgent!.id);
        return latestRun
          ? {
              invocationSource: latestRun.invocationSource,
              status: latestRun.status,
            }
          : null;
      },
      {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      }
    ).toEqual(
      expect.objectContaining({
        invocationSource: "assignment",
        status: expect.stringMatching(/^(queued|running|succeeded|failed)$/),
      })
    );
  });
});
