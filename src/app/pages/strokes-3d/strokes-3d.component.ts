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

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

      // Camera
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.set(0, 2, 8);
      this.camera.lookAt(0, 0, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap) {
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      container.appendChild(this.renderer.domElement);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 5);
      directionalLight.castShadow = true;
      this.scene.add(directionalLight);

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
    const waterGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.1
    });

    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -1;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  createSwimmer(): void {
    const group = new THREE.Group();

    // Body (torso) - using cylinder geometry instead of capsule
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.3, 0);
    head.castShadow = true;
    group.add(head);

    // Arms - using cylinder geometry
    const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.5, 0.8, 0);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.rotation.y = -Math.PI / 12; // Slight forward angle
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.5, 0.8, 0);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.rotation.y = Math.PI / 12; // Slight forward angle
    rightArm.castShadow = true;
    group.add(rightArm);

    // Legs - using cylinder geometry
    const legGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, -0.3, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, -0.3, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    this.swimmer = {
      group,
      body,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    };
    
    // Store initial head position for butterfly animation
    this.swimmer.headInitialY = 1.3;

    this.scene.add(group);
    this.updateStrokeAnimation('freestyle');
  }

  updateStrokeAnimation(stroke: StrokeType): void {
    if (!this.swimmer) return;

    // Reset positions
    this.swimmer.leftArm.rotation.x = 0;
    this.swimmer.rightArm.rotation.x = 0;
    this.swimmer.leftArm.rotation.z = Math.PI / 6;
    this.swimmer.rightArm.rotation.z = -Math.PI / 6;
    this.swimmer.leftLeg.rotation.x = 0;
    this.swimmer.rightLeg.rotation.x = 0;
    this.swimmer.leftLeg.rotation.z = 0;
    this.swimmer.rightLeg.rotation.z = 0;
    this.swimmer.body.rotation.y = 0;
    this.swimmer.body.rotation.x = 0;
    this.swimmer.head.rotation.x = 0;
    this.swimmer.head.rotation.y = 0;
    // Reset head position
    if (this.swimmer.headInitialY !== undefined) {
      this.swimmer.head.position.y = this.swimmer.headInitialY;
    }

    switch (stroke) {
      case 'freestyle':
        // Freestyle: body slightly rotated, arms alternate
        this.swimmer.body.rotation.x = -0.1; // Slight forward lean
        break;
      case 'backstroke':
        // Backstroke: body rotated 180 degrees, lying on back
        this.swimmer.body.rotation.y = Math.PI;
        this.swimmer.body.rotation.x = 0.1; // Slight backward lean
        this.swimmer.head.rotation.x = 0.2; // Head tilted back
        break;
      case 'breaststroke':
        // Breaststroke: symmetrical position
        this.swimmer.body.rotation.x = -0.05;
        this.swimmer.leftArm.rotation.z = 0.3;
        this.swimmer.rightArm.rotation.z = -0.3;
        break;
      case 'butterfly':
        // Butterfly: body undulates, arms move together
        this.swimmer.body.rotation.x = -0.15;
        break;
    }
  }

  animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (!this.swimmer || !this.water) return;

    this.clock.elapsed += 0.016; // ~60fps

    // Animate water
    if (this.water.geometry.attributes.position) {
      const positions = this.water.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] = Math.sin(this.clock.elapsed * 2 + positions[i] * 0.5) * 0.1;
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
        // Arms: Full windmill motion - one arm up while other is down
        this.swimmer.leftArm.rotation.x = Math.sin(freestylePhase) * 1.4;
        this.swimmer.rightArm.rotation.x = Math.sin(freestylePhase + Math.PI) * 1.4;
        // Arm sweep - forward and backward
        this.swimmer.leftArm.rotation.z = Math.PI / 6 + Math.cos(freestylePhase) * 0.5;
        this.swimmer.rightArm.rotation.z = -Math.PI / 6 + Math.cos(freestylePhase + Math.PI) * 0.5;
        // Flutter kick - fast alternating
        this.swimmer.leftLeg.rotation.x = Math.sin(time * 5) * 0.5;
        this.swimmer.rightLeg.rotation.x = Math.sin(time * 5 + Math.PI) * 0.5;
        // Body rotation for breathing (roll)
        this.swimmer.body.rotation.y = Math.sin(time * 0.8) * 0.4;
        this.swimmer.body.rotation.x = -0.1 + Math.sin(time * 0.3) * 0.05;
        // Head turns for breathing
        this.swimmer.head.rotation.y = Math.sin(time * 0.8) * 0.3;
        break;
        
      case 'backstroke':
        // Backstroke: Alternating arm motion above water, flutter kick
        const backstrokePhase = time * 2.3;
        // Arms: Circular motion above water (negative rotation = backward)
        this.swimmer.leftArm.rotation.x = -Math.sin(backstrokePhase) * 1.2;
        this.swimmer.rightArm.rotation.x = -Math.sin(backstrokePhase + Math.PI) * 1.2;
        // Arms sweep outward and inward
        this.swimmer.leftArm.rotation.z = Math.sin(backstrokePhase) * 0.6;
        this.swimmer.rightArm.rotation.z = -Math.sin(backstrokePhase + Math.PI) * 0.6;
        // Flutter kick - similar to freestyle
        this.swimmer.leftLeg.rotation.x = Math.sin(time * 4.5) * 0.4;
        this.swimmer.rightLeg.rotation.x = Math.sin(time * 4.5 + Math.PI) * 0.4;
        // Body stays relatively flat on back
        this.swimmer.body.rotation.x = 0.1 + Math.sin(time * 0.2) * 0.05;
        this.swimmer.body.rotation.y = Math.PI + Math.sin(time * 0.2) * 0.1;
        // Head stays still looking up
        this.swimmer.head.rotation.x = 0.2;
        break;
        
      case 'breaststroke':
        // Breaststroke: Symmetrical arm pull and frog kick
        const breaststrokePhase = time * 1.6;
        // Arms: Pull phase (outward then inward) - symmetrical
        const pullPhase = Math.sin(breaststrokePhase);
        this.swimmer.leftArm.rotation.x = pullPhase * 0.9;
        this.swimmer.rightArm.rotation.x = pullPhase * 0.9;
        // Arms spread wide then pull together
        this.swimmer.leftArm.rotation.z = 0.6 + pullPhase * 0.5;
        this.swimmer.rightArm.rotation.z = -0.6 - pullPhase * 0.5;
        // Frog kick - legs bend outward then snap together
        const kickPhase = Math.sin(breaststrokePhase);
        this.swimmer.leftLeg.rotation.x = kickPhase * 1.0;
        this.swimmer.rightLeg.rotation.x = kickPhase * 1.0;
        // Legs spread wide (frog position) then snap together
        this.swimmer.leftLeg.rotation.z = kickPhase * 0.5;
        this.swimmer.rightLeg.rotation.z = -kickPhase * 0.5;
        // Body lifts slightly during pull
        this.swimmer.body.rotation.x = -0.05 + pullPhase * 0.1;
        // Head lifts for breathing
        this.swimmer.head.rotation.x = -pullPhase * 0.2;
        break;
        
      case 'butterfly':
        // Butterfly: Simultaneous arm motion, dolphin kick
        const butterflyPhase = time * 2.0;
        // Both arms move together in large circular motion
        const armMotion = Math.sin(butterflyPhase);
        this.swimmer.leftArm.rotation.x = armMotion * 1.6;
        this.swimmer.rightArm.rotation.x = armMotion * 1.6;
        // Arms sweep wide
        this.swimmer.leftArm.rotation.z = armMotion * 0.8;
        this.swimmer.rightArm.rotation.z = -armMotion * 0.8;
        // Dolphin kick - both legs together, two kicks per arm cycle
        const kickMotion = Math.sin(butterflyPhase * 2);
        this.swimmer.leftLeg.rotation.x = kickMotion * 0.8;
        this.swimmer.rightLeg.rotation.x = kickMotion * 0.8;
        // Body undulation (wave motion) - chest down, hips up
        this.swimmer.body.rotation.x = -0.2 + armMotion * 0.3;
        this.swimmer.body.rotation.y = Math.sin(butterflyPhase * 0.8) * 0.2;
        // Head bobs up for breathing during recovery phase
        this.swimmer.head.rotation.x = -armMotion * 0.4;
        if (this.swimmer.headInitialY !== undefined) {
          this.swimmer.head.position.y = this.swimmer.headInitialY + armMotion * 0.1;
        }
        break;
    }

    // Rotate camera around swimmer
    const radius = 8;
    this.camera.position.x = Math.cos(time * 0.2) * radius;
    this.camera.position.z = Math.sin(time * 0.2) * radius;
    this.camera.lookAt(0, 0, 0);

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
