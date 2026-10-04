import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Manage your Rarely Alone settings."),
  component: Page,
});

function Page() {
  return (
    <div>
      <h1>Settings</h1>
      
    </div>
  );
}
