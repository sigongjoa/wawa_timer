"""
학생 타이머 + P5S 워치 알림
- 학생별 타이머 (카운트다운)
- 동시에 여러 명 타이머 관리
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from bleak import BleakClient

# ========== P5S 워치 설정 ==========
DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"


class WatchNotifier:
    def __init__(self, address: str):
        self.address = address
        self.client: Optional[BleakClient] = None
        self.connected = False

    async def connect(self):
        if self.connected:
            return True
        try:
            print(f"🔗 워치 연결 중...")
            self.client = BleakClient(self.address)
            await self.client.connect()
            self.connected = True
            print("✅ 워치 연결됨!\n")
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


class Timer:
    """개별 타이머"""
    def __init__(self, name: str, minutes: int, callback):
        self.name = name
        self.minutes = minutes
        self.end_time = datetime.now() + timedelta(minutes=minutes)
        self.callback = callback
        self.task: Optional[asyncio.Task] = None
        self.cancelled = False

    @property
    def remaining(self) -> int:
        """남은 초"""
        return max(0, int((self.end_time - datetime.now()).total_seconds()))

    @property
    def remaining_str(self) -> str:
        """남은 시간 문자열"""
        r = self.remaining
        m, s = divmod(r, 60)
        return f"{m:02d}:{s:02d}"

    async def run(self):
        """타이머 실행"""
        await asyncio.sleep(self.remaining)
        if not self.cancelled:
            await self.callback(self.name)

    def cancel(self):
        """타이머 취소"""
        self.cancelled = True
        if self.task:
            self.task.cancel()


class TimerManager:
    """타이머 관리자"""
    def __init__(self):
        self.timers: dict[str, Timer] = {}
        self.notifier = WatchNotifier(DEVICE_ADDRESS)

    async def on_timer_end(self, name: str):
        """타이머 종료 시 호출"""
        msg = f"⏰ {name} 시간 종료!"
        print(f"\n🔔 {msg}")
        await self.notifier.send(msg)

        # 타이머 목록에서 제거
        if name in self.timers:
            del self.timers[name]

    def add_timer(self, name: str, minutes: int):
        """타이머 추가"""
        # 기존 타이머 있으면 취소
        if name in self.timers:
            self.timers[name].cancel()

        timer = Timer(name, minutes, self.on_timer_end)
        timer.task = asyncio.create_task(timer.run())
        self.timers[name] = timer
        print(f"✅ {name} - {minutes}분 타이머 시작!")

    def cancel_timer(self, name: str):
        """타이머 취소"""
        if name in self.timers:
            self.timers[name].cancel()
            del self.timers[name]
            print(f"❌ {name} 타이머 취소됨")
        else:
            print(f"⚠️ {name} 타이머 없음")

    def list_timers(self):
        """타이머 목록"""
        print("\n" + "=" * 40)
        print("⏱️  활성 타이머")
        print("-" * 40)
        if not self.timers:
            print("  (없음)")
        else:
            for name, timer in self.timers.items():
                print(f"  {name}: {timer.remaining_str} 남음")
        print("=" * 40)

    async def connect(self):
        """워치 연결"""
        await self.notifier.connect()

    async def disconnect(self):
        """워치 연결 해제"""
        await self.notifier.disconnect()


async def main():
    print("=" * 40)
    print("  학생 타이머 + P5S 워치 알림")
    print("=" * 40)

    manager = TimerManager()
    await manager.connect()

    print("\n[명령어]")
    print("  add 이름 분  : 타이머 추가 (예: add 김철수 30)")
    print("  del 이름     : 타이머 취소 (예: del 김철수)")
    print("  list         : 타이머 목록")
    print("  test 메시지  : 테스트 알림 (예: test 안녕)")
    print("  q            : 종료")
    print("-" * 40)

    while True:
        try:
            # 현재 타이머 상태 표시
            if manager.timers:
                status = " | ".join([f"{n}:{t.remaining_str}" for n, t in manager.timers.items()])
                print(f"\r[{status}]", end="")

            # 입력 대기 (비동기)
            cmd = await asyncio.get_event_loop().run_in_executor(
                None, lambda: input("\n> ").strip()
            )

            parts = cmd.split(maxsplit=2)
            if not parts:
                continue

            action = parts[0].lower()

            if action == 'add' and len(parts) >= 3:
                name = parts[1]
                try:
                    minutes = int(parts[2])
                    manager.add_timer(name, minutes)
                except ValueError:
                    print("⚠️ 분은 숫자로!")

            elif action == 'del' and len(parts) >= 2:
                manager.cancel_timer(parts[1])

            elif action == 'list':
                manager.list_timers()

            elif action == 'test':
                msg = parts[1] if len(parts) > 1 else "테스트!"
                print(f"📤 전송: {msg}")
                await manager.notifier.send(msg)
                print("✅ 전송 완료!")

            elif action == 'q':
                break

            else:
                print("⚠️ 명령: add/del/list/test/q")

        except (EOFError, KeyboardInterrupt):
            break

    # 정리
    for timer in manager.timers.values():
        timer.cancel()
    await manager.disconnect()
    print("\n👋 종료!")


if __name__ == "__main__":
    asyncio.run(main())
