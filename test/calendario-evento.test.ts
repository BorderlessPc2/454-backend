import assert from "node:assert/strict";
import {
  addDaysYmd,
  assertInclusiveDateRange,
  toFullCalendarExclusiveEnd,
} from "../src/lib/calendario-evento-dates.js";
import { mapCalendarioEventoToResponse } from "../src/services/calendario-evento.service.js";

assert.equal(addDaysYmd("2026-07-20", 1), "2026-07-21");
assert.equal(addDaysYmd("2026-07-31", 1), "2026-08-01");
assert.equal(toFullCalendarExclusiveEnd("2026-07-22"), "2026-07-23");
assert.equal(toFullCalendarExclusiveEnd("2026-07-20"), "2026-07-21");

assert.doesNotThrow(() => assertInclusiveDateRange("2026-07-20", "2026-07-20"));
assert.doesNotThrow(() => assertInclusiveDateRange("2026-07-20", "2026-07-22"));
assert.throws(
  () => assertInclusiveDateRange("2026-07-22", "2026-07-20"),
  /dataInicio não pode ser maior que dataFim/,
);

const mapped = mapCalendarioEventoToResponse({
  id: 7,
  titulo: "Demanda sprint",
  descricao: "Alinhar prioridades",
  dataInicio: new Date(Date.UTC(2026, 6, 20)),
  dataFim: new Date(Date.UTC(2026, 6, 22)),
  clienteId: 3,
  criadoPorId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  cliente: { id: 3, nomeFantasia: "TechSolutions" },
  criadoPor: { id: 1, nome: "Admin" },
});

assert.equal(mapped.id, "7");
assert.equal(mapped.title, "Demanda sprint");
assert.equal(mapped.start, "2026-07-20");
assert.equal(mapped.end, "2026-07-23"); // exclusivo FullCalendar → pinta 20, 21 e 22
assert.equal(mapped.allDay, true);
assert.equal(mapped.extendedProps.dataInicio, "2026-07-20");
assert.equal(mapped.extendedProps.dataFim, "2026-07-22");
assert.equal(mapped.extendedProps.clienteNome, "TechSolutions");

const sameDay = mapCalendarioEventoToResponse({
  id: 8,
  titulo: "Daily",
  descricao: null,
  dataInicio: new Date(Date.UTC(2026, 6, 20)),
  dataFim: new Date(Date.UTC(2026, 6, 20)),
  clienteId: null,
  criadoPorId: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
  cliente: null,
  criadoPor: { id: 2, nome: "Técnico" },
});

assert.equal(sameDay.start, "2026-07-20");
assert.equal(sameDay.end, "2026-07-21");
assert.equal(sameDay.extendedProps.dataInicio, "2026-07-20");
assert.equal(sameDay.extendedProps.dataFim, "2026-07-20");
assert.equal(sameDay.extendedProps.clienteId, null);

console.log("calendario-evento.test.ts OK");
