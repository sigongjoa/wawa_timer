const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

let notion = null;
let config = null;

// 설정 파일 경로
function getConfigPath() {
    // 패키지된 앱에서는 exe 옆에 설정 파일
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'notion-config.json');
    }
    return path.join(__dirname, 'notion-config.json');
}

// Notion 클라이언트 초기화
function initNotion() {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        console.log('Notion 설정 파일이 없습니다:', configPath);
        return false;
    }

    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (!config.apiKey) {
            console.log('Notion API 키가 설정되지 않았습니다.');
            return false;
        }

        notion = new Client({ auth: config.apiKey });
        console.log('Notion 클라이언트 초기화 완료');
        return true;
    } catch (error) {
        console.error('Notion 초기화 오류:', error);
        return false;
    }
}

// 설정 저장
function saveConfig(newConfig) {
    const configPath = getConfigPath();
    try {
        // 기존 config가 없으면 먼저 로드
        if (!config) {
            getConfig();
        }

        // 깊은 병합
        config = {
            ...config,
            ...newConfig,
            databases: {
                ...(config?.databases || {}),
                ...(newConfig.databases || {})
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        // API 키가 변경되면 클라이언트 재초기화
        if (newConfig.apiKey || config.apiKey) {
            notion = new Client({ auth: config.apiKey });
            console.log('Notion 클라이언트 재초기화됨');
        }
        return { success: true };
    } catch (error) {
        console.error('설정 저장 오류:', error);
        return { success: false, error: error.message };
    }
}

// 설정 불러오기
function getConfig() {
    if (!config) {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } else {
            config = { apiKey: '', databases: { students: '', attendance: '' } };
        }
    }
    return config;
}

// 연결 테스트
async function testConnection() {
    // 항상 새로 초기화 시도
    const initialized = initNotion();
    if (!initialized || !notion) {
        return { success: false, error: 'Notion 클라이언트 초기화 실패. API 키를 확인하세요.' };
    }

    try {
        const response = await notion.users.me();
        return { success: true, user: response.name || response.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 데이터베이스 구조 가져오기
async function getDatabaseSchema(databaseId) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }

    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        return { success: true, properties: response.properties, title: response.title };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 학생 데이터 관련 =====

// 학생 목록 가져오기 (Notion -> 앱)
async function getStudentsFromNotion() {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패. API 키를 확인하세요.' };
        }
    }
    if (!config?.databases?.students) {
        return { success: false, error: '학생 데이터베이스 ID가 설정되지 않았습니다.' };
    }

    try {
        const response = await notion.databases.query({
            database_id: config.databases.students,
        });

        const students = response.results.map(page => {
            const props = page.properties;
            const startNum = getPropertyValue(props['시작시간'] || props['Start'] || props['start']);
            return {
                notionId: page.id,
                name: getPropertyValue(props['이름'] || props['Name'] || props['name']),
                grade: getPropertyValue(props['학년'] || props['Grade'] || props['grade']),
                day: getPropertyValue(props['요일'] || props['Day'] || props['day']),
                start: numberToTime(startNum),
                end: getPropertyValue(props['종료시간'] || props['End'] || props['end']),
                subject: getPropertyValue(props['과목'] || props['Subject'] || props['subject']),
                note: getPropertyValue(props['비고'] || props['Note'] || props['note']),
                localFolder: '',
                driveLinks: [],
            };
        });

        return { success: true, students };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 학생 추가 (앱 -> Notion)
async function addStudentToNotion(student) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.students) {
        return { success: false, error: '학생 DB ID가 설정되지 않았습니다.' };
    }

    try {
        const response = await notion.pages.create({
            parent: { database_id: config.databases.students },
            properties: buildStudentProperties(student),
        });

        return { success: true, notionId: response.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 학생 수정 (앱 -> Notion)
async function updateStudentInNotion(notionId, student) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }

    try {
        await notion.pages.update({
            page_id: notionId,
            properties: buildStudentProperties(student),
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 학생 삭제 (앱 -> Notion)
async function deleteStudentFromNotion(notionId) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }

    try {
        await notion.pages.update({
            page_id: notionId,
            archived: true,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 출석 기록 관련 =====

// 출석 기록 추가 (체크아웃 시)
async function addAttendanceToNotion(record) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.attendance) {
        return { success: false, error: 'Notion 출석 DB ID가 설정되지 않았습니다.' };
    }

    try {
        const response = await notion.pages.create({
            parent: { database_id: config.databases.attendance },
            properties: {
                '이름': { title: [{ text: { content: record.studentName } }] },
                '학년': { select: { name: record.grade } },
                '날짜': { date: { start: record.date } },
                '체크인': { rich_text: [{ text: { content: record.checkIn } }] },
                '체크아웃': { rich_text: [{ text: { content: record.checkOut } }] },
                '수업시간': { number: record.duration },
                '예정시간': { rich_text: [{ text: { content: record.scheduledTime || '' } }] },
            },
        });

        return { success: true, notionId: response.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 특정 날짜의 출석 기록 가져오기
async function getAttendanceFromNotion(date) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.attendance) {
        return { success: false, error: 'Notion 출석 DB ID가 설정되지 않았습니다.' };
    }

    try {
        const response = await notion.databases.query({
            database_id: config.databases.attendance,
            filter: {
                property: '날짜',
                date: { equals: date },
            },
        });

        const records = response.results.map(page => {
            const props = page.properties;
            return {
                notionId: page.id,
                studentName: getPropertyValue(props['이름']),
                grade: getPropertyValue(props['학년']),
                date: getPropertyValue(props['날짜']),
                checkIn: getPropertyValue(props['체크인']),
                checkOut: getPropertyValue(props['체크아웃']),
                duration: getPropertyValue(props['수업시간']),
                scheduledTime: getPropertyValue(props['예정시간']),
            };
        });

        return { success: true, records };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 헬퍼 함수 =====

// Notion 속성 값 추출
function getPropertyValue(property) {
    if (!property) return '';

    switch (property.type) {
        case 'title':
            return property.title?.[0]?.plain_text || '';
        case 'rich_text':
            return property.rich_text?.[0]?.plain_text || '';
        case 'number':
            return property.number || 0;
        case 'select':
            return property.select?.name || '';
        case 'multi_select':
            return property.multi_select?.map(s => s.name) || [];
        case 'date':
            return property.date?.start || '';
        case 'url':
            return property.url || '';
        case 'checkbox':
            return property.checkbox || false;
        default:
            return '';
    }
}

// 시간 문자열을 숫자로 변환 (예: "15:00" → 1500, "15:30" → 1530)
function timeToNumber(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === 'number') return timeStr;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 100 + parseInt(parts[1]);
    }
    return parseInt(timeStr) || 0;
}

// 숫자를 시간 문자열로 변환 (예: 1500 → "15:00", 1530 → "15:30")
function numberToTime(num) {
    if (!num) return '';
    if (typeof num === 'string') return num;
    const hours = Math.floor(num / 100);
    const mins = num % 100;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// 학생 데이터 -> Notion 속성 변환
function buildStudentProperties(student) {
    return {
        '이름': { title: [{ text: { content: student.name } }] },
        '학년': { select: { name: student.grade } },
        '요일': { select: { name: student.day } },
        '시작시간': { number: timeToNumber(student.start) },
        '종료시간': { rich_text: [{ text: { content: student.end || '' } }] },
        '과목': { select: { name: student.subject } },
        '비고': { rich_text: [{ text: { content: student.note || '' } }] },
    };
}

// ===== PDF 자료 관련 =====

// PDF 자료 목록 가져오기 (Notion -> 앱)
async function getPdfsFromNotion(studentName = null) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.pdfs) {
        return { success: false, error: 'PDF DB ID가 설정되지 않았습니다.' };
    }

    try {
        const queryOptions = {
            database_id: config.databases.pdfs,
        };

        // 특정 학생의 PDF만 필터링
        if (studentName) {
            queryOptions.filter = {
                property: '학생이름',
                rich_text: { equals: studentName }
            };
        }

        const response = await notion.databases.query(queryOptions);

        const pdfs = response.results.map(page => {
            const props = page.properties;
            return {
                notionId: page.id,
                fileName: getPropertyValue(props['파일명'] || props['Name']),
                studentName: getPropertyValue(props['학생이름']),
                subject: getPropertyValue(props['과목']),
                memo: getPropertyValue(props['메모']),
            };
        });

        return { success: true, pdfs };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PDF 자료 추가 (앱 -> Notion)
async function addPdfToNotion(pdf) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.pdfs) {
        return { success: false, error: 'PDF DB ID가 설정되지 않았습니다.' };
    }

    try {
        const properties = {
            '파일명': { title: [{ text: { content: pdf.fileName } }] },
            '학생이름': { rich_text: [{ text: { content: pdf.studentName || '' } }] },
            '과목': { select: { name: pdf.subject || '기타' } },
            '메모': { rich_text: [{ text: { content: pdf.memo || '' } }] },
        };

        const response = await notion.pages.create({
            parent: { database_id: config.databases.pdfs },
            properties,
        });

        return { success: true, notionId: response.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PDF 자료 수정 (앱 -> Notion)
async function updatePdfInNotion(notionId, pdf) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }

    try {
        const properties = {
            '파일명': { title: [{ text: { content: pdf.fileName } }] },
            '학생이름': { rich_text: [{ text: { content: pdf.studentName || '' } }] },
            '과목': { select: { name: pdf.subject || '기타' } },
            '메모': { rich_text: [{ text: { content: pdf.memo || '' } }] },
        };

        await notion.pages.update({
            page_id: notionId,
            properties,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PDF 자료 삭제 (앱 -> Notion)
async function deletePdfFromNotion(notionId) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }

    try {
        await notion.pages.update({
            page_id: notionId,
            archived: true,
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PDF 메타데이터를 Notion에 일괄 저장
async function syncPdfMetadataToNotion(studentName, files) {
    if (!notion) {
        const initialized = initNotion();
        if (!initialized) {
            return { success: false, error: 'Notion 클라이언트 초기화 실패.' };
        }
    }
    if (!config?.databases?.pdfs) {
        return { success: false, error: 'PDF DB ID가 설정되지 않았습니다.' };
    }

    try {
        const results = [];
        let addedCount = 0;

        for (const file of files) {
            const result = await addPdfToNotion({
                fileName: file.fileName,
                studentName: studentName,
                subject: file.subject || '기타',
                memo: file.memo || '',
            });
            if (result.success) addedCount++;
            results.push({ file: file.fileName, ...result });
        }

        return {
            success: true,
            added: addedCount,
            total: files.length,
            message: `${addedCount}/${files.length}개 파일 메타데이터 Notion에 저장 완료`,
            results
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 모듈 내보내기
// 설정 리로드 (설정 창에서 저장 후 호출)
function reloadConfig() {
    config = null;
    notion = null;
    return initNotion();
}

module.exports = {
    initNotion,
    saveConfig,
    getConfig,
    testConnection,
    getDatabaseSchema,
    getStudentsFromNotion,
    addStudentToNotion,
    updateStudentInNotion,
    deleteStudentFromNotion,
    addAttendanceToNotion,
    getAttendanceFromNotion,
    // PDF 관련
    getPdfsFromNotion,
    addPdfToNotion,
    updatePdfInNotion,
    deletePdfFromNotion,
    syncPdfMetadataToNotion,
    // 설정 리로드
    reloadConfig,
};
