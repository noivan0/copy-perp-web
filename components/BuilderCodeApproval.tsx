'use client';

/**
 * BuilderCodeApproval
 *
 * 팔로워가 Copy Perp를 사용하기 전 builder_code="noivan" 승인 서명을 처리합니다.
 *
 * 플로우:
 *   1. GET /builder/check → 이미 승인됐으면 스킵
 *   2. POST /builder/prepare-approval → 서버에서 서명할 메시지 받기
 *   3. Privy signMessage → 서명 생성
 *   4. POST /builder/approve → 서명을 서버로 전달 → Pacifica API 승인
 */

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require('bs58') as { encode: (bytes: Uint8Array) => string; decode: (str: string) => Uint8Array };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const BUILDER_CODE = 'noivan';
const MAX_FEE_RATE = '0.0005'; // 0.05%

interface Props {
  onApproved: () => void;
}

export function BuilderCodeApproval({ onApproved }: Props) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<'checking' | 'needed' | 'signing' | 'approved' | 'error'>('checking');
  const [error, setError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solanaWallet = (user?.linkedAccounts as any[])?.find(
    (a: any) => a.type === 'wallet' && a.chainType === 'solana'
  );
  const address: string = solanaWallet?.address || '';

  useEffect(() => {
    if (!address) return;
    checkApproval();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function checkApproval() {
    if (!address) return;
    setStatus('checking');
    try {
      const res = await fetch(`${API_URL}/builder/check?account=${address}`);
      const data = await res.json();
      if (data.approved) {
        setStatus('approved');
        onApproved();
      } else {
        setStatus('needed');
      }
    } catch {
      setStatus('needed'); // 확인 실패 → 승인 필요로 처리
    }
  }

  async function handleApprove() {
    if (!address) return;
    setStatus('signing');
    setError('');

    try {
      // 1. 서버에서 서명할 메시지 받기
      const prepRes = await fetch(`${API_URL}/builder/prepare-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: address, max_fee_rate: MAX_FEE_RATE }),
      });
      const prep = await prepRes.json();

      // 2. Privy Solana embedded wallet signMessage
      // wallets 배열에서 privy clientType 찾기
      const privyWallet = wallets.find((w) => w.walletClientType === 'privy');
      if (!privyWallet) throw new Error('Privy 임베디드 지갑을 찾을 수 없습니다');

      // Privy wallet provider를 통해 solana_signMessage 호출
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = await (privyWallet as any).getSolanaProvider?.();
      let signature: string;
      if (provider) {
        // Solana provider: signMessage expects Uint8Array
        const msgBytes = new TextEncoder().encode(prep.message);
        const { signature: sig } = await provider.signMessage(msgBytes);
        signature = bs58Encode(sig instanceof Uint8Array ? sig : new Uint8Array(sig));
      } else {
        // Fallback: Privy embedded wallet signMessage via connector
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { signature: sig } = await (privyWallet as any).sign(
          new TextEncoder().encode(prep.message)
        );
        signature = bs58Encode(sig instanceof Uint8Array ? sig : new Uint8Array(sig));
      }
      // bs58Encode fallback (unused if bs58 import works)
      void bs58Encode;

      // 3. 서버로 전달 → Pacifica API 승인
      const approveRes = await fetch(`${API_URL}/builder/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: address,
          signature,
          timestamp: prep.timestamp,
          max_fee_rate: MAX_FEE_RATE,
        }),
      });

      if (!approveRes.ok) {
        const err = await approveRes.json();
        throw new Error(err.detail || '승인 실패');
      }

      setStatus('approved');
      onApproved();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }

  // base58 인코딩 — bs58 라이브러리 사용
  function bs58Encode(bytes: Uint8Array): string {
    return bs58.encode(bytes);
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border border-gray-600 border-t-transparent rounded-full animate-spin" />
        Builder Code 확인 중...
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <span>✅</span>
        <span>Builder Code <span className="font-mono">{BUILDER_CODE}</span> 승인됨</span>
      </div>
    );
  }

  if (status === 'signing') {
    return (
      <div className="flex items-center gap-2 text-sm text-indigo-400">
        <div className="w-4 h-4 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
        지갑에서 서명 중...
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-xl">🔐</span>
        <div>
          <p className="text-sm font-medium text-white">Builder Code 승인 필요</p>
          <p className="text-xs text-gray-400 mt-1">
            Copy Perp는 <span className="font-mono text-indigo-400">{BUILDER_CODE}</span> 빌더 코드를 통해
            거래 수수료의 <strong className="text-white">0.05%</strong>를 수취합니다.
            서비스 유지 비용으로 사용됩니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={handleApprove}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        서명하고 Copy Trading 시작
      </button>

      <p className="text-xs text-gray-600 text-center">
        1회 서명으로 영구 적용 · 언제든 취소 가능
      </p>
    </div>
  );
}
