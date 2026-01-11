/**
 * Example usage of ParameterManager
 *
 * Demonstrates parameter control, UI integration, presets, and animation
 */

import { ParameterManager, Easing } from '../ParameterManager';
import { SlangPresetParser } from '../SlangPresetParser';
import { MultiPassRenderer } from '../MultiPassRenderer';
import { ShaderParameter } from '../SlangShaderCompiler';
import * as THREE from 'three';

// Example 1: Basic parameter management
function basicParameterManagement() {
  const parameters: ShaderParameter[] = [
    {
      name: 'scanlineIntensity',
      displayName: 'Scanline Intensity',
      default: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.05
    },
    {
      name: 'bloomAmount',
      displayName: 'Bloom Amount',
      default: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01
    }
  ];

  const manager = new ParameterManager(parameters);

  // Get current value
  console.log('Scanline intensity:', manager.getValue('scanlineIntensity'));

  // Set value (automatically clamped and snapped to step)
  manager.setValue('scanlineIntensity', 0.53); // → 0.55 (snapped to 0.05)

  // Reset to default
  manager.resetToDefault('bloomAmount');

  // Reset all
  manager.resetAllToDefaults();

  return manager;
}

// Example 2: Integration with MultiPassRenderer
async function integrateWithRenderer() {
  const renderer = new THREE.WebGLRenderer();

  const preset = SlangPresetParser.parse(`
shaders = 1

shader0 = shaders/crt.slang

parameters = "scanlineIntensity;bloomAmount"
scanlineIntensity = 0.25
bloomAmount = 0.15
`);

  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 800,
    height: 800
  });

  await multipass.loadShaders(async () => '/* shader source */');

  // Get parameters from multipass
  const params = multipass.getAllParameters();

  // Create parameter manager
  const manager = new ParameterManager(
    Array.from(params.entries()).map(([name, value]) => ({
      name,
      displayName: name,
      default: value,
      min: 0,
      max: 1,
      step: 0.01
    }))
  );

  // Link to renderer for automatic updates
  manager.linkRenderer(multipass);

  // Now changing parameters automatically updates the renderer
  manager.setValue('scanlineIntensity', 0.5);
  // → Automatically calls multipass.setParameter('scanlineIntensity', 0.5)

  console.log('Parameter manager linked to MultiPassRenderer');

  return { manager, multipass };
}

// Example 3: Change callbacks for UI updates
function setupChangeCallbacks() {
  const manager = new ParameterManager();

  manager.addParameters([
    {
      name: 'brightness',
      displayName: 'Brightness',
      default: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1
    }
  ]);

  // Parameter-specific callback
  const unsubscribe = manager.onChange('brightness', (event) => {
    console.log(`Brightness changed from ${event.previousValue} to ${event.value}`);

    // Update UI slider
    updateUISlider('brightness', event.value);
  });

  // Global callback (for all parameters)
  manager.onAnyChange((event) => {
    console.log(`Parameter ${event.name} changed to ${event.value}`);

    // Update status display
    updateStatusDisplay(event.name, event.value);
  });

  // Later: unsubscribe
  // unsubscribe();

  return manager;
}

// Example 4: Preset management
function presetManagement() {
  const manager = new ParameterManager();

  manager.addParameters([
    { name: 'brightness', displayName: 'Brightness', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'contrast', displayName: 'Contrast', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'saturation', displayName: 'Saturation', default: 1.0, min: 0.0, max: 2.0, step: 0.05 }
  ]);

  // Configure custom settings
  manager.setValue('brightness', 1.3);
  manager.setValue('contrast', 1.2);
  manager.setValue('saturation', 1.1);

  // Save preset
  const vibrantPreset = manager.savePreset('Vibrant', 'Bright and colorful');
  console.log('Saved preset:', vibrantPreset);

  // Configure different settings
  manager.setValue('brightness', 0.8);
  manager.setValue('contrast', 0.9);
  manager.setValue('saturation', 0.7);

  // Save another preset
  const mutedPreset = manager.savePreset('Muted', 'Low saturation, dark');

  // Load preset (instant)
  manager.loadPreset(vibrantPreset);
  console.log('Loaded vibrant preset');

  // Load preset with animation (500ms)
  manager.loadPreset(mutedPreset, true, 500);
  console.log('Animating to muted preset...');

  return { manager, presets: [vibrantPreset, mutedPreset] };
}

