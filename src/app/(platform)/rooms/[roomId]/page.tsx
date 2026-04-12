import { RoomView } from "@/components/rooms/room-view";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  return (
    <div className="min-h-screen bg-black pb-24">
      <RoomView roomId={roomId} />
    </div>
  );
}
