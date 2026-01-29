"""
P5S 알림 패킷 테스트 스크립트
"""
import asyncio
from bleak import BleakClient, BleakScanner

DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"

SERVICE_UUID = "000001ff-3c17-d293-8e48-14fe2e4da212"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR = "0000ff03-0000-1000-8000-00805f9b34fb"

# 알림 관련 추정 명령어들
NOTIFICATION_TESTS = [
    # 일반적인 중국 워치 알림 패킷 구조
    # [CMD] [TYPE] [LEN] [TITLE...] [00] [MESSAGE...]

    # 명령어 03, 04, 05 테스트 (알림 관련일 가능성)
    ("CMD 03", bytes([0x03])),
    ("CMD 04", bytes([0x04])),
    ("CMD 05", bytes([0x05])),
    ("CMD 06", bytes([0x06])),
    ("CMD 07", bytes([0x07])),
    ("CMD 08", bytes([0x08])),
    ("CMD 09", bytes([0x09])),
    ("CMD 0A", bytes([0x0A])),

    # 알림 타입별 테스트 (일반적인 패턴)
    # Type: 01=전화, 02=SMS, 03=카카오톡, etc
    ("Notify Type 01", bytes([0x03, 0x01, 0x04, 0x54, 0x65, 0x73, 0x74])),  # Test
    ("Notify Type 02", bytes([0x03, 0x02, 0x04, 0x54, 0x65, 0x73, 0x74])),
    ("Notify Type 03", bytes([0x03, 0x03, 0x04, 0x54, 0x65, 0x73, 0x74])),

    # 다른 구조 테스트
    ("Alt1", bytes([0x00, 0x03, 0x00, 0x01, 0x48, 0x69])),  # Hi
    ("Alt2", bytes([0x01, 0x03, 0x00, 0x01, 0x48, 0x69])),
    ("Alt3", bytes([0x03, 0x00, 0x01, 0x48, 0x69])),

    # 긴 메시지 테스트
    ("Long MSG", bytes([0x03, 0x01, 0x00, 0x0B]) + "Hello World".encode('utf-8')),

    # WeChat 스타일
    ("WeChat1", bytes([0xFE, 0x03, 0x00, 0x05]) + "Test!".encode('utf-8')),
    ("WeChat2", bytes([0x01, 0xFE, 0x03, 0x00, 0x05]) + "Test!".encode('utf-8')),
]

responses = []

def notification_handler(sender, data):
    print(f"  📥 응답: {data.hex()}")
    try:
        ascii_str = data.decode('utf-8', errors='ignore')
        if ascii_str.strip():
            print(f"     ASCII: {ascii_str}")
    except:
        pass
    responses.append(data)

async def main():
    print("=" * 60)
    print("  P5S 알림 패킷 테스트")
    print("=" * 60)

    print(f"\n🔗 {DEVICE_ADDRESS} 연결 중...")

    async with BleakClient(DEVICE_ADDRESS) as client:
        print("  ✅ 연결됨!")

        await client.start_notify(NOTIFY_CHAR, notification_handler)
        print("  ✅ Notify 활성화됨\n")

        print("=" * 60)
        print(" 알림 패킷 테스트 시작 (워치 화면 주시!)")
        print("=" * 60)

        for name, packet in NOTIFICATION_TESTS:
            print(f"\n[{name}] 전송: {packet.hex()}")
            responses.clear()

            try:
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                print("  ✅ Write 성공")
                await asyncio.sleep(1.5)

                if not responses:
                    print("  ⚠️ 응답 없음")

            except Exception as e:
                print(f"  ❌ 실패: {e}")

            # 사용자 입력 대기 (워치 반응 확인)
            user = input("  워치에 뭔가 떴나요? (y/n/q=종료): ").strip().lower()
            if user == 'y':
                print(f"  🎉 성공! 패킷: {packet.hex()}")
                break
            elif user == 'q':
                break

        await client.stop_notify(NOTIFY_CHAR)

    print("\n✅ 테스트 완료!")

if __name__ == "__main__":
    asyncio.run(main())
