"""
P5S Service 02fd (fd03) 집중 테스트
- 알림 기능 후보!
"""
import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"

# Service 02fd
WRITE_CHAR = "0000fd03-0000-1000-8000-00805f9b34fb"

# 다양한 알림 패킷 테스트
TEST_PACKETS = [
    # 기본 테스트
    ("01", bytes([0x01])),
    ("02", bytes([0x02])),

    # 아까 반응 있었던 것 근처
    ("01 01 05 Test!", bytes([0x01, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("01 00 05 Hello", bytes([0x01, 0x00, 0x05]) + "Hello".encode('utf-8')),
    ("00 01 05 Hello", bytes([0x00, 0x01, 0x05]) + "Hello".encode('utf-8')),

    # 알림 타입 변형
    ("01 01 + 학생입실", bytes([0x01, 0x01, 0x0C]) + "학생 입실".encode('utf-8')),
    ("01 02 + 학생입실", bytes([0x01, 0x02, 0x0C]) + "학생 입실".encode('utf-8')),
    ("01 03 + 학생입실", bytes([0x01, 0x03, 0x0C]) + "학생 입실".encode('utf-8')),

    # 다른 명령어
    ("02 01 + Test", bytes([0x02, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("03 01 + Test", bytes([0x03, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("04 01 + Test", bytes([0x04, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("05 01 + Test", bytes([0x05, 0x01, 0x05]) + "Test!".encode('utf-8')),

    # 더 긴 구조
    ("00 01 01 05 Test", bytes([0x00, 0x01, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("01 00 01 05 Test", bytes([0x01, 0x00, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("01 01 00 05 Test", bytes([0x01, 0x01, 0x00, 0x05]) + "Test!".encode('utf-8')),

    # 전화 알림 스타일
    ("Call style 1", bytes([0x01, 0x00]) + "010-1234-5678".encode('utf-8')),
    ("Call style 2", bytes([0x01, 0x01]) + "010-1234-5678".encode('utf-8')),

    # SMS 스타일
    ("SMS style 1", bytes([0x02, 0x00, 0x05]) + "Hello".encode('utf-8')),
    ("SMS style 2", bytes([0x02, 0x01, 0x05]) + "Hello".encode('utf-8')),
]

async def main():
    print("=" * 60)
    print("  P5S fd03 서비스 집중 테스트")
    print("  Write: " + WRITE_CHAR)
    print("=" * 60)
    print("\n⚠️ 워치 화면 계속 보세요!")
    print("⚠️ 진동/알림/화면변화 있으면 바로 y 누르세요!\n")

    async with BleakClient(DEVICE_ADDRESS) as client:
        print("✅ 연결됨!\n")

        for name, packet in TEST_PACKETS:
            print(f"[{name}]")
            print(f"  전송: {packet.hex()}")

            try:
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                print("  ✅ Write 성공")
            except Exception as e:
                print(f"  ❌ 실패: {e}")
                continue

            await asyncio.sleep(1.5)

            user = input("  👀 워치 반응? (y/n/q): ").strip().lower()
            if user == 'y':
                print(f"\n" + "=" * 60)
                print(f"🎉 찾았다!")
                print(f"   서비스: fd03")
                print(f"   패킷: {packet.hex()}")
                print(f"   이름: {name}")
                print("=" * 60)

                # 한번 더 보내서 확인
                input("\n다시 보내볼까요? Enter 누르세요...")
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                print("✅ 다시 전송함!")
                return
            elif user == 'q':
                return

            print()

    print("\n✅ 테스트 완료!")

if __name__ == "__main__":
    asyncio.run(main())
