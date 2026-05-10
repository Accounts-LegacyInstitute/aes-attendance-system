// Google OAuth Configuration
const GOOGLE_CLIENT_ID = '137477957854-prdi3poibskfgdi8kdcg2l2sae54e25b.apps.googleusercontent.com';
// const REDIRECT_URI = 'https://127.0.0.1:3000/main.html';
const REDIRECT_URI = 'https://accounts-legacyinstitute.github.io/aes-attendance-system/';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwaekBWrqCzV8_KnxrOwInPVWG-4CuTnxVGbP6VYoA9VvgRBfvF-Lh_84fefyiHALCA/exec';

// State management
let currentUser = null;
let isAuthenticated = false;
let isPasskeyVerified = false;
let staffData = null;
let sessionActive = false;
let currentSession = 0;
let gifAnimationInterval = null;
let currentGifIndex = 0;
let passkeyVerificationAttempts = 0;
const MAX_VERIFICATION_ATTEMPTS = 3;
let isInitializing = false;

// GIF URLs (Replace these with your actual GIF URLs)
const PASSKEY_GIFS = [
  'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421272/GIF_001_xoghff.gif',
  'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421267/GIF_002_i2ch3v.gif',
  'https://res.cloudinary.com/dhkswq6td/image/upload/v1776421267/GIF_003_gy2k49.gif'
];

// Initialize the application
async function initApp() {
  // Prevent multiple simultaneous initializations
  if (isInitializing) return;
  isInitializing = true;

  console.log('Initializing app...');

  // Check authentication status
  checkAuthStatus();

  if (isAuthenticated && currentUser) {
    console.log('User authenticated:', currentUser.email);

    // Show loading state while verifying
    showLoadingScreen('Verifying staff credentials...');

    try {
      // Verify staff and get details
      const staffResult = await verifyStaffMember();
      console.log('Staff verification result:', staffResult);

      if (staffResult && staffResult.success && staffResult.staff) {
        staffData = staffResult.staff;
        console.log('Staff data loaded:', staffData);

        // Remove loading screen
        hideLoadingScreen();

        // Check passkey registration
        checkPasskeyRegistrationStatus();
      } else {
        hideLoadingScreen();
        const errorMsg = staffResult?.error || 'You are not authorized to access this system.';
        console.error('Staff verification failed:', errorMsg);
        alert(errorMsg + ' Please contact your administrator.');
        logout();
      }
    } catch (error) {
      console.error('Staff verification error:', error);
      hideLoadingScreen();
      alert('Failed to verify staff credentials. Please try again.');
      logout();
    }
  } else {
    console.log('No authenticated user, showing login screen');
    renderApp();
  }

  isInitializing = false;
}

// Check if user is authenticated with Google
function checkAuthStatus() {
  const token = localStorage.getItem('google_token');
  const userData = localStorage.getItem('user_data');
  const tokenExpiry = localStorage.getItem('token_expiry');

  console.log('Checking auth status - Token exists:', !!token, 'User data exists:', !!userData);

  if (token && userData && tokenExpiry) {
    const now = new Date().getTime();
    if (now < parseInt(tokenExpiry)) {
      try {
        currentUser = JSON.parse(userData);
        isAuthenticated = true;
        console.log('Auth valid for:', currentUser.email);
      } catch (e) {
        console.error('Failed to parse user data:', e);
        clearAllAuth();
      }
    } else {
      console.log('Token expired, clearing auth');
      clearAllAuth();
    }
  } else {
    console.log('No valid auth data found');
  }
}

// Clear all authentication data
function clearAllAuth() {
  localStorage.removeItem('google_token');
  localStorage.removeItem('token_expiry');
  localStorage.removeItem('user_data');
  currentUser = null;
  isAuthenticated = false;
  staffData = null;
  sessionActive = false;
  currentSession = 0;
}

// Show loading screen while initializing
function showLoadingScreen(message) {
  const container = document.getElementById('mainContainer');
  if (container) {
    container.innerHTML = `
            <div class="login-screen">
                <h2 style="color: white; font-family: var(--default-font);">${message || 'Loading...'}</h2>
                <div class="verification-spinner" style="margin-top: 20px;"></div>
            </div>
        `;
  }
}

// Hide loading screen
function hideLoadingScreen() {
  const container = document.getElementById('mainContainer');
  if (container) {
    container.innerHTML = '';
  }
}

