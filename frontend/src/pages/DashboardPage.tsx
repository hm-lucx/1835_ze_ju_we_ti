import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import PageShell from '../components/PageShell';

interface Account {
  userId: string;
  username: string;
  balance: number;
}

interface Game {
  id: string;
  host: string;
  status: string;
  players: { username: string; joinedAt: string }[];
  startedAt?: string;
  finishedAt?: string;
  accounts: Account[];
  bank: { balance: number } | null;
  winners?: string[];
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  memo: string | null;
  fromUsername: string | null;
  toUsername: string | null;
  createdAt: string;
  runningBalance: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  STARTING_CAPITAL: 'Startkapital',
  PLAYER_TRANSFER: 'Überweisung',
  RECEIVE_FROM_BANK: 'Bankeinzahlung',
  BUY_FROM_BANK: 'Aktienkauf (Bank)',
  SELL_TO_BANK: 'Aktienverkauf (Bank)',
  BUY_FROM_PLAYER: 'Aktienkauf (Spieler)',
  SELL_TO_PLAYER: 'Aktienverkauf (Spieler)',
  PAYOFF: 'Auszahlung',
};

const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const myAccount = game?.accounts?.find(a => a.username === user?.username);
  const otherPlayers = game?.accounts?.filter(a => a.username !== user?.username) || [];
  const sortedAccounts = game?.accounts ? [...game.accounts].sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.username.localeCompare(b.username);
  }) : [];

  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveError, setReceiveError] = useState('');
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [receiveMemo, setReceiveMemo] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [finishLoading, setFinishLoading] = useState(false);

  async function handleTransfer() {
    if (!token || !id || !myAccount) return;
    const amount = parseInt(transferAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setTransferError('Betrag muss eine positive ganze Zahl sein.');
      return;
    }
    if (amount > myAccount.balance) {
      setTransferError('Nicht genügend Guthaben.');
      return;
    }
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      const data = await apiPost(`/api/games/${id}/transfer`, { toUsername: transferRecipient, amount, memo: transferMemo || undefined }, token) as { accounts: Account[]; bank: { balance: number } };
      setGame(prev => prev ? { ...prev, accounts: data.accounts, bank: data.bank } : null);
      setTransferAmount('');
      setTransferMemo('');
      setTransferSuccess('Überweisung erfolgreich.');
    } catch (err: unknown) {
      setTransferError((err as { message?: string }).message || 'Überweisung fehlgeschlagen.');
    } finally {
      setTransferLoading(false);
      loadTransactions();
    }
  }

  async function handleReceiveFromBank() {
    if (!token || !id) return;
    const amount = parseInt(receiveAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setReceiveError('Betrag muss eine positive ganze Zahl sein.');
      return;
    }
    setReceiveLoading(true);
    setReceiveError('');
    setReceiveSuccess('');
    try {
      const data = await apiPost(`/api/games/${id}/receive-from-bank`, { amount, memo: receiveMemo || undefined }, token) as { accounts: Account[]; bank: { balance: number } };
      setGame(prev => prev ? { ...prev, accounts: data.accounts, bank: data.bank } : null);
      setReceiveAmount('');
      setReceiveMemo('');
      setReceiveSuccess('Geld von Bank empfangen.');
    } catch (err: unknown) {
      setReceiveError((err as { message?: string }).message || 'Auszahlung fehlgeschlagen.');
    } finally {
      setReceiveLoading(false);
      loadTransactions();
    }
  }

  async function handlePause() {
    if (!token || !id) return;
    if (!window.confirm('Spiel wirklich pausieren? Spieler können dann keine Transaktionen mehr durchführen.')) return;
    setPauseLoading(true);
    try {
      const data = await apiPost(`/api/games/${id}/pause`, {}, token) as { status: string };
      setGame(prev => prev ? { ...prev, status: data.status } : null);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Pausieren fehlgeschlagen.');
    } finally {
      setPauseLoading(false);
    }
  }

  async function handleFinish() {
    if (!token || !id) return;
    if (!window.confirm('Spiel wirklich beenden? Dies kann nicht rückgängig gemacht werden.')) return;
    setFinishLoading(true);
    try {
      const data = await apiPost(`/api/games/${id}/finish`, {}, token) as { status: string; winners: string[]; finishedAt: string };
      setGame(prev => prev ? { ...prev, status: data.status, winners: data.winners, finishedAt: data.finishedAt } : null);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Beenden fehlgeschlagen.');
    } finally {
      setFinishLoading(false);
    }
  }

  const loadGame = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await apiGet(`/api/games/${id}`, token);
      if (data.game) {
        setGame(data.game as Game);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Fehler beim Laden des Spielstands.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const loadTransactions = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await apiGet(`/api/games/${id}/transactions`, token) as { transactions: Transaction[] };
      setTransactions(data.transactions);
    } catch (err) {
      console.warn('Transaktionen laden fehlgeschlagen:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadGame();
    loadTransactions();
  }, [loadGame, loadTransactions]);

  useEffect(() => {
    if (!game) return;
    if (game.status !== 'RUNNING') return;
    const interval = setInterval(() => {
      loadGame();
      loadTransactions();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [game, loadGame, loadTransactions]);

  if (loading) {
    return (
      <PageShell wide withHeader>
        <p className="page-muted">Lade Spielstand…</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell wide withHeader>
        <p className="page-error" style={{ marginBottom: '1rem' }}>{error}</p>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/lobby')}>
          Zurück zur Lobby
        </button>
      </PageShell>
    );
  }

  if (!game) {
    return (
      <PageShell wide withHeader>
        <p className="page-muted">Spiel nicht gefunden.</p>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/lobby')}>
          Zurück zur Lobby
        </button>
      </PageShell>
    );
  }

  return (
    <PageShell wide withHeader>
      <h1 className="page-title">Spiel-Dashboard</h1>

      {game.startedAt && (
        <p className="page-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Gestartet: {new Date(game.startedAt).toLocaleString()}
        </p>
      )}

      {game.status === 'PAUSED' && (
        <p className="page-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-error)', fontWeight: 600 }}>
          ⚠️ Spiel pausiert
        </p>
      )}

      {game.status === 'FINISHED' && (
        <p className="page-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-accent)', fontWeight: 700 }}>
          🏆 Spiel beendet
        </p>
      )}

      {myAccount && (
        <div className="balance-card">
          <p className="balance-card__label">Dein Kontostand</p>
          <p className="balance-card__amount">{myAccount.balance} Mark</p>
        </div>
      )}

      {game.bank && (
        <div className={`balance-card balance-card--bank${game.bank.balance < 0 ? ' balance-card--negative' : ''}`}>
          <p className="balance-card__label" style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Bank</p>
          <p className={`balance-card__amount balance-card__amount--bank${game.bank.balance < 0 ? ' balance-card__amount--negative' : ''}`}>
            {game.bank.balance} Mark
          </p>
        </div>
      )}

      {game.status === 'RUNNING' && (
        <button
          type="button"
          className="btn btn--danger"
          onClick={handlePause}
          disabled={pauseLoading}
          style={{ marginBottom: '0.5rem' }}
        >
          {pauseLoading ? 'Wird pausiert…' : 'Spiel pausieren'}
        </button>
      )}

      {(game.status === 'RUNNING' || game.status === 'PAUSED') && (
        <button
          type="button"
          className="btn btn--dark"
          onClick={handleFinish}
          disabled={finishLoading}
          style={{ marginBottom: '1rem' }}
        >
          {finishLoading ? 'Wird beendet…' : 'Spiel beenden'}
        </button>
      )}

      <div className="table-scroll">
        <table className="data-table data-table--leaderboard">
          <thead>
            <tr>
              <th className="data-table__rank">Rang</th>
              <th style={{ textAlign: 'left' }}>Spieler</th>
              <th className="data-table__right">Kontostand</th>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((a, i) => {
              const isMe = a.username === user?.username;
              const isWinner = game.winners?.includes(a.username);
              const bgColor = isWinner ? 'rgba(201, 153, 58, 0.15)' : isMe ? 'rgba(201, 153, 58, 0.08)' : undefined;
              return (
                <tr key={a.userId} style={{ backgroundColor: bgColor }}>
                  <td className="data-table__rank">{i + 1}.</td>
                  <td style={{ fontWeight: isMe ? 700 : 400 }}>
                    {isWinner ? '👑 ' : ''}{a.username}{isMe ? ' (Du)' : ''}
                  </td>
                  <td className="data-table__right">{a.balance} Mark</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {game.status === 'RUNNING' ? (
        <>
          <div className="form-section">
            <p className="form-section__title">Geld senden</p>

            <div className="form-row">
              <input
                type="number"
                min={1}
                max={myAccount?.balance || 0}
                value={transferAmount}
                onChange={e => { setTransferAmount(e.target.value); setTransferError(''); setTransferSuccess(''); }}
                placeholder="Betrag"
                className="form-input"
              />
              <select
                value={transferRecipient}
                onChange={e => { setTransferRecipient(e.target.value); setTransferError(''); setTransferSuccess(''); }}
                className="form-select"
              >
                <option value="">Bank</option>
                {otherPlayers.map(a => (
                  <option key={a.userId} value={a.username}>{a.username}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={transferMemo}
              onChange={e => { setTransferMemo(e.target.value); setTransferError(''); setTransferSuccess(''); }}
              placeholder="Verwendungszweck"
              maxLength={100}
              className="form-input"
              style={{ marginBottom: '0.5rem' }}
            />

            <button
              type="button"
              className="btn"
              onClick={handleTransfer}
              disabled={transferLoading || !transferAmount || !myAccount}
            >
              {transferLoading ? 'Wird gesendet…' : 'Senden'}
            </button>

            {transferError && <p className="page-error" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{transferError}</p>}
            {transferSuccess && <p style={{ color: 'var(--color-accent)', marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{transferSuccess}</p>}
          </div>

          <div className="form-section">
            <p className="form-section__title">Geld von Bank empfangen</p>

            <div className="form-row">
              <input
                type="number"
                min={1}
                value={receiveAmount}
                onChange={e => { setReceiveAmount(e.target.value); setReceiveError(''); setReceiveSuccess(''); }}
                placeholder="Betrag"
                className="form-input"
              />
            </div>

            <input
              type="text"
              value={receiveMemo}
              onChange={e => { setReceiveMemo(e.target.value); setReceiveError(''); setReceiveSuccess(''); }}
              placeholder="Verwendungszweck"
              maxLength={100}
              className="form-input"
              style={{ marginBottom: '0.5rem' }}
            />

            <button
              type="button"
              className="btn"
              onClick={handleReceiveFromBank}
              disabled={receiveLoading || !receiveAmount}
            >
              {receiveLoading ? 'Wird empfangen…' : 'Empfangen'}
            </button>

            {receiveError && <p className="page-error" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{receiveError}</p>}
            {receiveSuccess && <p style={{ color: 'var(--color-accent)', marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{receiveSuccess}</p>}
          </div>
        </>
      ) : game.status === 'PAUSED' ? (
        <p className="page-muted" style={{ marginBottom: '1rem' }}>
          Transaktionen sind im pausierten Zustand nicht möglich.
        </p>
      ) : (
        <p className="page-muted" style={{ marginBottom: '1rem' }}>
          Das Spiel ist beendet.
        </p>
      )}

      <div className="form-section">
        <p className="form-section__title">Transaktionshistorie</p>

        {transactionsLoading ? (
          <p className="page-muted">Lade Transaktionen…</p>
        ) : transactions.length === 0 ? (
          <p className="page-muted">Noch keine Transaktionen.</p>
        ) : (
          <div className="table-scroll table-scroll--transactions">
            <table className="data-table data-table--transactions">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Typ</th>
                  <th style={{ textAlign: 'left' }}>Von</th>
                  <th style={{ textAlign: 'left' }}>Nach</th>
                  <th className="data-table__right">Betrag</th>
                  <th className="data-table__right">Saldo</th>
                  <th style={{ textAlign: 'left' }}>Zweck</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const amountStr = t.type === 'STARTING_CAPITAL' || t.toUsername === user?.username
                    ? `+${t.amount} Mark`
                    : `-${t.amount} Mark`;
                  const amountColor = t.type === 'STARTING_CAPITAL' || t.toUsername === user?.username
                    ? 'var(--color-accent)'
                    : 'var(--color-error)';
                  return (
                    <tr key={t.id}>
                      <td>{TYPE_LABELS[t.type] || t.type}</td>
                      <td>{t.fromUsername || 'Bank'}</td>
                      <td>{t.toUsername || 'Bank'}</td>
                      <td className="data-table__right" style={{ color: amountColor }}>{amountStr}</td>
                      <td className="data-table__right">{t.runningBalance !== null ? `${t.runningBalance} Mark` : '—'}</td>
                      <td className="data-table__memo">{t.memo || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button type="button" className="btn btn--ghost" onClick={() => navigate('/lobby')}>
        Zurück zur Lobby
      </button>
    </PageShell>
  );
}
