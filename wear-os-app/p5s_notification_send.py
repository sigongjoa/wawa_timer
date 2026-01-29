"""
P5S 알림 전송 스크립트
- Zmoofit 앱 리버스 엔지니어링 결과 기반
"""
import asyncio
from bleak import BleakClient

# P5S 정보
DEVICE_ADDRESS = "01:BC:8D:DB:2C:15"  # 본인 워치 주소

# Realtek UUID (P5S)
SERVICE_UUID = "000001ff-3c17-d293-8e48-14fe2e4da212"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR = "0000ff03-0000-1000-8000-00805f9b34fb"

# 알림 타입
class NotifyType:
    PHONE = 0       # 전화
    SMS = 1         # 문자
    INSTAGRAM = 2
    WECHAT = 3      # 위챗
    QQ = 4
    LINE = 5
    LINKEDIN = 6
    WHATSAPP = 7
    TWITTER = 8
    FACEBOOK = 9
    MESSENGER = 10
    SKYPE = 11
    SNAPCHAT = 12
    ALIPAY = 13
    TAOBAO = 14
    DOUYIN = 15
    DINGTALK = 16
    JD = 17
    GMAIL = 18
    VIBER = 19
    YOUTUBE = 20
    KAKAO = 21      # 카카오톡
    TELEGRAM = 22
    OTHER = 255     # 기타


def build_notification_packet(message: str, notify_type: int = NotifyType.OTHER) -> list:
    """
    알림 패킷 생성 (Zmoofit 프로토콜)

    패킷 구조:
    [0] = 0x02              - 명령 헤더
    [1] = 0x11 (17)         - 알림 명령
    [2-5] = 길이            - 4바이트, 리틀엔디안
    [6] = 0x01              - 고정
    [7] = TYPE              - 알림 타입
    [8-9] = 시퀀스          - 2바이트
    [10] = 0x01
    [11] = 0x01
    [12] = 데이터길이
    [13~] = UTF-8 텍스트
    """
    # 메시지 최대 128자
    if len(message) > 128:
        message = message[:125] + "..."

    content = message.encode('utf-8')
    length = len(content)

    packets = []

    # 첫 번째 패킷 (최대 7바이트 데이터)
    first_data_len = min(7, length)

    packet = bytearray()
    packet.append(0x02)  # 명령 헤더
    packet.append(0x11)  # 알림 명령 (17)

    # 총 길이 (4바이트, 리틀엔디안)
    packet.append(length & 0xFF)
    packet.append((length >> 8) & 0xFF)
    packet.append((length >> 16) & 0xFF)
    packet.append((length >> 24) & 0xFF)

    packet.append(0x01)  # 고정
    packet.append(notify_type & 0xFF)  # 알림 타입

    # 시퀀스 번호 (첫 패킷 = 0)
    packet.append(0x00)
    packet.append(0x00)

    packet.append(0x01)  # 고정
    packet.append(0x01)  # 고정
    packet.append(first_data_len)  # 이 패킷의 데이터 길이

    # 데이터 추가
    packet.extend(content[:first_data_len])

    packets.append(bytes(packet))

    # 후속 패킷들 (16바이트씩)
    offset = 7
    seq = 1
    while offset < length:
        chunk_len = min(16, length - offset)

        packet = bytearray()
        packet.append(0x02)
        packet.append(0x11)
        packet.append(seq & 0xFF)
        packet.append((seq >> 8) & 0xFF)
        packet.extend(content[offset:offset + chunk_len])

        packets.append(bytes(packet))
        offset += 16
        seq += 1

    return packets


def notification_handler(sender, data):
    """Notify 응답 처리"""
    print(f"  📥 응답: {data.hex()}")


async def send_notification(address: str, message: str, notify_type: int = NotifyType.OTHER):
    """알림 전송"""
    print(f"\n🔗 {address} 연결 중...")

    async with BleakClient(address) as client:
        print("  ✅ 연결됨!")

        # Notify 구독
        await client.start_notify(NOTIFY_CHAR, notification_handler)
        print("  ✅ Notify 활성화")

        # 패킷 생성
        packets = build_notification_packet(message, notify_type)

        print(f"\n📤 알림 전송: '{message}' (타입: {notify_type})")
        print(f"   패킷 수: {len(packets)}")

        for i, packet in enumerate(packets):
            print(f"   [{i+1}] {packet.hex()}")
            try:
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                print(f"       ✅ 전송 성공")
                await asyncio.sleep(0.1)  # 패킷 간 딜레이
            except Exception as e:
                print(f"       ❌ 전송 실패: {e}")

        # 응답 대기
        await asyncio.sleep(2)

        await client.stop_notify(NOTIFY_CHAR)

    print("\n✅ 완료!")


async def main():
    print("=" * 60)
    print("  P5S 알림 전송 테스트")
    print("  (Zmoofit 리버스 엔지니어링 기반)")
    print("=" * 60)

    # 테스트 알림들
    tests = [
        ("Hello!", NotifyType.OTHER),
        ("학생 입실", NotifyType.OTHER),
        ("카카오톡 테스트", NotifyType.KAKAO),
        ("SMS 테스트", NotifyType.SMS),
    ]

    for message, ntype in tests:
        await send_notification(DEVICE_ADDRESS, message, ntype)

        user = input("\n👀 워치에 알림이 떴나요? (y=성공/n=다음/q=종료): ").strip().lower()
        if user == 'y':
            print(f"\n🎉 성공! 타입: {ntype}, 메시지: {message}")
            break
        elif user == 'q':
            break


if __name__ == "__main__":
    asyncio.run(main())
