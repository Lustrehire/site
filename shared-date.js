(function () {
  const formatDisplayDate = (value, fallback = "-") => {
    if (value == null || value === "") return fallback;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return fallback;
      return value.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }

    const safeValue = String(value).trim();
    if (!safeValue) return fallback;

    if (/^\d{4}-\d{2}-\d{2}$/.test(safeValue)) {
      const [year, month, day] = safeValue.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (Number.isNaN(parsed.getTime())) return fallback;
      return parsed.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }

    const parsed = new Date(safeValue);
    if (Number.isNaN(parsed.getTime())) return fallback;

    return parsed.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const minimumNoticeDays = 8;
  const earliestEventDate = (backendDays = minimumNoticeDays, backendDate = "", now = new Date()) => {
    const offset = Math.max(minimumNoticeDays, Math.ceil(Number(backendDays) || minimumNoticeDays));
    // Advance local calendar days, including across DST, month and year boundaries.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const localMinimum = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(backendDate) && backendDate > localMinimum ? backendDate : localMinimum;
  };
  const noticeMessage = (earliestDate = earliestEventDate()) =>
    `We require at least 7 days' notice for bookings. Please select an event date from ${formatDisplayDate(earliestDate)} onwards.`;

  window.LustreHireDate = window.LustreHireDate || {};
  Object.assign(window.LustreHireDate, { formatDisplayDate, minimumNoticeDays, earliestEventDate, noticeMessage });
})();
