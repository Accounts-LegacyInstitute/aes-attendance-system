// PWA Installation Logic for Attendance System
(function() {
  let deferredPrompt = null;
  let isInstalled = false;
  
  // Check if app is already installed
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    isInstalled = true;
  }
  
  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (!isInstalled) {
      setTimeout(() => showInstallPopup(), 3000);
    }
  });
  
  // Show install popup
  function showInstallPopup() {
    // Remove any existing popup
    const existingPopup = document.getElementById('installPopupOverlay');
    if (existingPopup) existingPopup.remove();
    
    const popup = document.createElement('div');
    popup.id = 'installPopupOverlay';
    popup.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      animation: fadeInOverlay 0.3s ease;
      padding: 20px;
    `;
    
    popup.innerHTML = `
      <div style="
        background: white;
        border-radius: 20px;
        padding: 25px;
        max-width: 400px;
        width: 100%;
        animation: slideUpModal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
          <img src="/aes-attendance-system/icons/icon-96x96.png" alt="App Icon" 
               style="width: 50px; height: 50px; border-radius: 12px;"
               onerror="this.src='https://via.placeholder.com/50/8cb300/ffffff?text=LI'">
          <div style="flex: 1;">
            <h3 style="font-size: 18px; color: #1e293b; margin: 0; font-weight: 700;">Install Attendance System</h3>
            <p style="font-size: 13px; color: #64748b; margin: 2px 0 0;">Legacy Institute</p>
          </div>
          <button id="closeInstallPopup" 
                  style="background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0;">
            ✕
          </button>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 10px;">
            Install this app for a fullscreen experience with quick access to your attendance dashboard.
          </p>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 5px 0; font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
              <span style="color: #8cb300; font-size: 16px;">✓</span> Fullscreen experience
            </li>
            <li style="padding: 5px 0; font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
              <span style="color: #8cb300; font-size: 16px;">✓</span> Quick access from home screen
            </li>
            <li style="padding: 5px 0; font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
              <span style="color: #8cb300; font-size: 16px;">✓</span> Offline support
            </li>
          </ul>
        </div>
        
        <button id="installAppBtn" 
                style="width: 100%; background: #8cb300; color: white; border: none; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s; font-family: inherit;">
          <span style="font-size: 18px;">⬇</span> Install App
        </button>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Add keyframes if not exists
    if (!document.getElementById('pwaKeyframes')) {
      const style = document.createElement('style');
      style.id = 'pwaKeyframes';
      style.textContent = `
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpModal {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Close button
    popup.querySelector('#closeInstallPopup').addEventListener('click', () => {
      popup.remove();
    });
    
    // Install button
    popup.querySelector('#installAppBtn').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        
        if (result.outcome === 'accepted') {
          deferredPrompt = null;
          popup.remove();
          console.log('App installed successfully');
        }
      } else {
        popup.remove();
        console.log('Install prompt not available');
      }
    });
    
    // Close on overlay click
    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.remove();
    });
  }
  
  // Check if already installed
  if (isInstalled) {
    console.log('App is running in standalone mode');
  }
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('https://accounts-legacyinstitute.github.io/aes-attendance-system/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
})();