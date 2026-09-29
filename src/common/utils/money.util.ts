import { TransactionDirection, TransactionType } from '@prisma/client';

export interface LedgerRow { amount: number; direction: TransactionDirection; type: TransactionType; parentId: string | null; }
export interface FinancialState { net: number; balance: number; debt: number; }
export function calculateFinancialState(rows: readonly LedgerRow[], parentId: string): FinancialState {
  const net = rows.filter((row) => row.parentId === parentId && row.type !== TransactionType.EXPENSE)
    .reduce((total, row) => total + (row.direction === TransactionDirection.IN ? row.amount : -row.amount), 0);
  return { net, balance: Math.max(net, 0), debt: Math.max(-net, 0) };
}
export function assertPositiveMoney(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Amount must be a positive safe integer in UZS');
}
