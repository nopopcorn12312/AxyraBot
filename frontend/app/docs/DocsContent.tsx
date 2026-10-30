import Link from "next/link";
import type { ReactNode } from "react";

// How-to documentation for AxyraBot. Everything here describes what the bot
// actually does today (backend/main.go, backend/timers.go, backend/discord.go),
// so keep it in step when commands or variables change.

export const docsSections = [
  { id: "getting-started", label: "Getting started" },
  { id: "chat-commands", label: "Chat commands" },
  { id: "custom-commands", label: "Custom commands" },
  { id: "variables", label: "Variables" },
  { id: "moderation", label: "Moderation" },
  { id: "modules", label: "Modules" },
  { id: "timers", label: "Timers" },
  { id: "birthdays", label: "Birthdays" },
  { id: "giveaways", label: "Giveaways" },
  { id: "discord", label: "Discord" },
  { id: "importing", label: "Importing commands" },
  { id: "access", label: "Editors & access" },
] as const;

type SectionId = (typeof docsSections)[number]["id"];

export function Code({ children }: { children: ReactNode }) {
  // Long examples may wrap on narrow phones rather than widen the page.
  return <code className="rounded bg-ax-raised px-1.5 py-0.5 font-mono text-[0.85em] text-ax-heading [overflow-wrap:anywhere] [box-decoration-break:clone]">{children}</code>;
}

function DocSection({ id, children }: { id: SectionId; children: ReactNode }) {
  const label = docsSections.find((s) => s.id === id)?.label;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4 border-t border-ax-subtle pt-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="font-display text-2xl font-semibold text-ax-heading">
        {label}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl leading-relaxed text-ax-body">{children}</p>;
}

function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-20 pt-2 text-lg font-semibold text-ax-heading">
      {children}
    </h3>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-3xl rounded-md border border-ax-subtle border-l-ax-accent bg-ax-raised/40 px-4 py-3 text-sm leading-relaxed text-ax-body [border-left-width:3px]">
      {children}
    </p>
  );
}

