export const defaultBadgeBorderColor = (code: string) => code.endsWith("-silver") ? "#AEB7C4" : code.endsWith("-gold") ? "#E3B32E" : code.endsWith("-diamond") ? "#25B9B3" : code === "diligent-5" ? "#F26522" : "#D71920";

export const normalizeBadgeBorderColor = (value: unknown, code: string) => {
  const match = String(value || "").trim().match(/^#?([0-9A-Fa-f]{6})/);
  return match ? `#${match[1].toUpperCase()}` : defaultBadgeBorderColor(code);
};
