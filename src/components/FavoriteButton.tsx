import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function FavoriteButton({
  label,
  href,
  kind,
  entityType,
  entityId,
}: {
  label: string;
  href: string;
  kind: "route" | "record" | "view";
  entityType?: "company" | "contact" | "deal" | "project" | "task" | "note";
  entityId?: string;
}) {
  const favoriteId = useQuery(api.favorites.getByHref, { href });
  const toggle = useMutation(api.favorites.toggle);
  const active = favoriteId !== null && favoriteId !== undefined;

  return (
    <button
      type="button"
      title={active ? "Remove favorite" : "Save favorite"}
      onClick={() =>
        void toggle({ label, href, kind, entityType, entityId }).catch(
          () => undefined,
        )
      }
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-amber-500 text-amber-500 hover:bg-raised"
          : "border-edge text-neutral-500 hover:border-edge-strong hover:text-white"
      }`}
    >
      <StarIcon filled={active} />
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z" />
    </svg>
  );
}