// A table that scrolls sideways on its own on narrow screens instead of
// widening the page.
function Table({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-ax-subtle" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead className="bg-ax-raised/50">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ax-subtle">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 leading-relaxed ${j === 0 ? "whitespace-nowrap" : "text-ax-body"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="max-w-3xl list-decimal space-y-2 pl-5 leading-relaxed text-ax-body marker:font-mono marker:text-ax-secondary">{children}</ol>;
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-ax-body marker:text-ax-secondary">{children}</ul>;
}

const pageLink = "font-medium text-ax-heading underline decoration-ax-accent underline-offset-2 hover:decoration-2";

// "Works in" labels for the variable tables.
function Where({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((w) => (
        <span key={w} className="whitespace-nowrap rounded border border-ax-border px-1.5 py-0.5 text-xs text-ax-secondary">
          {w}
        </span>
      ))}
    </span>
  );
}

const variableGroups: { id: string; title: string; intro: string; rows: [string, ReactNode, string[]][] }[] = [
  {
    id: "variables-people",
    title: "People",
    intro: "Name someone in the message: whoever used the command, who they mentioned, or someone else in chat.",
    rows: [
      ["$(user)", <>The person who used the command. AxyraBot starts its reply with an @mention of them (a real mention on Discord). In a Discord welcome message, it mentions the new member.</>, ["Custom commands", "Discord welcome"]],
      ["$(touser)", <>Whatever was typed after the command, without the @. <Code>!hug @quietfox</Code> gives <Code>quietfox</Code>. If nothing was typed, it&apos;s the person who used the command.</>, ["Custom commands"]],
      ["$(random.chatter)", <>A random viewer who is in chat right now.</>, ["Custom commands", "Timers"]],
      ["$(raider)", <>The channel that just raided you.</>, ["Raid shoutout"]],
      ["$(username)", <>The new member&apos;s Discord username, as plain text without a mention.</>, ["Discord welcome"]],
    ],
  },
  {
    id: "variables-stream",
    title: "Channel and stream",
    intro: "Fill in details about your channel, your current stream, or your Discord server.",
    rows: [
      ["$(channel)", <>Your Twitch channel name.</>, ["Custom commands", "Go live announcement", "Timers", "Discord notifications"]],
      ["$(title)", <>Your current stream title (&ldquo;Untitled stream&rdquo; if it&apos;s empty).</>, ["Go live announcement", "Timers", "Discord live alert"]],
      ["$(game)", <>Your current Twitch category (&ldquo;Just Chatting&rdquo; if it&apos;s empty). In a raid shoutout, it&apos;s what the <em>raider</em> was streaming.</>, ["Go live announcement", "Raid shoutout", "Timers", "Discord live alert"]],
      ["$(server)", <>Your Discord server&apos;s name.</>, ["Discord welcome"]],
    ],
  },
  {
    id: "variables-counters",
    title: "Counters",
    intro: "Show a number that the bot keeps track of.",
    rows: [
      ["$(count)", <>In a custom command: how many times that command has been used in your channel, including this time. In <Code>!birthday</Code>: how many birthdays are today.</>, ["Custom commands", "!birthday"]],
    ],
  },
  {
    id: "variables-birthdays",
    title: "Birthdays and dates",
    intro: "Used in the custom wording for birthday commands (Modules → Birthdays) and the Discord birthday post.",
    rows: [
      ["$(names)", <>Everyone whose birthday it is, separated by commas.</>, ["!birthday", "!nextbday", "Discord birthday post"]],
      ["$(name)", <>The person the command is about.</>, ["!whenbday", "!addbday", "!delbday", "!editbday"]],
      ["$(date)", <>The birthday date: <Code>02/14</Code> in <Code>!whenbday</Code>, <Code>Feb 14</Code> in <Code>!nextbday</Code>.</>, ["!whenbday", "!nextbday"]],
      ["$(month)", <>The month that was saved, as two digits (<Code>02</Code>).</>, ["!addbday", "!addmybday", "!editbday"]],
      ["$(day)", <>The day that was saved, as two digits (<Code>14</Code>).</>, ["!addbday", "!addmybday", "!editbday"]],
    ],
  },
  {
    id: "variables-youtube",
    title: "YouTube uploads (Discord)",
    intro: "Used in the Discord message AxyraBot posts when your YouTube channel uploads a new video.",
    rows: [
      ["$(channel)", <>Your YouTube channel&apos;s name.</>, ["YouTube uploads"]],
      ["$(title)", <>The video&apos;s title.</>, ["YouTube uploads"]],
      ["$(url)", <>A link to the video.</>, ["YouTube uploads"]],
    ],
  },
  {
    id: "variables-modlog",
    title: "Moderation log (Discord)",
    intro: "Used in the Discord alert AxyraBot posts when it deletes a message, times someone out or bans someone in your Twitch chat. A line whose variables are all empty is left out, so \"Message: $(message)\" only shows for deleted messages.",
    rows: [
      ["$(target)", <>The person who was moderated: for a deleted message, who sent it.</>, ["Discord mod alert"]],
      ["$(message)", <>The chat message that was deleted, exactly as it was typed. Empty for bans and timeouts.</>, ["Discord mod alert"]],
      ["$(moderator)", <>Who took the action. For automatic actions, that&apos;s AxyraBot.</>, ["Discord mod alert"]],
      ["$(action)", <>The action: <Code>ban</Code>, <Code>timeout</Code> or <Code>delete</Code>.</>, ["Discord mod alert"]],
      ["$(verb)", <>The action as words: &ldquo;banned&rdquo;, &ldquo;timed out&rdquo; or &ldquo;moderated (message deleted)&rdquo;, so it reads well after &ldquo;was&rdquo;.</>, ["Discord mod alert"]],
      ["$(emoji)", <>An emoji for the action: 🔨 ban, ⏱️ timeout, 🗑️ delete.</>, ["Discord mod alert"]],
      ["$(reason)", <>Why it happened, for example &ldquo;Blocked term: …&rdquo;.</>, ["Discord mod alert"]],
    ],
  },
];

export function DocsContent() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-ax-secondary">Documentation</p>
        <h1 className="font-display text-3xl font-semibold text-ax-heading sm:text-4xl">How to use AxyraBot</h1>
        <P>
          AxyraBot moderates your Twitch chat, answers commands, posts scheduled messages and keeps your Discord server in
          sync. This guide covers everything you can set up, from the first login to the variables you can use in your
          own messages.
        </P>
      </header>

      <DocSection id="getting-started">
        <Steps>
          <li>Click <strong className="text-ax-heading">Connect with Twitch</strong> on the home page and approve the permissions. AxyraBot uses them to moderate, update your title and category, and post in your chat.</li>
          <li>On the <Link href="/dashboard" className={pageLink}>Dashboard</Link>, press <strong className="text-ax-heading">Join channel</strong>. AxyraBot joins your chat and starts listening for commands. Press <strong className="text-ax-heading">Part channel</strong> any time to remove it.</li>
          <li>Turn on the features you want: <Link href="/moderation/blocked-terms" className={pageLink}>Blocked Terms</Link>, <Link href="/moderation/spam-filters" className={pageLink}>Spam Filters</Link>, <Link href="/modules" className={pageLink}>Modules</Link> and <Link href="/commands" className={pageLink}>Commands</Link>.</li>
          <li>Optional: link your Discord server on the <Link href="/discord/settings" className={pageLink}>Discord</Link> page.</li>
        </Steps>
        <Note>
          Every change you make in the dashboard applies right away. There&apos;s nothing to restart, and the Dashboard&apos;s
          Recent Activity lists what changed.
        </Note>
      </DocSection>

      <DocSection id="chat-commands">
        <P>
          These commands are built in. You can turn each one on or off on the <Link href="/commands" className={pageLink}>Commands</Link> page.
          Words in <Code>&lt;angle brackets&gt;</Code> are required; words in <Code>[square brackets]</Code> are optional.
        </P>
        <Table
          label="Built-in chat commands"
          head={["Command", "Who can use it", "What it does"]}
          rows={[
            [<Code key="c">!title &lt;new title&gt;</Code>, "Broadcaster, mods", "Changes your stream title."],
            [<Code key="c">!game &lt;category&gt;</Code>, "Broadcaster, mods", "Changes your Twitch category. Use the category's full name, e.g. !game Elden Ring."],
            [<Code key="c">!uptime</Code>, "Everyone", "Says how long you've been live, or that you're offline."],
            [<Code key="c">!followage [user]</Code>, "Everyone", "How long someone has followed you. Without a name, it's the person asking."],
            [<Code key="c">!accountage [user]</Code>, "Everyone", "How old someone's Twitch account is."],
            [<Code key="c">!watchtime [user]</Code>, "Everyone", "How long someone has watched your streams. Time counts while they chat during a live stream."],
            [<Code key="c">!clip</Code>, "Everyone", "Creates a clip of the last moments of the stream and posts the link."],
            [<Code key="c">!commands</Code>, "Everyone", "Posts a link to your public list of custom commands."],
            [<Code key="c">!vanish</Code>, "Everyone", "Times the person out for one second, which clears their messages. Just for fun."],
          ]}
        />
        <P>The birthday commands are listed under <a href="#birthdays" className={pageLink}>Birthdays</a>.</P>
      </DocSection>

      <DocSection id="custom-commands">
        <P>
          Custom commands are your own <Code>!commands</Code> with your own replies, like <Code>!discord</Code> or <Code>!socials</Code>.
          They work in your Twitch chat and in your linked Discord server.
        </P>
        <H3>From the dashboard</H3>
        <P>
          On the <Link href="/commands" className={pageLink}>Commands</Link> page, add a command, write its reply, and choose who can use it:
          Everyone, VIPs, Moderators or only you. You can also edit, turn off or delete commands there.
        </P>
        <H3>From chat</H3>
        <P>The broadcaster and moderators can manage commands without leaving the stream:</P>
        <Table
          label="Chat commands for managing custom commands"
          head={["Command", "What it does"]}
          rows={[
            [<Code key="c">!addcom !name reply</Code>, <>Creates a command (or replaces it). <Code>!addcom !discord Join us at discord.gg/example</Code></>],
            [<Code key="c">!editcom !name new reply</Code>, "Changes the reply of an existing command."],
            [<Code key="c">!delcom !name</Code>, "Deletes a command."],
          ]}
        />
        <Note>
          Commands added from chat can be used by everyone. To limit one to VIPs or mods, change it on the Commands page.
          Built-in commands like <Code>!title</Code> can&apos;t be replaced, only turned off.
        </Note>
        <P>
          Replies can include <a href="#variables" className={pageLink}>variables</a>. For example, <Code>!hug</Code> with the reply{" "}
          <Code>$(user) gives $(touser) a big hug!</Code> turns <Code>!hug @quietfox</Code> into &ldquo;@nopopcorn gives quietfox a big hug!&rdquo;
        </P>
      </DocSection>

      <DocSection id="variables">
        <P>
          Variables are placeholders written like <Code>$(name)</Code>. When AxyraBot sends the message, it replaces each one with
          real text. They&apos;re grouped below by what they do, and each one lists where you can use it.
        </P>
        <Note>
          A variable only works in the places listed next to it. Anywhere else it&apos;s sent exactly as typed. For example,{" "}
          <Code>$(title)</Code> and <Code>$(game)</Code> don&apos;t work in custom commands yet.
        </Note>
        {variableGroups.map((g) => (
          <div key={g.id} className="space-y-3">
            <H3 id={g.id}>{g.title}</H3>
            <P>{g.intro}</P>
            <Table
              label={`${g.title} variables`}
              head={["Variable", "What it becomes", "Works in"]}
              rows={g.rows.map(([name, desc, where]) => [<Code key="v">{name}</Code>, desc, <Where key="w" items={where} />])}
            />
          </div>
        ))}
      </DocSection>

      <DocSection id="moderation">
        <P>
          AxyraBot checks every chat message against your blocked terms first, then your spam filters. When one matches, it takes the
          action you picked: delete the message, time the person out (60 seconds unless you set a length), or ban them. It
          stops at the first match. Your own messages as the broadcaster are never moderated.
        </P>
        <H3>Blocked terms</H3>
        <P>
          On <Link href="/moderation/blocked-terms" className={pageLink}>Blocked Terms</Link>, add words or phrases that aren&apos;t allowed.
          They match whole words, in any capitalization: blocking &ldquo;cat&rdquo; catches &ldquo;CAT&rdquo; but not &ldquo;category&rdquo;.
        </P>
        <H3>Spam filters</H3>
        <P>On <Link href="/moderation/spam-filters" className={pageLink}>Spam Filters</Link>, turn on any of these:</P>
        <Table
          label="Spam filters"
          head={["Filter", "Catches a message when…"]}
          rows={[
            ["Caps", "It has at least 10 letters and 70% or more of them are capitals."],
            ["Links", "It contains a web address, like https://…, www.… or something.com (also .gg, .tv, .io and other common endings)."],
            ["Length", "It's longer than 400 characters."],
            ["Emotes", "The same word or emote appears 5 or more times."],
          ]}
        />
        <P>If you link Discord, AxyraBot can post an alert there each time it deletes, times out or bans someone. See <a href="#discord" className={pageLink}>Discord</a>.</P>
      </DocSection>

      <DocSection id="modules">
        <P>Modules are optional automations. Turn them on and customize their messages on the <Link href="/modules" className={pageLink}>Modules</Link> page.</P>
        <Table
          label="Modules"
          head={["Module", "What it does", "Variables"]}
          rows={[
            ["Go live announcement", "Posts a message in your chat when your stream goes live.", <span key="v" className="flex flex-wrap gap-1.5"><Code>$(channel)</Code><Code>$(title)</Code><Code>$(game)</Code></span>],
            ["Raid auto-shoutout", "Thanks raiders with a message in chat. It can also send Twitch's own /shoutout, with an optional minimum raid size.", <span key="v" className="flex flex-wrap gap-1.5"><Code>$(raider)</Code><Code>$(game)</Code></span>],
            ["Birthdays", "Turns on the birthday commands and the midnight birthday post.", <a key="v" href="#variables-birthdays" className={pageLink}>Birthday variables</a>],
          ]}
        />
        <P>Timers also live on the Modules page and are explained next.</P>
      </DocSection>

      <DocSection id="timers">
        <P>
          Timers post a message in your chat on a schedule, like your socials every 20 minutes. Create them in the Timers section of the{" "}
          <Link href="/modules" className={pageLink}>Modules</Link> page. You can have several, and each runs on its own.
        </P>
        <Table
          label="Timer settings"
          head={["Setting", "What it means"]}
          rows={[
            ["Messages", "One or more messages, up to 500 characters each. With several, they're sent in order or at random (random never repeats the same one twice in a row)."],
            ["Interval", "How often the timer comes due: every 5 to 1440 minutes."],
            ["Minimum chat messages", "How many messages viewers must have sent recently. Use 0 to always send."],
            ["Counted over the last", "How far back those messages are counted (1–120 minutes). The bot's own messages don't count."],
            ["Only while live", "When on, the timer is skipped while you're offline."],
          ]}
        />
        <H3>When a timer sends</H3>
        <Bullets>
          <li>A new or re-enabled timer waits one full interval before its first message.</li>
          <li>When it comes due, it sends one message, unless chat was too quiet, you&apos;re offline (for &ldquo;only while live&rdquo; timers), or AxyraBot isn&apos;t in your chat. Then it&apos;s skipped.</li>
          <li>Sent or skipped, it waits a full interval again. You&apos;ll never get a burst of catch-up messages after a quiet stretch.</li>
          <li>Timers in the same channel always send at least 30 seconds apart.</li>
        </Bullets>
        <P>
          Timer messages can use <Code>$(channel)</Code>, <Code>$(title)</Code>, <Code>$(game)</Code> and <Code>$(random.chatter)</Code>.
          Each timer shows when it next checks, and why it was last skipped.
        </P>
      </DocSection>

      <DocSection id="birthdays">
        <P>
          With the Birthdays module on, your community can save birthdays and AxyraBot celebrates them at midnight in your time zone.
          Manage the list on the <Link href="/birthdays" className={pageLink}>Birthdays</Link> page, and change any command&apos;s wording on the Modules page.
        </P>
        <Table
          label="Birthday commands"
          head={["Command", "Who can use it", "What it does"]}
          rows={[
            [<Code key="c">!addmybday MM DD</Code>, "Everyone", "Saves your own birthday, e.g. !addmybday 02 14. Once saved, only a mod can change it."],
            [<Code key="c">!birthday</Code>, "Everyone", "Lists today's birthdays."],
            [<Code key="c">!nextbday</Code>, "Everyone", "Shows the next upcoming birthday."],
            [<Code key="c">!whenbday @user</Code>, "Everyone", "Shows someone's saved birthday."],
            [<Code key="c">!addbday name MM DD</Code>, "Broadcaster, mods", "Saves a birthday for someone else."],
            [<Code key="c">!editbday name MM DD</Code>, "Broadcaster, mods", "Changes a saved birthday."],
            [<Code key="c">!delbday name</Code>, "Broadcaster, mods", "Deletes a saved birthday."],
          ]}
        />
      </DocSection>

      <DocSection id="giveaways">
        <P>Run a giveaway from the <Link href="/giveaways" className={pageLink}>Giveaways</Link> page:</P>
        <Steps>
          <li>Set a keyword. Viewers enter by typing it in chat exactly, with nothing else in the message (capitals matter).</li>
          <li>Optionally give subscribers better odds with the subscriber luck multiplier, and turn on chat announcements.</li>
          <li>Press <strong className="text-ax-heading">Start</strong>. Entries appear in the Users list as they come in, and you can remove anyone.</li>
          <li>Stop the giveaway and pick a winner. AxyraBot picks at random, weighted by the multiplier.</li>
        </Steps>
      </DocSection>

      <DocSection id="discord">
        <P>
          On the <Link href="/discord/settings" className={pageLink}>Discord</Link> page, sign in with Discord and pick a server you manage. If AxyraBot
          isn&apos;t in that server yet, you&apos;ll get an <strong className="text-ax-heading">Add to Discord</strong> button. Then you can set up:
        </P>
        <Bullets>
          <li><strong className="text-ax-heading">Notifications</strong>: a post when you go live, a birthday post, and alerts when AxyraBot moderates your Twitch chat. Each message can be customized with <a href="#variables" className={pageLink}>variables</a>.</li>
          <li><strong className="text-ax-heading">YouTube uploads</strong>: paste your YouTube channel&apos;s link and pick a Discord channel, and AxyraBot posts there when you upload a new video, Short or stream. It checks every 5 minutes, so a post can take a few minutes to appear. Videos already on your channel aren&apos;t announced, and Community posts aren&apos;t included.</li>
          <li><strong className="text-ax-heading">Welcome messages</strong> for new members, with an optional image banner. Use <Code>$(user)</Code>, <Code>$(username)</Code> and <Code>$(server)</Code>.</li>
          <li><strong className="text-ax-heading">Moderation log</strong>: choose which server events (bans, deleted messages, role changes and more) get logged to a channel. A deleted message is logged with who sent it, what it said and who deleted it. Messages people delete themselves aren&apos;t logged.</li>
          <li><strong className="text-ax-heading">Role mappings, reaction roles and tickets</strong> to organize your server. When a ticket is closed, the person who opened it loses access and the channel is kept as a record, moved into a category you choose.</li>
          <li><strong className="text-ax-heading">Modules</strong>: turn whole groups of slash commands on or off for the server.</li>
        </Bullets>
        <H3>Slash commands</H3>
        <P>Type <Code>/</Code> in your server to see them all. Moderation commands only appear for members with the matching Discord permission.</P>
        <Table
          label="Discord slash commands"
          head={["Group", "Commands"]}
          rows={[
            ["Moderation", "/ban, /kick, /softban, /timeout, /untimeout, /warn, /warnings, /delwarn, /clearwarnings, /purge, /lock, /unlock, /lockdown, /slowmode, /deafen, /undeafen"],
            ["Case history", "/modlogs, /modstats, /case, /reason, /note, /notes, /delnote, /clearnotes"],
            ["Roles", "/role, /addrole, /delrole, /rolecolor, /rolename, /temprole, /rolepersist, /members, /addmod, /delmod, /rank, /addrank, /delrank"],
            ["Server tools", "/announce, /setnick, /addemote, /ignorechannel, /module, /giveaway"],
            ["Info", "/whois, /roleinfo, /avatar, /emotes, /inviteinfo, /commands"],
            ["Personal", "/afk, /remindme, /highlights"],
            ["Fun", "/poll, /roll, /rps, /color, /pokemon, /github"],
            ["Tags", "/tag, /tags (saved text snippets anyone can post)"],
          ]}
        />
        <P>Your Twitch custom commands also work in the linked server: type <Code>!name</Code> in any channel.</P>
      </DocSection>

      <DocSection id="importing">
        <P>
          Moving from another bot? On the <Link href="/import" className={pageLink}>Import</Link> page you can bring over your custom commands from
          Nightbot, StreamElements or Fossabot instead of retyping them.
        </P>
      </DocSection>

      <DocSection id="access">
        <P>
          On the <Link href="/roles" className={pageLink}>Roles</Link> page, give someone the <strong className="text-ax-heading">Editor</strong> role to let them
          manage your channel&apos;s dashboard: commands, moderation, modules, timers and more. After logging in, they can switch to your
          channel with the channel picker at the top of the dashboard. Only you and your Editors can change your settings.
        </P>
        <P>
          Chat commands that change things, like <Code>!title</Code> or <Code>!addcom</Code>, follow your Twitch roles instead: they work for you and your Twitch moderators.
        </P>
      </DocSection>
    </div>
  );
}
