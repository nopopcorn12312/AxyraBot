"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type BirthdayRow = {
  userLogin: string;
  displayName: string;
  month: number;
  day: number;
};

// Static list of IANA timezones for the timezone dropdown.
const allTimezones: string[] = [
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Addis_Ababa",
  "Africa/Algiers",
  "Africa/Asmara",
  "Africa/Bamako",
  "Africa/Bangui",
  "Africa/Banjul",
  "Africa/Bissau",
  "Africa/Blantyre",
  "Africa/Brazzaville",
  "Africa/Bujumbura",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Ceuta",
  "Africa/Conakry",
  "Africa/Dakar",
  "Africa/Dar_es_Salaam",
  "Africa/Djibouti",
  "Africa/Douala",
  "Africa/El_Aaiun",
  "Africa/Freetown",
  "Africa/Gaborone",
  "Africa/Harare",
  "Africa/Johannesburg",
  "Africa/Juba",
  "Africa/Kampala",
  "Africa/Khartoum",
  "Africa/Kigali",
  "Africa/Kinshasa",
  "Africa/Lagos",
  "Africa/Libreville",
  "Africa/Lome",
  "Africa/Luanda",
  "Africa/Lubumbashi",
  "Africa/Lusaka",
  "Africa/Malabo",
  "Africa/Maputo",
  "Africa/Maseru",
  "Africa/Mbabane",
  "Africa/Mogadishu",
  "Africa/Monrovia",
  "Africa/Nairobi",
  "Africa/Ndjamena",
  "Africa/Niamey",
  "Africa/Nouakchott",
  "Africa/Ouagadougou",
  "Africa/Porto-Novo",
  "Africa/Sao_Tome",
  "Africa/Tripoli",
  "Africa/Tunis",
  "Africa/Windhoek",
  "America/Adak",
  "America/Anchorage",
  "America/Anguilla",
  "America/Antigua",
  "America/Araguaina",
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Catamarca",
  "America/Argentina/Cordoba",
  "America/Argentina/Jujuy",
  "America/Argentina/La_Rioja",
  "America/Argentina/Mendoza",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
  "America/Aruba",
  "America/Asuncion",
  "America/Atikokan",
  "America/Bahia",
  "America/Bahia_Banderas",
  "America/Barbados",
  "America/Belem",
  "America/Belize",
  "America/Blanc-Sablon",
  "America/Boa_Vista",
  "America/Bogota",
  "America/Boise",
  "America/Cambridge_Bay",
  "America/Campo_Grande",
  "America/Cancun",
  "America/Caracas",
  "America/Cayenne",
  "America/Cayman",
  "America/Chicago",
  "America/Chihuahua",
  "America/Costa_Rica",
  "America/Creston",
  "America/Cuiaba",
  "America/Curacao",
  "America/Danmarkshavn",
  "America/Dawson",
  "America/Dawson_Creek",
  "America/Denver",
  "America/Detroit",
  "America/Dominica",
  "America/Edmonton",
  "America/Eirunepe",
  "America/El_Salvador",
  "America/Fort_Nelson",
  "America/Fortaleza",
  "America/Glace_Bay",
  "America/Godthab",
  "America/Goose_Bay",
  "America/Grand_Turk",
  "America/Grenada",
  "America/Guadeloupe",
  "America/Guatemala",
  "America/Guayaquil",
  "America/Guyana",
  "America/Halifax",
  "America/Havana",
  "America/Hermosillo",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Inuvik",
  "America/Iqaluit",
  "America/Jamaica",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Kralendijk",
  "America/La_Paz",
  "America/Lima",
  "America/Los_Angeles",
  "America/Lower_Princes",
  "America/Maceio",
  "America/Managua",
  "America/Manaus",
  "America/Marigot",
  "America/Martinique",
  "America/Matamoros",
  "America/Mazatlan",
  "America/Menominee",
  "America/Merida",
  "America/Metlakatla",
  "America/Mexico_City",
  "America/Miquelon",
  "America/Moncton",
  "America/Monterrey",
  "America/Montevideo",
  "America/Montserrat",
  "America/Nassau",
  "America/New_York",
  "America/Nipigon",
  "America/Nome",
  "America/Noronha",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Ojinaga",
  "America/Panama",
  "America/Pangnirtung",
  "America/Paramaribo",
  "America/Phoenix",
  "America/Port-au-Prince",
  "America/Port_of_Spain",
  "America/Porto_Velho",
  "America/Puerto_Rico",
  "America/Punta_Arenas",
  "America/Rainy_River",
  "America/Rankin_Inlet",
  "America/Recife",
  "America/Regina",
  "America/Resolute",
  "America/Rio_Branco",
  "America/Santarem",
  "America/Santiago",
  "America/Santo_Domingo",
  "America/Sao_Paulo",
  "America/Scoresbysund",
  "America/Sitka",
  "America/St_Barthelemy",
  "America/St_Johns",
  "America/St_Kitts",
  "America/St_Lucia",
  "America/St_Thomas",
  "America/St_Vincent",
  "America/Swift_Current",
  "America/Tegucigalpa",
  "America/Thule",
  "America/Thunder_Bay",
  "America/Tijuana",
  "America/Toronto",
  "America/Tortola",
  "America/Vancouver",
  "America/Whitehorse",
  "America/Winnipeg",
  "America/Yakutat",
  "America/Yellowknife",
  "Antarctica/Casey",
  "Antarctica/Davis",
  "Antarctica/DumontDUrville",
  "Antarctica/Macquarie",
  "Antarctica/Mawson",
  "Antarctica/Palmer",
  "Antarctica/Rothera",
  "Antarctica/Syowa",
  "Antarctica/Troll",
  "Antarctica/Vostok",
  "Asia/Almaty",
  "Asia/Amman",
  "Asia/Anadyr",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Ashgabat",
  "Asia/Atyrau",
  "Asia/Baghdad",
  "Asia/Bahrain",
  "Asia/Baku",
  "Asia/Bangkok",
  "Asia/Barnaul",
  "Asia/Beirut",
  "Asia/Bishkek",
  "Asia/Brunei",
  "Asia/Chita",
  "Asia/Choibalsan",
  "Asia/Colombo",
  "Asia/Damascus",
  "Asia/Dhaka",
  "Asia/Dili",
  "Asia/Dubai",
  "Asia/Dushanbe",
  "Asia/Famagusta",
  "Asia/Gaza",
  "Asia/Hebron",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Hovd",
  "Asia/Irkutsk",
  "Asia/Jakarta",
  "Asia/Jayapura",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Kamchatka",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Khandyga",
  "Asia/Kolkata",
  "Asia/Krasnoyarsk",
  "Asia/Kuala_Lumpur",
  "Asia/Kuching",
  "Asia/Kuwait",
  "Asia/Macau",
  "Asia/Magadan",
  "Asia/Makassar",
  "Asia/Manila",
  "Asia/Muscat",
  "Asia/Nicosia",
  "Asia/Novokuznetsk",
  "Asia/Novosibirsk",
  "Asia/Omsk",
  "Asia/Oral",
  "Asia/Phnom_Penh",
  "Asia/Pontianak",
  "Asia/Pyongyang",
  "Asia/Qatar",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
  "Asia/Riyadh",
  "Asia/Sakhalin",
  "Asia/Samarkand",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Srednekolymsk",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tbilisi",
  "Asia/Tehran",
  "Asia/Thimphu",
  "Asia/Tokyo",
  "Asia/Tomsk",
  "Asia/Ulaanbaatar",
  "Asia/Urumqi",
  "Asia/Ust-Nera",
  "Asia/Vientiane",
  "Asia/Vladivostok",
  "Asia/Yakutsk",
  "Asia/Yangon",
  "Asia/Yekaterinburg",
  "Asia/Yerevan",
  "Atlantic/Azores",
  "Atlantic/Bermuda",
  "Atlantic/Canary",
  "Atlantic/Cape_Verde",
  "Atlantic/Faroe",
  "Atlantic/Madeira",
  "Atlantic/Reykjavik",
  "Atlantic/South_Georgia",
  "Atlantic/St_Helena",
  "Atlantic/Stanley",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Broken_Hill",
  "Australia/Currie",
  "Australia/Darwin",
  "Australia/Eucla",
  "Australia/Hobart",
  "Australia/Lindeman",
  "Australia/Lord_Howe",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Andorra",
  "Europe/Astrakhan",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Busingen",
  "Europe/Chisinau",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Gibraltar",
  "Europe/Guernsey",
  "Europe/Helsinki",
  "Europe/Isle_of_Man",
  "Europe/Istanbul",
  "Europe/Jersey",
  "Europe/Kaliningrad",
  "Europe/Kiev",
  "Europe/Kirov",
  "Europe/Lisbon",
  "Europe/Ljubljana",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Mariehamn",
  "Europe/Minsk",
  "Europe/Monaco",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Podgorica",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Samara",
  "Europe/San_Marino",
  "Europe/Sarajevo",
  "Europe/Saratov",
  "Europe/Simferopol",
  "Europe/Skopje",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Tirane",
  "Europe/Ulyanovsk",
  "Europe/Uzhgorod",
  "Europe/Vaduz",
  "Europe/Vatican",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Volgograd",
  "Europe/Warsaw",
  "Europe/Zagreb",
  "Europe/Zaporozhye",
  "Europe/Zurich",
  "Indian/Antananarivo",
  "Indian/Chagos",
  "Indian/Christmas",
  "Indian/Cocos",
  "Indian/Comoro",
  "Indian/Kerguelen",
  "Indian/Mahe",
  "Indian/Maldives",
  "Indian/Mauritius",
  "Indian/Mayotte",
  "Indian/Reunion",
  "Pacific/Apia",
  "Pacific/Auckland",
  "Pacific/Bougainville",
  "Pacific/Chatham",
  "Pacific/Chuuk",
  "Pacific/Easter",
  "Pacific/Efate",
  "Pacific/Enderbury",
  "Pacific/Fakaofo",
  "Pacific/Fiji",
  "Pacific/Funafuti",
  "Pacific/Galapagos",
  "Pacific/Gambier",
  "Pacific/Guadalcanal",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Kiritimati",
  "Pacific/Kosrae",
  "Pacific/Kwajalein",
  "Pacific/Majuro",
  "Pacific/Marquesas",
  "Pacific/Midway",
  "Pacific/Nauru",
  "Pacific/Niue",
  "Pacific/Norfolk",
  "Pacific/Noumea",
  "Pacific/Pago_Pago",
  "Pacific/Palau",
  "Pacific/Pitcairn",
  "Pacific/Pohnpei",
  "Pacific/Port_Moresby",
  "Pacific/Rarotonga",
  "Pacific/Saipan",
  "Pacific/Tahiti",
  "Pacific/Tarawa",
  "Pacific/Tongatapu",
  "Pacific/Wake",
  "Pacific/Wallis",
];

