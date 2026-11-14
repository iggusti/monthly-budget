/**
 * Payment method presets.
 *
 * A stored method is a display label, optionally followed by a channel:
 * `"QRIS · BRI"`, `"Tarik tunai · BCA"`, or a legacy free-text value. The base
 * part is translated in the UI, so this module deals with raw labels only;
 * mapping a label back to its `qris` / `transfer` / `cash` value stays in
 * `ExpenseSection.svelte` where the translations live.
 */

/** Bases that can carry a bank / e-wallet channel. */
export const CHANNEL_BASES = ["qris", "transfer", "cash"] as const;

export type MethodBase = (typeof CHANNEL_BASES)[number];

/** Bank accounts — also the only choices for a cash withdrawal. */
export const METHOD_CHANNELS_BANK: readonly string[] = [
  "BRI",
  "Bank Jago",
  "Allo Bank",
  "BSI",
  "SeaBank"
];

/** E-wallets, offered for QRIS and Transfer only. */
export const METHOD_CHANNELS_EWALLET: readonly string[] = ["ShopeePay", "GoPay", "Flip", "Dana"];

/** Everything offered for QRIS and Transfer: every bank plus every e-wallet. */
export const METHOD_CHANNELS_ALL: readonly string[] = [
  ...METHOD_CHANNELS_BANK,
  ...METHOD_CHANNELS_EWALLET
];

/** Separator between the base label and the channel. */
const SEPARATOR = "·";

/** True when `value` is one of the selectable method bases. */
export function isMethodBase(value: string): value is MethodBase {
  return (CHANNEL_BASES as readonly string[]).includes(value);
}

/** Banks / e-wallets valid for a given method base. */
export function channelsFor(base: string): readonly string[] {
  if (base === "cash") return METHOD_CHANNELS_BANK;
  if (isMethodBase(base)) return METHOD_CHANNELS_ALL;
  return [];
}

/** Split a stored method (`"QRIS · BRI"`) into its base label and channel. */
export function parseMethod(stored: string | undefined): { baseLabel: string; channel: string } {
  const [rawBase = "", rawChannel = ""] = String(stored ?? "").split(SEPARATOR);
  return { baseLabel: rawBase.trim(), channel: rawChannel.trim() };
}

/** Compose the value stored on an item from a base label and a channel. */
export function joinMethod(baseLabel: string, channel: string): string {
  const trimmedChannel = channel.trim();
  return trimmedChannel ? `${baseLabel} ${SEPARATOR} ${trimmedChannel}` : baseLabel;
}
