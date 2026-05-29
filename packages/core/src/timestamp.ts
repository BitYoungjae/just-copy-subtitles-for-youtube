/**
 * Format a millisecond offset as a transcript timestamp.
 * Under an hour: `m:ss` (e.g. "0:07", "12:34"). One hour or more: `h:mm:ss` (e.g. "1:02:05").
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
