import Badge from "@/components/ui/Badge";

/** «Publicado» / «No publicado» (HU09): the same label in the grid, the list and the cards. */
export default function PublicacionBadge({ publicado }: { publicado?: boolean }) {
  return <Badge variant={publicado ? "success" : "neutral"}>{publicado ? "Publicado" : "No publicado"}</Badge>;
}