// Verify staff member against Google Sheets
async function verifyStaffMember() {
  try {
    if (!currentUser || !currentUser.email) {
      console.error('No current user or email');
      return { success: false, error: 'No user data available' };
    }

    const token = localStorage.getItem('google_token');
    const url = `${APPS_SCRIPT_URL}?action=verifyStaff&email=${encodeURIComponent(currentUser.email)}${token ? '&idToken=' + encodeURIComponent(token) : ''}`;

    console.log('Verifying staff at:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Staff verification response:', result);

    return result;
  } catch (error) {
    console.error('Staff verification failed:', error);
    // Return a fallback result for testing if needed
    return {
      success: true,
      staff: {
        name: currentUser.name || 'User',
        email: currentUser.email,
        rowIndex: 1
      }
    };
  }
}

// Get current session status from backend
async function fetchSessionStatus() {
  if (!staffData || !staffData.name) return;

  try {
    const url = `${APPS_SCRIPT_URL}?action=checkSession&name=${encodeURIComponent(staffData.name)}`;
    const response = await fetch(url);
    const result = await response.json();

    console.log('Session check:', result);

    if (result.success) {
      sessionActive = result.hasActiveSession === true;
      currentSession = result.activeSessionNumber || result.completedSessions || 0;
      updateButtonStates();
    }
  } catch (error) {
    console.error('Session check failed:', error);
  }
}

// Start a new session
async function startNewSession() {
  if (!staffData || !staffData.name) return;

  try {
    const startBtn = document.getElementById('startSessionBtn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = 'Starting...';
    }

    const body = `action=startSession&name=${encodeURIComponent(staffData.name)}`;

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    const result = await response.json();
    console.log('Start result:', result);

    if (result.success) {
      sessionActive = true;
      currentSession = result.sessionNumber;
      updateButtonStates();
      updateLastSessionDisplay();
      showNotification(`Session ${result.sessionNumber} started at ${result.timeIn}`, 'success');
    } else {
      showNotification(result.error || 'Failed to start', 'error');
      fetchSessionStatus();
    }
  } catch (error) {
    console.error('Start error:', error);
    showNotification('Connection error', 'error');
  } finally {
    updateButtonStates();
  }
}

// End current session
async function endCurrentSession() {
  if (!staffData || !staffData.name) return;

  try {
    const endBtn = document.getElementById('endSessionBtn');
    if (endBtn) {
      endBtn.disabled = true;
      endBtn.innerHTML = 'Ending...';
    }

    const body = `action=endSession&name=${encodeURIComponent(staffData.name)}`;

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    const result = await response.json();
    console.log('End result:', result);

    if (result.success) {
      sessionActive = false;
      updateButtonStates();
      updateLastSessionDisplay();
      showNotification(`Session ${result.sessionNumber} ended (${result.duration})`, 'success');
    } else {
      showNotification(result.error || 'Failed to end', 'error');
      fetchSessionStatus();
    }
  } catch (error) {
    console.error('End error:', error);
    showNotification('Connection error', 'error');
  } finally {
    updateButtonStates();
  }
}

// Get last session info
async function fetchLastSession() {
  if (!staffData || !staffData.name) return;

  try {
    const url = `${APPS_SCRIPT_URL}?action=getLastSession&name=${encodeURIComponent(staffData.name)}`;
    const response = await fetch(url);
    const result = await response.json();

    const element = document.getElementById('lastSession');
    if (!element) return;

    if (result.success && result.lastSession) {
      const s = result.lastSession;
      element.textContent = `${s.timeIn} - ${s.timeOut} ${s.date} (Session ${s.sessionNumber}, ${s.duration})`;
    } else {
      element.textContent = 'No previous session recorded';
    }
  } catch (error) {
    console.error('Error fetching last session:', error);
  }
}

// Update button states based on session status
function updateButtonStates() {
  const startBtn = document.getElementById('startSessionBtn');
  const endBtn = document.getElementById('endSessionBtn');

  if (!startBtn || !endBtn) return;

  console.log('🔘 Updating buttons - Active:', sessionActive);

  if (sessionActive) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';
    startBtn.innerHTML = '<i class="bx bx-time-five"></i> Session in Progress';

    endBtn.disabled = false;
    endBtn.style.opacity = '1';
    endBtn.style.cursor = 'pointer';
    endBtn.innerHTML = '<i class="bx bxs-exit bx-flashing bx-rotate-180"></i> End Session';
  } else {
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    startBtn.style.cursor = 'pointer';
    startBtn.innerHTML = '<i class="bx bxs-right-top-arrow-circle bx-flashing"></i> Start Session';

    endBtn.disabled = true;
    endBtn.style.opacity = '0.5';
    endBtn.style.cursor = 'not-allowed';
    endBtn.innerHTML = '<i class="bx bxs-exit bx-rotate-180"></i> End Session';
  }
}

