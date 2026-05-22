export function isWithinConfiguredHorario(
  dataInicio: Date,
  dataFim: Date,
  now = new Date(),
): boolean {
  const inicio = new Date(now);
  inicio.setHours(dataInicio.getHours(), dataInicio.getMinutes(), 0, 0);

  const fim = new Date(now);
  fim.setHours(dataFim.getHours(), dataFim.getMinutes(), 0, 0);

  return now >= inicio && now <= fim;
}
