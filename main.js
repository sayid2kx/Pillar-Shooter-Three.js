// --- Imports ---
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

// --- Basic Setup ---
let scene, camera, renderer, controls
let clock = new THREE.Clock()
let gameActive = false // Is the game simulation running (not paused)?
let timerInterval
let isGameOver = false // Has the game finished (win/lose)?
let isPaused = false // Explicit pause state (e.g., via Esc)

// --- Game Objects & State ---
const gameObjects = [] // Array to hold all pillars/shapes for collision etc.
const redPillars = [] // Keep track of red pillars specifically
const pillarLabels = {} // Map pillar UUID to its label sprite {label: Sprite, pillar: Mesh}
let bullets = 20
let destroyedTargets = 0
const totalTargets = 10
let timeLeft = 300 // 5 minutes in seconds

// --- Constants ---
const PLAYER_HEIGHT = 1.6
const PLAYER_SPEED = 5.0
const PLAYER_RADIUS = 0.3 // Player's approximate collision radius
const PILLAR_COUNT = 1000 // Increased pillar count
const PILLAR_AREA_SIZE = 80 // Increased area for more pillars
const LABEL_VISIBILITY_DISTANCE = 35 // Max distance to show labels
const LABEL_UPDATE_INTERVAL = 0.25 // Seconds - Check label visibility less frequently
let timeSinceLastLabelUpdate = 0
const MAX_BASE_SIZE_TARGET = 1.8 // Max height/diameter for targets
const MAX_BASE_SIZE_OTHER = 2.2 // Max height/diameter/size for others
const MIN_OBJ_SCALE = 0.6 // Minimum scale factor relative to max base size
const MAX_OBJ_SCALE = 1.0 // Maximum scale factor
const MIN_SPACING = PLAYER_RADIUS * 2 + 0.5 // Min distance between object centers (player diameter + buffer)
const MAX_PLACEMENT_ATTEMPTS = 10 // Attempts to find a spaced-out position

// --- Gun & Effects ---
let gunGroup // Group holding all gun parts
let muzzleFlash
let originalGunPosition = new THREE.Vector3(0.2, -0.15, -0.5) // Store default position
let isRecoiling = false
const RECOIL_AMOUNT = 0.03 // How far back the gun kicks
const RECOIL_RECOVERY_SPEED = 10.0 // How fast it returns

// Player movement state
const moveState = { forward: 0, right: 0 }

// Particle System
const MAX_PARTICLES = 1000
const PARTICLES_PER_EFFECT = 50
let particleSystem, particleGeometry, particleMaterial
const particles = []

// Raycasters
const shootRaycaster = new THREE.Raycaster()
const labelRaycaster = new THREE.Raycaster() // Separate raycaster for labels

// --- UI Elements ---
const bulletsUI = document.querySelector('#bullets .ui-value')
const targetsUI = document.querySelector('#targets .ui-value')
const timerUI = document.querySelector('#timer .ui-value')
const crosshair = document.getElementById('crosshair')
const instructionsOverlay = document.getElementById('instructions-overlay')
const instructionsBox = document.getElementById('instructions-box')
const gameEndMessage = document.getElementById('game-end-message')
const screenFlashElement = document.getElementById('screen-flash') // Get flash element

// --- Initialization ---
function init() {
  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050a10)
  scene.fog = new THREE.Fog(scene.background, 30, PILLAR_AREA_SIZE * 0.8) // Add fog for atmosphere/depth

  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    150,
  ) // Increased far plane slightly
  camera.position.y = PLAYER_HEIGHT

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: false })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio) // Use device pixel ratio

  // *** CHANGE: Append canvas to <main> instead of <body> ***
  const mainElement = document.querySelector('main')
  if (mainElement) {
    mainElement.appendChild(renderer.domElement) // Append canvas inside <main>
  } else {
    console.error(
      'Could not find <main> element to append canvas! Appending to body as fallback.',
    )
    document.body.appendChild(renderer.domElement) // Fallback
  }
  // *** END CHANGE ***

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x607080) // Cooler ambient
  scene.add(ambientLight)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8) // Add hemisphere light for subtle gradients
  hemiLight.position.set(0, 50, 0)
  scene.add(hemiLight)

  // Ground Plane
  const groundGeometry = new THREE.PlaneGeometry(
    PILLAR_AREA_SIZE * 1.5,
    PILLAR_AREA_SIZE * 1.5,
  ) // Larger ground
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1a2a1a }) // Use Lambert for subtle light interaction
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // Pointer Lock Controls
  controls = new PointerLockControls(camera, renderer.domElement)
  scene.add(controls.getObject()) // Add camera group to scene

  // Create Improved Gun Model & Effects
  createGun()

  // Generate Environment
  generateEnvironment()

  // Particle System Setup
  initParticleSystem()

  // Event Listeners
  setupEventListeners()

  // Initial UI Update
  updateUI()

  // Start Animation Loop
  animate()
}

