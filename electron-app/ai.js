require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

let aiClient = null;
let provider = process.env.AI_PROVIDER || 'anthropic';

// 대화 히스토리 (최근 20개 메시지 유지)
let conversationHistory = [];
const MAX_HISTORY = 20;

// AI 클라이언트 초기화
function initAI() {
    provider = process.env.AI_PROVIDER || 'anthropic';

    try {
        switch (provider) {
            case 'anthropic':
                if (!process.env.ANTHROPIC_API_KEY) {
                    return { success: false, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' };
                }
                aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
                break;

            case 'openai':
                if (!process.env.OPENAI_API_KEY) {
                    return { success: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다.' };
                }
                aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                break;

            case 'google':
                if (!process.env.GOOGLE_API_KEY) {
                    return { success: false, error: 'GOOGLE_API_KEY가 설정되지 않았습니다.' };
                }
                aiClient = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                break;

            default:
                return { success: false, error: `알 수 없는 AI 제공자: ${provider}` };
        }
        return { success: true, provider };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 수학 학원 관리를 돕는 AI 비서 "매쓰봇"입니다.

## 역할
- 학생 일정 관리 및 요약
- 수업 진도 추적 및 기록
- 학생별 학습 상태 파악 및 조언
- PDF 학습 자료 분석

## 응답 스타일
- 기본: 간결하고 핵심만 (2-3줄)
- "자세히", "상세하게" 요청 시: 구체적으로 설명
- 한국어로 자연스럽게
- 이모지 적절히 사용

## 컨텍스트 활용
- 제공된 학생 데이터를 기반으로 답변
- 오늘 요일과 시간을 고려
- 이전 대화 내용을 기억하고 참조

## 주요 기능
1. 일정 관리: "오늘 일정", "이번 주 일정", "홍길동 언제 와?"
2. 학생 정보: "홍길동 정보", "중2 학생 목록"
3. 진도 확인: "홍길동 진도", "다음에 뭐 해야 해?"
4. 수업 기록: "홍길동 오늘 단항식 했어" → 기록 제안
5. 전체 현황: "출석률", "이번 주 요약"`;

// 스마트 컨텍스트 분석 - 질문에 따라 필요한 데이터 결정
function analyzeQueryIntent(message) {
    const lowerMsg = message.toLowerCase();

    return {
        // 오늘 일정 관련
        needsTodaySchedule: /오늘|지금|현재|다음\s*(수업|학생)|누구.*와|올\s*사람/.test(lowerMsg),

        // 특정 학생 관련
        needsStudentDetail: /정보|진도|어디까지|뭐\s*해|약점|특성|언제.*와/.test(lowerMsg),

        // 전체 학생 목록
        needsAllStudents: /목록|전체|모든|학생들|중[1-3]|고[1-3]/.test(lowerMsg),

        // 출석 관련
        needsAttendance: /출석|결석|빠진|안\s*온/.test(lowerMsg),

        // 요약/통계 관련
        needsSummary: /요약|정리|현황|통계|이번\s*(주|달)/.test(lowerMsg),

        // 상세 설명 요청
        wantsDetail: /자세히|상세|구체적|왜|이유/.test(lowerMsg)
    };
}

// 학생 이름 추출
function extractStudentName(message, students) {
    for (const student of students) {
        if (message.includes(student.name)) {
            return student.name;
        }
    }
    return null;
}

// 스마트 컨텍스트 구성
function buildSmartContext(message, context = {}) {
    const intent = analyzeQueryIntent(message);
    const students = context.students || [];
    const mentionedStudent = extractStudentName(message, students);

    let contextParts = [];

    // 현재 시간 정보
    const now = new Date();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDay = dayNames[now.getDay()];
    const currentTime = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    contextParts.push(`[현재 시간] ${now.toLocaleDateString('ko-KR')} (${todayDay}) ${currentTime}`);

    // 오늘 일정 (필요시)
    if (intent.needsTodaySchedule || intent.needsSummary) {
        const todayStudents = students.filter(s => s.day === todayDay);
        if (todayStudents.length > 0) {
            const scheduleInfo = todayStudents.map(s =>
                `- ${s.start}~${s.end} ${s.name}(${s.grade}) - ${s.subject}${s.note ? ` [메모: ${s.note}]` : ''}`
            ).join('\n');
            contextParts.push(`[오늘(${todayDay}) 수업 일정]\n${scheduleInfo}`);
        } else {
            contextParts.push(`[오늘(${todayDay}) 수업 일정] 없음`);
        }
    }

    // 특정 학생 상세 정보 (이름 언급시)
    if (mentionedStudent && intent.needsStudentDetail) {
        const studentInfo = students.filter(s => s.name === mentionedStudent);
        if (studentInfo.length > 0) {
            const info = studentInfo.map(s =>
                `- ${s.day} ${s.start}~${s.end}: ${s.subject}${s.note ? `\n  메모: ${s.note}` : ''}`
            ).join('\n');
            contextParts.push(`[${mentionedStudent} 학생 정보]\n학년: ${studentInfo[0].grade}\n수업:\n${info}`);
        }
    }

    // 전체 학생 목록 (필요시, 요약 형태)
    if (intent.needsAllStudents && !mentionedStudent) {
        const studentSummary = {};
        students.forEach(s => {
            if (!studentSummary[s.grade]) studentSummary[s.grade] = [];
            if (!studentSummary[s.grade].includes(s.name)) {
                studentSummary[s.grade].push(s.name);
            }
        });

        const summaryText = Object.entries(studentSummary)
            .map(([grade, names]) => `${grade}: ${names.join(', ')}`)
            .join('\n');
        contextParts.push(`[학생 목록 (${students.length}명)]\n${summaryText}`);
    }

    // 출석 정보 (필요시)
    if (intent.needsAttendance && context.attendance) {
        contextParts.push(`[출석 기록]\n${JSON.stringify(context.attendance, null, 2)}`);
    }

    return contextParts.join('\n\n');
}

// 대화 히스토리 관리
function addToHistory(role, content) {
    conversationHistory.push({ role, content });

    // 최대 개수 초과시 오래된 것 제거
    if (conversationHistory.length > MAX_HISTORY) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }
}

function clearHistory() {
    conversationHistory = [];
}

function getHistory() {
    return [...conversationHistory];
}

// 텍스트 채팅 (히스토리 + 스마트 컨텍스트)
async function chat(message, context = {}) {
    if (!aiClient) {
        const init = initAI();
        if (!init.success) return init;
    }

    try {
        // 스마트 컨텍스트 구성
        const smartContext = buildSmartContext(message, context);

        // 시스템 프롬프트 + 컨텍스트
        const systemWithContext = `${SYSTEM_PROMPT}\n\n---\n${smartContext}`;

        // 히스토리에 현재 메시지 추가
        addToHistory('user', message);

        let response;
        let assistantMessage;

        switch (provider) {
            case 'anthropic':
                // Anthropic: 히스토리 포함
                response = await aiClient.messages.create({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: 1024,
                    system: systemWithContext,
                    messages: conversationHistory.map(h => ({
                        role: h.role,
                        content: h.content
                    }))
                });
                assistantMessage = response.content[0].text;
                break;

            case 'openai':
                // OpenAI: 히스토리 포함
                response = await aiClient.chat.completions.create({
                    model: 'gpt-4o-mini',
                    max_tokens: 1024,
                    messages: [
                        { role: 'system', content: systemWithContext },
                        ...conversationHistory.map(h => ({
                            role: h.role,
                            content: h.content
                        }))
                    ]
                });
                assistantMessage = response.choices[0].message.content;
                break;

            case 'google':
                // Google: 히스토리를 문자열로 결합
                const historyText = conversationHistory
                    .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`)
                    .join('\n');
                const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
                response = await model.generateContent(
                    `${systemWithContext}\n\n[대화 기록]\n${historyText}`
                );
                assistantMessage = response.response.text();
                break;
        }

        // 응답을 히스토리에 추가
        addToHistory('assistant', assistantMessage);

        return { success: true, message: assistantMessage };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PDF 분석 (Claude, Gemini 지원)
async function analyzePdf(pdfPath, question = '이 문서의 내용을 요약해주세요.', context = {}) {
    if (!aiClient) {
        const init = initAI();
        if (!init.success) return init;
    }

    try {
        if (!fs.existsSync(pdfPath)) {
            return { success: false, error: '파일을 찾을 수 없습니다.' };
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const base64Pdf = pdfBuffer.toString('base64');

        let response;

        switch (provider) {
            case 'anthropic':
                response = await aiClient.messages.create({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: 2048,
                    system: SYSTEM_PROMPT,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'document',
                                source: {
                                    type: 'base64',
                                    media_type: 'application/pdf',
                                    data: base64Pdf
                                }
                            },
                            { type: 'text', text: question }
                        ]
                    }]
                });
                return { success: true, message: response.content[0].text };

            case 'google':
                const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
                response = await model.generateContent([
                    { text: `${SYSTEM_PROMPT}\n\n${question}` },
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Pdf
                        }
                    }
                ]);
                return { success: true, message: response.response.text() };

            case 'openai':
                return { success: false, error: 'OpenAI는 PDF 직접 분석을 지원하지 않습니다. Claude나 Gemini를 사용하세요.' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 연결 테스트
async function testConnection() {
    if (!aiClient) {
        const init = initAI();
        if (!init.success) return init;
    }

    try {
        // 테스트용 임시 히스토리 저장
        const tempHistory = [...conversationHistory];
        conversationHistory = [];

        const result = await chat('연결 테스트입니다. "연결 성공"이라고만 답해주세요.', {});

        // 히스토리 복원 (테스트 대화 제외)
        conversationHistory = tempHistory;

        if (result.success) {
            return { success: true, provider, message: result.message };
        }
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 현재 설정 정보
function getConfig() {
    return {
        provider: process.env.AI_PROVIDER || 'anthropic',
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasOpenaiKey: !!process.env.OPENAI_API_KEY,
        hasGoogleKey: !!process.env.GOOGLE_API_KEY
    };
}

module.exports = {
    initAI,
    chat,
    analyzePdf,
    testConnection,
    getConfig,
    clearHistory,
    getHistory
};
