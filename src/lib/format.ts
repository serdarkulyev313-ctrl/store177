export function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}
