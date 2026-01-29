/**
 * P5S 워치 알림 모듈
 * Python 스크립트를 통해 BLE로 워치에 알림 전송
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class WatchNotifier {
    constructor() {
        this.config = {
            enabled: false,
            macAddress: '',
            warningMinutes: 5
        };
        this.writeChar = "0000ff02-0000-1000-8000-00805f9b34fb";

        // 알림 중복 방지 (같은 알림 5분간 재전송 안함)
        this.sentNotifications = new Map();
        this.NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5분

        // 설정 파일 로드
        this.loadConfig();
    }

    /**
     * 설정 파일 경로
     */
    getConfigPath() {
        try {
            if (app.isPackaged) {
                const exeDir = path.dirname(app.getPath('exe'));
                return path.join(exeDir, 'watch-config.json');
            }
        } catch (e) {
            // app이 아직 준비 안됨
        }
        return path.join(__dirname, 'watch-config.json');
    }

    /**
     * 설정 로드
     */
    loadConfig() {
        try {
            const configPath = this.getConfigPath();
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(data);
                this.updateConfig(config);
                console.log('[Watch] 설정 로드됨:', this.config.macAddress || '(미설정)');
            }
        } catch (err) {
            console.error('[Watch] 설정 로드 실패:', err.message);
        }
    }

    /**
     * 설정 업데이트
     */
    updateConfig(config) {
        if (config) {
            this.config.enabled = config.enabled || false;
            this.config.macAddress = config.macAddress || '';
            this.config.warningMinutes = config.warningMinutes || 5;
        }
    }

    /**
     * 알림 전송 가능 여부 확인
     */
    canNotify() {
        return this.config.enabled && this.config.macAddress;
    }

    /**
     * 알림 전송 (중복 방지)
     */
    async notify(studentName, message, type = 'warning') {
        if (!this.canNotify()) {
            console.log('[Watch] 워치 알림 비활성화 또는 MAC 미설정');
            return { success: false, disabled: true };
        }

        const key = `${studentName}_${type}`;
        const now = Date.now();

        // 쿨다운 체크
        if (this.sentNotifications.has(key)) {
            const lastSent = this.sentNotifications.get(key);
            if (now - lastSent < this.NOTIFICATION_COOLDOWN) {
                console.log(`[Watch] 쿨다운 중: ${studentName}`);
                return { success: true, skipped: true };
            }
        }

        // 알림 전송
        const result = await this.sendNotification(message);

        if (result.success) {
            this.sentNotifications.set(key, now);
        }

        return result;
    }

    /**
     * 실제 알림 전송 (Python 스크립트 실행)
     */
    sendNotification(message) {
        if (!this.config.macAddress) {
            return Promise.resolve({ success: false, error: 'MAC 주소 미설정' });
        }

        return new Promise((resolve) => {
            // watch-send.py 파일 실행
            const scriptPath = path.join(__dirname, 'watch-send.py');

            const python = spawn('python', [
                scriptPath,
                this.config.macAddress,
                message
            ], {
                timeout: 20000
            });

            let output = '';
            let error = '';

            python.stdout.on('data', (data) => {
                output += data.toString();
            });

            python.stderr.on('data', (data) => {
                error += data.toString();
            });

            python.on('close', (code) => {
                if (output.includes('OK')) {
                    console.log(`[Watch] 알림 전송 성공: ${message}`);
                    resolve({ success: true });
                } else {
                    console.error(`[Watch] 알림 전송 실패: ${error || output}`);
                    resolve({ success: false, error: error || output });
                }
            });

            python.on('error', (err) => {
                console.error(`[Watch] Python 실행 오류: ${err.message}`);
                resolve({ success: false, error: err.message });
            });
        });
    }

    /**
     * 수업 종료 N분 전 알림
     */
    async notifyWarning(studentName) {
        const mins = this.config.warningMinutes || 5;
        return this.notify(studentName, `${studentName} ${mins}분 전!`, 'warning');
    }

    /**
     * 수업 종료 알림
     */
    async notifyOvertime(studentName) {
        return this.notify(studentName, `${studentName} 수업 종료!`, 'overtime');
    }

    /**
     * 테스트 알림
     */
    async testNotification() {
        if (!this.config.macAddress) {
            return { success: false, error: 'MAC 주소가 설정되지 않았습니다. 설정에서 워치를 등록하세요.' };
        }
        return this.sendNotification("워치 연결 테스트!");
    }

    /**
     * 쿨다운 초기화
     */
    clearCooldowns() {
        this.sentNotifications.clear();
    }
}

// 싱글톤 인스턴스
const watchNotifier = new WatchNotifier();

module.exports = watchNotifier;
