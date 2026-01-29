"""
학생 수업 타이머 + P5S 워치 알림 시스템
- 학생별 수업 시간 관리
- 수업 N분 전 워치로 알림 전송
"""
import asyncio
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from bleak import BleakClient, BleakScanner

# ========== P5S 워치 설정 ==========
DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR = "0000ff03-0000-1000-8000-00805f9b34fb"

# 알림 몇 분 전에 보낼지
ALERT_MINUTES_BEFORE = 5


@dataclass
class Student:
    name: str
    schedule: list[str]  # ["15:00", "16:30", ...]
    alerted_times: set = field(default_factory=set)  # 이미 알림 보낸 시간


class WatchNotifier:
    """P5S 워치 알림 전송"""

    def __init__(self, address: str):
        self.address = address
        self.client: Optional[BleakClient] = None
        self.connected = False

    async def connect(self):
        """워치 연결"""
        if self.connected:
            return True

        try:
            print(f"🔗 워치 연결 중... ({self.address})")
            self.client = BleakClient(self.address)
            await self.client.connect()
            self.connected = True
            print("  ✅ 워치 연결됨!")
            return True
        except Exception as e:
            print(f"  ❌ 연결 실패: {e}")
            self.connected = False
            return False

    async def disconnect(self):
        """연결 해제"""
        if self.client and self.connected:
            await self.client.disconnect()
            self.connected = False

    def build_packet(self, message: str, notify_type: int = 255) -> list[bytes]:
        """알림 패킷 생성"""
        if len(message) > 128:
            message = message[:125] + "..."

        content = message.encode('utf-8')
        length = len(content)

        packets = []
        first_data_len = min(7, length)

        # 첫 번째 패킷
        packet = bytearray([
            0x02, 0x11,  # 헤더 + 알림명령
            length & 0xFF, (length >> 8) & 0xFF,
            (length >> 16) & 0xFF, (length >> 24) & 0xFF,
            0x01, notify_type & 0xFF,  # 고정 + 타입
            0x00, 0x00,  # 시퀀스
            0x01, 0x01, first_data_len  # 고정 + 데이터길이
        ])
        packet.extend(content[:first_data_len])
        packets.append(bytes(packet))

        # 후속 패킷
        offset = 7
        seq = 1
        while offset < length:
            chunk = content[offset:offset + 16]
            packet = bytearray([0x02, 0x11, seq & 0xFF, (seq >> 8) & 0xFF])
            packet.extend(chunk)
            packets.append(bytes(packet))
            offset += 16
            seq += 1

        return packets

    async def send_notification(self, message: str) -> bool:
        """알림 전송"""
        if not self.connected:
            if not await self.connect():
                return False

        try:
            packets = self.build_packet(message)
            for packet in packets:
                await self.client.write_gatt_char(WRITE_CHAR, packet, response=True)
                await asyncio.sleep(0.05)
            print(f"  📤 알림 전송: {message}")
            return True
        except Exception as e:
            print(f"  ❌ 전송 실패: {e}")
            self.connected = False
            return False


class StudentTimer:
    """학생 수업 타이머 관리"""

    def __init__(self):
        self.students: dict[str, Student] = {}
        self.notifier = WatchNotifier(DEVICE_ADDRESS)
        self.running = False

    def add_student(self, name: str, schedule: list[str]):
        """학생 추가"""
        self.students[name] = Student(name=name, schedule=schedule)
        print(f"  👤 {name} 추가: {', '.join(schedule)}")

    def remove_student(self, name: str):
        """학생 제거"""
        if name in self.students:
            del self.students[name]
            print(f"  ❌ {name} 제거됨")

    def get_upcoming_alerts(self) -> list[tuple[str, str, int]]:
        """곧 알림 보낼 학생 목록 [(이름, 시간, 남은분), ...]"""
        now = datetime.now()
        alerts = []

        for student in self.students.values():
            for time_str in student.schedule:
                # 오늘 날짜 + 수업 시간
                hour, minute = map(int, time_str.split(':'))
                class_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

                # 이미 알림 보냈으면 스킵
                alert_key = f"{now.date()}_{time_str}"
                if alert_key in student.alerted_times:
                    continue

                # 수업 시간까지 남은 분
                diff = (class_time - now).total_seconds() / 60

                # N분 전 ~ 수업시간 사이면 알림 대상
                if 0 <= diff <= ALERT_MINUTES_BEFORE:
                    alerts.append((student.name, time_str, int(diff)))
                    student.alerted_times.add(alert_key)

        return alerts

    async def check_and_notify(self):
        """알림 체크 및 전송"""
        alerts = self.get_upcoming_alerts()

        for name, time_str, minutes_left in alerts:
            if minutes_left > 0:
                msg = f"{name} {minutes_left}분 후 수업!"
            else:
                msg = f"{name} 수업 시작!"

            await self.notifier.send_notification(msg)

    async def run(self, check_interval: int = 30):
        """타이머 실행 (check_interval초마다 체크)"""
        self.running = True
        print(f"\n🚀 타이머 시작! ({check_interval}초마다 체크)")
        print(f"   알림: 수업 {ALERT_MINUTES_BEFORE}분 전")
        print("-" * 40)

        # 워치 연결
        await self.notifier.connect()

        while self.running:
            now = datetime.now().strftime("%H:%M:%S")
            print(f"\r⏰ {now} - 학생 {len(self.students)}명 모니터링 중...", end="", flush=True)

            await self.check_and_notify()
            await asyncio.sleep(check_interval)

        await self.notifier.disconnect()

    def stop(self):
        """타이머 중지"""
        self.running = False
        print("\n⏹️ 타이머 중지됨")


def print_status(timer: StudentTimer):
    """현재 상태 출력"""
    print("\n" + "=" * 50)
    print("📋 등록된 학생:")
    print("-" * 50)
    for name, student in timer.students.items():
        times = ", ".join(student.schedule)
        print(f"  {name}: {times}")
    print("=" * 50)


async def main():
    print("=" * 50)
    print("  학생 수업 타이머 + P5S 워치 알림")
    print("=" * 50)

    timer = StudentTimer()

    # ========== 학생 시간표 설정 ==========
    # 형식: timer.add_student("이름", ["HH:MM", "HH:MM", ...])

    timer.add_student("김철수", ["15:00", "16:30"])
    timer.add_student("이영희", ["15:30", "17:00"])
    timer.add_student("박민수", ["14:00", "15:30", "17:00"])
    timer.add_student("정수진", ["16:00"])
    timer.add_student("홍길동", ["14:30", "16:30"])

    # 테스트용: 1분 후 알림
    # now = datetime.now()
    # test_time = (now + timedelta(minutes=1)).strftime("%H:%M")
    # timer.add_student("테스트학생", [test_time])

    print_status(timer)

    # 타이머 실행
    try:
        await timer.run(check_interval=30)
    except KeyboardInterrupt:
        timer.stop()


if __name__ == "__main__":
    asyncio.run(main())
