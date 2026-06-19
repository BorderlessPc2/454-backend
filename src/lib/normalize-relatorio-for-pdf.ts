import type { RelatorioPdfData } from "../services/relatorio-pdf.service.js";
import {
  formatDataVisitaWallClock,
  formatHorarioWallClock,
  parseDataVisita,
  parseHorario,
} from "./horario-datetime.js";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Garante que data/horários do PDF usem o mesmo "horário de parede" da API
 * (08:00 digitado = 08:00 no PDF), independente do fuso do servidor.
 */
export function normalizeRelatorioForPdf(
  relatorio: RelatorioPdfData,
): RelatorioPdfData {
  const dataVisitaDate = toDate(relatorio.dataVisita);
  const dataVisitaStr = formatDataVisitaWallClock(dataVisitaDate);

  const horarios = relatorio.horarios.map((horario) => {
    const chegadaHhmm = formatHorarioWallClock(toDate(horario.horaChegada));
    const saidaHhmm = formatHorarioWallClock(toDate(horario.horaSaida));

    return {
      horaChegada: parseHorario(dataVisitaStr, chegadaHhmm),
      horaSaida: parseHorario(dataVisitaStr, saidaHhmm),
    };
  });

  return {
    ...relatorio,
    dataVisita: parseDataVisita(dataVisitaStr),
    horarios,
  };
}
