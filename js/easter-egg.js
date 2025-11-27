// F12 Developer Mode Easter Egg
(function() {
  let f12Count = 0;
  let resetTimer;
  let hackerModeActive = false;
  let matrixInterval;
  let canvas, ctx;

  // Detect F12 key press
  document.addEventListener('keydown', function(e) {
    // F12 key code is 123
    if (e.keyCode === 123 || e.key === 'F12') {
      f12Count++;

      // Reset counter after 2 seconds of no presses
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        f12Count = 0;
      }, 2000);

      // Activate on 3rd press
      if (f12Count === 3) {
        toggleHackerMode();
        f12Count = 0;
      }
    }

    // ESC to exit hacker mode
    if (e.keyCode === 27 && hackerModeActive) {
      deactivateHackerMode();
    }
  });

  function toggleHackerMode() {
    if (hackerModeActive) {
      deactivateHackerMode();
    } else {
      activateHackerMode();
    }
  }

  function activateHackerMode() {
    hackerModeActive = true;
    document.body.classList.add('hacker-mode');

    // Create Matrix rain effect
    createMatrixRain();

    // Show notification
    showNotification('🚀 HACKER MODE ACTIVATED 🚀<br><small>Press ESC to exit</small>');
  }

  function deactivateHackerMode() {
    hackerModeActive = false;
    document.body.classList.remove('hacker-mode');

    // Remove Matrix rain
    if (canvas) {
      canvas.remove();
      canvas = null;
    }
    if (matrixInterval) {
      clearInterval(matrixInterval);
    }

    showNotification('👋 Hacker mode deactivated');
  }

  function createMatrixRain() {
    // Create canvas
    canvas = document.createElement('canvas');
    canvas.id = 'matrix-rain';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9998';
    canvas.style.opacity = '0.3';
    document.body.appendChild(canvas);

    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Matrix characters
    const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01234567890';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    function draw() {
      // Fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw characters
      ctx.fillStyle = '#0f0';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(char, x, y);

        // Reset drop to top
        if (y > canvas.height && Math.random() > 0.95) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    matrixInterval = setInterval(draw, 33);

    // Handle window resize
    window.addEventListener('resize', function() {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'easter-egg-notification';
    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // Console message for developers
  console.log('%c🚀 Welcome, Developer! 🚀', 'font-size: 20px; font-weight: bold; color: #478079;');
  console.log('%cTip: Press F12 three times to activate something special...', 'font-size: 14px; color: #7ee787;');
  console.log('%c//f12', 'font-size: 40px; font-weight: bold; color: #478079; font-family: monospace;');
})();
