import dayjs from 'dayjs';

export type ImageSuggestion = { name: string; date?: string };

// Lark event titles often start with YYMMDD. Keep the visible title intact:
// screenshots can truncate it, and dates or times must be checked by the user.
export function extractImageEvents(text: string): ImageSuggestion[] {
  const found: ImageSuggestion[] = [];
  for (const line of text.split(/\r?\n/)) {
    const matches = [...line.matchAll(/\b(\d{6})(?:\d{2,4})?(?=\D|$)/g)];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const raw = line.slice(match.index, matches[i + 1]?.index ?? line.length).trim();
      const code = match[1];
      const year = 2000 + Number(code.slice(0, 2));
      const month = Number(code.slice(2, 4));
      const day = Number(code.slice(4, 6));
      const value = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      if (!value.isValid() || value.year() !== year || value.month() + 1 !== month || value.date() !== day) continue;
      if (!found.some(item => item.name === raw)) found.push({ name: raw.slice(0, 200), date: value.format('YYYY-MM-DD') });
    }
  }
  return found;
}
