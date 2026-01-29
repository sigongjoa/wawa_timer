require('dotenv').config();
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const notion = require('./notion');
const ai = require('./ai');

let mainWindow;

// 데이터 파일 경로 (exe 기준 상대 경로 - 포터블)
function getDataPath() {
    if (app.isPackaged) {
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, 'students-data.json');
    }
    // 개발 모드
    return path.join(__dirname, '..', 'students-data.json');
}

// 출석 데이터 경로
function getAttendancePath(date) {
    if (app.isPackaged) {
        const exeDir = path.dirname(app.getPath('exe'));
        const attendanceDir = path.join(exeDir, 'attendance');
        if (!fs.existsSync(attendanceDir)) {
            fs.mkdirSync(attendanceDir, { recursive: true });
        }
        return path.join(attendanceDir, `${date}.json`);
    }
    // 개발 모드
    const attendanceDir = path.join(__dirname, '..', 'attendance');
    if (!fs.existsSync(attendanceDir)) {
        fs.mkdirSync(attendanceDir, { recursive: true });
    }
    return path.join(attendanceDir, `${date}.json`);
}

// 수학자료 경로 (exe 기준 상대 경로)
function getAssetsPath() {
    if (app.isPackaged) {
        // exe 파일이 있는 디렉토리 기준
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, '수학자료');
    }
    // 개발 모드: assets/수학자료
    return path.join(__dirname, '..', 'assets', '수학자료');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'icon.ico'),
        title: '알파시티점 수학 시간표 관리'
    });

    mainWindow.loadFile('index.html');

    // 개발 중에는 DevTools 열기
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC 핸들러들

// 데이터 로드
ipcMain.handle('load-data', async () => {
    const dataPath = getDataPath();
    try {
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf-8');
            return JSON.parse(data);
        }
        return null; // 기본 데이터 사용
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        return null;
    }
});

// 데이터 저장
ipcMain.handle('save-data', async (event, data) => {
    const dataPath = getDataPath();
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('데이터 저장 오류:', error);
        return { success: false, error: error.message };
    }
});

