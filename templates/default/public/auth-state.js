(function () {
  const loggedIn = document.querySelector('[data-auth-section="in"]');
  const loggedOut = document.querySelector('[data-auth-section="out"]');
  const imageBase = window.__EDK_IMAGE_URL || 'https://images.eve-kill.com';

  function setLoggedOut() {
    if (loggedIn) loggedIn.style.display = 'none';
    if (loggedOut) loggedOut.style.display = '';
  }

  function setLoggedIn(user) {
    if (loggedOut) loggedOut.style.display = 'none';
    if (loggedIn) loggedIn.style.display = '';

    const avatar = loggedIn?.querySelector('[data-auth-avatar]');
    const avatarLarge = loggedIn?.querySelector('[data-auth-avatar-large]');
    const nameEl = loggedIn?.querySelector('[data-auth-name]');
    const corpEl = loggedIn?.querySelector('[data-auth-corp]');
    const allianceEl = loggedIn?.querySelector('[data-auth-alliance]');
    const profileLink = loggedIn?.querySelector('[data-auth-profile]');
    const adminLink = loggedIn?.querySelector('[data-auth-admin]');
    const logoutLink = loggedIn?.querySelector('[data-auth-logout]');

    const portraitSmall = `${imageBase}/characters/${user.characterId}/portrait?size=64`;
    const portraitLarge = `${imageBase}/characters/${user.characterId}/portrait?size=128`;

    if (avatar) avatar.src = portraitSmall;
    if (avatarLarge) avatarLarge.src = portraitLarge;
    if (nameEl) nameEl.textContent = user.characterName || 'Unknown';

    if (corpEl) {
      if (user.corporationName) {
        corpEl.textContent = user.corporationName;
        corpEl.style.display = '';
      } else {
        corpEl.style.display = 'none';
      }
    }

    if (allianceEl) {
      if (user.allianceName) {
        allianceEl.textContent = user.allianceName;
        allianceEl.style.display = '';
      } else {
        allianceEl.style.display = 'none';
      }
    }

    if (profileLink) profileLink.href = `/character/${user.characterId}`;
    if (adminLink) adminLink.style.display = user.admin ? '' : 'none';
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.assign('/logout');
      });
    }

    // Register clientId for direct messaging
    const clientId = window.__EDK_WS_ID;
    if (clientId) {
      fetch('/api/auth/register-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          clientId,
          userAgent: navigator.userAgent || 'Unknown',
          lastSeen: Date.now(),
        }),
      }).catch(() => {});
    }
  }

  async function hydrate() {
    try {
      const resp = await fetch('/api/auth/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!resp.ok) {
        setLoggedOut();
        return;
      }
      const data = await resp.json();
      if (data.authenticated && data.user) {
        setLoggedIn(data.user);
      } else {
        setLoggedOut();
      }
    } catch (err) {
      setLoggedOut();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
