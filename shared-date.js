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

  window.LustreHireDate = window.LustreHireDate || {};
  window.LustreHireDate.formatDisplayDate = formatDisplayDate;
})();
