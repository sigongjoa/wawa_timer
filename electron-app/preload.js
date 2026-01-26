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
    loadAttendance: (date) => ipcRenderer.invoke('load-attendance', date)
});
