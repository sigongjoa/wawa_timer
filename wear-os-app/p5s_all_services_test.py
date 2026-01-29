"""
P5S 모든 서비스 알림 테스트
"""
import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"

# 모든 Write/Notify 쌍
SERVICES = [
    {
        "name": "Service 01ff (메인)",
        "write": "0000ff02-0000-1000-8000-00805f9b34fb",
        "notify": "0000ff03-0000-1000-8000-00805f9b34fb",
    },
    {
        "name": "Service d0ff",
        "write": "0000ffd1-0000-1000-8000-00805f9b34fb",
        "notify": None,  # Notify 없음
    },
    {
        "name": "Service 6287",
        "write": "00006387-3c17-d293-8e48-14fe2e4da212",
        "notify": "00006487-3c17-d293-8e48-14fe2e4da212",
    },
    {
        "name": "Service 494d (ba26/ba27)",
        "write": "0000ba26-0000-1000-8000-00805f9b34fb",
        "notify": "0000ba27-0000-1000-8000-00805f9b34fb",
    },
    {
        "name": "Service 02fd",
        "write": "0000fd03-0000-1000-8000-00805f9b34fb",
        "notify": "0000fd04-0000-1000-8000-00805f9b34fb",
    },
]

# 테스트 패킷들
TEST_PACKETS = [
    ("Simple 01", bytes([0x01])),
    ("Simple 02", bytes([0x02])),
    ("Notify test", bytes([0x01, 0x00, 0x05]) + "Hello".encode('utf-8')),
    ("Alt notify", bytes([0x00, 0x01, 0x05]) + "Hello".encode('utf-8')),
    ("Type 01", bytes([0x01, 0x01, 0x05]) + "Test!".encode('utf-8')),
    ("Type 02", bytes([0x02, 0x01, 0x05]) + "Test!".encode('utf-8')),
]

def make_handler(name):
    def handler(sender, data):
        print(f"  📥 [{name}] 응답: {data.hex()}")
    return handler

async def main():
    print("=" * 60)
    print("  P5S 모든 서비스 테스트")
    print("=" * 60)

    async with BleakClient(DEVICE_ADDRESS) as client:
        print("✅ 연결됨!\n")

        for svc in SERVICES:
            print("=" * 60)
            print(f"🔧 {svc['name']}")
            print(f"   Write: {svc['write']}")
            print("=" * 60)

            # Notify 구독
            if svc['notify']:
                try:
                    await client.start_notify(svc['notify'], make_handler(svc['name']))
                    print(f"  ✅ Notify 구독됨")
                except Exception as e:
                    print(f"  ⚠️ Notify 실패: {e}")

            # 패킷 테스트
            for pkt_name, packet in TEST_PACKETS:
                print(f"\n  [{pkt_name}] 전송: {packet.hex()}")
                try:
                    await client.write_gatt_char(svc['write'], packet, response=True)
                    print(f"    ✅ Write 성공")
                except Exception as e:
                    print(f"    ❌ 실패: {e}")

                await asyncio.sleep(1)

                user = input("    워치 반응? (y=성공/n=없음/q=종료): ").strip().lower()
                if user == 'y':
                    print(f"\n🎉 찾았다! 서비스: {svc['name']}, 패킷: {packet.hex()}")
                    return
                elif user == 'q':
                    return

            # Notify 해제
            if svc['notify']:
                try:
                    await client.stop_notify(svc['notify'])
                except:
                    pass

            print()

    print("\n✅ 전체 테스트 완료!")

if __name__ == "__main__":
    asyncio.run(main())
