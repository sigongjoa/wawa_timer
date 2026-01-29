"""
학생 수업 타이머 + P5S 워치 알림 (인터랙티브 버전)
- 실시간 학생 추가/제거
- 즉시 테스트 알림
- 타이머 관리
"""
import asyncio
import threading
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from bleak import BleakClient

# ========== P5S 워치 설정 ==========
DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"

# 알림 몇 분 전에 보낼지
ALERT_MINUTES_BEFORE = 5


@dataclass
class Student:
    name: str
    schedule: list[str]
    alerted_times: set = field(default_factory=set)


class WatchNotifier:
    def __init__(self, address: str):
        self.address = address
        self.client: Optional[BleakClient] = None
        self.connected = False
        self.lock = asyncio.Lock()

    async def connect(self):
        async with self.lock:
            if self.connected:
                return True
            try:
                print(f"\n🔗 워치 연결 중...")
                self.client = BleakClient(self.address)
                await self.client.connect()
                self.connected = True
                print("✅ 워치 연결됨!")
                return True
            except Exception as e:
                print(f"❌ 연결 실패: {e}")
                return False

    async def disconnect(self):
        if self.client and self.connected:
            await self.client.disconnect()
            self.connected = False

    def build_packet(self, message: str) -> list[bytes]:
        if len(message) > 128:
            message = message[:125] + "..."
        content = message.encode('utf-8')
        length = len(content)

        first_len = min(7, length)
        packet = bytearray([
            0x02, 0x11,
            length & 0xFF, (length >> 8) & 0xFF, 0, 0,
            0x01, 0xFF, 0, 0, 0x01, 0x01, first_len
        ])
        packet.extend(content[:first_len])
        packets = [bytes(packet)]

        offset, seq = 7, 1
        while offset < length:
            p = bytearray([0x02, 0x11, seq & 0xFF, 0])
            p.extend(content[offset:offset+16])
            packets.append(bytes(p))
            offset += 16
            seq += 1
        return packets

    async def send(self, message: str) -> bool:
        if not self.connected:
            if not await self.connect():
                return False
        try:
            for pkt in self.build_packet(message):
                await self.client.write_gatt_char(WRITE_CHAR, pkt, response=True)
                await asyncio.sleep(0.05)
            return True
        except Exception as e:
            print(f"❌ 전송 실패: {e}")
            self.connected = False
            return False


class StudentTimer:
    def __init__(self):
        self.students: dict[str, Student] = {}
        self.notifier = WatchNotifier(DEVICE_ADDRESS)
        self.running = False
        self.alert_minutes = ALERT_MINUTES_BEFORE

    def add(self, name: str, times: list[str]):
        self.students[name] = Student(name=name, schedule=times)

    def remove(self, name: str):
        if name in self.students:
            del self.students[name]

    def list_students(self):
        print("\n" + "=" * 45)
        print("📋 등록된 학생 (수업 시간)")
        print("-" * 45)
        if not self.students:
            print("  (없음)")
        for s in self.students.values():
            print(f"  {s.name}: {', '.join(s.schedule)}")
        print("=" * 45)

    def get_alerts(self) -> list[tuple[str, str, int]]:
        now = datetime.now()
        alerts = []
        for s in self.students.values():
            for t in s.schedule:
                h, m = map(int, t.split(':'))
                ct = now.replace(hour=h, minute=m, second=0, microsecond=0)
                key = f"{now.date()}_{t}"
                if key in s.alerted_times:
                    continue
                diff = (ct - now).total_seconds() / 60
                if 0 <= diff <= self.alert_minutes:
                    alerts.append((s.name, t, int(diff)))
                    s.alerted_times.add(key)
        return alerts

    async def check(self):
        for name, t, mins in self.get_alerts():
            msg = f"{name} {'수업 시작!' if mins == 0 else f'{mins}분 후 수업!'}"
            print(f"\n🔔 {msg}")
            await self.notifier.send(msg)

    async def run_loop(self, interval=30):
        self.running = True
        await self.notifier.connect()
        while self.running:
            await self.check()
            await asyncio.sleep(interval)
        await self.notifier.disconnect()

    def stop(self):
        self.running = False


async def send_test_notification(notifier: WatchNotifier, msg: str):
    """테스트 알림 전송"""
    print(f"\n📤 테스트 알림: {msg}")
    if await notifier.send(msg):
        print("✅ 전송 성공!")
    else:
        print("❌ 전송 실패")


async def interactive_menu(timer: StudentTimer):
    """인터랙티브 메뉴"""
    print("\n" + "=" * 45)
    print("  학생 수업 타이머 + P5S 워치 알림")
    print("=" * 45)

    # 샘플 학생 추가
    timer.add("김철수", ["15:00", "16:30"])
    timer.add("이영희", ["15:30"])
    timer.add("박민수", ["14:00", "17:00"])

    timer_task = None

    while True:
        print("\n[메뉴]")
        print("  1. 학생 목록 보기")
        print("  2. 학생 추가")
        print("  3. 학생 제거")
        print("  4. 테스트 알림 보내기")
        print("  5. 1분 후 테스트 타이머 추가")
        print("  6. 타이머 시작")
        print("  7. 타이머 중지")
        print("  q. 종료")

        try:
            choice = input("\n선택: ").strip()
        except EOFError:
            break

        if choice == '1':
            timer.list_students()

        elif choice == '2':
            name = input("학생 이름: ").strip()
            times = input("수업 시간 (쉼표 구분, 예: 15:00,16:30): ").strip()
            times = [t.strip() for t in times.split(',')]
            timer.add(name, times)
            print(f"✅ {name} 추가됨")

        elif choice == '3':
            name = input("제거할 학생 이름: ").strip()
            timer.remove(name)
            print(f"✅ {name} 제거됨")

        elif choice == '4':
            msg = input("알림 메시지: ").strip() or "테스트 알림!"
            await send_test_notification(timer.notifier, msg)

        elif choice == '5':
            test_time = (datetime.now() + timedelta(minutes=1)).strftime("%H:%M")
            timer.add("⏰테스트", [test_time])
            print(f"✅ 1분 후 ({test_time}) 테스트 알림 예약됨")

        elif choice == '6':
            if timer.running:
                print("⚠️ 이미 실행 중!")
            else:
                print("🚀 타이머 시작!")
                timer_task = asyncio.create_task(timer.run_loop(30))

        elif choice == '7':
            if timer.running:
                timer.stop()
                print("⏹️ 타이머 중지됨")
            else:
                print("⚠️ 실행 중이 아님")

        elif choice == 'q':
            timer.stop()
            if timer_task:
                timer_task.cancel()
            print("👋 종료!")
            break


async def main():
    timer = StudentTimer()
    await interactive_menu(timer)


if __name__ == "__main__":
    asyncio.run(main())
