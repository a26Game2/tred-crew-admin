import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageEvents } from '../src/image-events.ts';

test('extracts calendar codes including multi-day codes and rejects invalid dates', () => {
  const events = extractImageEvents('26100405 - HB Golf\n261028 - Tab   261031 - HB\n269999 - invalid');
  assert.deepEqual(events.map(e => e.date), ['2026-10-04', '2026-10-28', '2026-10-31']);
  assert.match(events[0].name, /HB Golf/);
});
