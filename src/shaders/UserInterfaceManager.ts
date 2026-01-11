/**
 * User Interface Manager for Mega Bezel
 *
 * Provides comprehensive UI controls for:
 * - Real-time parameter adjustment with visual feedback
 * - Preset management and saving/loading
 * - Performance monitoring dashboard
 * - Visual debugging tools and overlays
 * - Parameter categorization and organization
 * - User-friendly control interfaces with tooltips
 * - Keyboard shortcuts and hotkeys
 * - Parameter search and filtering
 * - Undo/redo functionality
 * - Parameter presets and favorites
 */

import { ParameterManager } from './ParameterManager';
import { MegaBezelPresetLoader } from './MegaBezelPresetLoader';

export interface UIParameterControl {
  name: string;
  displayName: string;
  value: number;
  min: number;
  max: number;
  step: number;
  category: string;
  description: string;
  type: 'slider' | 'checkbox' | 'select' | 'color';
  options?: string[]; // For select type
  unit?: string; // %, px, etc.
  advanced?: boolean; // Hidden in simple mode
}

export interface UIDashboardMetrics {
  fps: number;
  frameTime: number;
  gpuMemory: number;
  qualityPreset: string;
  activeEffects: string[];
  performanceStatus: 'good' | 'warning' | 'critical';
}

export interface UICategory {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  parameters: UIParameterControl[];
  collapsed: boolean;
}

export interface UIPreset {
  name: string;
  description: string;
  parameters: Record<string, number>;
  thumbnail?: string;
  created: Date;
  modified: Date;
  favorite: boolean;
}

export class UserInterfaceManager {
  private parameterManager: ParameterManager;
  private presetLoader: MegaBezelPresetLoader;

  // UI State
  private uiVisible: boolean = false;
  private activeCategory: string = 'screen_layout';
  private searchQuery: string = '';
  private showAdvanced: boolean = false;
  private darkMode: boolean = true;

  // UI Elements
  private uiContainer: HTMLDivElement | null = null;
  private dashboard: HTMLDivElement | null = null;
  private parameterPanel: HTMLDivElement | null = null;
  private presetPanel: HTMLDivElement | null = null;

  // Parameter Controls
  private parameterControls: Map<string, UIParameterControl> = new Map();
  private categories: Map<string, UICategory> = new Map();

  // Presets
  private presets: Map<string, UIPreset> = new Map();
  private currentPresetName: string = '';

  // History for undo/redo
  private parameterHistory: Array<Record<string, number>> = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;

  // Keyboard shortcuts
  private shortcuts: Map<string, (event?: KeyboardEvent) => void> = new Map();

  // Performance monitoring
  private metricsUpdateInterval: number | null = null;
  private lastMetricsUpdate: number = 0;

  constructor(
    parameterManager: ParameterManager,
    presetLoader: MegaBezelPresetLoader
  ) {
    this.parameterManager = parameterManager;
    this.presetLoader = presetLoader;

    this.initializeParameterControls();
    this.initializeCategories();
    this.initializePresets();
    this.initializeKeyboardShortcuts();
    this.loadUserPreferences();

    // Auto-save parameter changes
    this.setupAutoSave();
  }

  /**
   * Initialize parameter controls from parameter manager
   */
  private initializeParameterControls(): void {
    const allParameters = this.parameterManager.getAllParameterNames();

    for (const paramName of allParameters) {
      const param = this.parameterManager.getParameter(paramName);
      if (!param) continue;

      const control: UIParameterControl = {
        name: paramName,
        displayName: this.formatDisplayName(paramName),
        value: param.default,
        min: param.min,
        max: param.max,
        step: param.step,
        category: this.determineCategory(paramName),
        description: this.getParameterDescription(paramName),
        type: this.determineControlType(paramName),
        unit: this.getParameterUnit(paramName),
        advanced: this.isAdvancedParameter(paramName)
      };

      this.parameterControls.set(paramName, control);
    }

    console.log(`[UIManager] Initialized ${this.parameterControls.size} parameter controls`);
  }

