import { expect, test, type Locator, type Page } from '@playwright/test';

// 弹窗输出区 aria 关联断言（2026-10-03 用户裁定：e2e 开弹窗）：
// 验证 component-contract.md 头部「输出收账框 a11y」通用规则——输出 field 容器 role="group"
// + aria-labelledby 解析到 head 标签 span；各只读 <output> 的组合 aria-label 含
// 字段标签文本 + 同行代币章符号。断言取 DOM 自身组词（标签文本+代币章），不钉 copy 字符串，
// 文案演进不破测试。弹窗路由按 fixture 状态选取：/2=locked（Liquidity 池卡双弹窗 +
// Tokenization Mint/Flash Swap）、/3=unlocked（Tokenization Mint/Redeem PT/Redeem YT）。
// 仅桌面档（同 a11y.spec 口径：同一 DOM，断言不随视口变化）。不截屏、不写快照、不耦合 a11y-baseline。

const VERSE_LOCKED = '/memeverse/2';
const VERSE_UNLOCKED = '/memeverse/3';

const DIALOG = '[data-slot="dialog-content"]';

async function openDialog(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator(DIALOG)).toHaveCount(0);
}

/** 输出收账框三层接线：output → 同行代币章符号；output → 祖先 group → labelledby → 唯一标签 span；
 *  output 组合 aria-label ⊇ 标签文本 + 代币符号 */
async function assertOutputWiring(scope: Locator, name: string) {
  const outputs = scope.locator('output');
  const count = await outputs.count();
  expect(count, `${name}：应有只读 output`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const out = outputs.nth(i);
    const symbol = (
      await out.locator('xpath=..').locator('.swap-panel__token strong').innerText()
    ).trim();
    const group = out.locator('xpath=ancestor::div[@role="group"][1]');
    await expect(group, `${name} output#${i}：应归属 role="group" 输出框`).toHaveCount(1);
    const labelledBy = await group.getAttribute('aria-labelledby');
    expect(labelledBy, `${name} output#${i}：group 应有 aria-labelledby`).toBeTruthy();
    const labelSpan = scope.locator(`[id="${labelledBy}"]`);
    await expect(
      labelSpan,
      `${name} output#${i}：aria-labelledby 应解析到唯一标签 span`,
    ).toHaveCount(1);
    const ariaLabel = (await out.getAttribute('aria-label')) ?? '';
    expect(ariaLabel, `${name} output#${i}：output 应有组合 aria-label`).toContain(
      (await labelSpan.innerText()).trim(),
    );
    expect(ariaLabel, `${name} output#${i}：aria-label 应含同行代币符号 ${symbol}`).toContain(
      symbol,
    );
  }
}

test('弹窗 aria：Liquidity 池卡 Add=单腿 / Remove=双腿', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  const card = page.locator('.pool-card').first();

  const add = await openDialog(page, card.getByRole('button', { name: 'Add', exact: true }));
  expect(await add.locator('output').count()).toBe(1);
  await assertOutputWiring(add, 'Add Liquidity');
  await closeDialog(page);

  const remove = await openDialog(page, card.getByRole('button', { name: 'Remove', exact: true }));
  expect(await remove.locator('output').count()).toBe(2);
  await assertOutputWiring(remove, 'Remove Liquidity');
});

test('弹窗 aria：Tokenization(locked) Mint / Flash Swap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();

  const mint = await openDialog(page, page.getByRole('button', { name: 'Mint', exact: true }));
  expect(await mint.locator('output').count()).toBe(1);
  await assertOutputWiring(mint, 'Mint POL');
  await closeDialog(page);

  const flash = await openDialog(
    page,
    page.getByRole('button', { name: 'Flash Swap', exact: true }),
  );
  expect(await flash.locator('output').count()).toBe(1);
  await assertOutputWiring(flash, 'Flash Swap');
});

test('弹窗 aria：Tokenization(unlocked) Mint / Redeem PT=单腿 / Redeem YT=双腿', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_UNLOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();

  const mint = await openDialog(page, page.getByRole('button', { name: 'Mint', exact: true }));
  expect(await mint.locator('output').count()).toBe(1);
  await assertOutputWiring(mint, 'Mint POL');
  await closeDialog(page);

  const redeemPt = await openDialog(
    page,
    page.getByRole('button', { name: 'Redeem PT', exact: true }),
  );
  expect(await redeemPt.locator('output').count()).toBe(1);
  await assertOutputWiring(redeemPt, 'Redeem PT');
  await closeDialog(page);

  const redeemYt = await openDialog(
    page,
    page.getByRole('button', { name: 'Redeem YT', exact: true }),
  );
  expect(await redeemYt.locator('output').count()).toBe(2);
  await assertOutputWiring(redeemYt, 'Redeem YT');
});

test('swap 卡 buy 输出 aria 关联（页面级，无弹窗）', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  const desk = page.locator('.swap-panel').first();
  await expect(desk.locator('output').first()).toBeVisible();
  expect(await desk.locator('output').count()).toBe(1);
  await assertOutputWiring(desk, 'Swap 卡 buy');
});
