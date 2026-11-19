/**
 * Canonical date and time helpers for Jesmond 2.0 Business Availability and Appointments.
 * Provides timezone-resilient date string formatting and parsing.
 */

/**
 * Returns a local date in YYYY-MM-DD format regardless of UTC offset.
 */
export const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Extracts the calendar date (YYYY-MM-DD) from an ISO timestamp string.
 */
export const getItemDateString = (isoString: string): string => {
  if (!isoString) return "";
  if (isoString.includes("T")) {
    return isoString.split("T")[0];
  }
  return formatLocalDate(new Date(isoString));
};

/**
 * Extracts the time of day (HH:mm) from an ISO timestamp string.
 */
export const getItemTimeString = (isoString: string): string => {
  if (!isoString) return "";
  if (isoString.includes("T")) {
    const timePart = isoString.split("T")[1];
    return timePart.substring(0, 5);
  }
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Formats an ISO string into an Australian localized date: "Fri, 20 Nov 2026".
 */
export const formatDisplayDate = (isoString: string): string => {
  const dateStr = getItemDateString(isoString);
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
