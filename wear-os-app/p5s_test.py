"""
P5S 스마트워치 BLE 프로토콜 테스트 스크립트
"""
import asyncio
from bleak import BleakClient, BleakScanner

# P5S 정보
DEVICE_NAME = "P5S_2C15"
DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"  # 본인 워치 주소로 변경

# 특성 UUID
SERVICE_UUID = "000001ff-3c17-d293-8e48-14fe2e4da212"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR = "0000ff03-0000-1000-8000-00805f9b34fb"

# 테스트할 패킷들
TEST_PACKETS = [
    bytes([0x01]),
    bytes([0x02]),
    bytes([0x00, 0x01]),
    bytes([0x01, 0x00, 0x00, 0x00]),
    bytes([0xFE, 0x01, 0x00, 0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F]),  # Hello
    bytes([0x01, 0x00, 0x00, 0x00, 0x54, 0x65, 0x73, 0x74]),  # Test
    bytes([0x00, 0x00, 0x00, 0x01, 0x54, 0x65, 0x73, 0x74]),
]

def notification_handler(sender, data):
    """Notify 응답 처리"""
    print(f"  📥 응답 수신: {data.hex()}")
    print(f"     ASCII: {data.decode('utf-8', errors='ignore')}")

async def scan_for_p5s():
    """P5S 워치 스캔"""
    print("🔍 P5S 워치 검색 중...")
    devices = await BleakScanner.discover()
    for d in devices:
        if d.name and "P5S" in d.name:
            print(f"  ✅ 발견: {d.name} ({d.address})")
            return d.address
    return None

async def test_packets(address):
    """패킷 테스트 실행"""
    print(f"\n🔗 {address} 연결 중...")

    async with BleakClient(address) as client:
        print(f"  ✅ 연결됨!")

        # Notify 구독
        print(f"\n📡 Notify 구독 중 ({NOTIFY_CHAR})...")
        await client.start_notify(NOTIFY_CHAR, notification_handler)
        print("  ✅ Notify 활성화됨")

        # 테스트 패킷 전송
        print(f"\n📤 테스트 패킷 전송 시작...")
        print("=" * 50)

        for i, packet in enumerate(TEST_PACKETS):
            print(f"\n[테스트 {i+1}] 전송: {packet.hex()}")
            try:
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                print(f"  ✅ Write 성공!")
                await asyncio.sleep(2)  # 응답 대기
            except Exception as e:
                print(f"  ❌ 실패: {e}")

        print("\n" + "=" * 50)
        print("✅ 테스트 완료!")

        # Notify 해제
        await client.stop_notify(NOTIFY_CHAR)

async def main():
    print("=" * 50)
    print("  P5S BLE 프로토콜 테스트")
    print("=" * 50)

    # 스캔 또는 직접 연결
    address = await scan_for_p5s()
    if not address:
        print(f"⚠️ P5S를 찾지 못함. 직접 주소 사용: {DEVICE_ADDRESS}")
        address = DEVICE_ADDRESS

    await test_packets(address)

if __name__ == "__main__":
    asyncio.run(main())