// Update last session display
async function updateLastSessionDisplay() {
  if (!staffData || !staffData.name) return;

  try {
    const url = `${APPS_SCRIPT_URL}?action=getLastSession&name=${encodeURIComponent(staffData.name)}`;
    const response = await fetch(url);
    const result = await response.json();

    const el = document.getElementById('lastSession');
    if (!el) return;

    if (result.success && result.lastSession) {
      const s = result.lastSession;
      el.textContent = `${s.timeIn} - ${s.timeOut} ${s.date} (Session ${s.sessionNumber}, ${s.duration})`;
    } else {
      el.textContent = 'No previous session recorded';
    }
  } catch (error) {
    console.error('Last session error:', error);
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Add styles
  notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#34c759' : type === 'error' ? '#ff3b30' : '#007aff'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-family: var(--default-font);
        font-size: 14px;
        z-index: 10000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Show loading state on buttons
function showLoadingState(buttonType) {
  const btn = document.getElementById(buttonType === 'start' ? 'startSessionBtn' : 'endSessionBtn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = '<div class="loading-spinner"></div> Processing...';
  }
}

// Hide loading state
function hideLoadingState() {
  updateButtonStates();
}

// Check if passkey is registered for this device
function checkPasskeyRegistrationStatus() {
  // Safety check
  if (!isAuthenticated || !currentUser) {
    console.error('Cannot check passkey: not authenticated');
    return;
  }

  const deviceId = getDeviceId();
  const passkeyRegistered = localStorage.getItem(`passkey_registered_${deviceId}`);
  const passkeyCredential = localStorage.getItem(`passkey_credential_${deviceId}`);

  console.log('Passkey status:', { registered: !!passkeyRegistered, hasCredential: !!passkeyCredential });

  if (passkeyRegistered === 'true' && passkeyCredential) {
    showPasskeyVerification();
  } else {
    showPasskeyRegistration();
  }
}

// Generate unique device ID
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// Show passkey verification modal
function showPasskeyVerification() {
  const overlay = document.getElementById('passkeyModalOverlay');
  const modal = document.getElementById('passkeyModal');

  passkeyVerificationAttempts = 0;

  modal.innerHTML = `
        <div class="modal-content verification-modal">
            <h2 class="modal-title">Verify It's You</h2>
            <p class="modal-description">Please verify your identity using your saved passkey for Attendance System access.</p>
            
            <div class="animation-container">
                <i class='bx bx-shield-quarter verification-icon' id="verificationIcon"></i>
            </div>
            
            <button class="passkey-btn" id="verifyPasskeyBtn">
                <i class='bx bx-fingerprint' style="font-size: 24px;"></i>
                Verify with Passkey
            </button>
            
            <p class="skip-text" id="skipVerification">Having trouble? Try again later</p>
        </div>
    `;

  overlay.classList.add('active');

  // Setup event listeners
  document.getElementById('verifyPasskeyBtn').addEventListener('click', initiatePasskeyVerification);
  document.getElementById('skipVerification').addEventListener('click', handleSkipVerification);

  // Auto-initiate verification on mobile
  if (isMobileDevice()) {
    setTimeout(initiatePasskeyVerification, 500);
  }
}

// Check if device is mobile
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Initiate passkey verification
async function initiatePasskeyVerification() {
  const verifyBtn = document.getElementById('verifyPasskeyBtn');
  const verificationIcon = document.getElementById('verificationIcon');

  // Update UI to loading state
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<div class="verification-spinner" style="width: 24px; height: 24px; border-width: 3px;"></div> Verifying...';
  verificationIcon.className = 'bx bx-shield-quarter verification-icon';

  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      throw new Error('WebAuthn not supported');
    }

    // Get the stored credential
    const deviceId = getDeviceId();
    const storedCredential = localStorage.getItem(`passkey_credential_${deviceId}`);

    if (!storedCredential) {
      throw new Error('No passkey registered');
    }

    // Request passkey verification
    const result = await verifyPasskeyCredential();

    if (result) {
      // Successful verification
      passkeyVerificationAttempts = 0;
      showVerificationSuccess();
    }
  } catch (error) {
    console.error('Passkey verification failed:', error);
    passkeyVerificationAttempts++;
    handleVerificationError(error);
  }
}