// --- Improved Gun Creation (With Brighter Color) ---
function createGun() {
  gunGroup = new THREE.Group()
  const gunMaterial = new THREE.MeshBasicMaterial({ color: 0xc0c0c0 }) // Light Silver/Grey
  const barrelMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2a2a })

  const bodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25)
  const body = new THREE.Mesh(bodyGeo, gunMaterial)
  body.position.z = -0.05
  gunGroup.add(body)
  const gripGeo = new THREE.BoxGeometry(0.04, 0.18, 0.05)
  const grip = new THREE.Mesh(gripGeo, gunMaterial)
  grip.position.set(0, -0.08, 0.02)
  grip.rotation.x = -0.2
  gunGroup.add(grip)
  const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8)
  const barrel = new THREE.Mesh(barrelGeo, barrelMaterial)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, 0.01, -0.2)
  gunGroup.add(barrel)
  const sightGeo = new THREE.BoxGeometry(0.02, 0.02, 0.03)
  const sight = new THREE.Mesh(sightGeo, barrelMaterial)
  sight.position.set(0, 0.055, -0.1)
  gunGroup.add(sight)

  const flashGeo = new THREE.PlaneGeometry(0.15, 0.15)
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfff59d,
    map: createMuzzleFlashTexture(),
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
    transparent: true,
    depthWrite: false,
  })
  muzzleFlash = new THREE.Mesh(flashGeo, flashMat)
  muzzleFlash.position.set(0, 0.01, -0.31)
  muzzleFlash.visible = false
  gunGroup.add(muzzleFlash)

  gunGroup.position.copy(originalGunPosition)
  gunGroup.rotation.y = -0.05
  camera.add(gunGroup)
}

