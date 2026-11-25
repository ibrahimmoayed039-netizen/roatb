const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let win;
const refocus = () => { if (win) { win.focus(); win.webContents.focus(); } };
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

ipcMain.handle('load', () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch (e) { return null; } });
const backupDir = () => path.join(app.getPath('userData'), 'backups');
ipcMain.handle('save', (e, d) => {
  const json = JSON.stringify(d, null, 2);
  fs.writeFileSync(dataFile(), json);
  try { // نسخة احتياطية يومية تلقائية (آخر 14 يوماً)
    fs.mkdirSync(backupDir(), { recursive: true });
    fs.writeFileSync(path.join(backupDir(), 'data-' + new Date().toISOString().slice(0, 10) + '.json'), json);
    const old = fs.readdirSync(backupDir()).sort();
    while (old.length > 14) fs.unlinkSync(path.join(backupDir(), old.shift()));
  } catch (err) {}
  return true;
});
ipcMain.handle('refocus', () => refocus());
ipcMain.handle('openBackups', () => { fs.mkdirSync(backupDir(), { recursive: true }); return shell.openPath(backupDir()); });
ipcMain.handle('backup', async (e, d) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'نسخة-احتياطية-الرواتب.json' }); refocus();
  if (r.canceled) return false; fs.writeFileSync(r.filePath, JSON.stringify(d, null, 2)); return true;
});
ipcMain.handle('restore', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }] }); refocus();
  if (r.canceled) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (e) { return null; }
});
ipcMain.handle('saveText', async (e, name, text) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name }); refocus();
  if (r.canceled) return false; fs.writeFileSync(r.filePath, '\uFEFF' + text); return true;
});

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 980, minHeight: 640, autoHideMenuBar: true, title: 'رواتب الموظفين',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