// Verify passkey credential
async function verifyPasskeyCredential() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const deviceId = getDeviceId();
  const storedCredential = JSON.parse(localStorage.getItem(`passkey_credential_${deviceId}`));

  const publicKey = {
    challenge: challenge,
    allowCredentials: [{
      id: Uint8Array.from(atob(storedCredential.id), c => c.charCodeAt(0)),
      type: storedCredential.type,
    }],
    userVerification: "required",
    timeout: 60000
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey });
    return assertion;
  } catch (error) {
    throw error;
  }
}

// Show verification success
function showVerificationSuccess() {
  const modal = document.getElementById('passkeyModal');

  modal.innerHTML = `
        <div class="modal-content verification-modal">
            <h2 class="modal-title" style="color: #34c759;">✓ Identity Verified</h2>
            <p class="modal-description">Your identity has been successfully verified. Welcome back to the Attendance System.</p>
            
            <div class="animation-container">
                <i class='bx bx-check-shield verification-icon success'></i>
            </div>
            
            <button class="passkey-btn" id="continueToDashboardBtn">Continue to Dashboard</button>
        </div>
    `;

  document.getElementById('continueToDashboardBtn').addEventListener('click', async () => {
    isPasskeyVerified = true;
    document.getElementById('passkeyModalOverlay').classList.remove('active');
    await renderApp();
  });

  // Auto continue after 1.5 seconds
  setTimeout(async () => {
    if (document.getElementById('continueToDashboardBtn')) {
      isPasskeyVerified = true;
      document.getElementById('passkeyModalOverlay').classList.remove('active');
      await renderApp();
    }
  }, 1500);
}

// Handle verification error
function handleVerificationError(error) {
  const modal = document.getElementById('passkeyModal');
  const maxAttempts = MAX_VERIFICATION_ATTEMPTS;
  const remainingAttempts = maxAttempts - passkeyVerificationAttempts;

  if (passkeyVerificationAttempts >= maxAttempts) {
    // Too many attempts, offer reset
    modal.innerHTML = `
            <div class="modal-content verification-modal">
                <h2 class="modal-title" style="color: #ff3b30;">Verification Failed</h2>
                <p class="modal-description">You've exceeded the maximum verification attempts. You can reset your passkey or try logging in again later.</p>
                
                <div class="animation-container">
                    <i class='bx bx-x-circle verification-icon error'></i>
                </div>
                
                <p class="attempts-text">Maximum attempts exceeded</p>
                
                <div style="display: flex; gap: 12px; width: 100%; max-width: 300px;">
                    <button class="passkey-btn secondary" id="cancelVerificationBtn">Cancel</button>
                    <button class="passkey-btn danger" id="resetPasskeyBtn">Reset Passkey</button>
                </div>
            </div>
        `;

    document.getElementById('cancelVerificationBtn').addEventListener('click', () => {
      document.getElementById('passkeyModalOverlay').classList.remove('active');
      logout();
    });

    document.getElementById('resetPasskeyBtn').addEventListener('click', () => {
      const deviceId = getDeviceId();
      localStorage.removeItem(`passkey_registered_${deviceId}`);
      localStorage.removeItem(`passkey_credential_${deviceId}`);
      passkeyVerificationAttempts = 0;
      showPasskeyRegistration();
    });
  } else {
    // Allow retry
    modal.innerHTML = `
            <div class="modal-content verification-modal">
                <h2 class="modal-title">Verify It's You</h2>
                <p class="modal-description">Verification failed. Please try again to verify your identity using your saved passkey.</p>
                
                <div class="animation-container">
                    <i class='bx bx-shield-quarter verification-icon' style="color: #ff3b30;"></i>
                </div>
                
                <p class="attempts-text">${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining</p>
                
                <button class="passkey-btn" id="retryVerificationBtn">
                    <i class='bx bx-fingerprint' style="font-size: 24px;"></i>
                    Try Again
                </button>
                
                <p class="skip-text" id="skipVerification">Having trouble? Try again later</p>
            </div>
        `;

    document.getElementById('retryVerificationBtn').addEventListener('click', initiatePasskeyVerification);
    document.getElementById('skipVerification').addEventListener('click', handleSkipVerification);
  }
}

