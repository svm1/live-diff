const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

app.setName('LiveDiff');

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            
            // enable for prod -> means disable direct & full node.js access in renderer
            contextIsolation: false
        }
    });
    mainWindow.loadFile('frontend/index.html');
    // mainWindow.webContents.openDevTools();
    console.log('loaded')
});

let file1 = '';
let file2 = '';

ipcMain.handle('select-file', async (_, fileNumber) => {
    console.log(`Selecting file ${fileNumber}`);
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Ableton Live Sets', extensions: ['als'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        if (fileNumber === 1) {
            file1 = result.filePaths[0];
        } else if (fileNumber === 2) {
            file2 = result.filePaths[0];
        }
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('run-diff', async (event, file1, file2) => {
    if (!file1 || !file2) {
        return 'Please select two ALS files first!';
    }

    console.log(`Running diff on: ${file1} vs ${file2}`);

    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'backend', 'parse_als.py');
        exec(`python ${scriptPath} "${file1}" "${file2}"`, (error, stdout, stderr) => {
            console.log(`[PYTHON OUT]: ${stdout}`);  // Logs Python output to Node console
            console.error(`[PYTHON ERR]: ${stderr}`); // Logs Python errors (if any)

            if (error) {
                reject(stderr); // If Python script fails, send error to UI
            } else {
                resolve(stdout); // Send Python output to UI
            }
        });
    });
});

