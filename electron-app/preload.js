const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadData: () => ipcRenderer.invoke('load-data'),
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    openFolder: (folderName) => ipcRenderer.invoke('open-folder', folderName),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getAssetsPath: () => ipcRenderer.invoke('get-assets-path'),
    getFolders: () => ipcRenderer.invoke('get-folders'),

    // PDF 관련
    selectPdfFiles: () => ipcRenderer.invoke('select-pdf-files'),
    uploadPdf: (data) => ipcRenderer.invoke('upload-pdf', data),
    getStudentFiles: (folderName) => ipcRenderer.invoke('get-student-files', folderName),
    openPdf: (data) => ipcRenderer.invoke('open-pdf', data),
    deletePdf: (data) => ipcRenderer.invoke('delete-pdf', data),

    // 출석 관련
    saveAttendance: (data) => ipcRenderer.invoke('save-attendance', data),
    loadAttendance: (date) => ipcRenderer.invoke('load-attendance', date),

    // Notion 관련
    notionGetConfig: () => ipcRenderer.invoke('notion-get-config'),
    notionSaveConfig: (config) => ipcRenderer.invoke('notion-save-config', config),
    notionTestConnection: () => ipcRenderer.invoke('notion-test-connection'),
    notionGetDbSchema: (databaseId) => ipcRenderer.invoke('notion-get-db-schema', databaseId),
    notionGetStudents: () => ipcRenderer.invoke('notion-get-students'),
    notionAddStudent: (student) => ipcRenderer.invoke('notion-add-student', student),
    notionUpdateStudent: (data) => ipcRenderer.invoke('notion-update-student', data),
    notionDeleteStudent: (notionId) => ipcRenderer.invoke('notion-delete-student', notionId),
    notionAddAttendance: (record) => ipcRenderer.invoke('notion-add-attendance', record),
    notionGetAttendance: (date) => ipcRenderer.invoke('notion-get-attendance', date),

    // Notion PDF 관련
    notionGetPdfs: (studentName) => ipcRenderer.invoke('notion-get-pdfs', studentName),
    notionAddPdf: (pdf) => ipcRenderer.invoke('notion-add-pdf', pdf),
    notionUpdatePdf: (data) => ipcRenderer.invoke('notion-update-pdf', data),
    notionDeletePdf: (notionId) => ipcRenderer.invoke('notion-delete-pdf', notionId),
    notionSyncPdfs: (data) => ipcRenderer.invoke('notion-sync-pdfs', data),

    // AI 비서 관련
    aiGetConfig: () => ipcRenderer.invoke('ai-get-config'),
    aiTest: () => ipcRenderer.invoke('ai-test'),
    aiChat: (data) => ipcRenderer.invoke('ai-chat', data),
    aiAnalyzePdf: (data) => ipcRenderer.invoke('ai-analyze-pdf', data),
    aiClearHistory: () => ipcRenderer.invoke('ai-clear-history'),
    aiGetHistory: () => ipcRenderer.invoke('ai-get-history'),

    // 설정 관련
    openSettings: () => ipcRenderer.invoke('open-settings'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // P5S 워치 알림
    watchTest: () => ipcRenderer.invoke('watch-test'),
    watchWarning: (studentName) => ipcRenderer.invoke('watch-warning', studentName),
    watchOvertime: (studentName) => ipcRenderer.invoke('watch-overtime', studentName),
    watchNotify: (message) => ipcRenderer.invoke('watch-notify', message)
});
