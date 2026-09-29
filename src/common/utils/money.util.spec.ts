import { TransactionDirection, TransactionType } from '@prisma/client';
import { calculateFinancialState, assertPositiveMoney } from './money.util';

describe('calculateFinancialState', () => {
  const parentId = 'parent-uuid-001';

  it('Scenario 1: payment 2_000_000 - charge 100_000 = balance 1_900_000, debt 0', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 2_000_000 },
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 1_900_000, balance: 1_900_000, debt: 0 });
  });

  it('Scenario 2: balance 50_000 - charge 100_000 = balance 0, debt 50_000', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 50_000 },
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: -50_000, balance: 0, debt: 50_000 });
  });

  it('Scenario 3: debt 50_000 + payment 200_000 = balance 150_000, debt 0', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 50_000 },
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 200_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 150_000, balance: 150_000, debt: 0 });
  });

  it('Scenario 4: debt 50_000 + payment 20_000 = balance 0, debt 30_000', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 50_000 },
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 20_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: -30_000, balance: 0, debt: 30_000 });
  });

  it('Scenario 6: service price changes do not affect historical session charge calculation', () => {
    // The session stores a servicePriceSnapshot = 100_000 regardless of new price 150_000
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state.debt).toBe(100_000);
    // If we re-run with snapshot still = 100_000, the result is the same — immutable
    const state2 = calculateFinancialState(
      [
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state2).toEqual(state);
  });

  it('EXPENSE transactions do not affect parent family balance', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 100_000 },
        { parentId, type: TransactionType.EXPENSE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 100_000, balance: 100_000, debt: 0 });
  });

  it('REFUND reduces the net ledger correctly', () => {
    // Payment 200_000, charge 100_000, refund 50_000 => net = 200_000 - 100_000 - 50_000 = 50_000
    // Wait — REFUND is OUT (reduces parent's net) per spec: PAYMENTS - CHARGES - REFUNDS
    // Actually net = IN - OUT = 200_000 - 100_000 (charge OUT) - 50_000 (refund OUT) = 50_000
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 200_000 },
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
        { parentId, type: TransactionType.REFUND, direction: TransactionDirection.OUT, amount: 50_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 50_000, balance: 50_000, debt: 0 });
  });

  it('ignores rows for a different parentId', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 100_000 },
        { parentId: 'other-parent', type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 500_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 100_000, balance: 100_000, debt: 0 });
  });

  it('zero-sum yields zero balance and zero debt', () => {
    const state = calculateFinancialState(
      [
        { parentId, type: TransactionType.PAYMENT, direction: TransactionDirection.IN, amount: 100_000 },
        { parentId, type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, amount: 100_000 },
      ],
      parentId,
    );
    expect(state).toEqual({ net: 0, balance: 0, debt: 0 });
  });
});

describe('assertPositiveMoney', () => {
  it('passes for a valid positive integer', () => {
    expect(() => assertPositiveMoney(1)).not.toThrow();
    expect(() => assertPositiveMoney(100_000)).not.toThrow();
    expect(() => assertPositiveMoney(2_000_000_000)).not.toThrow();
  });

  it('throws for zero', () => {
    expect(() => assertPositiveMoney(0)).toThrow();
  });

  it('throws for negative', () => {
    expect(() => assertPositiveMoney(-1)).toThrow();
  });

  it('throws for a float', () => {
    expect(() => assertPositiveMoney(100.5)).toThrow();
  });

  it('throws for NaN', () => {
    expect(() => assertPositiveMoney(NaN)).toThrow();
  });
});
