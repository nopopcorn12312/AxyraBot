export const siteUrl = "https://axyrabot.com";

export type SeoLandingPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  sections: {
    heading: string;
    paragraphs: string[];
    points?: string[];
  }[];
  related: { href: string; label: string; context: string }[];
};

export const seoLandingPages: Record<string, SeoLandingPage> = {
  twitch: {
    slug: "twitch",
    title: "Free Twitch Moderation Bot | AxyraBot",
    description:
      "Moderate Twitch chat and manage community tools with AxyraBot, a free bot for streamers who want moderation and useful channel commands together.",
    h1: "A calmer Twitch chat, with community tools close by",
    eyebrow: "Twitch tools for streamers",
    intro:
      "AxyraBot helps Twitch creators handle chat moderation and everyday community tasks from one bot. Set up filters for unwanted messages, keep useful commands available, and connect Discord when your community uses both platforms.",
    sections: [
      {
        heading: "Keep unwanted chat under control",
        paragraphs: [
          "Fast-moving chat can make it difficult for moderators to catch every repeated message or unwanted term. AxyraBot includes configurable blocked-term and spam filters for Twitch channels.",
          "Choose the response that fits a rule, such as deleting a message, timing out a user, or banning an account. Filters support your moderators; they do not replace human judgment for context-sensitive decisions.",
        ],
      },
      {
        heading: "More than a message filter",
        paragraphs: [
          "A Twitch community also needs practical channel tools. AxyraBot includes built-in commands for stream information and viewer utilities, alongside custom commands that can be managed from the dashboard.",
          "Birthday lists are available as an optional community feature, not the center of the product. Keep the tools enabled that fit your channel and turn off modules you do not need.",
        ],
        points: ["Blocked terms and spam filters", "Built-in and custom chat commands", "Optional birthday lists and announcements"],
      },
      {
        heading: "One bot when your community uses two platforms",
        paragraphs: [
          "If your viewers also gather on Discord, AxyraBot can support that server too. Twitch chat tools and Discord server tools are configured for their respective platforms through the same AxyraBot product, so you have fewer separate bots to manage.",
        ],
      },
    ],
    related: [
      { href: "/twitch-moderation-bot", label: "Twitch moderation bot", context: "A closer look at chat filters and moderation actions." },
      { href: "/twitch-discord-bot", label: "One bot for Twitch and Discord", context: "See how the two platform integrations fit together." },
    ],
  },
  discord: {
    slug: "discord",
    title: "Free Discord Moderation Bot | AxyraBot",
    description:
      "Use AxyraBot to moderate a Discord server with slash commands, staff tools, and community management features, alongside Twitch tools in one free bot.",
    h1: "Discord moderation that fits into your creator toolkit",
    eyebrow: "Discord tools for communities",
    intro:
      "Discord moderation is more than removing a single message. AxyraBot brings practical staff commands and server utilities together, while also giving Twitch creators a companion set of channel tools from the same product.",
    sections: [
      {
        heading: "Give moderators useful server controls",
        paragraphs: [
          "AxyraBot provides Discord slash commands for common moderation work, including bans, kicks, timeouts, and warnings. Moderators can also use channel controls such as slowmode and locking when a conversation needs to cool down.",
          "For cleanup, the bot includes a purge command. Permission requirements are configured on Discord commands, and the bot still needs the matching role and channel permissions to carry out actions.",
        ],
      },
      {
        heading: "Keep staff work organized",
        paragraphs: [
          "Warning history, moderation cases, and staff notes help teams keep context around decisions. Additional server tools include role management, welcome settings, and configurable modules.",
          "Choose the pieces that suit your server rather than installing a stack of single-purpose bots for each task.",
        ],
        points: ["Moderation commands and warning records", "Channel slowmode and lock controls", "Roles, welcome settings, and modules"],
      },
      {
        heading: "Already stream on Twitch? Keep the toolkit together",
        paragraphs: [
          "AxyraBot also supports Twitch chat moderation and channel commands. Each platform has its own settings, but you can manage both integrations as part of one AxyraBot setup.",
        ],
      },
    ],
    related: [
      { href: "/discord-moderation-bot", label: "Discord moderation bot", context: "Explore AxyraBot’s Discord moderation workflow." },
      { href: "/twitch-discord-bot", label: "Twitch and Discord together", context: "See the combined platform approach." },
    ],
  },
  "twitch-moderation-bot": {
    slug: "twitch-moderation-bot",
    title: "Twitch Chat Moderation Bot for Streamers | AxyraBot",
    description:
      "Looking for a free Twitch chat moderation bot? AxyraBot provides configurable blocked-term and spam filters, with delete, timeout, and ban responses.",
    h1: "Twitch chat moderation that helps catch repeat problems",
    eyebrow: "Twitch chat moderation",
    intro:
      "When chat is moving quickly, repeated spam and unwanted terms can distract both viewers and moderators. AxyraBot gives Twitch channels configurable filters and moderation actions, with the rules managed from a web dashboard.",
    sections: [
      {
        heading: "Set rules for the messages you want to catch",
        paragraphs: [
          "Create blocked-term rules for words or phrases that should not appear in your channel. Add spam filters for patterns your moderators repeatedly have to handle, instead of relying only on someone noticing each message in real time.",
          "Review rules against the way your community talks. A filter that is too broad can remove harmless messages, so tune terms and thresholds to your channel rather than treating automation as a substitute for moderation judgment.",
        ],
      },
      {
        heading: "Choose an appropriate moderation response",
        paragraphs: [
          "Depending on the rule and its settings, AxyraBot can remove a message, timeout the account, or ban it. This lets a channel use a lighter response for some patterns and a firmer action for others.",
        ],
        points: ["Remove a matching message", "Apply a timeout", "Ban an account for a configured rule"],
      },
      {
        heading: "Keep channel commands in the same setup",
        paragraphs: [
          "Moderation is one part of stream management. AxyraBot also supports built-in and custom Twitch chat commands, and can be used with its Discord tools if your community has a server.",
        ],
      },
    ],
    related: [
      { href: "/twitch", label: "AxyraBot for Twitch", context: "See the broader set of Twitch community tools." },
      { href: "/twitch-discord-bot", label: "Twitch and Discord moderation", context: "Use one product across both parts of your community." },
      { href: "/free-moderation-bot", label: "Free moderation bot", context: "Read about AxyraBot’s free product model." },
    ],
  },
  "discord-moderation-bot": {
    slug: "discord-moderation-bot",
    title: "Discord Auto-Moderation Bot | AxyraBot",
    description:
      "AxyraBot is a free Discord moderation bot with slash commands for bans, kicks, timeouts, warnings, message cleanup, and channel controls.",
    h1: "Give your Discord moderation team practical tools",
    eyebrow: "Discord server moderation",
    intro:
      "Healthy Discord communities need clear, repeatable ways to respond to disruptive behavior. AxyraBot puts common moderation actions into Discord slash commands and adds staff-history tools, with Twitch moderation available in the same product.",
    sections: [
      {
        heading: "Handle common moderation actions in Discord",
        paragraphs: [
          "AxyraBot includes slash commands for banning, kicking, timing out, and warning members. Staff can also purge recent messages, lock a channel, or set slowmode when a channel needs temporary structure.",
          "Discord controls command availability based on permissions, and the bot’s role must be high enough to perform member actions. Configure those permissions in your server as part of setup.",
        ],
      },
      {
        heading: "Keep a record for your staff team",
        paragraphs: [
          "Warnings and moderation cases give moderators a place to review previous actions. Staff notes can preserve context for a team without turning every internal discussion into a public channel message.",
        ],
        points: ["Member warnings and case history", "Staff notes for moderation context", "Channel controls for busy or disrupted conversations"],
      },
      {
        heading: "A community toolkit, not just one command",
        paragraphs: [
          "AxyraBot also includes server utilities such as role tools, welcome settings, and modules. If you stream on Twitch, the same AxyraBot product has separate Twitch chat tools too.",
        ],
      },
    ],
    related: [
      { href: "/discord", label: "AxyraBot for Discord", context: "Explore Discord community management tools." },
      { href: "/twitch-discord-bot", label: "One bot across Twitch and Discord", context: "See how to manage both platform integrations." },
      { href: "/free-moderation-bot", label: "Free moderation bot", context: "Learn about AxyraBot’s pricing and scope." },
    ],
  },
  "twitch-discord-bot": {
    slug: "twitch-discord-bot",
    title: "Twitch & Discord Moderation Bot | AxyraBot",
    description:
      "One bot for Twitch and Discord. AxyraBot combines Twitch chat moderation and Discord server tools in one free product and dashboard.",
    h1: "One bot. Two platforms. One community toolkit.",
    eyebrow: "Twitch + Discord",
    intro:
      "Creators often end up managing one bot for Twitch chat and another for Discord. AxyraBot brings moderation and community tools for both platforms into one product, so you can reduce the number of separate bots in your setup.",
    sections: [
      {
        heading: "Use Twitch tools where your stream happens",
        paragraphs: [
          "For Twitch, AxyraBot supports blocked-term and spam filters with moderation actions, plus built-in and custom chat commands. Configure Twitch channel features for your stream rather than carrying server commands into chat.",
        ],
      },
      {
        heading: "Use Discord tools in your server",
        paragraphs: [
          "For Discord, moderators can use slash commands for actions such as bans, kicks, timeouts, warnings, and message cleanup. Server utilities include channel controls, role tools, and welcome settings.",
        ],
      },
      {
        heading: "One product, with platform-specific settings",
        paragraphs: [
          "AxyraBot does not merge Twitch and Discord into one chat or make their permissions interchangeable. Each integration works within its platform, while the bot and its configuration are managed as one AxyraBot setup.",
          "That means fewer separate bot products to install and maintain while keeping the right controls where your community uses them.",
        ],
        points: ["Twitch chat moderation and commands", "Discord moderation and server tools", "A single AxyraBot product with separate platform configuration"],
      },
    ],
    related: [
      { href: "/twitch-moderation-bot", label: "Twitch chat moderation", context: "Details on filters and stream-side tools." },
      { href: "/discord-moderation-bot", label: "Discord server moderation", context: "Details on staff commands and server controls." },
    ],
  },
  "free-moderation-bot": {
    slug: "free-moderation-bot",
    title: "Free All-in-One Moderation Bot for Twitch & Discord | AxyraBot",
    description:
      "AxyraBot is a 100% free moderation bot for Twitch and Discord, bringing chat filters, moderation commands, and community tools into one product.",
    h1: "A free moderation toolkit for Twitch and Discord",
    eyebrow: "Free to use",
    intro:
      "AxyraBot is 100% free: one product for creators who want practical moderation and community tools across Twitch and Discord without paying for multiple separate bots.",
    sections: [
      {
        heading: "What the free toolkit includes",
        paragraphs: [
          "On Twitch, configure blocked terms and spam filters, use moderation actions, and manage built-in or custom chat commands. On Discord, staff can use moderation slash commands and server utilities such as slowmode and channel locks.",
          "AxyraBot also has community features, including optional birthday lists and announcements. Birthday tools are one part of the platform, not a separate paid product or the main purpose of the bot.",
        ],
      },
      {
        heading: "One product instead of a collection of bots",
        paragraphs: [
          "Managing separate bots for chat filters, server moderation, and community commands can make setup harder to maintain. AxyraBot brings these supported tools together, while each platform keeps its own permissions and configuration.",
        ],
        points: ["No charge to use AxyraBot", "Tools for both Twitch and Discord", "Platform-specific permissions remain in place"],
      },
      {
        heading: "Start with the platform you use",
        paragraphs: [
          "Connect through the existing AxyraBot setup flow, then configure the Twitch channel and invite the bot to Discord as needed. You can use the platform that fits your community rather than enabling every feature at once.",
        ],
      },
    ],
    related: [
      { href: "/twitch", label: "Twitch community tools", context: "See chat moderation and stream commands." },
      { href: "/discord", label: "Discord community tools", context: "See the server-side moderation toolkit." },
      { href: "/twitch-discord-bot", label: "One bot for two platforms", context: "Learn how the integrations fit together." },
    ],
  },
  "twitch-birthday-bot": {
    slug: "twitch-birthday-bot",
    title: "Free Twitch Birthday Bot | AxyraBot",
    description:
      "Add birthday lists and Twitch chat announcements with AxyraBot, a free Twitch and Discord moderation toolkit with birthday features as one optional module.",
    h1: "Celebrate viewer birthdays as part of a bigger toolkit",
    eyebrow: "A community feature in AxyraBot",
    intro:
      "AxyraBot can help a Twitch community remember viewer birthdays with saved dates and chat announcements. It is one optional feature in a broader free bot for Twitch and Discord moderation—not a birthday-only bot.",
    sections: [
      {
        heading: "Keep a birthday list for your channel",
        paragraphs: [
          "Save a viewer’s month and day, let viewers submit their own birthday, and use chat commands to check today’s or the next upcoming birthday. The list is scoped to the Twitch channel using the feature.",
          "Birthday announcements can run using the broadcaster’s configured timezone. If you also want Discord announcements, configure a destination channel in AxyraBot’s Discord settings.",
        ],
        points: ["Add and manage saved birthdays", "Check today’s or upcoming birthdays in chat", "Optionally announce birthdays in a configured Discord channel"],
      },
      {
        heading: "Birthday reminders are not the whole product",
        paragraphs: [
          "AxyraBot is a 100% free, all-in-one moderation and community bot. Twitch features include blocked-term and spam filters, moderation actions, and chat commands; Discord features include moderation slash commands and server tools.",
          "Use birthdays when they suit your community, and use the wider moderation toolkit to help manage the channels where your members gather.",
        ],
      },
      {
        heading: "A small ritual, without adding another bot",
        paragraphs: [
          "If AxyraBot is already part of your moderation setup, birthday lists can live alongside its other Twitch and Discord features. That keeps a community extra in the same product instead of requiring another single-purpose bot.",
        ],
      },
    ],
    related: [
      { href: "/twitch-moderation-bot", label: "Twitch moderation tools", context: "See the core chat moderation features." },
      { href: "/twitch-discord-bot", label: "Twitch and Discord in one bot", context: "Explore the wider AxyraBot platform." },
      { href: "/free-moderation-bot", label: "Free moderation bot", context: "Learn about the complete free toolkit." },
    ],
  },
};