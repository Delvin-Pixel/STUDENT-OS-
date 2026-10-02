import { isValidLocalIsoDate } from "./calendarValidation";
import type { BudgetCategory, Transaction } from "./types";

const BUDGET_CATEGORIES: readonly BudgetCategory[] = [
  "food",
  "transport",
  "school",
  "entertainment",
  "other",
];

/** Mirrors the bounded transaction contract before a record reaches the local-first workspace. */
export function validateNewTransaction(
  transaction: Omit<Transaction, "id">
): string | null {
  if (transaction.type !== "income" && transaction.type !== "expense")
    return "Choose income or expense.";
  if (
    !Number.isFinite(transaction.amount) ||
    transaction.amount <= 0 ||
    transaction.amount > 10_000_000
  )
    return "Enter an amount greater than zero within the supported range.";
  if (!BUDGET_CATEGORIES.includes(transaction.category))
    return "Choose a valid budget category.";
  if (!transaction.label.trim() || transaction.label.trim().length > 1_000)
    return "Give the transaction a name of up to 1,000 characters.";
  if (!isValidLocalIsoDate(transaction.date))
    return "Choose a valid local calendar date.";
  return null;
}
