import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/profile")({
  head: () => pageHead("Profile", "Your Rarely Alone profile."),
  component: Page,
});

function Page() {
  return (
    <div>
      <h1>Profile</h1>
      
    </div>
  );
}