  /**
   * Initialize parameter categories
   */
  private initializeCategories(): void {
    const categoryDefinitions = [
      {
        name: 'screen_layout',
        displayName: 'Screen Layout',
        description: 'Screen positioning, size, and aspect ratio settings',
        icon: '📺',
        collapsed: false
      },
      {
        name: 'crt_effects',
        displayName: 'CRT Effects',
        description: 'Scanlines, curvature, and classic CRT display effects',
        icon: '📺',
        collapsed: false
      },
      {
        name: 'color_grading',
        displayName: 'Color Grading',
        description: 'Color correction, gamma, and display calibration',
        icon: '🎨',
        collapsed: false
      },
      {
        name: 'bezel_settings',
        displayName: 'Bezel Settings',
        description: 'Bezel graphics, materials, and visual styling',
        icon: '🔲',
        collapsed: false
      },
      {
        name: 'lighting_effects',
        displayName: 'Lighting Effects',
        description: 'Ambient lighting, specular highlights, and reflections',
        icon: '💡',
        collapsed: false
      },
      {
        name: 'temporal_effects',
        displayName: 'Temporal Effects',
        description: 'Motion blur, anti-aliasing, and temporal stability',
        icon: '⏱️',
        collapsed: false
      },
      {
        name: 'performance',
        displayName: 'Performance',
        description: 'Quality settings and performance optimization',
        icon: '⚡',
        collapsed: false
      },
      {
        name: 'advanced',
        displayName: 'Advanced',
        description: 'Expert settings and fine-tuning options',
        icon: '🔧',
        collapsed: true
      }
    ];

    for (const catDef of categoryDefinitions) {
      const parameters = Array.from(this.parameterControls.values())
        .filter(control => control.category === catDef.name);

      this.categories.set(catDef.name, {
        ...catDef,
        parameters
      });
    }

    console.log(`[UIManager] Initialized ${this.categories.size} parameter categories`);
  }

  /**
   * Initialize default presets
   */
  private initializePresets(): void {
    const defaultPresets: UIPreset[] = [
      {
        name: 'Default',
        description: 'Standard Mega Bezel settings',
        parameters: {},
        created: new Date(),
        modified: new Date(),
        favorite: true
      },
      {
        name: 'Retro CRT',
        description: 'Classic CRT monitor appearance',
        parameters: {
          'HSM_CRT_CURVATURE': 1.0,
          'HSM_CRT_ANTI_RINGING': 0.8,
          'HSM_SCANLINE_INTENSITY': 0.3,
          'HSM_SHADOW_MASK': 1.0
        },
        created: new Date(),
        modified: new Date(),
        favorite: true
      },
      {
        name: 'Modern LCD',
        description: 'Clean, modern display appearance',
        parameters: {
          'HSM_CRT_CURVATURE': 0.0,
          'HSM_SCANLINE_INTENSITY': 0.0,
          'HSM_SHADOW_MASK': 0.0,
          'HSM_SHARPNESS': 0.8
        },
        created: new Date(),
        modified: new Date(),
        favorite: false
      },
      {
        name: 'High Contrast',
        description: 'Enhanced contrast and sharpness',
        parameters: {
          'HSM_CONTRAST': 1.2,
          'HSM_SHARPNESS': 1.0,
          'HSM_BLACK_LEVEL': 0.1,
          'HSM_SATURATION': 1.1
        },
        created: new Date(),
        modified: new Date(),
        favorite: false
      }
    ];

    for (const preset of defaultPresets) {
      this.presets.set(preset.name, preset);
    }

    console.log(`[UIManager] Initialized ${this.presets.size} default presets`);
  }

  /**
   * Initialize keyboard shortcuts
   */
  private initializeKeyboardShortcuts(): void {
    this.shortcuts.set('KeyU', () => this.toggleUI());
    this.shortcuts.set('KeyD', () => this.toggleDashboard());
    this.shortcuts.set('KeyP', () => this.togglePresetPanel());
    this.shortcuts.set('KeyS', () => this.saveCurrentPreset());
    this.shortcuts.set('KeyL', () => this.loadPreset('Default'));
    this.shortcuts.set('KeyZ', (e) => { if (e.ctrlKey) this.undo(); });
    this.shortcuts.set('KeyY', (e) => { if (e.ctrlKey) this.redo(); });
    this.shortcuts.set('KeyF', () => this.toggleFullscreen());
    this.shortcuts.set('KeyR', () => this.resetToDefaults());

    // Quality preset shortcuts
    this.shortcuts.set('Digit1', () => this.presetLoader.setQualityPreset('low'));
    this.shortcuts.set('Digit2', () => this.presetLoader.setQualityPreset('medium'));
    this.shortcuts.set('Digit3', () => this.presetLoader.setQualityPreset('high'));
    this.shortcuts.set('Digit4', () => this.presetLoader.setQualityPreset('ultra'));

    console.log(`[UIManager] Initialized ${this.shortcuts.size} keyboard shortcuts`);
  }

