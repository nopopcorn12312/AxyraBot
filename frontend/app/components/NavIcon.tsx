import {
  Ban,
  BookOpen,
  Cake,
  ChevronDown,
  ChevronRight,
  Funnel,
  Gift,
  Import,
  LayoutDashboard,
  Menu,
  Puzzle,
  ScrollText,
  ShieldCheck,
  SquareTerminal,
  UserCog,
  type LucideIcon,
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  commands: SquareTerminal,
  blockedTerms: Ban,
  spamFilters: Funnel,
  modules: Puzzle,
  birthdays: Cake,
  giveaways: Gift,
  roles: UserCog,
  privacy: ShieldCheck,
  terms: ScrollText,
  docs: BookOpen,
  menu: Menu,
  import: Import,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof icons | "discord";

// "nav" icons follow their link's state: #D0D0D0 by default, white on hover,
// and #38BDF8 when the link is the current page (aria-current="page").
// "inherit" icons just use the surrounding text color.
const toneClasses = {
  nav: "text-ax-secondary transition-colors group-hover:text-ax-heading group-aria-[current=page]:text-ax-accent",
  inherit: "",
};

type Props = {
  name: NavIconName;
  size?: number;
  tone?: keyof typeof toneClasses;
  className?: string;
};

// Sidebar and control icons from Lucide, sized and stroked consistently.
// Always decorative: the link or button they sit in provides the label.
export default function NavIcon({ name, size = 20, tone = "nav", className = "" }: Props) {
  const classes = `shrink-0 ${toneClasses[tone]} ${className}`;

  // Discord keeps its real logo. It's drawn as a mask so it takes the same
  // state colors as the Lucide icons around it.
  if (name === "discord") {
    const mask = "url(/DiscordLogo.png) center / contain no-repeat";
    return (
      <span
        aria-hidden="true"
        className={`inline-block bg-current ${classes}`}
        style={{ width: size, height: size, WebkitMask: mask, mask }}
      />
    );
  }

  const Icon = icons[name];
  return <Icon aria-hidden="true" size={size} strokeWidth={1.75} className={classes} />;
}
