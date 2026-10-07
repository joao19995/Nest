export function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)}</>;
}
