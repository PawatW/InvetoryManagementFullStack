'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../../components/AuthContext';
import { useAuthedSWR } from '../../../../lib/swr';
import type { Product, StockTransaction } from '../../../../lib/types';

const formatDateInputLabel = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(date);
};

interface AggregatedRow {
  productId: string;
  productName: string;
  unit?: string;
  totalQuantity: number;
  totalAmount: number;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default function ReportExportPage() {
  const { role, token } = useAuth();
  const { data: transactions } = useAuthedSWR<StockTransaction[]>(role === 'ADMIN' ? '/stock/transactions' : null, token, {
    refreshInterval: 60000
  });
  const { data: products } = useAuthedSWR<Product[]>(role === 'ADMIN' ? '/products' : null, token);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setExporting] = useState(false);

  if (role !== 'ADMIN') {
    return <p className="text-sm text-slate-500">เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงรายงานนี้ได้</p>;
  }

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    (products ?? []).forEach((product) => {
      map.set(product.productId, product);
    });
    return map;
  }, [products]);

  const dateRange = useMemo(() => {
    if (!startDate || !endDate) {
      return null;
    }
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    if (start > end) {
      return { start, end, isValid: false } as const;
    }
    return { start, end, isValid: true } as const;
  }, [startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    if (!transactions || !dateRange || !dateRange.isValid) {
      return [] as StockTransaction[];
    }
    return transactions.filter((transaction) => {
      if (transaction.type !== 'OUT') {
        return false;
      }
      const date = new Date(transaction.transactionDate);
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      const timestamp = date.getTime();
      if (dateRange.start && timestamp < dateRange.start.getTime()) {
        return false;
      }
      if (dateRange.end && timestamp > dateRange.end.getTime()) {
        return false;
      }
      return true;
    });
  }, [transactions, dateRange]);

  const aggregatedRows = useMemo(() => {
    const map = new Map<string, AggregatedRow>();
    filteredTransactions.forEach((transaction) => {
      const product = productMap.get(transaction.productId);
      const key = transaction.productId;
      const quantity = Math.abs(transaction.quantity ?? 0);
      const unitCost = product?.costPrice ?? 0;
      const previous = map.get(key);
      if (previous) {
        previous.totalQuantity += quantity;
        previous.totalAmount += quantity * unitCost;
      } else {
        map.set(key, {
          productId: transaction.productId,
          productName: product?.productName ?? transaction.productId,
          unit: product?.unit,
          totalQuantity: quantity,
          totalAmount: quantity * unitCost
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [filteredTransactions, productMap]);

  const totalQuantity = useMemo(
    () => aggregatedRows.reduce((sum, row) => sum + row.totalQuantity, 0),
    [aggregatedRows]
  );
  const totalAmount = useMemo(
    () => aggregatedRows.reduce((sum, row) => sum + row.totalAmount, 0),
    [aggregatedRows]
  );

  const canExport = Boolean(dateRange && dateRange.isValid && aggregatedRows.length > 0 && !isExporting);

  const handleExport = () => {
    if (!dateRange || !dateRange.isValid || aggregatedRows.length === 0) {
      return;
    }
    setExporting(true);
    try {
      const rangeLabel = `${formatDateInputLabel(startDate)} - ${formatDateInputLabel(endDate)}`;
      const reportTitle = `รายงานการเบิกสินค้า AstarService`;
      const rowsHtml = aggregatedRows
        .map(
          (row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.productId)}</td>
              <td>${escapeHtml(row.productName)}</td>
              <td>${escapeHtml(row.unit || '-')}</td>
              <td>${row.totalQuantity.toLocaleString('th-TH')}</td>
              <td>${row.totalAmount.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}</td>
            </tr>
          `
        )
        .join('');

      const summaryText = `จำนวนสินค้า: ${aggregatedRows.length.toLocaleString('th-TH')} | จำนวนหน่วยรวม: ${totalQuantity.toLocaleString('th-TH')} | จำนวนเงินรวม: ${totalAmount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} บาท`;

      const documentHtml = `
        <!DOCTYPE html>
        <html lang="th">
          <head>
            <meta charSet="utf-8" />
            <title>${escapeHtml(reportTitle)}</title>
            <style>
              body { font-family: 'Sarabun', 'Prompt', sans-serif; margin: 32px; color: #0f172a; }
              h1 { font-size: 22px; margin-bottom: 4px; }
              p { margin: 4px 0; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #cbd5f5; padding: 8px 10px; font-size: 12px; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; }
              tfoot td { font-weight: 600; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(reportTitle)}</h1>
            <p>ช่วงวันที่: ${escapeHtml(rangeLabel)}</p>
            <p>${escapeHtml(summaryText)}</p>
            <table>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>รหัสสินค้า</th>
                  <th>ชื่อสินค้า</th>
                  <th>หน่วยนับ</th>
                  <th>จำนวนหน่วย</th>
                  <th>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=900,height=650');
      if (!printWindow) {
        throw new Error('ไม่สามารถเปิดหน้าต่างสำหรับพิมพ์ได้');
      }
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
        }, 500);
      }, 250);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Report Export</h1>
        <p className="text-sm text-slate-500">สร้างรายงานการเบิกสินค้าในรูปแบบ PDF โดยเลือกช่วงวันที่ที่ต้องการ</p>
      </header>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-600">
            <span>วันที่เริ่มต้น</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>วันที่สิ้นสุด</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
        </div>
        {dateRange && !dateRange.isValid && (
          <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">วันที่เริ่มต้นต้องไม่น้อยกว่าวันที่สิ้นสุด</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div>
            <p>ช่วงวันที่ที่เลือก: {`${formatDateInputLabel(startDate)} - ${formatDateInputLabel(endDate)}`}</p>
            <p className="text-xs text-slate-400">นับเฉพาะธุรกรรมประเภทเบิกสินค้า (OUT)</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isExporting ? 'กำลังสร้าง PDF...' : 'ส่งออกเป็น PDF'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">สรุปรายการสินค้า</h2>
          <div className="text-sm text-slate-500">
            <span className="mr-4">จำนวนสินค้า: {aggregatedRows.length.toLocaleString('th-TH')}</span>
            <span className="mr-4">จำนวนหน่วยรวม: {totalQuantity.toLocaleString('th-TH')}</span>
            <span>จำนวนเงินรวม: {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {!dateRange ? (
            <p className="px-4 py-6 text-sm text-slate-500">กรุณาเลือกช่วงวันที่เพื่อแสดงข้อมูลสรุป</p>
          ) : aggregatedRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">ยังไม่มีข้อมูลสำหรับช่วงวันที่ที่เลือก</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">ลำดับ</th>
                  <th className="px-4 py-3">รหัสสินค้า</th>
                  <th className="px-4 py-3">ชื่อสินค้า</th>
                  <th className="px-4 py-3">หน่วยนับ</th>
                  <th className="px-4 py-3">จำนวนหน่วย</th>
                  <th className="px-4 py-3">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {aggregatedRows.map((row, index) => (
                  <tr key={row.productId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.productId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.productName}</td>
                    <td className="px-4 py-3 text-slate-500">{row.unit || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.totalQuantity.toLocaleString('th-TH')}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {row.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
