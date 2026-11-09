'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export const tablePageSize = 40;

export function pageOf<T>(items: T[], requested: number, size = tablePageSize) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(0, requested), pages - 1);
  return { page, pages, rows: items.slice(page * size, (page + 1) * size) };
}

export default function Pagination({ page, pages, onChange }: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const numbers = pages <= 7
    ? Array.from({ length: pages }, (_, i) => i)
    : [...new Set([0, 1, 2, page - 1, page, page + 1, pages - 1])]
        .filter(i => i >= 0 && i < pages)
        .sort((a, b) => a - b);
  return <nav className="table-pagination" aria-label="Страницы таблицы">
    <button type="button" aria-label="Предыдущая страница" disabled={page === 0} onClick={() => onChange(page - 1)}>
      <ChevronLeft size={18} aria-hidden="true"/>
    </button>
    {numbers.map((number, i) => <span key={number} className="pagination-item">
      {i > 0 && number - numbers[i - 1] > 1 && <span className="pagination-gap" aria-hidden="true">…</span>}
      <button type="button" aria-label={`Страница ${number + 1}`} aria-current={number === page ? 'page' : undefined}
        onClick={() => onChange(number)}>{number + 1}</button>
    </span>)}
    <button type="button" aria-label="Следующая страница" disabled={page === pages - 1} onClick={() => onChange(page + 1)}>
      <ChevronRight size={18} aria-hidden="true"/>
    </button>
  </nav>;
}
