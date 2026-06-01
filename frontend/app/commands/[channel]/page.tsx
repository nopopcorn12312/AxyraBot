import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ channel: string }>;
}

export default async function CommandsChannelPage({ params }: Props) {
  const { channel } = await params;
  redirect(`/commands?view=custom&channel=${encodeURIComponent(channel)}`);
}
