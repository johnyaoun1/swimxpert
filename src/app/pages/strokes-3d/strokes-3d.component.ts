import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';

type StrokeType = 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly';

@Component({
  selector: 'app-strokes-3d',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strokes-3d.component.html',
  styleUrls: ['./strokes-3d.component.scss']
})
export class Strokes3dComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef<HTMLDivElement>;
  
  selectedStroke: StrokeType = 'freestyle';
  strokes: { type: StrokeType; name: string; description: string }[] = [
    { type: 'freestyle', name: 'Freestyle', description: 'Also known as front crawl, the fastest swimming stroke' },
    { type: 'backstroke', name: 'Backstroke', description: 'Swimming on your back with alternating arm movements' },
    { type: 'breaststroke', name: 'Breaststroke', description: 'A symmetrical stroke with frog-like kick' },
    { type: 'butterfly', name: 'Butterfly', description: 'The most challenging stroke with simultaneous arm movements' }
  ];

  private scene: any;
  private camera: any;
  private renderer: any;
  private animationId: number | null = null;
  private swimmer: any;
  private water: any;
  private clock = { elapsed: 0 };

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Use a longer delay to ensure the view is fully initialized and Three.js can be loaded
    setTimeout(() => {
      if (this.canvasContainer?.nativeElement) {
        this.initThreeJS();
      } else {
        console.error('Canvas container not found');
        // Retry after a bit more time
        setTimeout(() => {
          if (this.canvasContainer?.nativeElement) {
            this.initThreeJS();
          }
        }, 200);
      }
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  async initThreeJS(): Promise<void> {
    if (!this.canvasContainer?.nativeElement) {
      console.error('Canvas container not available');
      return;
    }

    try {
      console.log('Initializing Three.js...');
      
      // Three.js is now imported at the top, so it's available directly
      if (!THREE || !THREE.Scene) {
        console.error('Three.js not available');
        this.showFallbackMessage();
        return;
      }
      
      console.log('Three.js is available!', { Scene: THREE.Scene, WebGLRenderer: THREE.WebGLRenderer });

      const container = this.canvasContainer.nativeElement;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      // Clear any existing content
      container.innerHTML = '';

      // Scene with realistic pool background
      this.scene = new THREE.Scene();
      
      // Create gradient sky background (lighter at top, darker at bottom)
      const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
      const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(0x87ceeb) },
          bottomColor: { value: new THREE.Color(0x5ba3d3) }
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.6), 0.0)), 1.0);
          }
        `,
        side: THREE.BackSide
      });
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      this.scene.add(sky);

      // Camera positioned to view swimmer from side/above
      this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      this.camera.position.set(0, 1.5, 6);
      this.camera.lookAt(0, -0.5, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap) {
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      container.appendChild(this.renderer.domElement);

      // Enhanced lighting for realistic pool environment
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(ambientLight);

      // Main directional light (sun)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(5, 15, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -20;
      directionalLight.shadow.camera.right = 20;
      directionalLight.shadow.camera.top = 20;
      directionalLight.shadow.camera.bottom = -20;
      this.scene.add(directionalLight);

      // Additional light for water reflections
      const pointLight = new THREE.PointLight(0x88ccff, 0.5, 30);
      pointLight.position.set(0, 5, 0);
      this.scene.add(pointLight);

      // Hemisphere light for ambient pool lighting
      const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x006994, 0.3);
      this.scene.add(hemisphereLight);

      // Create water
      this.createWater();

      // Create swimmer
      this.createSwimmer();

      // Handle resize
      window.addEventListener('resize', () => this.onWindowResize());

      // Start animation
      console.log('Starting animation loop...');
      this.animate();
      console.log('3D scene initialized successfully!');
    } catch (error) {
      console.error('Error initializing Three.js:', error);
      this.showFallbackMessage();
    }
  }

  private showFallbackMessage(): void {
    if (this.canvasContainer?.nativeElement) {
      this.canvasContainer.nativeElement.innerHTML = `
        <div class="text-center p-8 bg-white rounded-lg">
          <div class="text-6xl mb-4">🏊</div>
          <p class="text-gray-700 text-lg mb-2 font-semibold">3D Visualization Error</p>
          <p class="text-gray-600 mb-4">Unable to load 3D visualization. Please check the browser console for errors.</p>
          <p class="text-sm text-gray-500">Make sure Three.js is properly installed: npm install three @types/three</p>
        </div>
      `;
    }
  }

  createWater(): void {
    // Create pool floor with tile pattern
    const floorGeometry = new THREE.PlaneGeometry(30, 20, 10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a4d80,
      roughness: 0.6,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Add pool tile lines
    for (let i = -14; i <= 14; i += 3) {
      const lineGeometry = new THREE.PlaneGeometry(0.1, 20);
      const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x0d3a5f });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i, -1.49, 0);
      this.scene.add(line);
    }
    
    for (let i = -9; i <= 9; i += 3) {
      const lineGeometry = new THREE.PlaneGeometry(30, 0.1);
      const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x0d3a5f });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, -1.49, i);
      this.scene.add(line);
    }

    // Create pool walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a87,
      roughness: 0.6,
      metalness: 0.1
    });
    
    // Back wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 2), wallMaterial);
    backWall.position.set(0, -0.5, -10);
    backWall.receiveShadow = true;
    this.scene.add(backWall);
    
    // Front wall
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 2), wallMaterial);
    frontWall.position.set(0, -0.5, 10);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);
    
    // Left wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 2), wallMaterial);
    leftWall.position.set(-15, -0.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 2), wallMaterial);
    rightWall.position.set(15, -0.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Create lane markers on floor
    for (let i = -2; i <= 2; i++) {
      const laneGeometry = new THREE.PlaneGeometry(0.2, 20);
      const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const lane = new THREE.Mesh(laneGeometry, laneMaterial);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(i * 3, -1.49, 0);
      this.scene.add(lane);
    }

    // Create realistic water surface with more detail and depth
    const waterGeometry = new THREE.PlaneGeometry(30, 20, 128, 128);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.7,
      roughness: 0.05,
      metalness: 0.4,
      emissive: 0x001122,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide
    });

    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -1;
    this.water.receiveShadow = true;
    this.water.castShadow = false;
    this.scene.add(this.water);
    
    // Add water depth layer for more realism
    const waterDepthGeometry = new THREE.PlaneGeometry(30, 20, 32, 32);
    const waterDepthMaterial = new THREE.MeshStandardMaterial({
      color: 0x004d73,
      transparent: true,
      opacity: 0.3,
      roughness: 0.8,
      metalness: 0.1
    });
    const waterDepth = new THREE.Mesh(waterDepthGeometry, waterDepthMaterial);
    waterDepth.rotation.x = -Math.PI / 2;
    waterDepth.position.y = -1.3;
    this.scene.add(waterDepth);
  }

  createSwimmer(): void {
    const group = new THREE.Group();
    
    // Position swimmer horizontally in water (swimming position)
    group.rotation.x = -0.1; // Slight downward angle
    group.position.y = -0.8; // Position in water

    // Realistic skin colors (various tones)
    const skinColor = 0xf4c2a1; // More realistic skin tone
    const skinColorDark = 0xe8b896; // Slightly darker for shadows
    const suitColor = 0x0066cc; // Blue swimsuit

    // Head - more detailed with better proportions
    const headGeometry = new THREE.SphereGeometry(0.22, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: skinColor,
      roughness: 0.8,
      metalness: 0.05
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.25, 0);
    head.castShadow = true;
    group.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.03, 12, 12);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const eyePupilMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    // Left eye
    const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.08, 1.28, 0.18);
    leftEyeWhite.scale.set(1, 0.6, 0.8);
    group.add(leftEyeWhite);
    
    const leftEyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 12), eyePupilMaterial);
    leftEyePupil.position.set(-0.08, 1.28, 0.195);
    group.add(leftEyePupil);
    
    // Right eye
    const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    rightEyeWhite.position.set(0.08, 1.28, 0.18);
    rightEyeWhite.scale.set(1, 0.6, 0.8);
    group.add(rightEyeWhite);
    
    const rightEyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 12), eyePupilMaterial);
    rightEyePupil.position.set(0.08, 1.28, 0.195);
    group.add(rightEyePupil);
    
    // Hair (simplified)
    const hairGeometry = new THREE.SphereGeometry(0.24, 16, 16);
    const hairMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3d2817,
      roughness: 0.9
    });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.set(0, 1.35, -0.05);
    hair.scale.set(1, 0.7, 1.1);
    group.add(hair);

    // Neck
    const neckGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 12);
    const neck = new THREE.Mesh(neckGeometry, headMaterial);
    neck.position.set(0, 1.1, 0);
    neck.castShadow = true;
    group.add(neck);

    // Torso (chest and abdomen) - more realistic proportions
    const torsoGeometry = new THREE.CylinderGeometry(0.28, 0.32, 0.9, 16);
    const torsoMaterial = new THREE.MeshStandardMaterial({ 
      color: suitColor,
      roughness: 0.4,
      metalness: 0.2
    });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.set(0, 0.55, 0);
    torso.castShadow = true;
    group.add(torso);

    // Shoulders - more defined
    const shoulderGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeometry, torsoMaterial);
    leftShoulder.position.set(-0.35, 0.85, 0);
    leftShoulder.castShadow = true;
    group.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeometry, torsoMaterial);
    rightShoulder.position.set(0.35, 0.85, 0);
    rightShoulder.castShadow = true;
    group.add(rightShoulder);

    // Upper arms - more detailed
    const upperArmGeometry = new THREE.CylinderGeometry(0.09, 0.11, 0.4, 12);
    const upperArmMaterial = new THREE.MeshStandardMaterial({ 
      color: skinColor,
      roughness: 0.7
    });
    
    const leftUpperArm = new THREE.Mesh(upperArmGeometry, upperArmMaterial);
    leftUpperArm.position.set(-0.5, 0.7, 0);
    leftUpperArm.rotation.z = Math.PI / 6;
    leftUpperArm.castShadow = true;
    group.add(leftUpperArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeometry, upperArmMaterial);
    rightUpperArm.position.set(0.5, 0.7, 0);
    rightUpperArm.rotation.z = -Math.PI / 6;
    rightUpperArm.castShadow = true;
    group.add(rightUpperArm);

    // Lower arms (forearms)
    const forearmGeometry = new THREE.CylinderGeometry(0.08, 0.09, 0.4, 12);
    
    const leftForearm = new THREE.Mesh(forearmGeometry, upperArmMaterial);
    leftForearm.position.set(-0.65, 0.45, 0);
    leftForearm.rotation.z = Math.PI / 4;
    leftForearm.castShadow = true;
    group.add(leftForearm);

    const rightForearm = new THREE.Mesh(forearmGeometry, upperArmMaterial);
    rightForearm.position.set(0.65, 0.45, 0);
    rightForearm.rotation.z = -Math.PI / 4;
    rightForearm.castShadow = true;
    group.add(rightForearm);

    // Hands - more detailed with fingers
    const handGroupGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.15);
    const handMaterial = new THREE.MeshStandardMaterial({ 
      color: skinColor,
      roughness: 0.8
    });
    
    // Left hand
    const leftHand = new THREE.Mesh(handGroupGeometry, handMaterial);
    leftHand.position.set(-0.75, 0.25, 0);
    leftHand.rotation.z = Math.PI / 12;
    leftHand.castShadow = true;
    group.add(leftHand);
    
    // Left hand fingers (simplified)
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.06, 0.02),
        handMaterial
      );
      finger.position.set(-0.75 + (i - 1.5) * 0.02, 0.19, 0.08);
      finger.castShadow = true;
      group.add(finger);
    }
    
    // Right hand
    const rightHand = new THREE.Mesh(handGroupGeometry, handMaterial);
    rightHand.position.set(0.75, 0.25, 0);
    rightHand.rotation.z = -Math.PI / 12;
    rightHand.castShadow = true;
    group.add(rightHand);
    
    // Right hand fingers
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.06, 0.02),
        handMaterial
      );
      finger.position.set(0.75 + (i - 1.5) * 0.02, 0.19, 0.08);
      finger.castShadow = true;
      group.add(finger);
    }

    // Hips/waist
    const waistGeometry = new THREE.CylinderGeometry(0.25, 0.28, 0.2, 16);
    const waist = new THREE.Mesh(waistGeometry, torsoMaterial);
    waist.position.set(0, 0.1, 0);
    waist.castShadow = true;
    group.add(waist);

    // Upper legs (thighs)
    const thighGeometry = new THREE.CylinderGeometry(0.13, 0.15, 0.5, 12);
    const legMaterial = new THREE.MeshStandardMaterial({ 
      color: suitColor,
      roughness: 0.4,
      metalness: 0.2
    });
    
    const leftThigh = new THREE.Mesh(thighGeometry, legMaterial);
    leftThigh.position.set(-0.18, -0.15, 0);
    leftThigh.castShadow = true;
    group.add(leftThigh);

    const rightThigh = new THREE.Mesh(thighGeometry, legMaterial);
    rightThigh.position.set(0.18, -0.15, 0);
    rightThigh.castShadow = true;
    group.add(rightThigh);

    // Lower legs (shins)
    const shinGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.45, 12);
    
    const leftShin = new THREE.Mesh(shinGeometry, legMaterial);
    leftShin.position.set(-0.18, -0.5, 0);
    leftShin.castShadow = true;
    group.add(leftShin);

    const rightShin = new THREE.Mesh(shinGeometry, legMaterial);
    rightShin.position.set(0.18, -0.5, 0);
    rightShin.castShadow = true;
    group.add(rightShin);

    // Feet - more detailed
    const footGeometry = new THREE.BoxGeometry(0.1, 0.06, 0.22);
    const footMaterial = new THREE.MeshStandardMaterial({ 
      color: skinColor,
      roughness: 0.8
    });
    
    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.18, -0.75, 0.08);
    leftFoot.rotation.x = Math.PI / 12;
    leftFoot.castShadow = true;
    group.add(leftFoot);
    
    // Left toes
    for (let i = 0; i < 5; i++) {
      const toe = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.02, 0.03),
        footMaterial
      );
      toe.position.set(-0.18 + (i - 2) * 0.015, -0.78, 0.18);
      toe.castShadow = true;
      group.add(toe);
    }

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.18, -0.75, 0.08);
    rightFoot.rotation.x = Math.PI / 12;
    rightFoot.castShadow = true;
    group.add(rightFoot);
    
    // Right toes
    for (let i = 0; i < 5; i++) {
      const toe = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.02, 0.03),
        footMaterial
      );
      toe.position.set(0.18 + (i - 2) * 0.015, -0.78, 0.18);
      toe.castShadow = true;
      group.add(toe);
    }

    // Store references for animation
    this.swimmer = {
      group,
      head,
      neck,
      torso,
      leftShoulder,
      rightShoulder,
      leftUpperArm,
      rightUpperArm,
      leftForearm,
      rightForearm,
      leftHand,
      rightHand,
      waist,
      leftThigh,
      rightThigh,
      leftShin,
      rightShin,
      leftFoot,
      rightFoot,
      // Keep old references for backward compatibility
      body: torso,
      leftArm: leftUpperArm,
      rightArm: rightUpperArm,
      leftLeg: leftThigh,
      rightLeg: rightThigh
    };
    
    this.swimmer.headInitialY = 1.25;

    this.scene.add(group);
    this.updateStrokeAnimation('freestyle');
  }

  updateStrokeAnimation(stroke: StrokeType): void {
    if (!this.swimmer) return;

    // Reset all body parts
    const resetRotation = (obj: any) => {
      if (obj) {
        obj.rotation.x = 0;
        obj.rotation.y = 0;
        obj.rotation.z = 0;
      }
    };

    resetRotation(this.swimmer.leftUpperArm);
    resetRotation(this.swimmer.rightUpperArm);
    resetRotation(this.swimmer.leftForearm);
    resetRotation(this.swimmer.rightForearm);
    resetRotation(this.swimmer.leftThigh);
    resetRotation(this.swimmer.rightThigh);
    resetRotation(this.swimmer.leftShin);
    resetRotation(this.swimmer.rightShin);
    resetRotation(this.swimmer.torso);
    resetRotation(this.swimmer.head);
    
    // Reset head position
    if (this.swimmer.headInitialY !== undefined) {
      this.swimmer.head.position.y = this.swimmer.headInitialY;
    }

    switch (stroke) {
      case 'freestyle':
        this.swimmer.torso.rotation.x = -0.1;
        break;
      case 'backstroke':
        this.swimmer.torso.rotation.y = Math.PI;
        this.swimmer.torso.rotation.x = 0.1;
        this.swimmer.head.rotation.x = 0.2;
        break;
      case 'breaststroke':
        this.swimmer.torso.rotation.x = -0.05;
        break;
      case 'butterfly':
        this.swimmer.torso.rotation.x = -0.15;
        break;
    }
  }

  animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (!this.swimmer || !this.water) return;

    this.clock.elapsed += 0.016; // ~60fps

    // Animate water with more realistic wave patterns
    if (this.water && this.water.geometry && this.water.geometry.attributes.position) {
      const positions = this.water.geometry.attributes.position.array as Float32Array;
      const time = this.clock.elapsed;
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        // Create more realistic wave pattern with multiple frequencies
        const wave1 = Math.sin(time * 1.5 + x * 0.3) * 0.08;
        const wave2 = Math.sin(time * 2.5 + y * 0.4) * 0.05;
        const wave3 = Math.sin(time * 3.5 + (x + y) * 0.2) * 0.03;
        positions[i + 2] = wave1 + wave2 + wave3;
      }
      this.water.geometry.attributes.position.needsUpdate = true;
      this.water.geometry.computeVertexNormals();
    }

    // Animate swimmer based on stroke
    const time = this.clock.elapsed;
    switch (this.selectedStroke) {
      case 'freestyle':
        // Freestyle: Alternating windmill arm motion, flutter kick
        const freestylePhase = time * 2.5;
        
        // Upper arms - windmill motion
        this.swimmer.leftUpperArm.rotation.x = Math.sin(freestylePhase) * 1.4;
        this.swimmer.rightUpperArm.rotation.x = Math.sin(freestylePhase + Math.PI) * 1.4;
        this.swimmer.leftUpperArm.rotation.z = Math.PI / 6 + Math.cos(freestylePhase) * 0.5;
        this.swimmer.rightUpperArm.rotation.z = -Math.PI / 6 + Math.cos(freestylePhase + Math.PI) * 0.5;
        
        // Forearms follow upper arms with slight delay
        this.swimmer.leftForearm.rotation.x = Math.sin(freestylePhase + 0.2) * 0.8;
        this.swimmer.rightForearm.rotation.x = Math.sin(freestylePhase + Math.PI + 0.2) * 0.8;
        
        // Flutter kick - fast alternating
        this.swimmer.leftThigh.rotation.x = Math.sin(time * 5) * 0.4;
        this.swimmer.rightThigh.rotation.x = Math.sin(time * 5 + Math.PI) * 0.4;
        this.swimmer.leftShin.rotation.x = Math.sin(time * 5 + 0.1) * 0.3;
        this.swimmer.rightShin.rotation.x = Math.sin(time * 5 + Math.PI + 0.1) * 0.3;
        
        // Body rotation for breathing (roll)
        this.swimmer.torso.rotation.y = Math.sin(time * 0.8) * 0.4;
        this.swimmer.torso.rotation.x = -0.1 + Math.sin(time * 0.3) * 0.05;
        
        // Head turns for breathing
        this.swimmer.head.rotation.y = Math.sin(time * 0.8) * 0.3;
        break;
        
      case 'backstroke':
        // Backstroke: Alternating arm motion above water, flutter kick
        const backstrokePhase = time * 2.3;
        
        // Upper arms - circular motion above water
        this.swimmer.leftUpperArm.rotation.x = -Math.sin(backstrokePhase) * 1.2;
        this.swimmer.rightUpperArm.rotation.x = -Math.sin(backstrokePhase + Math.PI) * 1.2;
        this.swimmer.leftUpperArm.rotation.z = Math.sin(backstrokePhase) * 0.6;
        this.swimmer.rightUpperArm.rotation.z = -Math.sin(backstrokePhase + Math.PI) * 0.6;
        
        // Forearms
        this.swimmer.leftForearm.rotation.x = -Math.sin(backstrokePhase + 0.2) * 0.7;
        this.swimmer.rightForearm.rotation.x = -Math.sin(backstrokePhase + Math.PI + 0.2) * 0.7;
        
        // Flutter kick
        this.swimmer.leftThigh.rotation.x = Math.sin(time * 4.5) * 0.3;
        this.swimmer.rightThigh.rotation.x = Math.sin(time * 4.5 + Math.PI) * 0.3;
        this.swimmer.leftShin.rotation.x = Math.sin(time * 4.5 + 0.1) * 0.25;
        this.swimmer.rightShin.rotation.x = Math.sin(time * 4.5 + Math.PI + 0.1) * 0.25;
        
        // Body stays relatively flat on back
        this.swimmer.torso.rotation.x = 0.1 + Math.sin(time * 0.2) * 0.05;
        this.swimmer.torso.rotation.y = Math.PI + Math.sin(time * 0.2) * 0.1;
        
        // Head stays still looking up
        this.swimmer.head.rotation.x = 0.2;
        break;
        
      case 'breaststroke':
        // Breaststroke: Symmetrical arm pull and frog kick
        const breaststrokePhase = time * 1.6;
        const pullPhase = Math.sin(breaststrokePhase);
        const kickPhase = Math.sin(breaststrokePhase);
        
        // Arms: Pull phase - symmetrical
        this.swimmer.leftUpperArm.rotation.x = pullPhase * 0.9;
        this.swimmer.rightUpperArm.rotation.x = pullPhase * 0.9;
        this.swimmer.leftUpperArm.rotation.z = 0.6 + pullPhase * 0.5;
        this.swimmer.rightUpperArm.rotation.z = -0.6 - pullPhase * 0.5;
        
        // Forearms follow
        this.swimmer.leftForearm.rotation.x = pullPhase * 0.6;
        this.swimmer.rightForearm.rotation.x = pullPhase * 0.6;
        
        // Frog kick - legs bend outward then snap together
        this.swimmer.leftThigh.rotation.x = kickPhase * 0.8;
        this.swimmer.rightThigh.rotation.x = kickPhase * 0.8;
        this.swimmer.leftThigh.rotation.z = kickPhase * 0.5;
        this.swimmer.rightThigh.rotation.z = -kickPhase * 0.5;
        
        // Shins bend
        this.swimmer.leftShin.rotation.x = kickPhase * 0.6;
        this.swimmer.rightShin.rotation.x = kickPhase * 0.6;
        
        // Body stays relatively flat
        this.swimmer.torso.rotation.x = -0.05 + Math.sin(breaststrokePhase) * 0.05;
        break;
        
      case 'butterfly':
        // Butterfly: Simultaneous arm motion, dolphin kick
        const butterflyPhase = time * 2.2;
        
        // Both arms move together
        this.swimmer.leftUpperArm.rotation.x = Math.sin(butterflyPhase) * 1.4;
        this.swimmer.rightUpperArm.rotation.x = Math.sin(butterflyPhase) * 1.4;
        this.swimmer.leftUpperArm.rotation.z = Math.sin(butterflyPhase) * 0.6;
        this.swimmer.rightUpperArm.rotation.z = -Math.sin(butterflyPhase) * 0.6;
        
        // Forearms
        this.swimmer.leftForearm.rotation.x = Math.sin(butterflyPhase + 0.2) * 0.8;
        this.swimmer.rightForearm.rotation.x = Math.sin(butterflyPhase + 0.2) * 0.8;
        
        // Dolphin kick - both legs together
        this.swimmer.leftThigh.rotation.x = Math.sin(butterflyPhase * 2) * 0.5;
        this.swimmer.rightThigh.rotation.x = Math.sin(butterflyPhase * 2) * 0.5;
        this.swimmer.leftShin.rotation.x = Math.sin(butterflyPhase * 2 + 0.1) * 0.4;
        this.swimmer.rightShin.rotation.x = Math.sin(butterflyPhase * 2 + 0.1) * 0.4;
        
        // Body undulation (wave motion)
        this.swimmer.torso.rotation.x = -0.15 + Math.sin(butterflyPhase) * 0.2;
        this.swimmer.torso.rotation.y = Math.sin(butterflyPhase * 0.5) * 0.15;
        
        // Head bobs up for breathing
        this.swimmer.head.rotation.x = Math.sin(butterflyPhase - Math.PI / 4) * 0.3;
        if (this.swimmer.headInitialY !== undefined) {
          this.swimmer.head.position.y = this.swimmer.headInitialY + Math.sin(butterflyPhase - Math.PI / 4) * 0.1;
        }
        break;
    }

    // Rotate camera around swimmer (viewing from side/above, looking at swimmer in water)
    const radius = 7;
    const height = 1.5;
    this.camera.position.x = Math.cos(time * 0.2) * radius;
    this.camera.position.z = Math.sin(time * 0.2) * radius;
    this.camera.position.y = height;
    this.camera.lookAt(0, -0.5, 0); // Look at swimmer in water

    this.renderer.render(this.scene, this.camera);
  };

  onWindowResize(): void {
    if (!this.camera || !this.renderer || !this.canvasContainer) return;
    
    const width = this.canvasContainer.nativeElement.clientWidth;
    const height = this.canvasContainer.nativeElement.clientHeight || 600;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  selectStroke(stroke: StrokeType): void {
    this.selectedStroke = stroke;
    this.updateStrokeAnimation(stroke);
  }

  getStrokeEmoji(type: StrokeType): string {
    const emojis: Record<StrokeType, string> = {
      freestyle: '🏊',
      backstroke: '🏊‍♂️',
      breaststroke: '🐸',
      butterfly: '🦋'
    };
    return emojis[type];
  }

  getCurrentStrokeName(): string {
    return this.strokes.find(s => s.type === this.selectedStroke)?.name || '';
  }

  getCurrentStrokeDescription(): string {
    return this.strokes.find(s => s.type === this.selectedStroke)?.description || '';
  }

  getCurrentStrokeTechniques(): string[] {
    const techniques: Record<StrokeType, string[]> = {
      freestyle: [
        'Keep your body horizontal and streamlined',
        'Alternate arm movements in a windmill pattern',
        'Breathe to the side every 2-3 strokes',
        'Use a flutter kick with relaxed ankles',
        'Rotate your body slightly with each stroke'
      ],
      backstroke: [
        'Lie flat on your back with ears in the water',
        'Alternate arm movements above the water',
        'Keep your head still and look up',
        'Use a flutter kick similar to freestyle',
        'Maintain a steady rhythm and breathing'
      ],
      breaststroke: [
        'Keep your body horizontal in the water',
        'Synchronize arm and leg movements',
        'Pull arms in a circular motion',
        'Use a frog-like kick (whip kick)',
        'Glide after each stroke cycle'
      ],
      butterfly: [
        'Both arms move simultaneously in a circular motion',
        'Use a dolphin kick (both legs together)',
        'Keep your body undulating through the water',
        'Breathe forward when arms are out of water',
        'Maintain strong core strength and rhythm'
      ]
    };
    return techniques[this.selectedStroke] || [];
  }
}
