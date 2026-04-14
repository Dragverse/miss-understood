import { redirect } from "next/navigation";

export default function LivePage({ params }: { params: { handle: string } }) {
  redirect(`/u/${params.handle}`);
}
