'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface CopyTrade {
  id: number;
  follower_address: string;
  trader_address: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  status: string;
  pnl: number | null;
  created_at: number;
}

interface Summary {
  filled: number;
  total_volume_usdc: number;
  total_pnl_usdc: number;
}

export function CopyTradeLog({ follower }: { follower?: string }) {
  const [trades, setTrades] = useState<CopyTrade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `${API_URL}/trades?limit=20${follower ? `&follower=${follower}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setTrades(d.data || []);
        setSummary(d.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // 30초 주기 자동 갱신
    const timer = setInterval(() => {
      fetch(url).then(r => r.json()).then(d => {
        setTrades(d.data || []);
        setSummary(d.summary || null);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [follower]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">체결 건수</div>
            <div className="text-xl font-bold text-white">{summary.filled}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">총 거래량</div>
            <div className="text-xl font-bold text-indigo-400">
              ${summary.total_volume_usdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">총 PnL</div>
            <div className={`text-xl font-bold ${summary.total_pnl_usdc >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.total_pnl_usdc >= 0 ? '+' : ''}{summary.total_pnl_usdc.toFixed(2)} USDC
            </div>
          </div>
        </div>
      )}

      {/* 거래 내역 */}
      {trades.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          아직 Copy Trade 내역이 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3">시간</th>
                <th className="text-left py-2 px-3">심볼</th>
                <th className="text-left py-2 px-3">방향</th>
                <th className="text-right py-2 px-3">수량</th>
                <th className="text-right py-2 px-3">가격</th>
                <th className="text-center py-2 px-3">상태</th>
                <th className="text-right py-2 px-3">PnL</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                  <td className="py-2 px-3 text-gray-500">
                    {new Date(t.created_at * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3 font-medium">{t.symbol}</td>
                  <td className={`py-2 px-3 font-medium ${t.side === 'bid' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.side === 'bid' ? '▲ LONG' : '▼ SHORT'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{t.amount}</td>
                  <td className="py-2 px-3 text-right font-mono">${parseFloat(t.price).toLocaleString()}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      t.status === 'filled' ? 'bg-green-500/20 text-green-400' :
                      t.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {t.status === 'filled' ? '체결' : t.status === 'failed' ? '실패' : '대기'}
                    </span>
                  </td>
                  <td className={`py-2 px-3 text-right font-mono ${(t.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
