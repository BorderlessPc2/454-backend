import assert from "node:assert/strict";
import {
  defaultConfigHorario,
  extractHhmmFromIsoLike,
  parseConfigHorarioInput,
  serializeConfigHorario,
} from "../src/lib/configuracao-horario.js";
import { isWithinConfiguredHorario } from "../src/lib/horario-utils.js";

function testParseHhmm() {
  const date = parseConfigHorarioInput("08:30");
  assert.equal(date.getUTCHours(), 8);
  assert.equal(date.getUTCMinutes(), 30);
}

function testExtractHhmmFromIso() {
  assert.equal(
    extractHhmmFromIsoLike("2020-01-01T00:00:00.000Z"),
    "00:00",
  );
  assert.equal(
    extractHhmmFromIsoLike("2026-07-02T08:00:00.000Z"),
    "08:00",
  );
  assert.equal(
    extractHhmmFromIsoLike("2026-07-02T19:00:00-03:00"),
    "19:00",
  );
}

function testSerializeReturnsHhmmAndIso() {
  const { dataInicio, dataFim } = defaultConfigHorario();
  const serialized = serializeConfigHorario(dataInicio, dataFim);
  assert.equal(serialized.horaInicio, "08:00");
  assert.equal(serialized.horaFim, "18:00");
  assert.equal(serialized.dataInicio, "1970-01-01T08:00:00.000Z");
  assert.equal(serialized.dataFim, "1970-01-01T18:00:00.000Z");
  // Compat legado: front que faz .slice(11, 16) no ISO
  assert.equal(serialized.dataInicio.slice(11, 16), "08:00");
  assert.equal(serialized.dataFim.slice(11, 16), "18:00");
}

function testParseIsoStoresWallClockFromString() {
  const date = parseConfigHorarioInput("2026-07-02T08:00:00.000Z");
  assert.equal(date.getUTCHours(), 8);
  assert.equal(date.getUTCMinutes(), 0);
}

function testIsWithinConfiguredHorario() {
  const { dataInicio, dataFim } = defaultConfigHorario();
  const meioDia = new Date(Date.UTC(2026, 5, 2, 12, 0, 0));
  const madrugada = new Date(Date.UTC(2026, 5, 2, 6, 0, 0));

  assert.equal(isWithinConfiguredHorario(dataInicio, dataFim, meioDia), true);
  assert.equal(isWithinConfiguredHorario(dataInicio, dataFim, madrugada), false);
}

testParseHhmm();
testExtractHhmmFromIso();
testSerializeReturnsHhmmAndIso();
testParseIsoStoresWallClockFromString();
testIsWithinConfiguredHorario();

console.log("configuracao-horario tests OK");