// Example 5: Parameter animation
async function animateParameters() {
  const manager = new ParameterManager();

  manager.addParameters([
    { name: 'intensity', displayName: 'Intensity', default: 0.0, min: 0.0, max: 1.0, step: 0.01 }
  ]);

  // Linear interpolation
  await manager.interpolate('intensity', 1.0, 1000);
  console.log('Intensity reached 1.0');

  // With easing
  await manager.interpolate('intensity', 0.0, 1000, Easing.easeInOutQuad);
  console.log('Intensity eased back to 0.0');

  // Animate multiple parameters
  manager.addParameters([
    { name: 'brightness', displayName: 'Brightness', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'contrast', displayName: 'Contrast', default: 1.0, min: 0.5, max: 2.0, step: 0.1 }
  ]);

  await manager.interpolateMultiple(
    {
      intensity: 0.5,
      brightness: 1.5,
      contrast: 1.3
    },
    2000,
    Easing.easeInOutCubic
  );

  console.log('All parameters animated');

  return manager;
}

// Example 6: UI integration with HTML controls
class ParameterUI {
  private manager: ParameterManager;
  private container: HTMLElement;

  constructor(manager: ParameterManager, containerId: string) {
    this.manager = manager;
    this.container = document.getElementById(containerId)!;

    this.buildUI();
  }

  private buildUI() {
    // Clear container
    this.container.innerHTML = '';

    // Get all parameters
    const parameters = this.manager.getAllParameters();

    // Group parameters
    const groups = this.manager.getGroups();

    if (groups.length > 0) {
      // Render grouped
      groups.forEach(group => {
        this.renderGroup(group);
      });

      // Render ungrouped
      const ungrouped = parameters.filter(p => !p.group && p.visible);
      if (ungrouped.length > 0) {
        this.renderGroup('Other', ungrouped);
      }
    } else {
      // Render all
      this.renderGroup('Parameters', parameters.filter(p => p.visible));
    }

    // Add preset controls
    this.renderPresetControls();
  }

  private renderGroup(groupName: string, params?: any[]) {
    const groupEl = document.createElement('div');
    groupEl.className = 'parameter-group';

    const title = document.createElement('h3');
    title.textContent = groupName;
    groupEl.appendChild(title);

    const parameters = params || this.manager.getParametersByGroup(groupName);

    parameters.forEach(param => {
      const control = this.createSlider(param);
      groupEl.appendChild(control);
    });

    this.container.appendChild(groupEl);
  }

  private createSlider(param: any) {
    const wrapper = document.createElement('div');
    wrapper.className = 'parameter-control';

    // Label
    const label = document.createElement('label');
    label.textContent = param.displayName;
    wrapper.appendChild(label);

    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'parameter-value';
    valueDisplay.textContent = param.value.toFixed(2);
    wrapper.appendChild(valueDisplay);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = param.min.toString();
    slider.max = param.max.toString();
    slider.step = param.step.toString();
    slider.value = param.value.toString();

    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.manager.setValue(param.name, value);
    });

    wrapper.appendChild(slider);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      this.manager.resetToDefault(param.name);
    });
    wrapper.appendChild(resetBtn);

    // Update slider when parameter changes
    this.manager.onChange(param.name, (event) => {
      slider.value = event.value.toString();
      valueDisplay.textContent = event.value.toFixed(2);
    });

    return wrapper;
  }

  private renderPresetControls() {
    const presetEl = document.createElement('div');
    presetEl.className = 'preset-controls';

    const title = document.createElement('h3');
    title.textContent = 'Presets';
    presetEl.appendChild(title);

    // Save preset button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Preset';
    saveBtn.addEventListener('click', () => {
      const name = prompt('Preset name:');
      if (name) {
        const preset = this.manager.savePreset(name);
        console.log('Saved preset:', preset);
        // Save to localStorage
        savePresetToStorage(preset);
      }
    });
    presetEl.appendChild(saveBtn);

    // Load preset button
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load Preset';
    loadBtn.addEventListener('click', () => {
      // Show preset picker
      showPresetPicker((preset) => {
        this.manager.loadPreset(preset, true);
      });
    });
    presetEl.appendChild(loadBtn);

    // Reset all button
    const resetAllBtn = document.createElement('button');
    resetAllBtn.textContent = 'Reset All';
    resetAllBtn.addEventListener('click', () => {
      this.manager.resetAllToDefaults();
    });
    presetEl.appendChild(resetAllBtn);

    this.container.appendChild(presetEl);
  }
}

