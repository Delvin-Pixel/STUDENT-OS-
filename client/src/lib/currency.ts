import type { CurrencyCode } from "./types";

export const CURRENCIES: {
  code: CurrencyCode;
  label: string;
  locale: string;
}[] = [
  { code: "GHS", label: "Ghanaian cedi (GH₵)", locale: "en-GH" },
  { code: "NGN", label: "Nigerian naira (₦)", locale: "en-NG" },
  { code: "KES", label: "Kenyan shilling (KSh)", locale: "en-KE" },
  { code: "ZAR", label: "South African rand (R)", locale: "en-ZA" },
  { code: "USD", label: "US dollar ($)", locale: "en-US" },
  { code: "GBP", label: "British pound (£)", locale: "en-GB" },
  { code: "EUR", label: "Euro (€)", locale: "en-IE" },
  { code: "INR", label: "Indian rupee (₹)", locale: "en-IN" },
];

export function formatMoney(amount: number, currency: CurrencyCode) {
  const locale =
    CURRENCIES.find(item => item.code === currency)?.locale ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
