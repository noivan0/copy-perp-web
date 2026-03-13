'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { BuilderCodeApproval } from './BuilderCodeApproval';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Trader {
  address: string;
  alias: string;
  total_pnl: number;
  win_rate: number;
  max_drawdown: number;
  follower_count: number;
  copy_trade_count: number;
  roi_7d?: number;
}

interface FollowModalProps {
  trader: Trader;
  onClose: () => void;
  followerAddress: string;
}

function FollowModal({ trader, onClose, followerAddress }: FollowModalProps) {
  const [ratio, setRatio] = useState(1.0);
  const [maxUsd, setMaxUsd] = useState(100);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [builderApproved, setBuilderApproved] = useState(false);

  async function handleFollow() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader_address: trader.address,
          follower_address: followerAddress,
          copy_ratio: ratio,
          max_position_usdc: maxUsd,
        }),
      });
      if (res.ok) setDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Follow {trader.alias}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-green-400 font-medium">Following {trader.alias}!</p>
            <p className="text-gray-400 text-sm mt-1">Copy trades will start automatically.</p>
            <button onClick={onClose} className="mt-4 bg-indigo-600 px-6 py-2 rounded-lg text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Builder Code 승인 */}
              <BuilderCodeApproval onApproved={() => setBuilderApproved(true)} />

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Copy Ratio</label>
                <input
                  type="range" min="0.1" max="1" step="0.1"
                  value={ratio}
                  onChange={e => setRatio(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10%</span>
                  <span className="text-white font-medium">{(ratio * 100).toFixed(0)}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Max Position Size (USDC)</label>
                <input
                  type="number" min="10" max="10000" step="10"
                  value={maxUsd}
                  onChange={e => setMaxUsd(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleFollow}
                disabled={loading || !builderApproved}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium"
                title={!builderApproved ? 'Builder Code 승인 후 가능합니다' : ''}
              >
                {loading ? 'Following...' : builderApproved ? 'Start Copying' : 'Approve First'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { authenticated, user } = usePrivy();
  const [traders, setTraders] = useState<Trader[]>([]);
  const [selected, setSelected] = useState<Trader | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solanaWallet = (user?.linkedAccounts as any[])?.find(
    (a: any) => a.type === 'wallet' && a.chainType === 'solana'
  );
  const followerAddress: string = solanaWallet?.address || '';

  useEffect(() => {
    fetch(`${API_URL}/traders?mock=true`)
      .then(r => r.json())
      .then(d => setTraders(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-3 px-4">#</th>
              <th className="text-left py-3 px-4">Trader</th>
              <th className="text-right py-3 px-4">PnL</th>
              <th className="text-right py-3 px-4">Win Rate</th>
              <th className="text-right py-3 px-4">Max DD</th>
              <th className="text-right py-3 px-4">Followers</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, i) => (
              <tr key={t.address} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-4 px-4 text-gray-500">{i + 1}</td>
                <td className="py-4 px-4">
                  <div className="font-medium">{t.alias}</div>
                  <div className="text-xs text-gray-500 font-mono">{t.address.slice(0, 8)}...</div>
                </td>
                <td className={`py-4 px-4 text-right font-mono font-medium ${t.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.total_pnl >= 0 ? '+' : ''}{t.total_pnl.toLocaleString()} USDC
                </td>
                <td className="py-4 px-4 text-right text-gray-300">{t.win_rate?.toFixed(1)}%</td>
                <td className="py-4 px-4 text-right text-red-400">{t.max_drawdown?.toFixed(1)}%</td>
                <td className="py-4 px-4 text-right text-gray-300">{t.follower_count}</td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => authenticated ? setSelected(t) : alert('Connect wallet first')}
                    className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && followerAddress && (
        <FollowModal
          trader={selected}
          followerAddress={followerAddress}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