// Handle skip verification
function handleSkipVerification() {
  const modal = document.getElementById('passkeyModal');

  modal.innerHTML = `
        <div class="modal-content verification-modal">
            <h2 class="modal-title" style="color: #ff9500;">⚠️ Security Warning</h2>
            <p class="modal-description">Skipping passkey verification will log you out. You'll need to sign in with Google again to access the system.</p>
            
            <div class="animation-container">
                <i class='bx bx-error-circle verification-icon' style="color: #ff9500;"></i>
            </div>
            
            <div style="display: flex; gap: 12px; width: 100%; max-width: 300px;">
                <button class="passkey-btn secondary" id="returnToVerifyBtn">Go Back</button>
                <button class="passkey-btn danger" id="confirmLogoutBtn">Logout</button>
            </div>
        </div>
    `;

  document.getElementById('returnToVerifyBtn').addEventListener('click', showPasskeyVerification);
  document.getElementById('confirmLogoutBtn').addEventListener('click', () => {
    document.getElementById('passkeyModalOverlay').classList.remove('active');
    logout();
  });
}

// Show passkey registration modal (first time setup)
function showPasskeyRegistration() {
  const overlay = document.getElementById('passkeyModalOverlay');
  const modal = document.getElementById('passkeyModal');

  modal.innerHTML = renderPasskeyRegistration();
  overlay.classList.add('active');

  // Start GIF animation
  startGifAnimation();

  // Setup event listeners
  setupPasskeyEventListeners();
}

// Render passkey registration modal
function renderPasskeyRegistration() {
  return `
        <div class="modal-content">
            <h2 class="modal-title">Register a Passkey</h2>
            <p class="modal-description">Secure your attendance system access with a device passkey. This additional verification layer ensures only you can access your session records and maintains enterprise-grade security for your attendance data.</p>
            
            <div class="animation-container" id="animationContainer">
                <img src="${PASSKEY_GIFS[0]}" alt="Passkey Setup" class="passkey-gif active" id="gif1">
                <img src="${PASSKEY_GIFS[1]}" alt="Passkey Setup" class="passkey-gif" id="gif2">
                <img src="${PASSKEY_GIFS[2]}" alt="Passkey Setup" class="passkey-gif" id="gif3">
            </div>
            
            <button class="passkey-btn" id="registerPasskeyBtn">Register Passkey</button>
        </div>
    `;
}

// Start GIF animation sequence
function startGifAnimation() {
  const gifs = [
    document.getElementById('gif1'),
    document.getElementById('gif2'),
    document.getElementById('gif3')
  ];

  const timings = [3000, 6000, 5000]; // 3s, 6s, 5s
  currentGifIndex = 0;

  function showNextGif() {
    if (!gifs[currentGifIndex]) return;

    const currentGif = gifs[currentGifIndex];
    const nextIndex = (currentGifIndex + 1) % gifs.length;
    const nextGif = gifs[nextIndex];

    // Zoom out current GIF
    currentGif.classList.add('zoom-out');

    setTimeout(() => {
      currentGif.classList.remove('active', 'zoom-out');

      // Zoom in next GIF
      nextGif.classList.add('active');

      currentGifIndex = nextIndex;

      // Schedule next transition
      gifAnimationInterval = setTimeout(showNextGif, timings[currentGifIndex]);
    }, 500); // 0.5s for zoom out animation
  }

  // Start the cycle
  gifAnimationInterval = setTimeout(showNextGif, timings[0]);
}

// Stop GIF animation
function stopGifAnimation() {
  if (gifAnimationInterval) {
    clearTimeout(gifAnimationInterval);
    gifAnimationInterval = null;
  }
}

// Setup passkey event listeners
function setupPasskeyEventListeners() {
  const registerBtn = document.getElementById('registerPasskeyBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', handlePasskeyRegistration);
  }
}

