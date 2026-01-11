/**
 * Tests for ParameterManager
 */

import { ParameterManager, Easing } from '../ParameterManager';
import { ShaderParameter } from '../SlangShaderCompiler';

describe('ParameterManager', () => {
  const testParameters: ShaderParameter[] = [
    {
      name: 'brightness',
      displayName: 'Brightness',
      default: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1
    },
    {
      name: 'contrast',
      displayName: 'Contrast',
      default: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1
    },
    {
      name: 'saturation',
      displayName: 'Saturation',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.05
    }
  ];

  describe('initialization', () => {
    it('should initialize with parameters', () => {
      const manager = new ParameterManager(testParameters);

      expect(manager.getAllParameters()).toHaveLength(3);
      expect(manager.getValue('brightness')).toBe(1.0);
    });

    it('should initialize empty', () => {
      const manager = new ParameterManager();

      expect(manager.getAllParameters()).toHaveLength(0);
    });
  });

  describe('parameter management', () => {
    it('should set and get parameter value', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.5);

      expect(manager.getValue('brightness')).toBe(1.5);
    });

    it('should clamp value to min/max', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 3.0);
      expect(manager.getValue('brightness')).toBe(2.0); // Clamped to max

      manager.setValue('brightness', 0.0);
      expect(manager.getValue('brightness')).toBe(0.5); // Clamped to min
    });

    it('should snap value to step', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.23);
      expect(manager.getValue('brightness')).toBe(1.2); // Snapped to step 0.1
    });

    it('should reset to default', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.5);
      manager.resetToDefault('brightness');

      expect(manager.getValue('brightness')).toBe(1.0);
    });

    it('should reset all to defaults', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.5);
      manager.setValue('contrast', 1.8);
      manager.resetAllToDefaults();

      expect(manager.getValue('brightness')).toBe(1.0);
      expect(manager.getValue('contrast')).toBe(1.0);
    });
  });

  describe('parameter metadata', () => {
    it('should get parameter metadata', () => {
      const manager = new ParameterManager(testParameters);

      const param = manager.getParameter('brightness');

      expect(param).toBeDefined();
      expect(param?.displayName).toBe('Brightness');
      expect(param?.min).toBe(0.5);
      expect(param?.max).toBe(2.0);
    });

    it('should set parameter group', () => {
      const manager = new ParameterManager(testParameters);

      manager.setGroup('brightness', 'Color');
      manager.setGroup('contrast', 'Color');
      manager.setGroup('saturation', 'Color');

      const colorParams = manager.getParametersByGroup('Color');
      expect(colorParams).toHaveLength(3);
    });

    it('should get all groups', () => {
      const manager = new ParameterManager(testParameters);

      manager.setGroup('brightness', 'Color');
      manager.setGroup('contrast', 'Color');

      const groups = manager.getGroups();
      expect(groups).toContain('Color');
    });

    it('should set parameter visibility', () => {
      const manager = new ParameterManager(testParameters);

      manager.setVisible('brightness', false);

      const param = manager.getParameter('brightness');
      expect(param?.visible).toBe(false);
    });
  });

  describe('change callbacks', () => {
    it('should trigger parameter-specific callback', () => {
      const manager = new ParameterManager(testParameters);
      const callback = jest.fn();

      manager.onChange('brightness', callback);
      manager.setValue('brightness', 1.5);

      expect(callback).toHaveBeenCalledWith({
        name: 'brightness',
        value: 1.5,
        previousValue: 1.0
      });
    });

    it('should trigger global callback', () => {
      const manager = new ParameterManager(testParameters);
      const callback = jest.fn();

      manager.onAnyChange(callback);
      manager.setValue('brightness', 1.5);

      expect(callback).toHaveBeenCalledWith({
        name: 'brightness',
        value: 1.5,
        previousValue: 1.0
      });
    });

    it('should unsubscribe callback', () => {
      const manager = new ParameterManager(testParameters);
      const callback = jest.fn();

      const unsubscribe = manager.onChange('brightness', callback);
      unsubscribe();

      manager.setValue('brightness', 1.5);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not trigger callback if value unchanged', () => {
      const manager = new ParameterManager(testParameters);
      const callback = jest.fn();

      manager.onChange('brightness', callback);
      manager.setValue('brightness', 1.0); // Same as default

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('presets', () => {
    it('should save preset', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.5);
      manager.setValue('contrast', 1.3);

      const preset = manager.savePreset('My Preset', 'Custom settings');

      expect(preset.name).toBe('My Preset');
      expect(preset.description).toBe('Custom settings');
      expect(preset.parameters.brightness).toBe(1.5);
      expect(preset.parameters.contrast).toBe(1.3);
    });

    it('should load preset', async () => {
      const manager = new ParameterManager(testParameters);

      const preset = {
        name: 'Test',
        parameters: {
          brightness: 1.5,
          contrast: 1.8
        }
      };

      await manager.loadPreset(preset);

      expect(manager.getValue('brightness')).toBe(1.5);
      expect(manager.getValue('contrast')).toBe(1.8);
    });
  });

  describe('JSON import/export', () => {
    it('should export to JSON', () => {
      const manager = new ParameterManager(testParameters);

      manager.setValue('brightness', 1.5);
      manager.setValue('contrast', 1.3);

      const json = manager.exportJSON();
      const data = JSON.parse(json);

      expect(data.brightness).toBe(1.5);
      expect(data.contrast).toBe(1.3);
    });

    it('should import from JSON', () => {
      const manager = new ParameterManager(testParameters);

      const json = JSON.stringify({
        brightness: 1.7,
        contrast: 1.2
      });

      manager.importJSON(json);

      expect(manager.getValue('brightness')).toBe(1.7);
      expect(manager.getValue('contrast')).toBe(1.2);
    });
  });

  describe('control creation', () => {
    it('should create control object', () => {
      const manager = new ParameterManager(testParameters);

      const control = manager.createControl('brightness');

      expect(control).toBeDefined();
      expect(control?.label).toBe('Brightness');
      expect(control?.value).toBe(1.0);
      expect(control?.min).toBe(0.5);
      expect(control?.max).toBe(2.0);
      expect(control?.step).toBe(0.1);
      expect(typeof control?.onChange).toBe('function');
      expect(typeof control?.reset).toBe('function');
    });

    it('should create all controls', () => {
      const manager = new ParameterManager(testParameters);

      const controls = manager.createAllControls();

      expect(Object.keys(controls)).toHaveLength(3);
      expect(controls.brightness).toBeDefined();
      expect(controls.contrast).toBeDefined();
      expect(controls.saturation).toBeDefined();
    });

    it('should exclude hidden parameters from all controls', () => {
      const manager = new ParameterManager(testParameters);

      manager.setVisible('brightness', false);

      const controls = manager.createAllControls();

      expect(Object.keys(controls)).toHaveLength(2);
      expect(controls.brightness).toBeUndefined();
    });
  });

  describe('interpolation', () => {
    it('should interpolate parameter value', async () => {
      const manager = new ParameterManager(testParameters);

      const promise = manager.interpolate('brightness', 2.0, 100);

      await promise;

      expect(manager.getValue('brightness')).toBe(2.0);
    }, 10000);

    it('should interpolate with easing', async () => {
      const manager = new ParameterManager(testParameters);

      await manager.interpolate('brightness', 2.0, 100, Easing.easeInOutQuad);

      expect(manager.getValue('brightness')).toBe(2.0);
    }, 10000);

    it('should interpolate multiple parameters', async () => {
      const manager = new ParameterManager(testParameters);

      await manager.interpolateMultiple(
        {
          brightness: 2.0,
          contrast: 1.5
        },
        100
      );

      expect(manager.getValue('brightness')).toBe(2.0);
      expect(manager.getValue('contrast')).toBe(1.5);
    }, 10000);
  });

  describe('easing functions', () => {
    it('should have linear easing', () => {
      expect(Easing.linear(0.5)).toBe(0.5);
    });

    it('should have quad easing functions', () => {
      expect(Easing.easeInQuad(0.5)).toBeGreaterThan(0);
      expect(Easing.easeOutQuad(0.5)).toBeGreaterThan(0);
      expect(Easing.easeInOutQuad(0.5)).toBeGreaterThan(0);
    });

    it('should have cubic easing functions', () => {
      expect(Easing.easeInCubic(0.5)).toBeGreaterThan(0);
      expect(Easing.easeOutCubic(0.5)).toBeGreaterThan(0);
      expect(Easing.easeInOutCubic(0.5)).toBeGreaterThan(0);
    });

    it('should have sine easing functions', () => {
      expect(Easing.easeInSine(0.5)).toBeGreaterThan(0);
      expect(Easing.easeOutSine(0.5)).toBeGreaterThan(0);
      expect(Easing.easeInOutSine(0.5)).toBeGreaterThan(0);
    });
  });
});