  /**
   * Load user preferences from localStorage
   */
  private loadUserPreferences(): void {
    try {
      const prefs = localStorage.getItem('megabezel_ui_prefs');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        this.uiVisible = parsed.uiVisible ?? false;
        this.activeCategory = parsed.activeCategory ?? 'screen_layout';
        this.showAdvanced = parsed.showAdvanced ?? false;
        this.darkMode = parsed.darkMode ?? true;
      }

      // Load custom presets
      const customPresets = localStorage.getItem('megabezel_custom_presets');
      if (customPresets) {
        const parsed = JSON.parse(customPresets);
        for (const [name, preset] of Object.entries(parsed)) {
          this.presets.set(name, preset as UIPreset);
        }
      }
    } catch (error) {
      console.warn('[UIManager] Failed to load user preferences:', error);
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private saveUserPreferences(): void {
    try {
      const prefs = {
        uiVisible: this.uiVisible,
        activeCategory: this.activeCategory,
        showAdvanced: this.showAdvanced,
        darkMode: this.darkMode
      };
      localStorage.setItem('megabezel_ui_prefs', JSON.stringify(prefs));

      // Save custom presets
      const customPresets: Record<string, UIPreset> = {};
      for (const [name, preset] of this.presets) {
        if (!['Default', 'Retro CRT', 'Modern LCD', 'High Contrast'].includes(name)) {
          customPresets[name] = preset;
        }
      }
      localStorage.setItem('megabezel_custom_presets', JSON.stringify(customPresets));
    } catch (error) {
      console.warn('[UIManager] Failed to save user preferences:', error);
    }
  }

  /**
   * Setup auto-save for parameter changes
   */
  private setupAutoSave(): void {
    // Save current state to history for undo/redo
    this.saveToHistory();

    // Auto-save preferences periodically
    setInterval(() => {
      this.saveUserPreferences();
    }, 5000); // Every 5 seconds
  }

  /**
   * Create and show the main UI
   */
  createUI(): void {
    if (this.uiContainer) return;

    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'megabezel-ui';
    this.uiContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      user-select: none;
      pointer-events: none;
    `;

    // Create main panels
    this.createDashboard();
    this.createParameterPanel();
    this.createPresetPanel();

    document.body.appendChild(this.uiContainer);

    // Setup keyboard event listeners
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Initial visibility
    this.updateUIVisibility();

    console.log('[UIManager] UI created and initialized');
  }

  /**
   * Create performance dashboard
   */
  private createDashboard(): void {
    this.dashboard = document.createElement('div');
    this.dashboard.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: ${this.darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
      border: 1px solid ${this.darkMode ? '#444' : '#ccc'};
      border-radius: 8px;
      padding: 15px;
      min-width: 300px;
      color: ${this.darkMode ? '#fff' : '#000'};
      backdrop-filter: blur(10px);
      pointer-events: auto;
    `;

    this.dashboard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; font-size: 16px;">🎮 Mega Bezel Dashboard</h3>
        <button id="dashboard-close" style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer;">×</button>
      </div>
      <div id="dashboard-metrics" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <div>FPS: <span id="fps-value">--</span></div>
        <div>Frame Time: <span id="frametime-value">--</span>ms</div>
        <div>GPU Memory: <span id="gpumem-value">--</span>MB</div>
        <div>Quality: <span id="quality-value">--</span></div>
      </div>
      <div style="margin-bottom: 10px;">
        <div style="display: flex; gap: 5px; margin-bottom: 5px;">
          <button id="quality-low" class="quality-btn" data-quality="low">Low</button>
          <button id="quality-medium" class="quality-btn" data-quality="medium">Medium</button>
          <button id="quality-high" class="quality-btn" data-quality="high">High</button>
          <button id="quality-ultra" class="quality-btn" data-quality="ultra">Ultra</button>
        </div>
      </div>
      <div id="dashboard-recommendations" style="font-size: 12px; color: #888;"></div>
    `;

    // Add quality button styles
    const style = document.createElement('style');
    style.textContent = `
      .quality-btn {
        padding: 4px 8px;
        border: 1px solid #666;
        background: #333;
        color: #fff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .quality-btn:hover { background: #555; }
      .quality-btn.active { background: #007bff; border-color: #007bff; }
    `;
    document.head.appendChild(style);

    // Event listeners
    this.dashboard.querySelector('#dashboard-close')?.addEventListener('click', () => {
      this.dashboard!.style.display = 'none';
    });

    // Quality preset buttons
    ['low', 'medium', 'high', 'ultra'].forEach(quality => {
      const btn = this.dashboard.querySelector(`#quality-${quality}`) as HTMLButtonElement;
      btn?.addEventListener('click', () => {
        this.presetLoader.setQualityPreset(quality as any);
        this.updateQualityButtons(quality);
      });
    });

    this.uiContainer!.appendChild(this.dashboard);

    // Start metrics updates
    this.startMetricsUpdates();
  }

  /**
   * Create parameter control panel
   */
  private createParameterPanel(): void {
    this.parameterPanel = document.createElement('div');
    this.parameterPanel.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      bottom: 10px;
      width: 400px;
      background: ${this.darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
      border: 1px solid ${this.darkMode ? '#444' : '#ccc'};
      border-radius: 8px;
      padding: 15px;
      overflow-y: auto;
      color: ${this.darkMode ? '#fff' : '#000'};
      backdrop-filter: blur(10px);
      pointer-events: auto;
    `;

    this.updateParameterPanel();
    this.uiContainer!.appendChild(this.parameterPanel);
  }

  /**
   * Update parameter panel content
   */
  private updateParameterPanel(): void {
    if (!this.parameterPanel) return;

    const searchBox = `<input type="text" id="param-search" placeholder="Search parameters..." style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #666; border-radius: 4px; background: ${this.darkMode ? '#333' : '#fff'}; color: ${this.darkMode ? '#fff' : '#000'};">`;

    const categoryTabs = Array.from(this.categories.values()).map(cat => `
      <button class="category-tab ${this.activeCategory === cat.name ? 'active' : ''}" data-category="${cat.name}">
        ${cat.icon} ${cat.displayName}
      </button>
    `).join('');

    const advancedToggle = `<label style="display: block; margin: 10px 0;"><input type="checkbox" id="show-advanced" ${this.showAdvanced ? 'checked' : ''}> Show Advanced Parameters</label>`;

    const undoRedo = `
      <div style="display: flex; gap: 5px; margin-bottom: 10px;">
        <button id="undo-btn" style="padding: 4px 8px; border: 1px solid #666; background: #333; color: #fff; border-radius: 4px; cursor: pointer;">↶ Undo</button>
        <button id="redo-btn" style="padding: 4px 8px; border: 1px solid #666; background: #333; color: #fff; border-radius: 4px; cursor: pointer;">↷ Redo</button>
        <button id="reset-btn" style="padding: 4px 8px; border: 1px solid #666; background: #333; color: #fff; border-radius: 4px; cursor: pointer;">🔄 Reset</button>
      </div>
    `;

    this.parameterPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 16px;">⚙️ Parameters</h3>
        <button id="params-close" style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer;">×</button>
      </div>
      ${searchBox}
      ${undoRedo}
      ${advancedToggle}
      <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 15px;">
        ${categoryTabs}
      </div>
      <div id="parameter-controls" style="max-height: calc(100% - 200px); overflow-y: auto;">
        ${this.renderParameterControls()}
      </div>
    `;

    // Event listeners
    this.parameterPanel.querySelector('#param-search')?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.updateParameterPanel();
    });

    this.parameterPanel.querySelector('#show-advanced')?.addEventListener('change', (e) => {
      this.showAdvanced = (e.target as HTMLInputElement).checked;
      this.updateParameterPanel();
    });

    this.parameterPanel.querySelector('#params-close')?.addEventListener('click', () => {
      this.parameterPanel!.style.display = 'none';
    });

    this.parameterPanel.querySelector('#undo-btn')?.addEventListener('click', () => this.undo());
    this.parameterPanel.querySelector('#redo-btn')?.addEventListener('click', () => this.redo());
    this.parameterPanel.querySelector('#reset-btn')?.addEventListener('click', () => this.resetToDefaults());

    // Category tabs
    this.parameterPanel.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = (e.target as HTMLElement).dataset.category!;
        this.activeCategory = category;
        this.updateParameterPanel();
      });
    });

    // Parameter controls
    this.setupParameterControlListeners();
  }

  /**
   * Render parameter controls for current category
   */
  private renderParameterControls(): string {
    const category = this.categories.get(this.activeCategory);
    if (!category) return '';

    const filteredParams = category.parameters.filter(param => {
      if (!this.showAdvanced && param.advanced) return false;
      if (this.searchQuery && !param.displayName.toLowerCase().includes(this.searchQuery.toLowerCase())) return false;
      return true;
    });

    return filteredParams.map(param => this.renderParameterControl(param)).join('');
  }

  /**
   * Render individual parameter control
   */
  private renderParameterControl(param: UIParameterControl): string {
    const value = this.parameterManager.getValue(param.name) ?? param.value;
    const percentage = ((value - param.min) / (param.max - param.min)) * 100;

    return `
      <div class="param-control" style="margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 6px; background: ${this.darkMode ? '#222' : '#f9f9f9'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <label style="font-weight: bold; font-size: 13px;" title="${param.description}">${param.displayName}</label>
          <span style="font-size: 12px; color: #888;">${value.toFixed(3)}${param.unit || ''}</span>
        </div>
        <input type="range" class="param-slider" data-param="${param.name}"
               min="${param.min}" max="${param.max}" step="${param.step}" value="${value}"
               style="width: 100%; margin: 5px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
          <span>${param.min}</span>
          <span>${param.max}</span>
        </div>
      </div>
    `;
  }

  /**
   * Setup parameter control event listeners
   */
  private setupParameterControlListeners(): void {
    this.parameterPanel!.querySelectorAll('.param-slider').forEach(slider => {
      const paramName = slider.getAttribute('data-param')!;
      const input = slider as HTMLInputElement;

      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        this.setParameterValue(paramName, value);
      });

      input.addEventListener('change', () => {
        this.saveToHistory();
      });
    });
  }

  /**
   * Create preset management panel
   */
  private createPresetPanel(): void {
    this.presetPanel = document.createElement('div');
    this.presetPanel.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${this.darkMode ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      border: 1px solid ${this.darkMode ? '#444' : '#ccc'};
      border-radius: 8px;
      padding: 20px;
      min-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      color: ${this.darkMode ? '#fff' : '#000'};
      backdrop-filter: blur(10px);
      pointer-events: auto;
    `;

    this.updatePresetPanel();
    this.uiContainer!.appendChild(this.presetPanel);
  }

  /**
   * Update preset panel content
   */
  private updatePresetPanel(): void {
    if (!this.presetPanel) return;

    const presetList = Array.from(this.presets.values()).map(preset => `
      <div class="preset-item" data-preset="${preset.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #444; border-radius: 6px; margin-bottom: 8px; background: ${this.darkMode ? '#222' : '#f9f9f9'}; cursor: pointer;">
        <div>
          <div style="font-weight: bold;">${preset.favorite ? '⭐ ' : ''}${preset.name}</div>
          <div style="font-size: 12px; color: #888;">${preset.description}</div>
        </div>
        <div>
          <button class="load-preset-btn" data-preset="${preset.name}" style="padding: 4px 8px; margin-right: 5px; border: 1px solid #666; background: #007bff; color: #fff; border-radius: 4px; cursor: pointer;">Load</button>
          <button class="delete-preset-btn" data-preset="${preset.name}" style="padding: 4px 8px; border: 1px solid #666; background: #dc3545; color: #fff; border-radius: 4px; cursor: pointer;">Delete</button>
        </div>
      </div>
    `).join('');

    this.presetPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px;">📁 Preset Manager</h3>
        <button id="preset-close" style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer;">×</button>
      </div>
      <div style="margin-bottom: 15px;">
        <input type="text" id="new-preset-name" placeholder="Preset name" style="padding: 8px; margin-right: 10px; border: 1px solid #666; border-radius: 4px; background: ${this.darkMode ? '#333' : '#fff'}; color: ${this.darkMode ? '#fff' : '#000'};">
        <button id="save-preset-btn" style="padding: 8px 15px; border: 1px solid #666; background: #28a745; color: #fff; border-radius: 4px; cursor: pointer;">Save Current</button>
      </div>
      <div id="preset-list">
        ${presetList}
      </div>
    `;

    // Event listeners
    this.presetPanel.querySelector('#preset-close')?.addEventListener('click', () => {
      this.presetPanel!.style.display = 'none';
    });

    this.presetPanel.querySelector('#save-preset-btn')?.addEventListener('click', () => {
      const nameInput = this.presetPanel!.querySelector('#new-preset-name') as HTMLInputElement;
      const name = nameInput.value.trim();
      if (name) {
        this.saveCurrentPreset(name);
        nameInput.value = '';
        this.updatePresetPanel();
      }
    });

    // Preset action buttons
    this.presetPanel.querySelectorAll('.load-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetName = (e.target as HTMLElement).dataset.preset!;
        this.loadPreset(presetName);
      });
    });

    this.presetPanel.querySelectorAll('.delete-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetName = (e.target as HTMLElement).dataset.preset!;
        if (confirm(`Delete preset "${presetName}"?`)) {
          this.deletePreset(presetName);
          this.updatePresetPanel();
        }
      });
    });
  }

  /**
   * Update dashboard metrics
   */
  private updateDashboardMetrics(): void {
    if (!this.dashboard) return;

    const metrics = this.presetLoader.getPerformanceMetrics();
    if (!metrics) return;

    const fpsElement = this.dashboard.querySelector('#fps-value');
    const frameTimeElement = this.dashboard.querySelector('#frametime-value');
    const gpuMemElement = this.dashboard.querySelector('#gpumem-value');
    const qualityElement = this.dashboard.querySelector('#quality-value');
    const recommendationsElement = this.dashboard.querySelector('#dashboard-recommendations');

    if (fpsElement) fpsElement.textContent = metrics.fps.toFixed(1);
    if (frameTimeElement) frameTimeElement.textContent = metrics.frameTime.toFixed(1);
    if (gpuMemElement) gpuMemElement.textContent = Math.round(metrics.gpuMemoryUsage / 1024 / 1024).toString();

    const quality = this.presetLoader.getCurrentQuality();
    if (qualityElement && quality) {
      // Determine quality preset based on current settings
      let preset = 'Custom';
      if (quality.renderScale >= 1.0 && quality.lightingQuality === 'ultra') preset = 'Ultra';
      else if (quality.renderScale >= 0.875 && quality.lightingQuality === 'high') preset = 'High';
      else if (quality.renderScale >= 0.75 && quality.lightingQuality === 'medium') preset = 'Medium';
      else if (quality.renderScale < 0.75) preset = 'Low';
      qualityElement.textContent = preset;
    }

    // Update recommendations
    const recommendations = this.presetLoader.getPerformanceRecommendations();
    if (recommendationsElement) {
      recommendationsElement.innerHTML = recommendations.map(rec => `<div>• ${rec}</div>`).join('');
    }

    // Update FPS color based on performance
    const fpsColor = metrics.fps >= 55 ? '#28a745' : metrics.fps >= 30 ? '#ffc107' : '#dc3545';
    if (fpsElement) (fpsElement as HTMLElement).style.color = fpsColor;
  }

  /**
   * Update quality preset buttons
   */
  private updateQualityButtons(activeQuality: string): void {
    if (!this.dashboard) return;

    ['low', 'medium', 'high', 'ultra'].forEach(quality => {
      const btn = this.dashboard.querySelector(`#quality-${quality}`) as HTMLButtonElement;
      if (btn) {
        btn.classList.toggle('active', quality === activeQuality);
      }
    });
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsUpdates(): void {
    this.metricsUpdateInterval = window.setInterval(() => {
      this.updateDashboardMetrics();
    }, 1000); // Update every second
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const shortcut = this.shortcuts.get(event.code);
    if (shortcut) {
      event.preventDefault();
      shortcut(event);
    }
  }

  /**
   * Toggle main UI visibility
   */
  toggleUI(): void {
    this.uiVisible = !this.uiVisible;
    this.updateUIVisibility();
  }

  /**
   * Toggle dashboard visibility
   */
  toggleDashboard(): void {
    if (this.dashboard) {
      this.dashboard.style.display = this.dashboard.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Toggle preset panel visibility
   */
  togglePresetPanel(): void {
    if (this.presetPanel) {
      this.presetPanel.style.display = this.presetPanel.style.display === 'none' ? 'block' : 'none';
      if (this.presetPanel.style.display === 'block') {
        this.updatePresetPanel();
      }
    }
  }

  /**
   * Update UI visibility
   */
  private updateUIVisibility(): void {
    if (!this.uiContainer) return;

    if (this.uiVisible) {
      this.uiContainer.style.display = 'block';
      this.parameterPanel!.style.display = 'block';
      this.dashboard!.style.display = 'block';
    } else {
      this.uiContainer.style.display = 'none';
    }
  }

  /**
   * Set parameter value with history tracking
   */
  private setParameterValue(name: string, value: number): void {
    this.parameterManager.setValue(name, value);
    this.presetLoader.updateParameter(name, value);

    // Update UI controls
    const control = this.parameterControls.get(name);
    if (control) {
      control.value = value;
    }

    // Update parameter display in UI
    this.updateParameterDisplay(name, value);
  }

  /**
   * Update parameter display in UI
   */
  private updateParameterDisplay(name: string, value: number): void {
    if (!this.parameterPanel) return;

    const paramElement = this.parameterPanel.querySelector(`[data-param="${name}"]`);
    if (paramElement) {
      const valueSpan = paramElement.parentElement?.querySelector('span:last-child');
      if (valueSpan) {
        const control = this.parameterControls.get(name);
        valueSpan.textContent = value.toFixed(3) + (control?.unit || '');
      }
    }
  }

  /**
   * Save current state to history
   */
  private saveToHistory(): void {
    const currentState = this.parameterManager.getAllValues();

    // Remove any history after current index (for when we're not at the end)
    this.parameterHistory = this.parameterHistory.slice(0, this.historyIndex + 1);

    // Add new state
    this.parameterHistory.push({ ...currentState });
    this.historyIndex++;

    // Limit history size
    if (this.parameterHistory.length > this.maxHistorySize) {
      this.parameterHistory.shift();
      this.historyIndex--;
    }
  }

  /**
   * Undo last parameter change
   */
  undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const previousState = this.parameterHistory[this.historyIndex];

      // Apply previous state
      Object.entries(previousState).forEach(([name, value]) => {
        this.setParameterValue(name, value);
      });

      console.log('[UIManager] Undid parameter change');
    }
  }

  /**
   * Redo parameter change
   */
  redo(): void {
    if (this.historyIndex < this.parameterHistory.length - 1) {
      this.historyIndex++;
      const nextState = this.parameterHistory[this.historyIndex];

      // Apply next state
      Object.entries(nextState).forEach(([name, value]) => {
        this.setParameterValue(name, value);
      });

      console.log('[UIManager] Redid parameter change');
    }
  }

  /**
   * Reset all parameters to defaults
   */
  resetToDefaults(): void {
    if (confirm('Reset all parameters to defaults?')) {
      this.presetLoader.resetParameters();
      this.saveToHistory();

      // Update UI
      this.updateParameterPanel();

      console.log('[UIManager] Reset all parameters to defaults');
    }
  }

  /**
   * Save current parameters as preset
   */
  saveCurrentPreset(name?: string): void {
    const presetName = name || `Preset ${Date.now()}`;
    const parameters = this.parameterManager.getAllValues();

    const preset: UIPreset = {
      name: presetName,
      description: `Custom preset created ${new Date().toLocaleString()}`,
      parameters,
      created: new Date(),
      modified: new Date(),
      favorite: false
    };

    this.presets.set(presetName, preset);
    this.currentPresetName = presetName;

    console.log(`[UIManager] Saved preset: ${presetName}`);
  }

  /**
   * Load preset by name
   */
  loadPreset(name: string): void {
    const preset = this.presets.get(name);
    if (!preset) {
      console.warn(`[UIManager] Preset not found: ${name}`);
      return;
    }

    // Apply preset parameters
    Object.entries(preset.parameters).forEach(([paramName, value]) => {
      this.setParameterValue(paramName, value);
    });

    this.currentPresetName = name;
    this.saveToHistory();

    // Update UI
    this.updateParameterPanel();

    console.log(`[UIManager] Loaded preset: ${name}`);
  }

  /**
   * Delete preset
   */
  deletePreset(name: string): void {
    if (this.presets.has(name)) {
      this.presets.delete(name);
      console.log(`[UIManager] Deleted preset: ${name}`);
    }
  }

  /**
   * Toggle fullscreen mode
   */
  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * Helper functions for parameter metadata
   */
  private formatDisplayName(paramName: string): string {
    // Convert HSM_PARAM_NAME to "Param Name"
    return paramName
      .replace(/^HSM_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private determineCategory(paramName: string): string {
    const name = paramName.toLowerCase();

    if (name.includes('position') || name.includes('size') || name.includes('scale') || name.includes('aspect')) {
      return 'screen_layout';
    }
    if (name.includes('crt') || name.includes('scanline') || name.includes('curvature') || name.includes('mask')) {
      return 'crt_effects';
    }
    if (name.includes('color') || name.includes('gamma') || name.includes('contrast') || name.includes('brightness') || name.includes('saturation')) {
      return 'color_grading';
    }
    if (name.includes('bezel') || name.includes('frame') || name.includes('background') || name.includes('border')) {
      return 'bezel_settings';
    }
    if (name.includes('light') || name.includes('specular') || name.includes('reflection') || name.includes('shadow')) {
      return 'lighting_effects';
    }
    if (name.includes('motion') || name.includes('blur') || name.includes('taa') || name.includes('temporal')) {
      return 'temporal_effects';
    }
    if (name.includes('performance') || name.includes('quality') || name.includes('render')) {
      return 'performance';
    }

    return 'advanced';
  }

  private determineControlType(paramName: string): 'slider' | 'checkbox' | 'select' | 'color' {
    const name = paramName.toLowerCase();

    if (name.includes('enabled') || name.includes('on') || name.includes('active')) {
      return 'checkbox';
    }

    return 'slider'; // Default to slider for most parameters
  }

  private getParameterDescription(paramName: string): string {
    // This would ideally come from a parameter definitions file
    // For now, return a generic description
    return `Controls ${this.formatDisplayName(paramName).toLowerCase()}`;
  }

  private getParameterUnit(paramName: string): string | undefined {
    const name = paramName.toLowerCase();

    if (name.includes('scale') || name.includes('size') || name.includes('radius')) {
      return '';
    }
    if (name.includes('angle') || name.includes('rotation')) {
      return '°';
    }
    if (name.includes('intensity') || name.includes('strength') || name.includes('opacity')) {
      return '';
    }

    return undefined;
  }

  private isAdvancedParameter(paramName: string): boolean {
    const name = paramName.toLowerCase();

    // Mark certain parameters as advanced
    return name.includes('debug') ||
           name.includes('test') ||
           name.includes('experimental') ||
           name.includes('fine_tune') ||
           name.startsWith('hs_'); // Hyperspace internal parameters
  }

  /**
   * Get current UI state
   */
  getUIState(): any {
    return {
      visible: this.uiVisible,
      activeCategory: this.activeCategory,
      searchQuery: this.searchQuery,
      showAdvanced: this.showAdvanced,
      darkMode: this.darkMode,
      currentPreset: this.currentPresetName
    };
  }

  /**
   * Dispose of UI resources
   */
  dispose(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }

    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }

    document.removeEventListener('keydown', this.handleKeyDown.bind(this));

    console.log('[UIManager] Disposed');
  }
}