export default function BirthdaysPage() {
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = usePersistentSectionState(
    "axyra.sidebar.mainSectionOpen",
    true,
  );
  const [vanitySectionOpen, setVanitySectionOpen] = usePersistentSectionState(
    "axyra.sidebar.vanitySectionOpen",
    true,
  );
  const [otherSectionOpen, setOtherSectionOpen] = usePersistentSectionState(
    "axyra.sidebar.otherSectionOpen",
    true,
  );
  const [moderationOpen, setModerationOpen] = usePersistentSectionState(
    "axyra.sidebar.moderationOpen",
    true,
  );
  const [timezone, setTimezone] = useState("");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneStatus, setTimezoneStatus] = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<BirthdayRow[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(false);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEntries, setAddEntries] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const addModalRef = useRef<HTMLDivElement | null>(null);
  const [deletingBirthday, setDeletingBirthday] = useState<string | null>(null);
  const [birthdayPage, setBirthdayPage] = useState(1);
  const BIRTHDAY_PAGE_SIZE = 10;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Reset to page 1 when the birthdays list changes
  useEffect(() => { setBirthdayPage(1); }, [birthdays.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
      setLogin((activeChannel || storedLogin).toLowerCase());
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
  }, []);

  // Load current module state for the birthdays module so we can show an
  // enable/disable toggle on this page.
  useEffect(() => {
    if (!login) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/modules/settings?login=${encodeURIComponent(login)}`,
        );
        if (!res.ok) return;
        const data: { modules?: { name: string; enabled: boolean }[] } = await res.json();
        const row = (data.modules || []).find((m) => m.name === "birthdays");
        if (!cancelled && row) {
          setModuleEnabled(row.enabled);
        }
      } catch {
        // ignore; keep default moduleEnabled=true
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!showAddModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setShowAddModal(false); setAddEntries(""); setAddError(null); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showAddModal]);

  // Load timezone settings for the broadcaster and default to the browser
  // timezone when none is set yet.
  useEffect(() => {
    if (!login) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/birthdays/settings?login=${encodeURIComponent(login)}`,
        );
        if (!res.ok) return;
        const data: { timezone?: string } = await res.json();
        let tz = (data.timezone || "").trim();
        if (!tz && typeof Intl !== "undefined") {
          try {
            const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (guess) tz = guess;
          } catch {
            // ignore
          }
        }
        if (!cancelled) {
          setTimezone(tz);
        }
      } catch {
        // ignore initial load errors for settings
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login]);

  // Load all stored birthdays for this broadcaster.
  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    setLoadingBirthdays(true);
    setBirthdaysError(null);
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/birthdays/list?login=${encodeURIComponent(login)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error("Failed to load birthdays");
        }
        const data: { birthdays?: BirthdayRow[] } = await res.json();
        setBirthdays(data.birthdays || []);
      } catch (err) {
        console.error(err);
        if (!controller.signal.aborted) {
          setBirthdaysError("Could not load birthdays.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingBirthdays(false);
        }
      }
    })();
    return () => controller.abort();
  }, [login]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setLogin(null);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleToggleModule = async () => {
    if (!login) return;
    const next = !moduleEnabled;
    setModuleSaving(true);
    setModuleError(null);
    setModuleEnabled(next);
    try {
      const res = await fetch(`${backendUrl}/modules/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, module: "birthdays", enabled: next }),
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
    } catch {
      setModuleError("Could not update birthdays module. Please try again.");
      setModuleEnabled(!next);
    } finally {
      setModuleSaving(false);
    }
  };

  const handleAddBirthdays = async () => {
    if (!login || !addEntries.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`${backendUrl}/birthdays/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, entries: addEntries }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      const failures = (data.results ?? []).filter((r: { error?: string }) => r.error);
      if (failures.length > 0) {
        setAddError(failures.map((r: { line: string; error: string }) => `"${r.line}": ${r.error}`).join("\n"));
      } else {
        setShowAddModal(false);
        setAddEntries("");
        // Refresh the birthday list
        const listRes = await fetch(`${backendUrl}/birthdays/list?login=${encodeURIComponent(login)}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setBirthdays(listData.birthdays ?? []);
        }
      }
    } catch {
      setAddError("Could not save birthdays. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteBirthday = async (userLogin: string) => {
    if (!login) return;
    setDeletingBirthday(userLogin);
    try {
      const res = await fetch(`${backendUrl}/birthdays/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, userLogin }),
      });
      if (!res.ok) throw new Error("delete failed");
      setBirthdays((prev) => prev.filter((b) => b.userLogin !== userLogin));
    } catch {
      // silent — the row stays in the list if delete fails
    } finally {
      setDeletingBirthday(null);
    }
  };

  const handleSaveTimezone = async () => {
    if (!login) return;
    const trimmed = timezone.trim();
    if (!trimmed) {
      setTimezoneError("Timezone cannot be empty.");
      setTimezoneStatus(null);
      return;
    }
    setTimezoneSaving(true);
    setTimezoneError(null);
    setTimezoneStatus(null);
    try {
      const res = await fetch(`${backendUrl}/birthdays/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, timezone: trimmed }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          setTimezoneError("That doesn&apos;t look like a valid timezone.");
        } else {
          setTimezoneError("Failed to save timezone. Please try again.");
        }
        return;
      }
      setTimezoneStatus("Timezone saved.");
      setTimeout(() => setTimezoneStatus(null), 3000);
    } catch {
      setTimezoneError("Network error while saving timezone.");
    } finally {
      setTimezoneSaving(false);
    }
  };

  const formatMonthDay = (m: number, d: number) => {
    const mm = m.toString().padStart(2, "0");
    const dd = d.toString().padStart(2, "0");
    return `${mm}/${dd}`;
  };

  return (
    <main className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="mr-2 rounded-lg bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 border border-slate-700"
          >
            ☰
          </button>
          <Link href="/" className="flex items-center gap-4">
            <Image
              src={AxyraBotPFP}
              alt="AxyraBot logo"
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="text-2xl font-semibold tracking-tight">
              <span className="text-accent">Axyra</span>
              <span className="text-white">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a href={primaryHref} className="hidden">
            {primaryLabel}
          </a>
          {isLoggedIn && (
            <>
              <ManagingChannelBadge />
              <Link
                href="/import"
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 hover:border-slate-500 transition"
              >
                <span className="text-xs">⬆</span>
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full bg-slate-900/80 px-1.5 py-1 hover:bg-slate-800 transition"
                >
                  {avatarUrl && (
                    <Image
                      src={avatarUrl}
                      alt="Twitch profile picture"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-slate-700 bg-slate-900/95 py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-left text-slate-200 hover:bg-slate-800"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
        <div
          className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}
        >
          <nav className="mt-1 flex flex-col gap-4 text-sm text-slate-200">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMainSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Main</span>
                {sidebarOpen && <span className="text-base font-bold">{mainSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {mainSectionOpen && (
                <>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/dashboard"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📊</span>
                    {sidebarOpen && <span>Dashboard</span>}
                  </Link>

                  <Link
                    href="/commands"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/commands"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">❓</span>
                    {sidebarOpen && <span>Commands</span>}
                  </Link>

                </>
              )}
            </div>

            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setModerationOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Moderation</span>
                {sidebarOpen && (
                  <span className="text-base font-bold">{moderationOpen ? "▾" : "▸"}</span>
                )}
              </button>
              {moderationOpen && (
                <>
                  <Link
                    href="/moderation/blocked-terms"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/moderation/blocked-terms"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🚫</span>
                    {sidebarOpen && <span>Blocked Terms</span>}
                  </Link>
                  <Link
                    href="/moderation/spam-filters"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/moderation/spam-filters"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🧹</span>
                    {sidebarOpen && <span>Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Vanity section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setVanitySectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Vanity</span>
                {sidebarOpen && <span className="text-base font-bold">{vanitySectionOpen ? "▾" : "▸"}</span>}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link
                    href="/modules"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/modules"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🧩</span>
                    {sidebarOpen && <span>Modules</span>}
                  </Link>
                  <Link
                    href="/birthdays"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/birthdays"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎂</span>
                    {sidebarOpen && <span>Birthdays</span>}
                  </Link>
                  <Link
                    href="/giveaways"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/giveaways"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎁</span>
                    {sidebarOpen && <span>Giveaways</span>}
                  </Link>
                  {!isEditor && (
                  <Link
                    href="/roles"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/roles"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎭</span>
                    {sidebarOpen && <span>Roles</span>}
                  </Link>
                  )}
                </>
              )}
            </div>

            {/* Integrations section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Integrations</span>
              </button>
              <Link href="/discord" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/discord" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}>
                <span className="text-lg">🎮</span>{sidebarOpen && <span>Discord</span>}
              </Link>
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOtherSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Other</span>
                {sidebarOpen && <span className="text-base font-bold">{otherSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {otherSectionOpen && (
                <>
                  <Link
                    href="/privacy"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/privacy"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🔒</span>
                    {sidebarOpen && <span>Privacy</span>}
                  </Link>
                  <Link
                    href="/terms"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/terms"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📜</span>
                    {sidebarOpen && <span>Terms</span>}
                  </Link>
                  <Link
                    href="/api-docs"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/api-docs"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📘</span>
                    {sidebarOpen && <span>API Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-6 text-slate-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="mb-2 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold">Birthdays</h1>
              {login && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setAddEntries(""); setAddError(null); setShowAddModal(true); }}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    Add Birthdays
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleModule}
                    disabled={moduleSaving}
                    className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      moduleEnabled
                        ? "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-700"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-700"
                    }`}
                  >
                    {moduleEnabled ? "Disable Birthdays" : "Enable Birthdays"}
                  </button>
                </div>
              )}
            </div>
            {/* Add Birthdays modal */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div
                  ref={addModalRef}
                  className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
                >
                  <h2 className="mb-4 text-base font-semibold text-slate-100">Add Birthdays</h2>
                  <textarea
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={6}
                    placeholder={"StreamerName 6 15\nAnotherUser 12 3\nViewerFriend 1 28"}
                    value={addEntries}
                    onChange={(e) => setAddEntries(e.target.value)}
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    One birthday per line. Format: <span className="font-mono text-slate-300">Username Month Day</span>
                    <br />
                    Example: <span className="font-mono text-slate-300">StreamerName 6 15</span> for June 15th.
                    <br />
                    You can add multiple birthdays at once — one per line.
                  </p>
                  {addError && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400">{addError}</pre>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowAddModal(false); setAddEntries(""); setAddError(null); }}
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBirthdays}
                      disabled={adding || !addEntries.trim()}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {adding ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <p className="mb-4 text-sm text-slate-400">
              View birthdays saved for your channel and choose the timezone the bot
              should use when announcing birthdays.
            </p>
            {moduleError && (
              <p className="-mt-2 mb-2 text-xs text-red-400">{moduleError}</p>
            )}
            {!login && (
              <p className="text-sm text-slate-400">
                Log in on the homepage to manage birthdays for your channel.
              </p>
            )}
            {login && (
              <div className="space-y-6 mt-2">
                <section className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-100 mb-2">
                    Timezone
                  </h2>
                  <p className="text-xs text-slate-400 mb-2">
                    Choose your timezone. The bot will use this when deciding which
                    birthdays are &quot;today&quot; and which one is next.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                    >
                      <option value="" disabled>
                        Select a timezone
                      </option>
                      {allTimezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleSaveTimezone}
                      disabled={timezoneSaving || !timezone}
                      className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                    >
                      {timezoneSaving ? "Saving..." : "Save timezone"}
                    </button>
                  </div>
                  {timezoneError && (
                    <p className="mt-2 text-xs text-red-400">{timezoneError}</p>
                  )}
                  {timezoneStatus && (
                    <p className="mt-2 text-xs text-emerald-400">{timezoneStatus}</p>
                  )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-100 mb-2">
                    Saved birthdays
                  </h2>
                  {loadingBirthdays && (
                    <p className="text-xs text-slate-400">Loading birthdays…</p>
                  )}
                  {birthdaysError && (
                    <p className="text-xs text-red-400">{birthdaysError}</p>
                  )}
                  {!loadingBirthdays && !birthdaysError && birthdays.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No birthdays have been saved yet. Mods can add birthdays
                      from chat using
                      {" "}
                      <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                        !addbday
                      </code>
                      {" "}
                      and viewers can add their own with
                      {" "}
                      <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                        !addmybday
                      </code>
                      .
                    </p>
                  )}
                  {!loadingBirthdays && !birthdaysError && birthdays.length > 0 && (() => {
                    const totalPages = Math.max(1, Math.ceil(birthdays.length / BIRTHDAY_PAGE_SIZE));
                    const safePage = Math.min(birthdayPage, totalPages);
                    const pageRows = birthdays.slice((safePage - 1) * BIRTHDAY_PAGE_SIZE, safePage * BIRTHDAY_PAGE_SIZE);
                    return (
                      <>
                        <table className="mt-2 min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                              <th className="py-2 pr-3">Name</th>
                              <th className="py-2 pr-3">Birthday</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((b) => (
                              <tr
                                key={`${b.userLogin}-${b.month}-${b.day}`}
                                className="border-b border-slate-900/60"
                              >
                                <td className="py-2 pr-3 text-slate-100">
                                  {b.displayName || b.userLogin}
                                </td>
                                <td className="py-2 pr-3 text-slate-200">
                                  {formatMonthDay(b.month, b.day)}
                                </td>
                                <td className="py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBirthday(b.userLogin)}
                                    disabled={deletingBirthday === b.userLogin}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-700 bg-red-700/80 text-white hover:bg-red-600/90 disabled:opacity-50"
                                  >
                                    <span className="sr-only">Delete birthday</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                      <path d="M6 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1h.54l.76 10.137A2 2 0 0 0 6.79 17h6.42a2 2 0 0 0 1.99-1.863L15.96 5H16.5a.5.5 0 0 0 0-1H15V3a1 1 0 0 0-1-1H6Zm1 2V3h6v1H7Z" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-4 mt-4">
                            <button
                              type="button"
                              onClick={() => setBirthdayPage((p) => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                              className="flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <span className="text-sm text-slate-300">
                              Page <span className="font-semibold text-slate-100">{safePage}</span> of{" "}
                              <span className="font-semibold text-slate-100">{totalPages}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setBirthdayPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safePage === totalPages}
                              className="flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
