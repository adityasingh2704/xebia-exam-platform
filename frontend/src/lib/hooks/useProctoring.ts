import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToastStore } from '@/components/ui/Toast';

interface ProctoringConfig {
  assignmentId: string;
  examId: string;
  enableProctoring: boolean;
  onTerminate: (reason: string) => void;
  candidateName: string;
}

export function useProctoring({
  assignmentId,
  examId,
  enableProctoring,
  onTerminate,
  candidateName,
}: ProctoringConfig) {
  const { addToast } = useToastStore();
  const [trustScore, setTrustScore] = useState(100);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const keypressTimesRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);
  const lastToastRef = useRef<{ msg: string; time: number }>({ msg: '', time: 0 });

  useEffect(() => {
    const effectiveId = assignmentId || examId;
    if (!enableProctoring || !effectiveId) return;

    // Connect to WebSocket server running on backend port 3004
    const socket = io('http://localhost:3004');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to proctoring websocket');
      socket.emit('join-room', { assignmentId: effectiveId, examId, candidateName, role: 'candidate' });
    });

    // Handle warning from proctor or system
    socket.on('receive-warning', (data: { message: string; assignmentId?: string; manual?: boolean }) => {
      if (data.assignmentId && data.assignmentId !== effectiveId && data.assignmentId !== assignmentId && data.assignmentId !== examId) {
        return;
      }
      setWarningMessage(data.message);
      const now = Date.now();
      if (lastToastRef.current.msg === data.message && now - lastToastRef.current.time < 3000) {
        return;
      }
      lastToastRef.current = { msg: data.message, time: now };
      addToast(data.message, 'warning');
    });

    // Handle session termination
    socket.on('force-terminate', (data: { reason: string; assignmentId?: string; manual?: boolean }) => {
      if (data.assignmentId && data.assignmentId !== effectiveId && data.assignmentId !== assignmentId && data.assignmentId !== examId && !data.manual) {
        return;
      }
      stopAllTracks();
      onTerminate(data.reason);
      addToast(`Exam Terminated: ${data.reason}`, 'error');
    });

    socket.on('trust-score-updated', (data: { trustScore: number }) => {
      setTrustScore(data.trustScore);
    });

    // ── Client Security Event Listeners ──

    // 1. Tab Switching & Window Focus Check
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportIncident('TAB_SWITCH', 'HIGH', 1.0);
      }
    };

    const handleWindowBlur = () => {
      reportIncident('WINDOW_FOCUS_LOST', 'MEDIUM', 0.9);
    };

    // 2. Context Menu & Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportIncident('RIGHT_CLICK_ATTEMPT', 'LOW', 0.95);
      addToast('Right-click is disabled during proctored assessments.', 'warning');
    };

    // 3. Copy & Paste Blocking
    const handleClipboardEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      reportIncident('CLIPBOARD_ACCESS', 'HIGH', 1.0);
      addToast('Copy/Paste actions are disabled and flagged.', 'error');
    };

    // 4. Keyboard Security Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Prevent PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        reportIncident('PRINTSCREEN_ATTEMPT', 'HIGH', 1.0);
        addToast('Screenshots are strictly prohibited.', 'error');
      }

      // Block Ctrl+C, Ctrl+V, Ctrl+P, Ctrl+U, Ctrl+Shift+I (inspect)
      if (isCmdOrCtrl && ['c', 'v', 'p', 'u', 'i'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        reportIncident('KEYBOARD_BYPASS_ATTEMPT', 'MEDIUM', 0.95);
        addToast('Action blocked: Security shortcut disabled.', 'warning');
      }

      // Keystroke dynamics analysis
      const now = Date.now();
      if (lastKeyTimeRef.current > 0) {
        const diff = now - lastKeyTimeRef.current;
        keypressTimesRef.current.push(diff);

        // Keep last 20 keystrokes for typing speed review
        if (keypressTimesRef.current.length > 20) {
          keypressTimesRef.current.shift();

          // Calculate average typing interval in milliseconds
          const avgInterval = keypressTimesRef.current.reduce((a, b) => a + b, 0) / keypressTimesRef.current.length;
          // If interval is below 35ms, it indicates automated/scripted input
          if (avgInterval < 35) {
            reportIncident('IMPLAUSIBLE_TYPING_SPEED', 'HIGH', 0.98);
            addToast('Security notice: Implausible typing speed detected.', 'error');
          }
        }
      }
      lastKeyTimeRef.current = now;
    };

    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleClipboardEvent);
    document.addEventListener('cut', handleClipboardEvent);
    document.addEventListener('paste', handleClipboardEvent);
    document.addEventListener('keydown', handleKeyDown);

    // 5. DevTools open check
    const devtoolsInterval = setInterval(() => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        reportIncident('DEVTOOLS_OPENED', 'HIGH', 1.0);
      }
    }, 2000);

    // 6. Real Live Webcam Stream & Periodic Base64 Frame Transmitter
    let webcamStream: MediaStream | null = null;
    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;

    let frameInterval: NodeJS.Timeout | null = null;

    // 7. Live Screen Recording Track & Frame Transmitter
    let screenStream: MediaStream | null = null;
    const screenVideoEl = document.createElement('video');
    screenVideoEl.autoplay = true;
    screenVideoEl.playsInline = true;
    screenVideoEl.muted = true;

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 640;
    screenCanvas.height = 360;

    let screenInterval: NodeJS.Timeout | null = null;

    const startFeed = async () => {
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoEl.srcObject = webcamStream;
        await videoEl.play().catch(() => { });
        startRealVideoStreaming();
      } catch (err) {
        reportIncident('WEBCAM_DISCONNECTED', 'HIGH', 1.0);
      }

      try {
        if (navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia) {
          screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: true,
            audio: false,
          });
          screenVideoEl.srcObject = screenStream;
          await screenVideoEl.play().catch(() => { });

          screenInterval = setInterval(() => {
            const ctx = screenCanvas.getContext('2d');
            if (ctx && screenVideoEl.readyState >= 2) {
              ctx.drawImage(screenVideoEl, 0, 0, screenCanvas.width, screenCanvas.height);
              const screenBase64 = screenCanvas.toDataURL('image/jpeg', 0.6);
              if (socketRef.current) {
                socketRef.current.emit('candidate-screen-frame', {
                  assignmentId: effectiveId,
                  candidateName,
                  examId,
                  screenScreenshot: screenBase64,
                });
              }
            }
          }, 2500);

          if (screenStream && screenStream.getVideoTracks()[0]) {
            screenStream.getVideoTracks()[0].onended = () => {
              if (screenInterval) clearInterval(screenInterval);
            };
          }
        }
      } catch (err) {
        console.warn('Screen stream prompt skipped or restricted:', err);
      }
    };
    startFeed();

    const startRealVideoStreaming = () => {
      // Capture & transmit real candidate webcam video frame (FACE ONLY) every 2.5 seconds
      frameInterval = setInterval(() => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (videoEl.readyState >= 2) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#38bdf8';
            ctx.font = '14px sans-serif';
            ctx.fillText('Initializing Camera...', 80, 120);
          }

          const frameBase64 = canvas.toDataURL('image/jpeg', 0.6);

          // 1. Emit live candidate webcam video frame (face) to proctor dashboard
          if (socketRef.current) {
            socketRef.current.emit('candidate-video-frame', {
              assignmentId: effectiveId,
              candidateName,
              examId,
              screenshot: frameBase64,
            });
          }

          // 2. Periodic AI safety check simulation
          const rand = Math.random();
          if (rand < 0.03) {
            reportIncident('GAZE_AWAY', 'LOW', 0.85, frameBase64);
          } else if (rand < 0.05) {
            reportIncident('MOBILE_PHONE', 'HIGH', 0.95, frameBase64);
          } else if (rand < 0.07) {
            reportIncident('FACE_ABSENCE', 'MEDIUM', 0.9, frameBase64);
          }
        }
      }, 2500);
    };

    const stopAllTracks = () => {
      if (frameInterval) clearInterval(frameInterval);
      if (screenInterval) clearInterval(screenInterval);
      if (webcamStream) {
        webcamStream.getTracks().forEach((t) => t.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
    };

    // Reporting Helper
    function reportIncident(flagType: string, severity: string, confidence: number, img?: string) {
      if (!socketRef.current) return;
      const currentScreenshot = img || (videoEl.readyState >= 2 ? canvas.toDataURL('image/jpeg', 0.6) : null);
      socketRef.current.emit('report-incident', {
        assignmentId: effectiveId,
        examId,
        candidateName,
        flagType,
        severity,
        confidenceScore: confidence,
        screenshot: currentScreenshot,
      });
    }

    return () => {
      // Clean up
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleClipboardEvent);
      document.removeEventListener('cut', handleClipboardEvent);
      document.removeEventListener('paste', handleClipboardEvent);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(devtoolsInterval);
      stopAllTracks();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [enableProctoring, assignmentId]);

  const reportCustomIncident = (flagType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', confidence: number) => {
    if (socketRef.current) {
      socketRef.current.emit('report-incident', {
        assignmentId,
        flagType,
        severity,
        confidenceScore: confidence,
      });
    }
  };

  const sendProgressUpdate = (questionsAnswered: number, totalQuestions: number) => {
    if (socketRef.current && assignmentId) {
      socketRef.current.emit('candidate-progress', {
        assignmentId,
        questionsAnswered,
        totalQuestions,
      });
    }
  };

  return {
    trustScore,
    warningMessage,
    clearWarning: () => setWarningMessage(null),
    reportCustomIncident,
    sendProgressUpdate,
  };
}