// Optional: Texture for Muzzle Flash for a better shape
function createMuzzleFlashTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  context.fillStyle = 'rgba(255, 245, 157, 1)'
  context.beginPath()
  context.moveTo(32, 5)
  context.lineTo(38, 26)
  context.lineTo(60, 28)
  context.lineTo(44, 40)
  context.lineTo(48, 62)
  context.lineTo(32, 50)
  context.lineTo(16, 62)
  context.lineTo(20, 40)
  context.lineTo(4, 28)
  context.lineTo(26, 26)
  context.closePath()
  context.fill()
  const gradient = context.createRadialGradient(32, 32, 5, 32, 32, 30)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.4, 'rgba(255, 245, 157, 0.5)')
  gradient.addColorStop(1, 'rgba(255, 220, 50, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// --- Environment Generation --- (Includes size, spacing, crash fix)
function generateEnvironment() {
  const nonTargetShapes = ['cube', 'sphere', 'pyramid', 'tree']
  const colors = []
  for (let i = 0; i < totalTargets; i++) colors.push(0xff0000)
  for (let i = 0; i < PILLAR_COUNT - totalTargets; i++) {
    colors.push(
      new THREE.Color()
        .setHSL(Math.random(), 0.6, 0.4 + Math.random() * 0.2)
        .getHex(),
    )
  }
  colors.sort(() => Math.random() - 0.5)
  let redPillarCount = 0
  for (let i = 0; i < PILLAR_COUNT; i++) {
    let geometry, material, mesh
    let position = new THREE.Vector3()
    let scale = MIN_OBJ_SCALE + Math.random() * (MAX_OBJ_SCALE - MIN_OBJ_SCALE)
    let objRadius = 0
    let objHeight = 0
    let shapeType = ''
    const randomColor = colors[i]
    const isTarget = randomColor === 0xff0000
    if (isTarget) {
      shapeType = 'cylinder'
      const maxRadius = (MAX_BASE_SIZE_TARGET / 2) * scale
      const maxHeight = MAX_BASE_SIZE_TARGET * 1.5 * scale
      const radius = Math.max(0.3, maxRadius * (0.7 + Math.random() * 0.3))
      const height = Math.max(1.0, maxHeight * (0.6 + Math.random() * 0.4))
      geometry = new THREE.CylinderGeometry(radius, radius, height, 8)
      material = new THREE.MeshBasicMaterial({ color: randomColor })
      objRadius = radius
      objHeight = height
      mesh = new THREE.Mesh(geometry, material)
    } else {
      shapeType =
        nonTargetShapes[Math.floor(Math.random() * nonTargetShapes.length)]
      material = new THREE.MeshLambertMaterial({ color: randomColor })
      const baseSize = MAX_BASE_SIZE_OTHER * scale
      switch (shapeType) {
        case 'cube':
          const size = Math.max(0.8, baseSize * (0.8 + Math.random() * 0.4))
          geometry = new THREE.BoxGeometry(size, size, size)
          objRadius = size * 0.707
          objHeight = size
          mesh = new THREE.Mesh(geometry, material)
          break
        case 'sphere':
          const sphereRadius = Math.max(
            0.5,
            baseSize * (0.4 + Math.random() * 0.3),
          )
          geometry = new THREE.SphereGeometry(sphereRadius, 10, 6)
          objRadius = sphereRadius
          objHeight = sphereRadius * 2
          mesh = new THREE.Mesh(geometry, material)
          break
        case 'pyramid':
          const pyramidRadius = Math.max(
            0.5,
            baseSize * (0.4 + Math.random() * 0.3),
          )
          const pyramidHeight = Math.max(
            1.2,
            baseSize * 1.2 * (0.8 + Math.random() * 0.4),
          )
          geometry = new THREE.ConeGeometry(pyramidRadius, pyramidHeight, 4)
          objRadius = pyramidRadius
          objHeight = pyramidHeight
          mesh = new THREE.Mesh(geometry, material)
          break
        case 'tree':
          const trunkHeight = Math.max(
            1.0,
            baseSize * 0.8 * (0.7 + Math.random() * 0.3),
          )
          const trunkRadius = Math.max(
            0.15,
            baseSize * 0.15 * (0.7 + Math.random() * 0.3),
          )
          const leavesHeight = Math.max(
            1.2,
            baseSize * 1.2 * (0.8 + Math.random() * 0.4),
          )
          const leavesRadius = Math.max(
            0.5,
            baseSize * 0.5 * (0.8 + Math.random() * 0.4),
          )
          const trunkGeo = new THREE.CylinderGeometry(
            trunkRadius,
            trunkRadius,
            trunkHeight,
            5,
          )
          const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 })
          const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat)
          const leavesGeo = new THREE.ConeGeometry(
            leavesRadius,
            leavesHeight,
            6,
          )
          const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
          const leavesMesh = new THREE.Mesh(leavesGeo, leavesMat)
          leavesMesh.position.y = trunkHeight / 2 + leavesHeight / 2
          mesh = new THREE.Group()
          mesh.add(trunkMesh)
          mesh.add(leavesMesh)
          objRadius = leavesRadius
          objHeight = trunkHeight + leavesHeight
          break
      }
    }
    let validPosition = false
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      position.set(
        (Math.random() - 0.5) * PILLAR_AREA_SIZE,
        0,
        (Math.random() - 0.5) * PILLAR_AREA_SIZE,
      )
      let tooClose = false
      for (const existingObj of gameObjects) {
        if (!existingObj || !existingObj.position || !existingObj.userData) {
          continue
        }
        const distSq = position.distanceToSquared(existingObj.position)
        const requiredDist =
          (existingObj.userData.radius || 0.5) +
          (objRadius || 0.5) +
          MIN_SPACING
        if (distSq < requiredDist * requiredDist) {
          tooClose = true
          break
        }
      }
      if (!tooClose) {
        validPosition = true
        break
      }
    }
    if (!validPosition) {
      continue
    }
    let finalY
    if (
      mesh instanceof THREE.Group &&
      mesh.children.length > 0 &&
      mesh.children[0].geometry?.parameters?.height
    ) {
      const trunkHeight = mesh.children[0].geometry.parameters.height
      finalY = trunkHeight / 2
    } else if (shapeType === 'sphere') {
      finalY = objRadius
    } else {
      finalY = objHeight / 2
    }
    position.y = finalY
    mesh.position.copy(position)
    mesh.userData.radius = objRadius
    mesh.userData.height = objHeight
    mesh.castShadow = false
    mesh.receiveShadow = false
    scene.add(mesh)
    gameObjects.push(mesh)
    if (isTarget) {
      mesh.isTarget = true
      redPillarCount++
      mesh.targetId = redPillarCount
      const label = createPillarLabel(redPillarCount.toString())
      label.position.set(
        mesh.position.x,
        mesh.position.y + objHeight / 2 + 0.8,
        mesh.position.z,
      )
      label.visible = false
      scene.add(label)
      pillarLabels[mesh.uuid] = { label: label, pillar: mesh }
      redPillars.push(mesh)
    } else {
      mesh.isTarget = false
    }
  }
  console.log(
    `Attempted ${PILLAR_COUNT}, Generated ${gameObjects.length} objects, ${redPillars.length} targets.`,
  )
}

