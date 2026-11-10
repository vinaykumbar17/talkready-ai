
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { House, Mic, MessageCircle, UserRound } from "lucide-react";

const items = [
  { label: "Home", path: "/", icon: House, end: true },
  { label: "SpeakCheck", path: "/speakcheck", icon: Mic, end: true },
  {
    label: "Before We Talk",
    path: "/before-we-talk",
    icon: MessageCircle,
    end: true,
  },
  { label: "Profile", path: "/profile", icon: UserRound, end: true },
];

export default function BottomNavigation() {
  const [isVisible, setIsVisible] = useState(true);
  const previousScrollY = useRef(0);
  const location = useLocation();

  // Show navigation and reset the new page to its top.
  useEffect(() => {
    setIsVisible(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    previousScrollY.current = 0;
  }, [location.pathname]);

  // Hide while scrolling down; reveal while scrolling up.
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const difference = currentScrollY - previousScrollY.current;

      if (currentScrollY <= 2) {
        setIsVisible(true);
      } else if (difference > 2) {
        setIsVisible(false);
      } else if (difference < -2) {
        setIsVisible(true);
      }

      previousScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transform-gpu transition-transform duration-300 ease-in-out sm:translate-y-0 ${
        isVisible
          ? "translate-y-0"
          : "translate-y-full pointer-events-none"
      }`}
    >
      <div className="mx-auto max-w-xl rounded-[1.75rem] border border-white/70 bg-white/80 p-1.5 shadow-[0_12px_40px_rgba(20,83,45,0.13)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="grid grid-cols-4 gap-1">
          {items.map(({ label, path, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={path}
              end={end}
              aria-label={label}
              onClick={(event) => {
                if (location.pathname === path) {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  setIsVisible(true);
                }
              }}
              className={({ isActive }) =>
                `group flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 py-2 text-[10px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 sm:min-h-16 sm:text-[11px] ${
                  isActive
                    ? "bg-emerald-100/90 text-emerald-800 shadow-sm dark:bg-emerald-400/15 dark:text-emerald-200"
                    : "text-slate-500 hover:bg-emerald-50/70 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors sm:h-8 ${
                      isActive
                        ? "bg-white/80 dark:bg-white/10"
                        : "group-hover:bg-white/60 dark:group-hover:bg-white/5"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                  </span>

                  <span className="w-full text-center leading-tight">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
