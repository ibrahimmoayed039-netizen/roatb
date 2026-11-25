const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

ipcMain.handle('load', () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch (e) { return null; } });
ipcMain.handle('save', (e, d) => { fs.writeFileSync(dataFile(), JSON.stringify(d, null, 2)); return true; });
ipcMain.handle('backup', async (e, d) => {
  const r = await dialog.showSaveDialog({ defaultPath: 'نسخة-احتياطية-الرواتب.json' });
  if (r.canceled) return false; fs.writeFileSync(r.filePath, JSON.stringify(d, null, 2)); return true;
});
ipcMain.handle('restore', async () => {
  const r = await dialog.showOpenDialog({ filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (e) { return null; }
});
ipcMain.handle('saveText', async (e, name, text) => {
  const r = await dialog.showSaveDialog({ defaultPath: name });
  if (r.canceled) return false; fs.writeFileSync(r.filePath, '\uFEFF' + text); return true;
});

app.whenReady().then(() => {
  const w = new BrowserWindow({
    width: 1280, height: 800, minWidth: 980, minHeight: 640, autoHideMenuBar: true, title: 'رواتب الموظفين',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  w.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