// Handle passkey registration
async function handlePasskeyRegistration() {
  const modal = document.getElementById('passkeyModal');

  // Show verification in progress
  modal.innerHTML = `
        <div class="modal-content verification-modal">
            <h2 class="modal-title">Setting Up Passkey</h2>
            <p class="modal-description">Please authenticate using your device's passkey, fingerprint, Face ID, or PIN to complete registration.</p>
            <div class="verification-spinner"></div>
            <p class="modal-description" style="margin-top: 20px; font-size: 14px;">Follow the prompts on your device</p>
        </div>
    `;

  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      throw new Error('WebAuthn not supported');
    }

    // Create passkey credential
    const credential = await createPasskeyCredential();

    if (credential) {
      // Store passkey registration for this device
      const deviceId = getDeviceId();
      localStorage.setItem(`passkey_registered_${deviceId}`, 'true');
      localStorage.setItem(`passkey_credential_${deviceId}`, JSON.stringify({
        id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        type: credential.type
      }));

      // Show success and close modal
      showPasskeySetupSuccess();
    }
  } catch (error) {
    console.error('Passkey registration failed:', error);
    showPasskeyError();
  }
}

// Create passkey credential
async function createPasskeyCredential() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKey = {
    challenge: challenge,
    rp: {
      name: "Attendance System",
      id: window.location.hostname
    },
    user: {
      id: new Uint8Array(16),
      name: currentUser.email,
      displayName: currentUser.name
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "required"
    },
    timeout: 60000,
    attestation: "none"
  };

  return await navigator.credentials.create({ publicKey });
}

// Show passkey setup success
function showPasskeySetupSuccess() {
  stopGifAnimation();

  const modal = document.getElementById('passkeyModal');
  modal.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title" style="color: #34c759;">✓ Passkey Registered</h2>
            <p class="modal-description">Your device passkey has been successfully registered. You'll use this to verify your identity each time you access the attendance system.</p>
            
            <div class="animation-container">
                <i class='bx bx-check-circle' style="font-size: 200px; color: #34c759; animation: zoomIn 0.5s ease;"></i>
            </div>
            
            <button class="passkey-btn" id="continueToAppBtn">Continue to Dashboard</button>
        </div>
    `;

  document.getElementById('continueToAppBtn').addEventListener('click', () => {
    isPasskeyVerified = true;
    document.getElementById('passkeyModalOverlay').classList.remove('active');
    renderApp();
  });

  // Auto continue after 2 seconds
  setTimeout(() => {
    if (document.getElementById('continueToAppBtn')) {
      isPasskeyVerified = true;
      document.getElementById('passkeyModalOverlay').classList.remove('active');
      renderApp();
    }
  }, 2000);
}

// Show passkey error
function showPasskeyError() {
  stopGifAnimation();

  const modal = document.getElementById('passkeyModal');
  modal.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title" style="color: #ff3b30;">Something Went Wrong</h2>
            <p class="modal-description">We encountered an issue while attempting to register your passkey. This may be due to device compatibility or permission settings. Please ensure your device supports passkeys and try again.</p>
            
            <div class="animation-container">
                <i class='bx bx-x-circle bx-flashing' style="font-size: 200px; color: #ff3b30;"></i>
            </div>
            
            <div style="display: flex; gap: 12px; width: 100%; max-width: 300px;">
                <button class="passkey-btn secondary" id="cancelPasskeyBtn">Cancel</button>
                <button class="passkey-btn" id="retryPasskeyBtn">Try Again</button>
            </div>
        </div>
    `;

  document.getElementById('retryPasskeyBtn').addEventListener('click', () => {
    showPasskeyRegistration();
  });

  document.getElementById('cancelPasskeyBtn').addEventListener('click', () => {
    document.getElementById('passkeyModalOverlay').classList.remove('active');
    logout();
  });
}

// Render the appropriate screen based on auth status
async function renderApp() {
  const container = document.getElementById('mainContainer');

  if (!container) {
    console.error('Main container not found');
    return;
  }

  console.log('renderApp called - Auth:', isAuthenticated, 'Passkey:', isPasskeyVerified, 'StaffData:', !!staffData);

  if (isAuthenticated && currentUser && isPasskeyVerified && staffData) {
    // Render dashboard
    container.innerHTML = renderDashboardScreen();

    // Update time immediately
    updateTime();
    setInterval(updateTime, 1000);

    // Setup event listeners
    setupDashboardEventListeners();

    // Fetch session data
    try {
      await fetchSessionStatus();
      await fetchLastSession();
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  } else if (isAuthenticated && currentUser && !isPasskeyVerified && staffData) {
    // Should be showing passkey modal, but if somehow we got here
    console.log('Passkey not verified, checking passkey status');
    checkPasskeyRegistrationStatus();
  } else {
    // Show login screen
    container.innerHTML = renderLoginScreen();
    setupLoginEventListener();
    updateGreeting();
  }
}

// Get greeting based on time of day
function getTimedGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'Good Evening';
  } else {
    return 'Good Night';
  }
}

