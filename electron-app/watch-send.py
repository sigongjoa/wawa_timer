"""
P5S 워치 알림 전송 스크립트
사용법: python watch-send.py <MAC주소> <메시지>
"""
import sys
import asyncio
from bleak import BleakClient, BleakScanner

SERVICE_UUID = "000001ff-3c17-d293-8e48-14fe2e4da212"
WRITE_CHAR = "0000ff02-0000-1000-8000-00805f9b34fb"
NOTIFY_CHAR = "0000ff03-0000-1000-8000-00805f9b34fb"


def notification_handler(sender, data):
    """Notify 응답 처리"""
    pass  # 응답 받음


def build_packet(message: str, notify_type: int = 255) -> list:
    """알림 패킷 생성 (p5s_notification_send.py와 동일)"""
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


async def send_notification(mac_address: str, message: str):
    """알림 전송"""
    try:
        # Windows에서 BLE Random 주소 직접 연결 불가 - 스캔 필요
        device = await BleakScanner.find_device_by_address(mac_address, timeout=10.0)
        if not device:
            print(f"ERROR: Device {mac_address} not found in scan")
            return

        async with BleakClient(device) as client:
            # Notify 구독
            await client.start_notify(NOTIFY_CHAR, notification_handler)

            # 패킷 생성 및 전송
            packets = build_packet(message)

            for packet in packets:
                await client.write_gatt_char(WRITE_CHAR, packet, response=True)
                await asyncio.sleep(0.1)  # 패킷 간 딜레이

            # 응답 대기 (중요!)
            await asyncio.sleep(2)

            await client.stop_notify(NOTIFY_CHAR)

            print("OK")
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("ERROR: 사용법: python watch-send.py <MAC주소> <메시지>")
        sys.exit(1)

    mac_address = sys.argv[1]
    message = " ".join(sys.argv[2:])

    asyncio.run(send_notification(mac_address, message))
