import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ProcessedFaceImage } from '../game/faceImage'
import { buildFaceMesh, buildSkullMesh } from '../game/fighterHead'
import './FightScreen.css'

type FightScreenProps = {
  face: ProcessedFaceImage
  onBack: () => void
}

const HIT_WORDS = ['POW!', 'BAM!', 'BỐP!', 'OÁCH!', 'CHÁT!', 'BÙM!']

export function FightScreen({ face, onBack }: FightScreenProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hpRef = useRef<HTMLDivElement>(null)
  const splashRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const koRef = useRef<HTMLDivElement>(null)
  const portraitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (portraitRef.current) {
      portraitRef.current.style.backgroundImage = `url(${face.previewUrl})`
    }
  }, [face.previewUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = wrapRef.current
    if (!canvas || !root) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    {
      const bg = document.createElement('canvas')
      bg.width = 2
      bg.height = 256
      const g = bg.getContext('2d')
      if (g) {
        const gr = g.createLinearGradient(0, 0, 0, 256)
        gr.addColorStop(0, '#5ea0ef')
        gr.addColorStop(0.55, '#2f64ad')
        gr.addColorStop(1, '#1c3c6b')
        g.fillStyle = gr
        g.fillRect(0, 0, 2, 256)
        scene.background = new THREE.CanvasTexture(bg)
      }
    }

    const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 100)
    camera.position.set(0, 1.55, 5.4)
    camera.lookAt(0, 1.45, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xfff1d6, 1.0)
    key.position.set(2, 4, 3)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fc6ff, 0.5)
    rim.position.set(-3, 1, -3)
    scene.add(rim)

    // Ring floor
    {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')
      if (g) {
        g.fillStyle = '#3da0e8'
        g.fillRect(0, 0, 256, 256)
        g.strokeStyle = 'rgba(255,255,255,.25)'
        g.lineWidth = 6
        for (let i = 0; i <= 256; i += 64) {
          g.beginPath()
          g.moveTo(i, 0)
          g.lineTo(i, 256)
          g.stroke()
          g.beginPath()
          g.moveTo(0, i)
          g.lineTo(256, i)
          g.stroke()
        }
      }
      const tex = new THREE.CanvasTexture(c)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(4, 4)
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -1.2
      scene.add(floor)
    }

    // Ropes + posts
    {
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe3342f, roughness: 0.5 })
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 16, 8), ropeMat)
        r.rotation.z = Math.PI / 2
        r.position.set(0, -0.4 + i * 0.55, -4.5)
        scene.add(r)
      }
      const postMat = new THREE.MeshStandardMaterial({ color: 0x1f7ae0, roughness: 0.4 })
      for (const x of [-7.5, 7.5]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 12), postMat)
        p.position.set(x, 0.1, -4.5)
        scene.add(p)
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 14, 12),
          new THREE.MeshStandardMaterial({ color: 0xffcc1d }),
        )
        ball.position.set(x, 1.45, -4.5)
        scene.add(ball)
      }
    }

    const fighter = new THREE.Group()
    const headPivot = new THREE.Group()
    headPivot.position.set(0, 2.25, 0)
    fighter.add(headPivot)
    let headBuilt = false

    const loader = new THREE.TextureLoader()
    loader.load(face.previewUrl, (tex) => {
      headPivot.add(buildSkullMesh(), buildFaceMesh(tex))
      headBuilt = true
    })

    // Cartoon body
    {
      const skin = new THREE.MeshStandardMaterial({ color: 0xc89a72, roughness: 0.8 })
      const shirt = new THREE.MeshStandardMaterial({ color: 0x18a558, roughness: 0.7 })
      const gloveM = new THREE.MeshStandardMaterial({ color: 0x1f7ae0, roughness: 0.45 })
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 1.5, 18), shirt)
      torso.position.y = 0.55
      torso.scale.z = 0.72
      fighter.add(torso)
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.5, 12), skin)
      neck.position.y = 1.4
      fighter.add(neck)
      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), shirt)
        sh.position.set(s * 0.62, 1.1, 0)
        fighter.add(sh)
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 1.0, 10), skin)
        arm.position.set(s * 0.85, 0.55, 0.25)
        arm.rotation.z = s * 0.45
        arm.rotation.x = -0.5
        fighter.add(arm)
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), gloveM)
        glove.scale.set(1, 0.92, 1.1)
        glove.position.set(s * 1.0, 0.15, 0.62)
        fighter.add(glove)
      }
      const belt = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.09, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xffcc1d }),
      )
      belt.rotation.x = Math.PI / 2
      belt.position.y = -0.18
      belt.scale.z = 0.72
      fighter.add(belt)
      const hips = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.6, 0.8, 18),
        new THREE.MeshStandardMaterial({ color: 0x202a3a, roughness: 0.8 }),
      )
      hips.position.y = -0.55
      hips.scale.z = 0.72
      fighter.add(hips)
    }
    fighter.position.set(0, -0.55, 0)
    scene.add(fighter)

    // Dizzy stars
    const stars: THREE.Sprite[] = []
    {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')
      if (g) {
        g.translate(32, 32)
        g.fillStyle = '#ffcc1d'
        g.strokeStyle = '#000'
        g.lineWidth = 4
        g.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5
          const r = i % 2 ? 11 : 26
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        g.closePath()
        g.fill()
        g.stroke()
      }
      const st = new THREE.CanvasTexture(c)
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true }))
        sp.scale.set(0.4, 0.4, 0.4)
        sp.visible = false
        headPivot.add(sp)
        stars.push(sp)
      }
    }

    // Player gloves
    type GloveUserData = {
      rest: THREE.Vector3
      t: number
      active: boolean
      side: number
      hit: boolean
    }
    const myGloves: THREE.Group[] = []
    {
      const red = new THREE.MeshStandardMaterial({ color: 0xe3342f, roughness: 0.4 })
      const cuff = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
      for (const s of [-1, 1]) {
        const g = new THREE.Group()
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), red)
        fist.scale.set(1, 0.9, 1.15)
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.5, 12), cuff)
        c.position.set(0, -0.15, 0.55)
        c.rotation.x = 1.2
        g.add(fist, c)
        const rest = new THREE.Vector3(s * 1.25, 0.25, 3.6)
        g.userData = { rest, t: 0, active: false, side: s, hit: false } satisfies GloveUserData
        g.position.copy(rest)
        scene.add(g)
        myGloves.push(g)
      }
    }

    let hp = 100
    let ko = false
    let started = false
    const headVel = { x: 0, y: 0, z: 0 }
    let squash = 0
    let shake = 0
    let dizzy = 0

    const hpFill = hpRef.current
    const splash = splashRef.current
    const flash = flashRef.current
    const koPanel = koRef.current

    function showSplash(txt: string) {
      if (!splash) return
      const span = splash.querySelector('span')
      if (span) span.textContent = txt
      splash.classList.remove('show')
      void splash.offsetWidth
      splash.classList.add('show')
    }

    const startTimer = window.setTimeout(() => {
      showSplash('FIGHT!')
      started = true
    }, 600)

    function landHit(side: number) {
      if (ko) return
      hp = Math.max(0, hp - (7 + Math.random() * 6))
      if (hpFill) {
        hpFill.style.width = `${hp}%`
        if (hp < 40) {
          hpFill.style.background = 'linear-gradient(180deg,#ff9d4d,#e07a1f 55%,#9e520e)'
        }
        if (hp < 18) {
          hpFill.style.background = 'linear-gradient(180deg,#ff6b5e,#d11f1f 55%,#8a0e0e)'
        }
      }
      headVel.y += 0.5 + Math.random() * 0.3
      headVel.x += -side * (0.8 + Math.random() * 0.5)
      headVel.z += 0.35
      squash = 1
      shake = 1
      dizzy = Math.min(1, dizzy + (hp < 35 ? 0.6 : 0.25))
      if (flash) {
        flash.style.opacity = '0.55'
        window.setTimeout(() => {
          if (flash) flash.style.opacity = '0'
        }, 60)
      }
      const w = document.createElement('div')
      w.className = 'fight-pow'
      w.textContent = HIT_WORDS[(Math.random() * HIT_WORDS.length) | 0] ?? 'POW!'
      w.style.setProperty('--r', `${Math.random() * 30 - 15}deg`)
      w.style.left = `${window.innerWidth / 2 + (Math.random() * 120 - 60) + side * 60}px`
      w.style.top = `${window.innerHeight * 0.32 + (Math.random() * 60 - 30)}px`
      wrapRef.current?.appendChild(w)
      window.setTimeout(() => w.remove(), 520)
      if (navigator.vibrate) navigator.vibrate(35)
      if (hp <= 0) doKO()
    }

    function doKO() {
      ko = true
      dizzy = 1
      showSplash('K.O.!')
      window.setTimeout(() => koPanel?.classList.add('show'), 900)
    }

    function rematch() {
      hp = 100
      ko = false
      dizzy = 0
      if (hpFill) {
        hpFill.style.width = '100%'
        hpFill.style.background = 'linear-gradient(180deg,#7dff4d,#46d11f 55%,#2f9e0e)'
      }
      fighter.rotation.set(0, 0, 0)
      fighter.position.y = -0.55
      koPanel?.classList.remove('show')
      showSplash('ROUND 2!')
    }

    function punch(side: number) {
      if (ko || !started) return
      const g = myGloves[side < 0 ? 0 : 1]
      if (!g || (g.userData as GloveUserData).active) return
      const ud = g.userData as GloveUserData
      ud.active = true
      ud.t = 0
      ud.hit = false
    }

    const onPunchLeft = (e: Event) => {
      e.stopPropagation()
      punch(-1)
    }
    const onPunchRight = (e: Event) => {
      e.stopPropagation()
      punch(1)
    }
    const onCanvasDown = (e: PointerEvent) => punch(e.clientX < window.innerWidth / 2 ? -1 : 1)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'ArrowLeft') punch(-1)
      if (e.key === 'l' || e.key === 'ArrowRight') punch(1)
    }

    const btnLeft = root.querySelector('#fight-pl')
    const btnRight = root.querySelector('#fight-pr')
    const btnRematch = root.querySelector('#fight-rematch')
    btnLeft?.addEventListener('pointerdown', onPunchLeft)
    btnRight?.addEventListener('pointerdown', onPunchRight)
    btnRematch?.addEventListener('click', rematch)
    canvas.addEventListener('pointerdown', onCanvasDown)
    window.addEventListener('keydown', onKey)

    const clock = new THREE.Clock()
    let frameId = 0

    function resize() {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)
    resize()

    function animate() {
      frameId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime

      if (!ko) {
        fighter.rotation.y = Math.sin(t * 1.1) * 0.12
        fighter.position.x = Math.sin(t * 0.8) * 0.25
        fighter.position.y = -0.55 + Math.abs(Math.sin(t * 3)) * 0.05
      } else {
        fighter.rotation.x = Math.min(Math.PI / 2.2, fighter.rotation.x + dt * 2.2)
        fighter.position.y = Math.max(-1.05, fighter.position.y - dt * 0.8)
      }

      if (headBuilt) {
        headPivot.rotation.x += (headVel.y * 0 - headPivot.rotation.x) * dt * 8
        headPivot.rotation.z += (-headVel.x * 0.6 - headPivot.rotation.z) * dt * 10
        headPivot.rotation.y += (headVel.x * 0.9 - headPivot.rotation.y) * dt * 10
        headPivot.position.z = headVel.z * -0.3
        headVel.x *= 1 - dt * 5
        headVel.y *= 1 - dt * 5
        headVel.z *= 1 - dt * 6
        squash = Math.max(0, squash - dt * 4)
        const s = 1 - squash * 0.25
        headPivot.scale.set(1 + squash * 0.18, s, 1 + squash * 0.18)
        if (ko) headPivot.rotation.y += dt * 3
      }

      dizzy = Math.max(0, dizzy - dt * (ko ? 0 : 0.15))
      stars.forEach((sp, i) => {
        sp.visible = dizzy > 0.2
        const a = t * 4 + i * 2.1
        sp.position.set(Math.cos(a) * 0.95, 0.95 + Math.sin(t * 6 + i) * 0.07, Math.sin(a) * 0.6)
      })

      const headWorld = new THREE.Vector3()
      myGloves.forEach((g) => {
        const u = g.userData as GloveUserData
        if (u.active) {
          u.t += dt * 4.2
          headPivot.getWorldPosition(headWorld)
          const target = headWorld.clone()
          target.z += 0.7
          target.x += u.side * 0.15
          if (u.t < 1) {
            g.position.lerpVectors(u.rest, target, THREE.MathUtils.smoothstep(u.t, 0, 1))
            if (u.t >= 0.92 && !u.hit) {
              u.hit = true
              landHit(u.side)
            }
          } else if (u.t < 2) {
            g.position.lerpVectors(target, u.rest, THREE.MathUtils.smoothstep(u.t - 1, 0, 1))
          } else {
            u.active = false
            u.hit = false
            g.position.copy(u.rest)
          }
        } else {
          g.position.y = u.rest.y + Math.sin(t * 3 + u.side) * 0.06
        }
      })

      shake = Math.max(0, shake - dt * 4)
      camera.position.x = (Math.random() - 0.5) * shake * 0.15
      camera.position.y = 1.55 + (Math.random() - 0.5) * shake * 0.15

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(startTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onCanvasDown)
      btnLeft?.removeEventListener('pointerdown', onPunchLeft)
      btnRight?.removeEventListener('pointerdown', onPunchRight)
      btnRematch?.removeEventListener('click', rematch)
      renderer.dispose()
    }
  }, [face.previewUrl])

  return (
    <div ref={wrapRef} className="fight-screen">
      <canvas ref={canvasRef} className="fight-gl" />

      <div className="fight-hud">
        <div className="fight-hp-row">
          <div ref={portraitRef} className="fight-portrait" />
          <div className="fight-hp-shell">
            <div className="fight-hp-name">ĐỐI THỦ</div>
            <div className="fight-hp-bar">
              <div ref={hpRef} className="fight-hp-fill" />
            </div>
          </div>
        </div>
        <div className="fight-round">ROUND 1</div>
      </div>

      <div ref={splashRef} className="fight-splash">
        <span>FIGHT!</span>
      </div>
      <div ref={flashRef} className="fight-flash" />

      <p className="fight-hint">
        Bấm nửa trái / phải màn hình hoặc 2 nút găng để đấm
      </p>

      <div className="fight-btns">
        <button type="button" className="fight-punch" id="fight-pl">
          ĐẤM
          <br />
          TRÁI
        </button>
        <button type="button" className="fight-punch" id="fight-pr">
          ĐẤM
          <br />
          PHẢI
        </button>
      </div>

      <div ref={koRef} className="fight-ko">
        <h2>K.O.!</h2>
        <button type="button" className="fight-rematch" id="fight-rematch">
          Đấu lại
        </button>
      </div>

      <button type="button" className="fight-back" onClick={onBack}>
        ← Căn lại mặt
      </button>
    </div>
  )
}
