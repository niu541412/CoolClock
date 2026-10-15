var aboutApi = globalThis.browser || globalThis.chrome;
document.querySelectorAll('[trans]').forEach(node => { node.textContent = t(node.getAttribute('trans')); });
document.getElementById('version').textContent = aboutApi.runtime.getManifest().version;
document.getElementById('settingsButton').addEventListener('click', () => aboutApi.runtime.openOptionsPage());
document.getElementById('updateLogButton').addEventListener('click', () => { location.href = aboutApi.runtime.getURL('update.html'); });
document.getElementById('permissionButton').addEventListener('click', async () => {
  const permissions = await aboutApi.permissions.getAll();
  alert(`Permissions: ${(permissions.permissions || []).join(', ')}\nOrigins: ${(permissions.origins || []).join(', ')}`);
});
