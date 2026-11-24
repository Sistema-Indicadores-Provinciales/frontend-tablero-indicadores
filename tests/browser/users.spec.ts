import { test, expect } from '@playwright/test';

test('users can be listed, created and deleted without email in either theme', async ({ page }) => {
  let users: any[] = [{ _id: 'reader', username: 'Bruno', profileType: 'INVITADO', access: [], email: 'legacy@example.test' }];
  const created: any[] = [], deleted: any[] = [], consoleWarnings: string[] = [];
  page.on('console', message => { if (message.text().includes('uncontrolled')) consoleWarnings.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ _id: 'admin', username: 'Ana', profileType: 'ADMIN', access_token: 'test' })));
  await page.route(/:(3000|8000)\//, async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = { data: [] };
    if (path === '/user/get-all') data = { data: users };
    else if (path === '/user' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); created.push(body);
      const account = { _id: 'new-' + created.length, ...body, access: [] };
      users.push(account); data = { data: account };
    } else if (path === '/user' && route.request().method() === 'DELETE') {
      const body = route.request().postDataJSON(); deleted.push(body);
      users = users.filter(user => user.username !== body.username);
      data = { data: { message: 'Usuario eliminado correctamente.' } };
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/usuarios');
  await expect(page.getByRole('cell', { name: 'Bruno', exact: true })).toBeVisible();
  await expect(page.getByText('Email', { exact: true })).toHaveCount(0);
  await expect(page.getByText('legacy@example.test')).toHaveCount(0);
  for (const [index, name] of ['Carla', 'Diego'].entries()) {
    if (index) await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
    await page.getByRole('button', { name: 'Agregar Usuario', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel(/email|correo/i)).toHaveCount(0);
    await dialog.getByLabel('Nombre').fill(name);
    await dialog.getByLabel('Contraseña').fill('test-password');
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Invitado', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
    expect(created[index]).toMatchObject({ username: name, password: 'test-password', profileType: 'INVITADO' });
    expect(created[index]).not.toHaveProperty('email');
  }
  await page.getByRole('button', { name: 'Eliminar a Bruno', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Bruno', exact: true })).toHaveCount(0);
  expect(deleted).toEqual([{ username: 'Bruno' }]);
  expect(consoleWarnings).toEqual([]);
});
