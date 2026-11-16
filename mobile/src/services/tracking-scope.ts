// A request from a previous account must never populate the current account's UI.
export const trackingScope = { version: 0, revision: 0, owner: null as string | null };
export function changeTrackingOwner(owner: string | null) {
  trackingScope.owner = owner;
  trackingScope.version += 1;
  trackingScope.revision += 1;
}
