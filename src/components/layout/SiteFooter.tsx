import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { NAV_ITEMS } from "./nav-items";
import { NavItem } from "./NavItem";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 md:grid-cols-2 md:px-6">
        <div>
          <Link to="/dashboard" aria-label="Rarely Alone home" className="inline-block"><Logo /></Link>
          <p className="mt-3 text-muted-foreground">Turn a rare diagnosis into a path toward treatment</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavItem item={item} className="hover:underline" activeClassName="font-bold text-primary" inactiveClassName="text-primary" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 text-sm text-muted-foreground md:col-span-2">
          <p>Rarely Alone supports decisions and care teams. It does not diagnose or give medical advice.</p>
          <p className="text-[12.5px]">Built for Hack-Nation Challenge 5</p>
        </div>
      </div>
    </footer>
  );
}
