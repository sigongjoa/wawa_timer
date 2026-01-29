const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
    // 버전 정보
    getVersion: () => ipcRenderer.invoke('settings:getVersion'),

    // Notion 설정
    getNotionConfig: () => ipcRenderer.invoke('settings:getNotionConfig'),
    saveNotionConfig: (config) => ipcRenderer.invoke('settings:saveNotionConfig', config),
    testNotion: (config) => ipcRenderer.invoke('settings:testNotion', config),

    // AI 설정
    getAIConfig: () => ipcRenderer.invoke('settings:getAIConfig'),
    saveAIConfig: (config) => ipcRenderer.invoke('settings:saveAIConfig', config),
    testAI: (config) => ipcRenderer.invoke('settings:testAI', config),

    // 워치 설정
    getWatchConfig: () => ipcRenderer.invoke('settings:getWatchConfig'),
    saveWatchConfig: (config) => ipcRenderer.invoke('settings:saveWatchConfig', config),
    scanWatch: () => ipcRenderer.invoke('settings:scanWatch'),
    testWatch: (macAddress) => ipcRenderer.invoke('settings:testWatch', macAddress)
});
