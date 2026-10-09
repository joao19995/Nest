export function Money({ value }: { value: number }) {
  return <>{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}</>;
}
