import { createFileRoute, redirect } from "@tanstack/react-router";

// The Atlas-first dashboard is the app's home; "/" has no page of its own.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