// --- Pillar Label Creation & Visibility ---
function createPillarLabel(text) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const fontSize = 64
  const padding = 10
  context.font = `Bold ${fontSize}px ${
    getComputedStyle(document.body).fontFamily
  }`
  const textMetrics = context.measureText(text)
  const textWidth = textMetrics.width
  canvas.width = textWidth + padding * 2
  canvas.height = fontSize + padding * 2
  context.font = `Bold ${fontSize}px ${
    getComputedStyle(document.body).fontFamily
  }`
  context.fillStyle = 'rgba(255, 255, 255, 1)'
  context.strokeStyle = 'rgba(0, 0, 0, 0.7)'
  context.lineWidth = 4
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.strokeText(text, canvas.width / 2, canvas.height / 2)
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: false,
  })
  const sprite = new THREE.Sprite(material)
  const scaleFactor = 0.006
  sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1.0)
  sprite.renderOrder = 1
  return sprite
}
function updateLabelVisibility(deltaTime) {
  timeSinceLastLabelUpdate += deltaTime
  if (timeSinceLastLabelUpdate < LABEL_UPDATE_INTERVAL && !isGameOver) return
  timeSinceLastLabelUpdate = 0
  const cameraPosition = camera.position
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3())
  const sceneMeshes = gameObjects.filter(
    (obj) => !(obj instanceof THREE.Sprite) && obj !== particleSystem,
  )
  for (const uuid in pillarLabels) {
    const { label, pillar } = pillarLabels[uuid]
    if (!pillar || !pillar.parent) {
      if (label && label.parent) scene.remove(label)
      delete pillarLabels[uuid]
      continue
    }
    const pillarHeight = pillar.userData.height || 1.0
    const pillarTopY = pillar.position.y + pillarHeight / 2
    const pillarTopPosition = new THREE.Vector3(
      pillar.position.x,
      pillarTopY,
      pillar.position.z,
    )
    const distanceToPillar = cameraPosition.distanceTo(pillar.position)
    if (distanceToPillar > LABEL_VISIBILITY_DISTANCE) {
      label.visible = false
      continue
    }
    const pillarDirection = pillar.position
      .clone()
      .sub(cameraPosition)
      .normalize()
    if (cameraDirection.dot(pillarDirection) < 0.75) {
      label.visible = false
      continue
    }
    labelRaycaster.set(
      cameraPosition,
      pillarTopPosition.sub(cameraPosition).normalize(),
    )
    labelRaycaster.far = distanceToPillar + 1.0
    const intersects = labelRaycaster.intersectObjects(sceneMeshes, true)
    let isVisible = false
    if (intersects.length > 0) {
      const firstHit = intersects[0]
      if (
        firstHit.object === pillar ||
        (pillar instanceof THREE.Group &&
          pillar.children.includes(firstHit.object))
      ) {
        isVisible = true
      } else if (
        Math.abs(firstHit.distance - distanceToPillar) <
        (pillar.userData.radius || 0.5) * 1.5
      ) {
        isVisible = true
      }
    } else {
      if (distanceToPillar < 5) isVisible = true
    }
    label.visible = isVisible
  }
}

