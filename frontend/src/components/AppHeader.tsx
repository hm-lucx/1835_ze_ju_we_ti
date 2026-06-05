import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleLogout() {
    closeMenu();
    logout();
    navigate('/login');
  }

  function goToLobby() {
    closeMenu();
    navigate('/lobby');
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">1835</div>
      <button
        type="button"
        className="app-header__toggle"
        aria-label="Menü öffnen"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(prev => !prev)}
      >
        ☰
      </button>
      <nav className={`app-header__nav${menuOpen ? ' app-header__nav--open' : ''}`}>
        {location.pathname !== '/lobby' && (
          <button type="button" className="btn btn--inline btn--secondary" onClick={goToLobby}>
            Lobby
          </button>
        )}
        <span className="app-header__user">{user?.username}</span>
        <button type="button" className="btn btn--inline btn--ghost" onClick={handleLogout}>
          Abmelden
        </button>
      </nav>
    </header>
  );
}
