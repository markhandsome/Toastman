// ===== Auth Module - Google Sign-In =====

const Auth = {
  currentUser: null,
  onAuthChange: null,

  init(onAuthChange) {
    this.onAuthChange = onAuthChange;

    // Check for redirect result first (fallback for localhost/mobile)
    auth.getRedirectResult().catch((err) => {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Redirect sign-in error:', err);
      }
    });

    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      if (this.onAuthChange) this.onAuthChange(user);
    });
  },

  async signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (error) {
      // If popup fails, fall back to redirect (works on localhost & mobile)
      if (error.code === 'auth/popup-blocked' ||
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/unauthorized-domain') {
        try {
          await auth.signInWithRedirect(provider);
        } catch (redirectErr) {
          UI.toast('Sign in failed: ' + redirectErr.message, 'error');
        }
      } else if (error.code !== 'auth/popup-closed-by-user') {
        UI.toast('Sign in failed: ' + error.message, 'error');
      }
    }
  },

  async signOut() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      UI.toast('Sign out failed', 'error');
    }
  },

  getUser() { return this.currentUser; },
  getUserId() { return this.currentUser ? this.currentUser.uid : null; },
  getUserName() { return this.currentUser ? this.currentUser.displayName : null; },
  getUserPhoto() { return this.currentUser ? this.currentUser.photoURL : null; },
  getUserEmail() { return this.currentUser ? this.currentUser.email : null; },
  isLoggedIn() { return !!this.currentUser; }
};
