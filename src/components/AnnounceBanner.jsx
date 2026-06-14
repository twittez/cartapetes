import { useState, useEffect } from 'react';

export default function AnnounceBanner({ locationText }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    // 2 hours, 47 minutes, 31 seconds = 10051 seconds
    const savedTime = localStorage.getItem('cartapetes_countdown');
    if (savedTime) {
      const parsed = parseInt(savedTime, 10);
      if (parsed > 0) return parsed;
    }
    return 10051;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        localStorage.setItem('cartapetes_countdown', next.toString());
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#111827] text-white text-center text-xs sm:text-sm py-2 px-3 flex flex-wrap items-center justify-center gap-2 select-none">
      <span>🔥 OFERTA RELÂMPAGO — Frete Grátis para <span className="font-bold text-[#FF5A00]">{locationText || 'sua região'}</span>! Termina em</span>
      <span className="font-mono font-bold text-white bg-[#FF5A00] px-2 py-0.5 rounded text-sm min-w-[75px]">
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}