// --- Particle System ---
function initParticleSystem() {
  particleGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const alphas = new Float32Array(MAX_PARTICLES)
  for (let i = 0; i < MAX_PARTICLES; i++) {
    positions[i * 3 + 1] = -10000
    alphas[i] = 0.0
    particles.push({
      active: false,
      velocity: new THREE.Vector3(),
      life: 0,
      initialLife: 2.0,
    })
  }
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  )
  particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
  particleMaterial = new THREE.ShaderMaterial({
    uniforms: { pointTexture: { value: createParticleTexture() } },
    vertexShader: `attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_PointSize = 10.0 * ( 300.0 / -mvPosition.z ); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `uniform sampler2D pointTexture; varying float vAlpha; void main() { vec4 texColor = texture2D( pointTexture, gl_PointCoord ); if (texColor.a < 0.1) discard; gl_FragColor = vec4( texColor.rgb, texColor.a * vAlpha ); }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: false,
  })
  particleSystem = new THREE.Points(particleGeometry, particleMaterial)
  scene.add(particleSystem)
}
function createParticleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,224,180,0.9)')
  gradient.addColorStop(0.5, 'rgba(255,200,100,0.5)')
  gradient.addColorStop(1, 'rgba(255,150,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}
function triggerParticleEffect(position) {
  let particlesSpawned = 0
  const positions = particleGeometry.attributes.position.array
  const alphas = particleGeometry.attributes.alpha.array
  let needsPosUpdate = false,
    needsAlphaUpdate = false
  for (
    let i = 0;
    i < MAX_PARTICLES && particlesSpawned < PARTICLES_PER_EFFECT;
    i++
  ) {
    if (!particles[i].active) {
      particles[i].active = true
      particles[i].initialLife = 1.8 + Math.random() * 0.7
      particles[i].life = particles[i].initialLife
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z
      alphas[i] = 1.0
      particles[i].velocity.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 3,
        (Math.random() - 0.5) * 6,
      )
      particlesSpawned++
      needsPosUpdate = true
      needsAlphaUpdate = true
    }
  }
  if (needsPosUpdate) particleGeometry.attributes.position.needsUpdate = true
  if (needsAlphaUpdate) particleGeometry.attributes.alpha.needsUpdate = true
}
function updateParticles(deltaTime) {
  const gravity = new THREE.Vector3(0, -9.8, 0)
  let needsPosUpdate = false,
    needsAlphaUpdate = false
  const positions = particleGeometry.attributes.position.array
  const alphas = particleGeometry.attributes.alpha.array
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (particles[i].active) {
      particles[i].life -= deltaTime
      if (particles[i].life <= 0) {
        particles[i].active = false
        if (alphas[i] > 0) {
          alphas[i] = 0.0
          needsAlphaUpdate = true
        }
      } else {
        particles[i].velocity.addScaledVector(gravity, deltaTime)
        positions[i * 3] += particles[i].velocity.x * deltaTime
        positions[i * 3 + 1] += particles[i].velocity.y * deltaTime
        positions[i * 3 + 2] += particles[i].velocity.z * deltaTime
        alphas[i] = Math.max(
          0,
          Math.min(1, particles[i].life / particles[i].initialLife),
        )
        needsPosUpdate = true
        needsAlphaUpdate = true
      }
    }
  }
  if (needsPosUpdate) particleGeometry.attributes.position.needsUpdate = true
  if (needsAlphaUpdate) particleGeometry.attributes.alpha.needsUpdate = true
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  controls.addEventListener('lock', () => {
    if (isGameOver) return
    instructionsOverlay.style.display = 'none'
    crosshair.style.display = 'block'
    isPaused = false
    if (!gameActive && !timerInterval) {
      startGame()
    }
    gameActive = true
  })
  controls.addEventListener('unlock', () => {
    if (isGameOver) return
    gameActive = false
    isPaused = true
    crosshair.style.display = 'none'
    instructionsOverlay.style.display = 'flex'
    instructionsBox.querySelector('h1').textContent = 'Game Paused'
    instructionsBox.querySelector(
      'p:not(.keybinds):not(.click-to-play)',
    ).textContent = 'Destroy all 10 Red Cylinders before time runs out!'
    instructionsBox.querySelector('.click-to-play').textContent =
      'Click anywhere to Resume'
    instructionsBox.querySelector('.click-to-play').style.display = 'block'
    gameEndMessage.style.display = 'none'
    moveState.forward = 0
    moveState.right = 0
  })
  instructionsOverlay.addEventListener('click', () => {
    if (!isGameOver) {
      controls.lock()
    }
  })
  document.addEventListener('pointerdown', (event) => {
    if (
      controls.isLocked &&
      event.isPrimary &&
      gameActive &&
      !isGameOver &&
      !isPaused
    ) {
      shoot()
    }
  })
}

