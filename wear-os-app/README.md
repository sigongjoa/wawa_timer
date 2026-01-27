# 학원 출석 체크 - Wear OS 앱

Galaxy Watch용 학원 출석 체크 시스템입니다.

## 기능

- **오늘 학생 목록**: 오늘 요일에 해당하는 학생만 표시
- **입실/퇴실 체크**: 버튼 하나로 간편하게 체크
- **실시간 타이머**: 수업 시간 경과 표시
- **Notion 연동**: 출석 기록이 Notion DB에 자동 저장

## 빌드 방법

### 요구사항
- Android Studio (Hedgehog 이상)
- JDK 17
- Wear OS 에뮬레이터 또는 실제 Galaxy Watch

### 단계

1. Android Studio에서 `wear-os-app` 폴더를 열기
2. Gradle Sync 실행
3. Wear OS 에뮬레이터 생성 또는 Galaxy Watch 연결
4. Run 버튼 클릭

### 에뮬레이터 설정
1. Tools > Device Manager
2. Create Device > Wear OS > Wear OS Small Round (API 30+)
3. 에뮬레이터 실행

## 앱 설정

1. 앱 실행 후 **설정** 버튼 클릭
2. Notion API 키 입력 (secret_xxx...)
3. Database ID 입력
4. 저장

## 사용 방법

1. **오늘 학생** 버튼을 눌러 학생 목록 확인
2. 학생 이름을 터치하여 타이머 화면으로 이동
3. **입실** 버튼으로 수업 시작
4. 타이머가 자동으로 시작됨
5. 수업 종료 시 **퇴실** 버튼 클릭

## Notion DB 요구사항

다음 속성이 필요합니다:
- `이름` (title)
- `학년` (rich_text)
- `과목` (rich_text)
- `요일` (rich_text) - "화목" 형식
- `시작시간` (number) - 1500 형식 (15:00)
- `종료시간` (rich_text) - "16:30" 형식
- `출석시간` (rich_text) - 앱에서 자동 기록
- `퇴실시간` (rich_text) - 앱에서 자동 기록

## 프로젝트 구조

```
wear-os-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/mathesis/attendance/
│   │   │   ├── api/          # Notion API 클라이언트
│   │   │   ├── data/         # 데이터 모델
│   │   │   ├── ui/           # Activity들
│   │   │   └── util/         # 유틸리티
│   │   ├── res/
│   │   │   ├── layout/       # XML 레이아웃
│   │   │   ├── values/       # 문자열, 색상, 테마
│   │   │   └── drawable/     # 아이콘
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```