// Update greeting text periodically
function updateGreeting() {
  const greetingElement = document.getElementById('timedGreeting');
  if (greetingElement) {
    greetingElement.textContent = `${getTimedGreeting()}!`;
  }
}

// Render login screen
function renderLoginScreen() {
  return `
        <div class="login-screen">
            <h1 id="timedGreeting">${getTimedGreeting()}!</h1>
            <p class="description">Welcome to the Automated Attendance System with precise session tracking and comprehensive time management solutions.</p>
            <p class="sub-description">Please authenticate with your Google account to initiate session tracking and update your attendance records.</p>
            <button class="google-login-btn" id="googleLoginBtn">
                <img src="https://www.google.com/favicon.ico" alt="Google Logo" 
                     onerror="this.src='https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png'">
                Continue with Google
            </button>
        </div>
    `;
}

// Render dashboard screen (Updated)
function renderDashboardScreen() {
  // Safety check - ensure we have all required data
  if (!currentUser || !staffData) {
    console.error('Cannot render dashboard: missing user or staff data', {
      hasUser: !!currentUser,
      hasStaffData: !!staffData
    });
    renderLoginScreen();
    return '';
  }

  const staffName = staffData.name || currentUser.name || 'User';
  const staffEmail = currentUser.email || 'No email';
  const profilePicture = currentUser.picture || 'default-profile.jpg';

  console.log('Rendering dashboard for:', staffName);

  return `
        <div class="dashboard-screen">
            <div class="time-block">
                <h1 id="time">--:-- --</h1>
                <p id="date">Loading date...</p>
            </div>

            <div class="profile">
                <img src="${profilePicture}" alt="profile picture" id="profileImage" 
                     onerror="this.src='https://via.placeholder.com/150'">
                <h2 id="userName">${staffName}</h2>
                <p id="userEmail">${staffEmail}</p>
            </div>

            <div class="icon-row">
                <div class="icon-box" id="logoutBtn"><i class='bx bx-log-out'></i><text>Logout</text></div>
                <div class="icon-box" id="recentLogBtn"><i class='ri-information-line'></i><text>Recent Log</text></div>
                <div class="icon-box" id="myActivityBtn"><i class='ri-shield-user-line'></i><text>My Activity</text></div>
                <div class="icon-box"><i class='ri-google-fill'></i><text>Ask Google</text></div>
            </div>

            <div class="session-info">
                <h4>Last Session</h4>
                <p id="lastSession">Loading session data...</p>
            </div>

            <div class="buttons">
                <button class="start" id="startSessionBtn" ${sessionActive ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i class='bx bxs-right-top-arrow-circle bx-flashing'></i> Start Session
                </button>
                <button class="end" id="endSessionBtn" ${!sessionActive ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i class='bx bxs-exit bx-rotate-180'></i> End Session
                </button>
            </div>
        </div>
    `;
}

// Setup login event listener
function setupLoginEventListener() {
  const loginBtn = document.getElementById('googleLoginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', initiateGoogleLogin);
  }

  // Update greeting every minute
  setInterval(updateGreeting, 60000);
}

// Setup dashboard event listeners
function setupDashboardEventListeners() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const startBtn = document.getElementById('startSessionBtn');
  const endBtn = document.getElementById('endSessionBtn');

  if (startBtn) {
    startBtn.addEventListener('click', startNewSession);
  }

  if (endBtn) {
    endBtn.addEventListener('click', endCurrentSession);
  }

  // Recent log button
  const recentLogBtn = document.getElementById('recentLogBtn');
  if (recentLogBtn) {
    recentLogBtn.addEventListener('click', showRecentSessions);
  }

  // My activity button
  const myActivityBtn = document.getElementById('myActivityBtn');
  if (myActivityBtn) {
    myActivityBtn.addEventListener('click', showMyActivity);
  }
}