// --- Game Logic ---
function startGame() {
  console.log('Starting game')
  isGameOver = false
  isPaused = false
  gameActive = true
  timeLeft = 300
  bullets = 20
  destroyedTargets = 0
  updateUI()
  clearInterval(timerInterval)
  timerInterval = null
  timerInterval = setInterval(() => {
    if (!gameActive || isGameOver || isPaused) return
    timeLeft--
    updateUI()
    if (timeLeft <= 0) {
      timeLeft = 0
      updateUI()
      endGame(false)
    }
  }, 1000)
}

function shoot() {
  if (bullets <= 0) return
  bullets--
  updateUI()

  // Trigger Gun Effects
  if (muzzleFlash) {
    muzzleFlash.visible = true
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2
    setTimeout(() => {
      if (muzzleFlash) muzzleFlash.visible = false
    }, 60)
  }
  isRecoiling = true
  if (gunGroup) {
    gunGroup.position.z += RECOIL_AMOUNT
  }

  shootRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  const intersects = shootRaycaster.intersectObjects(redPillars, false)

  if (intersects.length > 0) {
    const hitObject = intersects[0].object
    if (hitObject.isTarget && hitObject.visible) {
      hitObject.visible = false
      scene.remove(hitObject)
      const pillarIndex = redPillars.findIndex((p) => p === hitObject)
      if (pillarIndex > -1) redPillars.splice(pillarIndex, 1)
      const gameObjIndex = gameObjects.findIndex((p) => p === hitObject)
      if (gameObjIndex > -1) gameObjects.splice(gameObjIndex, 1)
      const labelInfo = pillarLabels[hitObject.uuid]
      if (labelInfo && labelInfo.label) {
        scene.remove(labelInfo.label)
      }
      delete pillarLabels[hitObject.uuid]
      triggerParticleEffect(intersects[0].point)
      destroyedTargets++
      updateUI()
      triggerScreenFlash() // Target Hit Feedback
      // console.log("SOUND: Target Hit!");
      if (destroyedTargets === totalTargets) {
        endGame(true)
      }
    }
  } else {
    // Optional miss effect
  }
}

function triggerScreenFlash() {
  if (!screenFlashElement) return
  screenFlashElement.classList.add('active')
  setTimeout(() => {
    screenFlashElement.classList.remove('active')
  }, 100)
}

// --- Player Movement & Collision ---
function updatePlayerMovement(deltaTime) {
  if (!controls.isLocked || !gameActive || isGameOver || isPaused) return
  const speed = PLAYER_SPEED * deltaTime
  const cameraObject = controls.getObject()
  const moveDirection = new THREE.Vector3(moveState.right, 0, moveState.forward)
  moveDirection.normalize()
  moveDirection.multiplyScalar(speed)
  moveDirection.applyQuaternion(cameraObject.quaternion)
  const intendedPosition = cameraObject.position.clone().add(moveDirection)
  intendedPosition.y = PLAYER_HEIGHT
  const currentPosition = cameraObject.position
  const collisionCheckRadius = 5
  for (const obj of gameObjects) {
    if (!obj.visible || !obj.userData.radius) continue
    const objPosition = obj.position
    const distToObjXZSq =
      (currentPosition.x - objPosition.x) ** 2 +
      (currentPosition.z - objPosition.z) ** 2
    if (distToObjXZSq > (collisionCheckRadius + obj.userData.radius) ** 2) {
      continue
    }
    const collisionRadius = (obj.userData.radius || 0.5) + PLAYER_RADIUS
    const intendedDistXZSq =
      (intendedPosition.x - objPosition.x) ** 2 +
      (intendedPosition.z - objPosition.z) ** 2
    if (intendedDistXZSq < collisionRadius * collisionRadius) {
      const intendedDistXZ = Math.sqrt(intendedDistXZSq)
      const penetrationDepth = collisionRadius - intendedDistXZ
      const pushDirection = new THREE.Vector3(
        intendedPosition.x - objPosition.x,
        0,
        intendedPosition.z - objPosition.z,
      )
      pushDirection.normalize()
      pushDirection.multiplyScalar(penetrationDepth * 1.01)
      intendedPosition.add(pushDirection)
      intendedPosition.y = PLAYER_HEIGHT
    }
  }
  cameraObject.position.copy(intendedPosition)
}

