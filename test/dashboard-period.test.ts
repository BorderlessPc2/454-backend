import assert from "node:assert/strict";
import {
  computePercentualConcluido,
  formatHorasKpiString,
  getDefaultDashboardPeriod,
  getFirstMonthRangeFromPeriod,
  parseDashboardPeriod,
} from "../src/lib/dashboard-period.js";

function testDefaultPeriodStartsOnFirstDayOfMonth() {
  const period = getDefaultDashboardPeriod();
  assert.match(period.dataInicio, /^\d{4}-\d{2}-01$/);
  assert.ok(period.dataInicio <= period.dataFim);
  assert.ok(period.inicio <= period.fim);
}

function testParseDashboardPeriod() {
  const period = parseDashboardPeriod("2024-08-01", "2024-09-15");
  assert.equal(period.dataInicio, "2024-08-01");
  assert.equal(period.dataFim, "2024-09-15");
}

function testParseDashboardPeriodRequiresBothDates() {
  assert.throws(
    () => parseDashboardPeriod("2024-08-01", undefined),
    /dataInicio e dataFim/,
  );
}

function testParseDashboardPeriodRejectsInvertedRange() {
  assert.throws(
    () => parseDashboardPeriod("2024-09-01", "2024-08-01"),
    /dataInicio não pode ser maior/,
  );
}

function testFirstMonthRangeFromPeriod() {
  const { inicio } = parseDashboardPeriod("2024-08-01", "2024-09-15");
  const firstMonth = getFirstMonthRangeFromPeriod(inicio);
  assert.equal(firstMonth.inicio.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.equal(firstMonth.fim.toISOString(), "2024-08-31T23:59:59.999Z");
}

function testFormatHorasKpiString() {
  assert.equal(formatHorasKpiString(350.5), "350.50");
  assert.equal(formatHorasKpiString(95), "95.00");
}

function testComputePercentualConcluido() {
  assert.equal(computePercentualConcluido(1, 5), 20);
  assert.equal(computePercentualConcluido(3, 4), 75);
}

testDefaultPeriodStartsOnFirstDayOfMonth();
testParseDashboardPeriod();
testParseDashboardPeriodRequiresBothDates();
testParseDashboardPeriodRejectsInvertedRange();
testFirstMonthRangeFromPeriod();
testFormatHorasKpiString();
testComputePercentualConcluido();

console.log("dashboard-period tests OK");
