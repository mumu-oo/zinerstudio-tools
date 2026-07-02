// 上下班時間表:台北時間 週一~五 10:00–19:00 = 穆穆值班(小精靈靜默)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBusinessHours, taipeiNow } from '../src/state.js';

// 用 UTC 造台北時間:台北 = UTC+8
const taipei = (y, m, d, hh, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh - 8, mm));

test('週四 14:00 → 上班中', () => assert.equal(isBusinessHours(taipei(2026, 7, 2, 14)), true));
test('週四 09:59 → 還沒上班', () => assert.equal(isBusinessHours(taipei(2026, 7, 2, 9, 59)), false));
test('週四 10:00 → 上班開始', () => assert.equal(isBusinessHours(taipei(2026, 7, 2, 10, 0)), true));
test('週四 18:59 → 還在上班', () => assert.equal(isBusinessHours(taipei(2026, 7, 2, 18, 59)), true));
test('週四 19:00 → 下班了', () => assert.equal(isBusinessHours(taipei(2026, 7, 2, 19, 0)), false));
test('週六中午 → 休假(小精靈值班)', () => assert.equal(isBusinessHours(taipei(2026, 7, 4, 12)), false));
test('週日晚上 → 休假', () => assert.equal(isBusinessHours(taipei(2026, 7, 5, 21)), false));
test('週一凌晨 02:00 → 下班時間', () => assert.equal(isBusinessHours(taipei(2026, 7, 6, 2)), false));

test('dateKey 以台北時間換日', () => {
  // 台北 7/3 凌晨 01:00 = UTC 7/2 17:00,dateKey 應該是 7/3
  assert.equal(taipeiNow(taipei(2026, 7, 3, 1)).dateKey, '2026-07-03');
});