// --- End Game Logic ---
function endGame(isWin) {
  if (isGameOver) return
  isGameOver = true
  gameActive = false
  isPaused = false
  clearInterval(timerInterval)
  timerInterval = null
  if (controls.isLocked) {
    controls.unlock()
  }
  instructionsOverlay.style.display = 'flex'
  crosshair.style.display = 'none'
  let title = '',
    message = ''
  if (isWin) {
    title = 'Victory!'
    message = `You destroyed all ${totalTargets} targets!`
  } else {
    if (timeLeft <= 0) {
      title = "Time's Up!"
      message = 'You ran out of time. Better luck next round!'
    } else {
      title = 'Game Over'
      message = 'You ended the game.'
    }
  }
  instructionsBox.querySelector('h1').textContent = title
  /* Update h1 */ instructionsBox.querySelector(
    'p:not(.keybinds):not(.click-to-play)',
  ).textContent = message
  gameEndMessage.textContent = 'Refresh the page to play again.'
  gameEndMessage.style.display = 'block'
  instructionsBox.querySelector('.click-to-play').style.display = 'none'
}

// --- Input Handling ---
function onKeyDown(event) {
  if (event.key === 'Escape') {
    if (!isGameOver) {
      if (controls.isLocked) {
        controls.unlock()
      } else if (isPaused) {
        controls.lock()
      }
    }
    return
  }
  if (!controls.isLocked || !gameActive || isGameOver || isPaused) return
  switch (event.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      moveState.forward = -1
      break
    case 's':
    case 'arrowdown':
      moveState.forward = 1
      break
    case 'a':
    case 'arrowleft':
      moveState.right = -1
      break
    case 'd':
    case 'arrowright':
      moveState.right = 1
      break
  }
}
function onKeyUp(event) {
  switch (event.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      if (moveState.forward < 0) moveState.forward = 0
      break
    case 's':
    case 'arrowdown':
      if (moveState.forward > 0) moveState.forward = 0
      break
    case 'a':
    case 'arrowleft':
      if (moveState.right < 0) moveState.right = 0
      break
    case 'd':
    case 'arrowright':
      if (moveState.right > 0) moveState.right = 0
      break
  }
}

// --- UI Update ---
function updateUI() {
  bulletsUI.textContent = bullets
  targetsUI.textContent = `${destroyedTargets}/${totalTargets}`
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  timerUI.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// --- Window Resize ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate)
  const deltaTime = Math.min(clock.getDelta(), 0.1)

  if (!isGameOver && gameActive && !isPaused) {
    updatePlayerMovement(deltaTime)
    updateParticles(deltaTime)
    updateLabelVisibility(deltaTime)

    // Gun Recoil Recovery
    if (isRecoiling && gunGroup) {
      gunGroup.position.lerp(
        originalGunPosition,
        deltaTime * RECOIL_RECOVERY_SPEED,
      )
      // Check if recoil is almost finished using a small threshold
      if (gunGroup.position.distanceToSquared(originalGunPosition) < 0.00001) {
        gunGroup.position.copy(originalGunPosition) // Snap to final position
        isRecoiling = false
      }
    }
  } else if (isRecoiling && gunGroup) {
    // Snap back instantly if paused/game over during recoil
    gunGroup.position.copy(originalGunPosition)
    isRecoiling = false
  }

  renderer.render(scene, camera)
}

// --- Start the Application ---
init()
