export function formatEuro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function Money({ value }: { value: number }) {
  return <>{formatEuro(value)}</>;
}
