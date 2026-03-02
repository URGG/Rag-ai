const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;
let splashWindow;
let pythonProcess;

// CONFIGURATION
const RAG_DIR = 'H:\\RAG'; // Your fixed location
const PYTHON_PATH = path.join(RAG_DIR, '.venv', 'Scripts', 'python.exe');
const SERVER_PATH = path.join(RAG_DIR, 'server.py');
const LOG_PATH = path.join(RAG_DIR, 'backend_debug.log');

// Logging helper to catch those "silent" errors
const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

function log(msg) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
}

function startPython() {
    log('Starting Python Backend...');

    if (!fs.existsSync(PYTHON_PATH)) {
        log('CRITICAL: Python executable not found.');
        dialog.showErrorBox('Error', 'Python environment not found. Did you move the folder?');
        app.quit();
        return;
    }

    pythonProcess = spawn(PYTHON_PATH, [SERVER_PATH], {
        cwd: RAG_DIR,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });


    pythonProcess.stdout.pipe(logStream);
    pythonProcess.stderr.pipe(logStream);

    pythonProcess.on('error', (err) => {
        log(`FAILED to spawn Python: ${err.message}`);
        dialog.showErrorBox('Backend Error', `Failed to start Neural Engine:\n${err.message}`);
    });

    pythonProcess.on('exit', (code) => {
        log(`Python process exited unexpectedly with code ${code}`);
    });
}

function checkServerHealth(retries = 0) {
    // Ping the server to see if it's alive
    const req = http.get('http://127.0.0.1:8000/', (res) => {
        if (res.statusCode === 200) {
            log('Server is healthy and ready!');
            createMainWindow();
        }
    });

    req.on('error', () => {
        if (retries < 40) {
            setTimeout(() => checkServerHealth(retries + 1), 500);
        } else {
            log('Server timed out.');
            dialog.showErrorBox('Timeout', 'The Neural Engine took too long to start.\nCheck backend_debug.log for details.');
            app.quit();
        }
    });

    req.end();
}

function createMainWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        backgroundColor: '#0A0A0B',
        title: 'Kernel Workspace',
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load the built UI
    mainWindow.loadFile(path.join(__dirname, 'ui-build', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    // 1. Show Splash Screen immediately
    splashWindow = new BrowserWindow({
        width: 400,
        height: 500,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true
    });
    splashWindow.loadFile('splash.html');

    // 2. Start the Backend
    startPython();


    checkServerHealth();
});

// Clean exit
app.on('window-all-closed', () => {
    if (pythonProcess) {
        spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
    }
    app.quit();
});