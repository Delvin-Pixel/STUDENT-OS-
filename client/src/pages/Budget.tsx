/* STUDENT OS — Budget Tracker. Income/expenses, categories, monthly summary,
   simple bar chart, add/delete transactions. */

import { BrandedEmpty } from "@/components/AppBits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/contexts/StoreContext";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { validateNewTransaction } from "@/lib/transactionValidation";
import type { BudgetCategory, Transaction } from "@/lib/types";
import { cn, formatDateHuman, todayStr } from "@/lib/utils";
import { Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const thisMonth = () => todayStr().slice(0, 7);

const CATEGORIES: { value: BudgetCategory; label: string; emoji: string }[] = [
  { value: "food", label: "Food", emoji: "🍔" },
  { value: "transport", label: "Transport", emoji: "🚌" },
  { value: "school", label: "School", emoji: "📚" },
  { value: "entertainment", label: "Entertainment", emoji: "🎮" },
  { value: "other", label: "Other", emoji: "📦" },
];

const CAT_COLORS: Record<string, string> = {
  food: "oklch(0.65 0.19 35)",
  transport: "oklch(0.62 0.11 195)",
  school: "oklch(0.65 0.13 145)",
  entertainment: "oklch(0.68 0.14 60)",
  other: "oklch(0.55 0.1 250)",
};

export default function Budget() {
  const { state, addTransaction, deleteTransaction, setCurrency } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const currency = state.settings.currency;
  const money = (amount: number) => formatMoney(amount, currency);

  const txns = useMemo(
    () => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions]
  );
  const month = thisMonth();

  const monthTxns = txns.filter(t => t.date.startsWith(month));
  const income = monthTxns
    .filter(t => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const spent = monthTxns
    .filter(t => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const balance = income - spent;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthTxns
      .filter(t => t.type === "expense")
      .forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        name: CATEGORIES.find(c => c.value === category)?.label ?? category,
        amount,
        fill: CAT_COLORS[category] ?? CAT_COLORS.other,
      }));
  }, [monthTxns]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Budget
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {month} — knowing where every coin goes is the first step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currency}
            onValueChange={value => setCurrency(value as typeof currency)}
          >
            <SelectTrigger
              aria-label="Budget currency"
              className="h-9 w-28 rounded-xl bg-card text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(item => (
                <SelectItem key={item.code} value={item.code}>
                  {item.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="sunrise" onClick={() => setDialogOpen(true)}>
            + Add
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Income"
          value={money(income)}
          color="text-[oklch(0.55_0.12_145)]"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Spent"
          value={money(spent)}
          color="text-destructive"
        />
        <SummaryCard
          icon={Wallet}
          label="Balance"
          value={money(balance)}
          color={balance >= 0 ? "text-foreground" : "text-destructive"}
        />
      </div>

      {byCategory.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-sm font-semibold">
            Spending by category (this month)
          </h2>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCategory}
                margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [money(v), "Spent"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {byCategory.map((b, i) => (
                    <BarCell key={i} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {byCategory.map(b => (
              <div key={b.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: b.fill }}
                />
                <span>{b.name}</span>
                <span className="font-medium">{money(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {txns.length === 0 ? (
          <BrandedEmpty
            icon={Wallet}
            title="No transactions yet"
            text="Track your income and expenses to keep your allowance in check."
            coach="Small amounts add up — log one thing and the picture appears."
            actionLabel="+ Add Transaction"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          txns.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm lift-card"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base",
                  t.type === "income"
                    ? "bg-[oklch(0.93_0.04_145)]"
                    : "bg-destructive/8"
                )}
              >
                {CATEGORIES.find(c => c.value === t.category)?.emoji ?? "📦"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.label}</div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] px-2 py-0.5"
                  >
                    {CATEGORIES.find(c => c.value === t.category)?.label ??
                      t.category}
                  </Badge>
                  <span>{formatDateHuman(t.date)}</span>
                </div>
              </div>
              <span
                className={cn(
                  "font-display text-sm font-bold",
                  t.type === "income"
                    ? "text-[oklch(0.55_0.12_145)]"
                    : "text-destructive"
                )}
              >
                {t.type === "income" ? "+" : "−"}
                {money(t.amount)}
              </span>
              <button
                onClick={() => deleteTransaction(t.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete transaction"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <TxnDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currency={currency}
        onSave={addTransaction}
      />
    </div>
  );
}

/* tiny helper so we can pass fills into Bar (shadcn chart needs ReactNode children) */
function BarCell({ fill }: { fill: string }) {
  return <rect fill={fill} />;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          color
        )}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("mt-1 font-display text-lg font-bold", color)}>
        {value}
      </div>
    </div>
  );
}

function TxnDialog({
  open,
  onOpenChange,
  onSave,
  currency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: Omit<Transaction, "id">) => boolean;
  currency: string;
}) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<BudgetCategory>("food");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayStr);
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);

  useEffect(() => {
    if (open) saveClaimRef.current = false;
  }, [open]);

  const submit = () => {
    const amt = Number(amount);
    const transaction = {
      type,
      amount: amt,
      category,
      label: label.trim(),
      date,
    };
    const validationError = validateNewTransaction(transaction);
    if (validationError) return setError(validationError);
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    if (!onSave(transaction)) {
      saveClaimRef.current = false;
      return setError(
        "Student OS could not save that transaction. Review the details and try again."
      );
    }
    setAmount("");
    setLabel("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add transaction</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["income", "expense"] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 rounded-full border px-4 py-2.5 text-sm font-medium capitalize",
                  type === t
                    ? t === "income"
                      ? "border-[oklch(0.55_0.12_145)] bg-[oklch(0.55_0.12_145)] text-white"
                      : "border-destructive bg-destructive text-white"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Label</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Groceries"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Amount ({currency})
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={v => setCategory(v as BudgetCategory)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} variant="sunrise">
            Add transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
