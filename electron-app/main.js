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

// 폴더 열기
ipcMain.handle('open-folder', async (event, folderName) => {
    const assetsPath = getAssetsPath();
    const folderPath = path.join(assetsPath, folderName);

    try {
        if (fs.existsSync(folderPath)) {
            shell.openPath(folderPath);
            return { success: true };
        } else {
            return { success: false, error: '폴더를 찾을 수 없습니다: ' + folderPath };
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

// 폴더 목록 가져오기
ipcMain.handle('get-folders', async () => {
    const assetsPath = getAssetsPath();

    try {
        // 폴더가 없으면 생성
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath, { recursive: true });
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
