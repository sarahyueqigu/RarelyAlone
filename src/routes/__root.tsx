import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ExperienceProvider } from "@/lib/experience";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CommunityProvider } from "@/lib/community-store";
import { FlowsProvider } from "@/components/community/flows";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="py-10">
      <title>Page not found · Rarely Alone</title>
      <h1>Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        We couldn't find that page. It may have moved, or the link may be mistyped.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Rarely Alone" },
      { name: "description", content: "Turn a rare diagnosis into a path toward treatment." },
      { property: "og:title", content: "Rarely Alone" },
      { property: "og:description", content: "Turn a rare diagnosis into a path toward treatment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#FFFFFF" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Fraunces:opsz,wght@9..144,500;9..144,650&family=IBM+Plex+Mono&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ExperienceProvider>
        <CommunityProvider>
        <FlowsProvider>
        <div className="flex min-h-screen flex-col">
          <a
            href="#content"
            className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main
            id="content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-6"
          >
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        </FlowsProvider>
        <Toaster position="bottom-center" />
        </CommunityProvider>
      </ExperienceProvider>
    </QueryClientProvider>
  );
}