// Example 7: Parameter grouping
function organizeParameters() {
  const manager = new ParameterManager();

  manager.addParameters([
    { name: 'brightness', displayName: 'Brightness', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'contrast', displayName: 'Contrast', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'saturation', displayName: 'Saturation', default: 1.0, min: 0.0, max: 2.0, step: 0.05 },
    { name: 'scanlineIntensity', displayName: 'Scanline Intensity', default: 0.25, min: 0.0, max: 1.0, step: 0.05 },
    { name: 'curvature', displayName: 'Curvature', default: 0.05, min: 0.0, max: 0.2, step: 0.01 }
  ]);

  // Organize into groups
  manager.setGroup('brightness', 'Color');
  manager.setGroup('contrast', 'Color');
  manager.setGroup('saturation', 'Color');
  manager.setGroup('scanlineIntensity', 'CRT Effect');
  manager.setGroup('curvature', 'CRT Effect');

  // Get parameters by group
  const colorParams = manager.getParametersByGroup('Color');
  console.log('Color parameters:', colorParams.map(p => p.displayName));

  const crtParams = manager.getParametersByGroup('CRT Effect');
  console.log('CRT parameters:', crtParams.map(p => p.displayName));

  return manager;
}

// Example 8: JSON export/import
function jsonExportImport() {
  const manager = new ParameterManager();

  manager.addParameters([
    { name: 'brightness', displayName: 'Brightness', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { name: 'contrast', displayName: 'Contrast', default: 1.0, min: 0.5, max: 2.0, step: 0.1 }
  ]);

  manager.setValue('brightness', 1.5);
  manager.setValue('contrast', 1.3);

  // Export to JSON
  const json = manager.exportJSON();
  console.log('Exported JSON:', json);

  // Save to localStorage
  localStorage.setItem('shader-parameters', json);

  // Import from JSON
  const loadedJson = localStorage.getItem('shader-parameters');
  if (loadedJson) {
    manager.importJSON(loadedJson);
    console.log('Parameters loaded from localStorage');
  }

  return manager;
}

// Helper functions (mock implementations)
function updateUISlider(name: string, value: number) {
  console.log(`Update UI slider ${name} to ${value}`);
}

function updateStatusDisplay(name: string, value: number) {
  console.log(`Status: ${name} = ${value}`);
}

function savePresetToStorage(preset: any) {
  const presets = JSON.parse(localStorage.getItem('shader-presets') || '[]');
  presets.push(preset);
  localStorage.setItem('shader-presets', JSON.stringify(presets));
}

function showPresetPicker(callback: (preset: any) => void) {
  const presets = JSON.parse(localStorage.getItem('shader-presets') || '[]');
  console.log('Available presets:', presets);
  // In real app, show UI picker
  if (presets.length > 0) {
    callback(presets[0]);
  }
}

// Export examples
export {
  basicParameterManagement,
  integrateWithRenderer,
  setupChangeCallbacks,
  presetManagement,
  animateParameters,
  ParameterUI,
  organizeParameters,
  jsonExportImport
};
