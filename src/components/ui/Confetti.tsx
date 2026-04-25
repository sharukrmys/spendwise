import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  life: number
}

const COLORS = ['#7c5cfc', '#a855f7', '#00c896', '#f59e0b', '#ec4899', '#06b6d4', '#f97316']

function makeParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 3 + Math.random() * 5
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 5 + Math.random() * 5,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    life: 1,
  }
}

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particles = useRef<Particle[]>([])
  const raf = useRef<number>(0)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      canvas.remove()
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const burst = (x?: number, y?: number) => {
    const cx = x ?? window.innerWidth / 2
    const cy = y ?? window.innerHeight / 3
    for (let i = 0; i < 60; i++) {
      particles.current.push(makeParticle(cx, cy))
    }

    const tick = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.current = particles.current.filter(p => p.life > 0)
      for (const p of particles.current) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.18            // gravity
        p.rotation += p.rotationSpeed
        p.life -= 0.018

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }

      if (particles.current.length > 0) {
        raf.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }

  return burst
}
