import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ExperienceSwitcher } from "./ExperienceSwitcher";
import { NAV_ITEMS } from "./nav-items";
import { NavItem, JourneyModeGuard } from "./NavItem";

const linkBase = "rounded-md px-3 py-2 transition-colors";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6">
        <JourneyModeGuard />
        <Link to="/dashboard" aria-label="Rarely Alone home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavItem item={item} className={linkBase} activeClassName="bg-tint-light font-bold text-primary" inactiveClassName="text-foreground hover:text-primary" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <ExperienceSwitcher />
        </div>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md text-primary lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-border bg-surface px-4 pb-6 pt-4 lg:hidden">
          <nav aria-label="Mobile">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavItem item={item} className={`block text-lg ${linkBase}`} activeClassName="bg-tint-light font-bold text-primary" inactiveClassName="text-foreground" />
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted-foreground">Experience</p>
            <ExperienceSwitcher fullWidth />
          </div>
        </div>
      )}
      <div className="border-t border-border bg-tint-warm px-4 py-2 text-center text-sm text-foreground">
        Prototype. Disease facts, organizations, studies and researchers come from public sources (linked). Circles, posts and inquiries are simulated. Organizations listed do not endorse this app.
      </div>
    </header>
  );
}
