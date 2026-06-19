import assert from "node:assert/strict";
import {
  normalizeHorarioItem,
  normalizeHorariosInput,
} from "../src/lib/normalize-horario-input.js";

assert.deepEqual(
  normalizeHorarioItem({
    horaInicial: "08:00",
    horaFinal: "12:00",
    periodo: "Manhã",
  }),
  { horaChegada: "08:00", horaSaida: "12:00" },
);

assert.deepEqual(
  normalizeHorariosInput({
    horaChegada: "09:00",
    horaSaida: "17:00",
  }),
  [{ horaChegada: "09:00", horaSaida: "17:00" }],
);

assert.equal(normalizeHorarioItem({ horaInicial: "", horaFinal: "" }), null);

console.log("normalize-horario-input tests OK");
