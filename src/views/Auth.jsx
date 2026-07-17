import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { buildGuestUser } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function Auth() {
  const { db, updateDB, prefs, toggleTheme, t, ui, setUi, startSession, toast } = useApp();
  const mode = ui.authMode;
  const [loginEmail, setLoginEmail] = useState('sam@incolab.com');
  const [loginPass, setLoginPass] = useState('demo1234');
  const [guestCode, setGuestCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  function setAuthMode(m) { setUi({ authMode: m }); }

  function doLogin() {
    const email = loginEmail.trim().toLowerCase();
    const m = db.team.find(x => x.email === email);
    if (!m || loginPass !== 'demo1234') { toast(t('loginFailed')); return; }
    if (m.locked) { toast(prefs.lang === 'en' ? 'Account Temporarily Locked' : 'Compte temporairement verrouillé'); return; }
    startSession(m);
  }
  function guestLogin() {
    const code = guestCode.trim().toUpperCase();
    const gc = db.guestCodes.find(g => g.code === code && g.active && g.uses < g.max);
    if (!gc) { toast(t('loginFailed')); return; }
    updateDB(draft => { const dg = draft.guestCodes.find(g => g.id === gc.id); if (dg) dg.uses++; });
    startSession(buildGuestUser(gc));
  }

  let form;
  if (mode === 'guest') {
    form = (
      <>
        <div className="auth-title">{t('guestAccess')}</div>
        <div className="auth-sub">{t('guestCode')}</div>
        <input className="input" placeholder="GUEST-XXXX" style={{ marginTop: 6 }}
          value={guestCode} onChange={e => setGuestCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guestLogin(); }} />
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: 10 }} onClick={guestLogin}>{t('enterAsGuest')}</button>
        <div className="auth-alt"><span className="link-accent" onClick={() => setAuthMode('login')}>{t('backToLogin')}</span></div>
        <div className="demo-hint">Démo : <b>GUEST-7F2K</b></div>
      </>
    );
  } else if (mode === 'forgot') {
    form = (
      <>
        <div className="auth-title">{t('forgotPassword')}</div>
        <div className="auth-sub">{t('email')}</div>
        <input className="input" type="email" placeholder="vous@entreprise.com" style={{ marginTop: 6 }}
          value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: 10 }}
          onClick={() => { toast(t('resetSent')); setAuthMode('login'); }}>{t('send')}</button>
        <div className="auth-alt"><span className="link-accent" onClick={() => setAuthMode('login')}>{t('backToLogin')}</span></div>
      </>
    );
  } else {
    form = (
      <>
        <div className="auth-title">{t('loginTitle')}</div>
        <div className="auth-sub">{t('loginSub')}</div>
        <label className="field-label">{t('email')}</label>
        <input className="input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
        <label className="field-label">{t('password')}</label>
        <input className="input" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doLogin(); }} />
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <span className="link-accent" style={{ fontSize: 11.5 }} onClick={() => setAuthMode('forgot')}>{t('forgotPassword')}</span>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: 10 }} onClick={doLogin}>{t('login')}</button>
        <div className="auth-alt">{t('guestAccess')} → <span className="link-accent" onClick={() => setAuthMode('guest')}>{t('guestCode')}</span></div>
        <div className="demo-hint">
          Démo — Admin : <b>sam@incolab.com</b> · Manager : <b>ava@incolab.com</b> · Employé : <b>priya@incolab.com</b><br />
          {t('password')} : <b>demo1234</b>
        </div>
      </>
    );
  }

  return (
    <div id="auth-root">
      <button className="icon-btn auth-theme-toggle" onClick={toggleTheme} title={t('theme')}>
        <Icon name={prefs.theme === 'light' ? 'moon' : 'sun'} />
      </button>
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo-row">
            <img className="auth-logo" src={`${import.meta.env.BASE_URL}logo.jpeg`} alt="INCO LAB" />
            <div>
              <div className="auth-name">INCO LAB</div>
              <div className="auth-tag">Boards · Chat · Files · Meet</div>
            </div>
          </div>
          {form}
        </div>
      </div>
    </div>
  );
}
