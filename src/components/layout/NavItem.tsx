import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useExperience } from "@/lib/experience";
import { NAV_ITEMS } from "./nav-items";

type Item = (typeof NAV_ITEMS)[number];
export const JOURNEY_DISABLED_HINT = "Available in Patients & Families mode";

/** My Journey is a patients-only page: shown muted and unclickable in Research & Advocacy mode. */
export function NavItem({ item, className, activeClassName, inactiveClassName }: { item: Item; className: string; activeClassName: string; inactiveClassName: string }) {
  const { experience } = useExperience();
  if (item.to === "/journey" && experience === "research") {
    return (
      <span role="link" aria-disabled="true" title={JOURNEY_DISABLED_HINT} className={`${className} cursor-not-allowed text-muted-foreground opacity-60`}>
        {item.label}<span className="sr-only"> ({JOURNEY_DISABLED_HINT})</span>
      </span>
    );
  }
  return (
    <Link to={item.to} className={className} activeProps={{ className: activeClassName, "aria-current": "page" }} inactiveProps={{ className: inactiveClassName }}>
      {item.label}
    </Link>
  );
}

/** Leaves My Journey for the dashboard when the audience switches to research. Mounted once in the header. */
export function JourneyModeGuard() {
  const { experience } = useExperience();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  useEffect(() => {
    if (experience === "research" && pathname.startsWith("/journey")) void navigate({ to: "/dashboard", replace: true });
  }, [experience, pathname, navigate]);
  return null;
}
