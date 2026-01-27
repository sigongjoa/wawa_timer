// 학생 시간표 업데이트 스크립트 (90분 고정)
const notion = require('../notion');

// 업데이트할 학생 시간표 (90분 고정)
const scheduleUpdates = [
    { name: '최고은', grade: '중1', day: '화목', start: '15:00', end: '16:30', subject: '수학' },
    { name: '강은서', grade: '중1', day: '목토', start: '15:00', end: '16:30', subject: '수학', note: '목 15:00-16:30 / 토 13:00-14:30' },
    { name: '박도은', grade: '중1', day: '화목', start: '15:30', end: '17:00', subject: '수학' },
    { name: '김성준', grade: '중2', day: '화목', start: '14:00', end: '15:30', subject: '수학' },
    { name: '김지후', grade: '중2', day: '화목', start: '18:00', end: '19:30', subject: '수학' },
    { name: '권순우', grade: '중2', day: '화목토', start: '14:00', end: '15:30', subject: '수학', note: '화목 14:00-15:30 / 토 13:00-14:30' },
    { name: '류호진', grade: '중3', day: '화목', start: '15:00', end: '16:30', subject: '수학' },
    { name: '신채원', grade: '중3', day: '화목', start: '16:00', end: '17:30', subject: '수학' },
    { name: '안성민', grade: '고1', day: '화목', start: '17:00', end: '18:30', subject: '수학' },
    { name: '류하진', grade: '고1', day: '목', start: '15:30', end: '17:00', subject: '수학' },
    { name: '하진서', grade: '고1', day: '화목', start: '17:00', end: '18:30', subject: '수학' },
    { name: '정윤재', grade: '고1', day: '화목', start: '16:00', end: '17:30', subject: '수학' },
    { name: '박도윤', grade: '고2', day: '화목토', start: '14:30', end: '16:00', subject: '수학' },
    { name: '최은서', grade: '고2', day: '화목', start: '17:00', end: '18:30', subject: '수학', note: '화 17:00-18:30 / 목 18:00-19:30' },
    { name: '문정빈', grade: '고2', day: '화목토', start: '16:00', end: '17:30', subject: '수학', note: '화목 16:00-17:30 / 토 14:30-16:00' },
    { name: '손동민', grade: '고2', day: '화목', start: '15:30', end: '17:00', subject: '수학', note: '화 15:30-17:00 / 목 14:00-15:30' },
    { name: '권도훈', grade: '고2', day: '화목', start: '18:00', end: '19:30', subject: '수학' },
    { name: '윤승환', grade: '고3', day: '목', start: '16:30', end: '18:00', subject: '수학' },
    { name: '송하선', grade: '고3', day: '목토', start: '18:00', end: '19:30', subject: '수학', note: '목 18:00-19:30 / 토 13:00-14:30' },
    { name: '김광민', grade: '고3', day: '화목', start: '15:00', end: '16:30', subject: '수학' },
    { name: '박동진', grade: '고3', day: '화목', start: '15:30', end: '17:00', subject: '수학', note: '화 15:30-17:00 / 목 15:00-16:30' },
    { name: '예원', grade: '기타', day: '화토', start: '14:00', end: '15:30', subject: '수학', note: '검정고시 / 화 14:00-15:30 / 토 14:00-15:30' },
];

async function main() {
    console.log('🚀 학생 시간표 업데이트 시작 (90분 고정)\n');

    // Notion 초기화
    const initialized = notion.initNotion();
    if (!initialized) {
        console.error('❌ Notion 초기화 실패');
        return;
    }

    // 기존 학생 목록 가져오기
    const result = await notion.getStudentsFromNotion();
    if (!result.success) {
        console.error('❌ 학생 목록 가져오기 실패:', result.error);
        return;
    }

    const existingStudents = result.students;
    console.log(`📋 기존 학생 수: ${existingStudents.length}명\n`);

    for (const schedule of scheduleUpdates) {
        // 이름으로 기존 학생 찾기
        const existing = existingStudents.find(s => s.name === schedule.name);

        const studentData = {
            name: schedule.name,
            grade: schedule.grade,
            day: schedule.day,
            start: schedule.start,
            end: schedule.end,
            subject: schedule.subject,
            note: schedule.note || '',
            localFolder: existing?.localFolder || '',
            driveLinks: existing?.driveLinks || [],
        };

        if (existing) {
            // 기존 학생 업데이트
            const updateResult = await notion.updateStudentInNotion(existing.notionId, studentData);
            if (updateResult.success) {
                console.log(`✅ 업데이트: ${schedule.name} (${schedule.grade}) ${schedule.day} ${schedule.start}-${schedule.end}`);
            } else {
                console.log(`❌ 업데이트 실패: ${schedule.name} - ${updateResult.error}`);
            }
        } else {
            // 새 학생 추가
            const addResult = await notion.addStudentToNotion(studentData);
            if (addResult.success) {
                console.log(`➕ 추가: ${schedule.name} (${schedule.grade}) ${schedule.day} ${schedule.start}-${schedule.end}`);
            } else {
                console.log(`❌ 추가 실패: ${schedule.name} - ${addResult.error}`);
            }
        }
    }

    console.log('\n✨ 업데이트 완료!');
}

main().catch(console.error);
