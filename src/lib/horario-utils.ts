export function isWithinConfiguredHorario(
  dataInicio: Date,
  dataFim: Date,
  now = new Date(),
): boolean {
  const startMinutes =
    dataInicio.getUTCHours() * 60 + dataInicio.getUTCMinutes();
  const endMinutes = dataFim.getUTCHours() * 60 + dataFim.getUTCMinutes();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}
