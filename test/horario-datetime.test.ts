import assert from "node:assert/strict";
import {
  combineDataHoraWallClock,
  formatDataVisitaWallClock,
  formatHorarioWallClock,
  parseDataVisita,
  parseHorario,
} from "../src/lib/horario-datetime.js";

const dataVisita = "2026-06-19";

const chegada = parseHorario(dataVisita, "08:00");
const saida = parseHorario(dataVisita, "12:00");

assert.equal(formatHorarioWallClock(chegada), "08:00");
assert.equal(formatHorarioWallClock(saida), "12:00");

const visita = parseDataVisita("2026-06-19T00:00:00.000Z");
assert.equal(formatDataVisitaWallClock(visita), "2026-06-19");

const isoRoundTrip = parseHorario(
  dataVisita,
  "2026-06-19T08:00:00.000Z",
);
assert.equal(formatHorarioWallClock(isoRoundTrip), "08:00");

const combined = combineDataHoraWallClock(dataVisita, "08:00");
assert.equal(combined.toISOString(), "2026-06-19T08:00:00.000Z");

console.log("horario-datetime tests OK");
