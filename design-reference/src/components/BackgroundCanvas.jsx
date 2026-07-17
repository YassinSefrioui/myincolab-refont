import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext.jsx';

const ORBS = [
  { hue: [108, 139, 245], r: .34, sx: .18, sy: .28, ax: .13, ay: .10, spx: .00021, spy: .00017, ph: 0 },
  { hue: [155, 123, 240], r: .30, sx: .82, sy: .22, ax: .11, ay: .13, spx: .00017, spy: .00023, ph: 2.1 },
  { hue: [42, 157, 143],  r: .28, sx: .70, sy: .80, ax: .14, ay: .09, spx: .00019, spy: .00015, ph: 4.2 },
  { hue: [224, 96, 122],  r: .22, sx: .25, sy: .78, ax: .09, ay: .12, spx: .00024, spy: .00019, ph: 1.3 },
];

export default function BackgroundCanvas() {
  const canvasRef = useRef(null);
  const { prefs } = useApp();
  const themeRef = useRef(prefs.theme);
  themeRef.current = prefs.theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w, h;
    const mouse = { x: .5, y: .5 };
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    function onMove(e) {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    resize();
    let raf;
    function frame(ts) {
      ctx.clearRect(0, 0, w, h);
      const dark = themeRef.current === 'dark';
      const alpha = dark ? .14 : .16;
      ORBS.forEach(o => {
        const px = (mouse.x - .5) * .05;
        const py = (mouse.y - .5) * .05;
        const x = (o.sx + Math.sin(ts * o.spx + o.ph) * o.ax + px) * w;
        const y = (o.sy + Math.cos(ts * o.spy + o.ph) * o.ay + py) * h;
        const r = o.r * Math.min(w, h) * (1 + Math.sin(ts * .0003 + o.ph) * .08);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},${alpha})`);
        g.addColorStop(1, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} aria-hidden="true" />;
}