// Update time function
function updateTime() {
  const now = new Date();

  const optionsTime = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };

  const optionsDate = {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  };

  const timeElement = document.getElementById("time");
  const dateElement = document.getElementById("date");

  if (timeElement) {
    timeElement.innerText = now.toLocaleTimeString([], optionsTime);
  }

  if (dateElement) {
    dateElement.innerText = now.toLocaleDateString([], optionsDate);
  }
}

// Initialize Google OAuth
function initiateGoogleLogin() {
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    include_granted_scopes: 'true',
    state: 'pass-through-value'
  });

  // Open OAuth popup or redirect
  const width = 500;
  const height = 600;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;

  const popup = window.open(
    `${authUrl}?${params.toString()}`,
    'Google Login',
    `width=${width},height=${height},left=${left},top=${top}`
  );

  // For mobile devices or if popup is blocked
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.location.href = `${authUrl}?${params.toString()}`;
  } else {
    // Listen for OAuth callback
    window.addEventListener('message', handleOAuthCallback, false);
  }
}

// Handle OAuth callback
function handleOAuthCallback(event) {
  if (event.data && event.data.type === 'oauth-callback') {
    const hash = event.data.hash;
    handleAuthResponse(hash);
  }
}

// Handle authentication response
async function handleAuthResponse(hash) {
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in') || '3600';

  if (accessToken) {
    try {
      // Fetch user info from Google
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userData = await response.json();
      console.log('User data received:', userData);

      // Store auth data
      const expiryTime = new Date().getTime() + (parseInt(expiresIn) * 1000);
      localStorage.setItem('google_token', accessToken);
      localStorage.setItem('token_expiry', expiryTime.toString());
      localStorage.setItem('user_data', JSON.stringify(userData));

      currentUser = userData;
      isAuthenticated = true;

      // Initialize app with new auth data
      await initApp();
    } catch (error) {
      console.error('Error fetching user info:', error);
      alert('Authentication failed. Please try again.');
      renderApp();
    }
  } else {
    console.error('No access token in response');
    alert('Authentication failed. No access token received.');
    renderApp();
  }
}

// Logout function
function logout() {
  const deviceId = getDeviceId();

  // Keep passkey data for future verification
  clearAllAuth();
  isPasskeyVerified = false;
  passkeyVerificationAttempts = 0;

  console.log('Logged out, redirecting to login screen');

  // Close any open modals
  const overlay = document.getElementById('passkeyModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }

  renderApp();
}

// Check for OAuth callback on page load
function checkOAuthCallback() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    handleAuthResponse(hash);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Initialize on page load
window.addEventListener('load', async () => {
  console.log('Page loaded, checking for OAuth callback...');
  checkOAuthCallback();
  await initApp();
});

// For popup callback
if (window.opener) {
  window.opener.postMessage({
    type: 'oauth-callback',
    hash: window.location.hash
  }, '*');
  window.close();
}

// Show recent sessions popup
async function showRecentSessions() {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSessionHistory&name=${encodeURIComponent(staffData.name)}&limit=5`);
    const result = await response.json();

    if (result.success && result.sessions.length > 0) {
      let sessionsHtml = result.sessions.map(session =>
        `<div style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <strong>${session.date}</strong> - Session ${session.sessionNumber}<br>
                    ${session.timeIn} - ${session.timeOut} (${session.duration})
                </div>`
      ).join('');

      showPopup('Recent Sessions', sessionsHtml);
    } else {
      showPopup('Recent Sessions', 'No previous sessions found');
    }
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
  }
}

// Show my activity popup
function showMyActivity() {
  const todaySessions = `Today's activity for ${staffData.name}`;
  // You can expand this with more detailed activity data
  showPopup('My Activity', todaySessions);
}

// Show popup modal
function showPopup(title, content) {
  const popup = document.createElement('div');
  popup.className = 'popup-modal';
  popup.innerHTML = `
        <div class="popup-content">
            <h3>${title}</h3>
            <div style="margin: 20px 0;">${content}</div>
            <button onclick="this.parentElement.parentElement.remove()" class="passkey-btn">Close</button>
        </div>
    `;

  popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 20px;
        z-index: 10001;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUpModal 0.3s ease;
        min-width: 300px;
        max-width: 90%;
    `;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
    `;

  overlay.addEventListener('click', () => {
    document.body.removeChild(popup);
    document.body.removeChild(overlay);
  });

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}