// 폴더 열기 (드라이브 링크 또는 로컬 폴더)
ipcMain.handle('open-folder', async (event, folderNameOrUrl) => {
    // URL인 경우 외부 브라우저로 열기
    if (folderNameOrUrl && (folderNameOrUrl.startsWith('http://') || folderNameOrUrl.startsWith('https://'))) {
        try {
            await shell.openExternal(folderNameOrUrl);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 로컬 폴더인 경우 (개발 모드용)
    const assetsPath = getAssetsPath();
    const folderPath = path.join(assetsPath, folderNameOrUrl);

    try {
        if (fs.existsSync(folderPath)) {
            shell.openPath(folderPath);
            return { success: true };
        } else {
            return { success: false, error: '드라이브 링크를 설정해주세요. (학생 정보 수정에서 설정 가능)' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 외부 링크 열기
ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// assets 경로 가져오기
ipcMain.handle('get-assets-path', async () => {
    return getAssetsPath();
});

// 폴더 목록 가져오기 (로컬 폴더가 없으면 빈 배열)
ipcMain.handle('get-folders', async () => {
    const assetsPath = getAssetsPath();

    try {
        if (!fs.existsSync(assetsPath)) {
            // 폴더가 없으면 빈 배열 반환 (오류 없이)
            return [];
        }
        const items = fs.readdirSync(assetsPath, { withFileTypes: true });
        return items.filter(item => item.isDirectory()).map(item => item.name);
    } catch (error) {
        console.error('폴더 목록 오류:', error);
        return [];
    }
});

// PDF 파일 선택 다이얼로그
ipcMain.handle('select-pdf-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'PDF 파일 선택',
        filters: [
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
    });

    if (result.canceled) {
        return { success: false, canceled: true };
    }

    return { success: true, filePaths: result.filePaths };
});

// PDF 파일 업로드 (복사)
ipcMain.handle('upload-pdf', async (event, { filePaths, studentName }) => {
    const assetsPath = getAssetsPath();
    const studentFolder = path.join(assetsPath, studentName);

    try {
        // 학생 폴더가 없으면 생성
        if (!fs.existsSync(studentFolder)) {
            fs.mkdirSync(studentFolder, { recursive: true });
        }

        const copiedFiles = [];
        for (const filePath of filePaths) {
            const fileName = path.basename(filePath);
            const destPath = path.join(studentFolder, fileName);

            // 파일 복사
            fs.copyFileSync(filePath, destPath);
            copiedFiles.push(fileName);
        }

        return { success: true, copiedFiles, folderName: studentName };
    } catch (error) {
        console.error('PDF 업로드 오류:', error);
        return { success: false, error: error.message };
    }
});

// 재귀적으로 폴더 구조와 파일 목록 가져오기
function getFilesRecursively(dirPath, relativePath = '') {
    const result = [];

    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;

            if (item.isDirectory()) {
                // 하위 폴더 정보 추가
                const subFiles = getFilesRecursively(fullPath, itemRelativePath);
                if (subFiles.length > 0) {
                    result.push({
                        type: 'folder',
                        name: item.name,
                        path: itemRelativePath,
                        children: subFiles
                    });
                }
            } else if (item.name.toLowerCase().endsWith('.pdf')) {
                // PDF 파일 정보 추가
                result.push({
                    type: 'file',
                    name: item.name,
                    path: itemRelativePath
                });
            }
        }
    } catch (error) {
        console.error('폴더 탐색 오류:', error);
    }

    return result;
}

// 학생 폴더의 파일 목록 가져오기 (하위 폴더 포함)
ipcMain.handle('get-student-files', async (event, folderName) => {
    const assetsPath = getAssetsPath();
    const folderPath = path.join(assetsPath, folderName);

    try {
        if (fs.existsSync(folderPath)) {
            return getFilesRecursively(folderPath);
        }
        return [];
    } catch (error) {
        console.error('파일 목록 오류:', error);
        return [];
    }
});

// PDF 파일 열기 (하위 폴더 경로 지원)
ipcMain.handle('open-pdf', async (event, { folderName, filePath: relativePath }) => {
    const assetsPath = getAssetsPath();
    // relativePath가 전체 상대 경로 (예: "이항정리 풀면/파일.pdf")
    const filePath = path.join(assetsPath, folderName, relativePath);

    try {
        if (fs.existsSync(filePath)) {
            shell.openPath(filePath);
            return { success: true };
        } else {
            return { success: false, error: '파일을 찾을 수 없습니다' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// PDF 파일 삭제 (하위 폴더 경로 지원)
ipcMain.handle('delete-pdf', async (event, { folderName, filePath: relativePath }) => {
    const assetsPath = getAssetsPath();
    const filePath = path.join(assetsPath, folderName, relativePath);

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        } else {
            return { success: false, error: '파일을 찾을 수 없습니다' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 출석 데이터 저장
ipcMain.handle('save-attendance', async (event, data) => {
    if (!data || !data.date) {
        return { success: false, error: '날짜 정보가 없습니다' };
    }

    const attendancePath = getAttendancePath(data.date);
    try {
        fs.writeFileSync(attendancePath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('출석 저장 오류:', error);
        return { success: false, error: error.message };
    }
});

// 출석 데이터 로드
ipcMain.handle('load-attendance', async (event, date) => {
    const attendancePath = getAttendancePath(date);
    try {
        if (fs.existsSync(attendancePath)) {
            const data = fs.readFileSync(attendancePath, 'utf-8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('출석 로드 오류:', error);
        return null;
    }
});

// ===== Notion API 핸들러 =====

// Notion 설정 가져오기
ipcMain.handle('notion-get-config', async () => {
    return notion.getConfig();
});

// Notion 설정 저장
ipcMain.handle('notion-save-config', async (event, config) => {
    return notion.saveConfig(config);
});

// Notion 연결 테스트
ipcMain.handle('notion-test-connection', async () => {
    return await notion.testConnection();
});

// 데이터베이스 구조 가져오기
ipcMain.handle('notion-get-db-schema', async (event, databaseId) => {
    return await notion.getDatabaseSchema(databaseId);
});

// 학생 목록 가져오기 (Notion -> 앱)
ipcMain.handle('notion-get-students', async () => {
    return await notion.getStudentsFromNotion();
});

// 학생 추가 (앱 -> Notion)
ipcMain.handle('notion-add-student', async (event, student) => {
    return await notion.addStudentToNotion(student);
});

// 학생 수정 (앱 -> Notion)
ipcMain.handle('notion-update-student', async (event, { notionId, student }) => {
    return await notion.updateStudentInNotion(notionId, student);
});

// 학생 삭제 (앱 -> Notion)
ipcMain.handle('notion-delete-student', async (event, notionId) => {
    return await notion.deleteStudentFromNotion(notionId);
});

// 출석 기록 추가 (앱 -> Notion)
ipcMain.handle('notion-add-attendance', async (event, record) => {
    return await notion.addAttendanceToNotion(record);
});

// 출석 기록 가져오기 (Notion -> 앱)
ipcMain.handle('notion-get-attendance', async (event, date) => {
    return await notion.getAttendanceFromNotion(date);
});

// ===== PDF 관련 Notion API =====

// PDF 목록 가져오기 (Notion -> 앱)
ipcMain.handle('notion-get-pdfs', async (event, studentName) => {
    return await notion.getPdfsFromNotion(studentName);
});

// PDF 추가 (앱 -> Notion)
ipcMain.handle('notion-add-pdf', async (event, pdf) => {
    return await notion.addPdfToNotion(pdf);
});

// PDF 수정 (앱 -> Notion)
ipcMain.handle('notion-update-pdf', async (event, { notionId, pdf }) => {
    return await notion.updatePdfInNotion(notionId, pdf);
});

// PDF 삭제 (앱 -> Notion)
ipcMain.handle('notion-delete-pdf', async (event, notionId) => {
    return await notion.deletePdfFromNotion(notionId);
});

// PDF 메타데이터를 Notion에 저장
ipcMain.handle('notion-sync-pdfs', async (event, { studentName, files }) => {
    return await notion.syncPdfMetadataToNotion(studentName, files);
});

// ===== AI 비서 관련 =====

// AI 설정 확인
ipcMain.handle('ai-get-config', async () => {
    return ai.getConfig();
});

// AI 연결 테스트
ipcMain.handle('ai-test', async () => {
    return await ai.testConnection();
});

// AI 채팅
ipcMain.handle('ai-chat', async (event, { message, context }) => {
    return await ai.chat(message, context);
});

// PDF 분석
ipcMain.handle('ai-analyze-pdf', async (event, { pdfPath, question, context }) => {
    // 상대 경로를 절대 경로로 변환
    const assetsPath = getAssetsPath();
    const fullPath = path.join(assetsPath, pdfPath);
    return await ai.analyzePdf(fullPath, question, context);
});

// 대화 히스토리 초기화
ipcMain.handle('ai-clear-history', async () => {
    ai.clearHistory();
    return { success: true };
});

// 대화 히스토리 조회
ipcMain.handle('ai-get-history', async () => {
    return { success: true, history: ai.getHistory() };
});

// ===== 설정 창 관련 =====

let settingsWindow = null;

// 설정 창 열기
ipcMain.handle('open-settings', async () => {
    if (settingsWindow) {
        settingsWindow.focus();
        return { success: true };
    }

    settingsWindow = new BrowserWindow({
        width: 650,
        height: 750,
        parent: mainWindow,
        modal: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'settings-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: '설정'
    });

    settingsWindow.loadFile('settings.html');
    settingsWindow.setMenu(null);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });

    return { success: true };
});

// 앱 버전 가져오기
ipcMain.handle('settings:getVersion', async () => {
    const packageJson = require('./package.json');
    return packageJson.version;
});

// Notion 설정 경로 (exe 기준)
function getNotionConfigPath() {
    if (app.isPackaged) {
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, 'notion-config.json');
    }
    return path.join(__dirname, 'notion-config.json');
}

// AI 설정 경로 (exe 기준)
function getAIConfigPath() {
    if (app.isPackaged) {
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, 'ai-config.json');
    }
    return path.join(__dirname, 'ai-config.json');
}

// 설정: Notion 설정 가져오기
ipcMain.handle('settings:getNotionConfig', async () => {
    const configPath = getNotionConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Notion 설정 로드 오류:', err);
    }
    return null;
});

// 설정: Notion 설정 저장
ipcMain.handle('settings:saveNotionConfig', async (event, config) => {
    const configPath = getNotionConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        // notion 모듈에 설정 반영
        notion.reloadConfig && notion.reloadConfig();
        return { success: true };
    } catch (err) {
        console.error('Notion 설정 저장 오류:', err);
        return { success: false, error: err.message };
    }
});

// 설정: Notion 연결 테스트
ipcMain.handle('settings:testNotion', async (event, config) => {
    try {
        const { Client } = require('@notionhq/client');
        const client = new Client({ auth: config.apiKey });

        // 학생 DB에 접근 시도
        await client.databases.retrieve({ database_id: config.databases.students });
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 설정: AI 설정 가져오기
ipcMain.handle('settings:getAIConfig', async () => {
    const configPath = getAIConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('AI 설정 로드 오류:', err);
    }
    return null;
});

// 설정: AI 설정 저장
ipcMain.handle('settings:saveAIConfig', async (event, config) => {
    const configPath = getAIConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        // .env 파일도 업데이트 (포터블 모드용)
        const envPath = app.isPackaged
            ? path.join(path.dirname(app.getPath('exe')), '.env')
            : path.join(__dirname, '.env');

        const envContent = `AI_PROVIDER=${config.provider}
ANTHROPIC_API_KEY=${config.anthropicKey || ''}
OPENAI_API_KEY=${config.openaiKey || ''}
GOOGLE_API_KEY=${config.googleKey || ''}
`;
        fs.writeFileSync(envPath, envContent, 'utf-8');

        // 환경변수 다시 로드
        require('dotenv').config({ path: envPath, override: true });

        return { success: true };
    } catch (err) {
        console.error('AI 설정 저장 오류:', err);
        return { success: false, error: err.message };
    }
});

// 설정: AI 연결 테스트
ipcMain.handle('settings:testAI', async (event, config) => {
    try {
        if (config.provider === 'anthropic' && config.anthropicKey) {
            const Anthropic = require('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey: config.anthropicKey });
            await client.messages.create({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            });
            return { success: true };
        } else if (config.provider === 'openai' && config.openaiKey) {
            const OpenAI = require('openai');
            const client = new OpenAI({ apiKey: config.openaiKey });
            await client.chat.completions.create({
                model: 'gpt-4o-mini',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            });
            return { success: true };
        } else if (config.provider === 'google' && config.googleKey) {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(config.googleKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('Hi');
            return { success: true };
        } else {
            return { success: false, error: '선택한 AI 제공자의 API 키가 필요합니다' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 앱 버전 가져오기 (렌더러용)
ipcMain.handle('get-app-version', async () => {
    const packageJson = require('./package.json');
    return packageJson.version;
});

// ===== P5S 워치 알림 =====
const watchNotifier = require('./watch-notifier');

// 워치 테스트 알림
ipcMain.handle('watch-test', async () => {
    return await watchNotifier.testNotification();
});

// 워치 경고 알림 (5분 전)
ipcMain.handle('watch-warning', async (event, studentName) => {
    return await watchNotifier.notifyWarning(studentName);
});

// 워치 종료 알림
ipcMain.handle('watch-overtime', async (event, studentName) => {
    return await watchNotifier.notifyOvertime(studentName);
});

// 워치 커스텀 알림
ipcMain.handle('watch-notify', async (event, message) => {
    return await watchNotifier.sendNotification(message);
});

// ===== 워치 설정 (settings 창) =====

// 워치 설정 경로
function getWatchConfigPath() {
    if (app.isPackaged) {
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, 'watch-config.json');
    }
    return path.join(__dirname, 'watch-config.json');
}

// 워치 설정 가져오기
ipcMain.handle('settings:getWatchConfig', async () => {
    const configPath = getWatchConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('워치 설정 로드 오류:', err);
    }
    return { enabled: false, macAddress: '', warningMinutes: 5 };
});

// 워치 설정 저장
ipcMain.handle('settings:saveWatchConfig', async (event, config) => {
    const configPath = getWatchConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        // watchNotifier에 설정 반영
        watchNotifier.updateConfig(config);
        return { success: true };
    } catch (err) {
        console.error('워치 설정 저장 오류:', err);
        return { success: false, error: err.message };
    }
});

// 워치 검색 (BLE 스캔)
ipcMain.handle('settings:scanWatch', async () => {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
        const pythonScript = `
import asyncio
from bleak import BleakScanner

async def scan():
    devices = await BleakScanner.discover(timeout=10.0)
    # 모든 기기 출력 (이름 있는 것 우선)
    named = [(d.address, d.name) for d in devices if d.name]
    unnamed = [(d.address, '') for d in devices if not d.name]

    for addr, name in named + unnamed:
        print(f"{addr}|{name}")

asyncio.run(scan())
`;

        const python = spawn('python', ['-c', pythonScript], { timeout: 15000 });

        let output = '';
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { console.error('scan stderr:', data.toString()); });

        python.on('close', () => {
            const devices = output.trim().split('\\n')
                .filter(line => line.includes('|'))
                .map(line => {
                    const [address, name] = line.split('|');
                    return { address, name: name || '(이름 없음)' };
                });
            resolve({ success: true, devices });
        });

        python.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
});

// 워치 연결 테스트
ipcMain.handle('settings:testWatch', async (event, macAddress) => {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
        // watch-send.py 파일 실행
        const scriptPath = path.join(__dirname, 'watch-send.py');

        const python = spawn('python', [
            scriptPath,
            macAddress,
            '연결 테스트!'
        ], { timeout: 20000 });

        let output = '';
        let error = '';
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });

        python.on('close', () => {
            if (output.includes('OK')) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: error || output || '연결 실패' });
            }
        });

        python.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
});
