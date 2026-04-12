import { RoomRedirector } from "@/components/rooms/room-redirector";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  return <RoomRedirector roomId={roomId} />;
}
