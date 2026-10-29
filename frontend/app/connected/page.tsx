interface ConnectedPageProps {
  searchParams: Promise<{
    login?: string;
  }>;
}

export default async function ConnectedPage({ searchParams }: ConnectedPageProps) {
  const { login } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-ax-bg">
      <div className="max-w-md w-full rounded-md border border-ax-subtle bg-ax-section p-8 text-center shadow-glow backdrop-blur-md">
        <h1 className="text-2xl sm:text-3xl font-semibold text-ax-heading">
          Twitch connected
        </h1>
        <p className="mt-4 text-sm text-ax-secondary">
          {login
            ? `AxyraBot is now configured to join ${login}'s channel when the bot is running.`
            : "Your Twitch account has been connected. AxyraBot will join your channel when the bot is running."}
        </p>
        <p className="mt-6 text-xs text-ax-secondary">
          You can close this tab and return to your stream.
        </p>
      </div>
    </main>
  );
}
