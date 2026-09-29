export interface PaginationInput { page?: number; limit?: number; }
export interface Pagination { skip: number; take: number; page: number; limit: number; }
export function toPagination(input: PaginationInput): Pagination {
  const page = Math.max(1, input.page ?? 1); const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
