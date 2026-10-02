import type { WorkspaceCacheMeta } from "./storage";
import type { StudyState } from "./types";

export type HydrationNetworkState = "synced" | "pending" | "offline" | "failed";

export function chooseHydratedWorkspace({
  local,
  localMeta,
  remote,
  remoteRevision,
  online,
  remoteAvailable,
}: {
  local: StudyState;
  localMeta: WorkspaceCacheMeta;
  remote: StudyState | null;
  remoteRevision: number;
  online: boolean;
  remoteAvailable: boolean;
}) {
  const adoptedRemote = Boolean(remote && !localMeta.pending);
  return {
    state: adoptedRemote ? remote! : local,
    revision: adoptedRemote ? remoteRevision : localMeta.revision,
    adoptedRemote,
    status: localMeta.pending
      ? online
        ? "pending"
        : "offline"
      : remoteAvailable
        ? "synced"
        : online
          ? "failed"
          : ("offline" as HydrationNetworkState),
  };
}
