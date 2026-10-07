import type { FinanceState } from "@/features/monthly-plan/domain/types";
import { exampleAnnualPlan, exampleConfiguration, exampleMonth } from "@/features/monthly-plan/data/example-month";

export const initialFinanceState: FinanceState = {
  configuration: exampleConfiguration,
  annualPlans: [exampleAnnualPlan],
  months: [exampleMonth],
};
