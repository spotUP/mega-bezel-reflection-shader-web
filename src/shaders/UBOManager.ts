/**
 * UBO Manager for WebGL 2.0 Uniform Buffer Objects
 *
 * Handles UBO creation, binding, and data updates for better performance
 * and compatibility with RetroArch's UBO approach.
 */

import * as THREE from 'three';

export interface UBOMember {
  name: string;
  type: string; // GLSL type (float, vec4, mat4, int, uint, etc.)
  offset: number; // Byte offset in UBO
  size: number; // Size in bytes
  arraySize?: number; // For arrays
}

export interface UBOInfo {
  name: string;
  binding: number;
  size: number; // Total size in bytes
  members: UBOMember[];
  instanceName?: string; // Instance name (e.g., "global", "params")
}

export interface UBOData {
  [memberName: string]: number | number[] | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | THREE.Matrix4;
}

export class UBOManager {
  private renderer: THREE.WebGLRenderer;
  private ubos: Map<string, WebGLBuffer> = new Map();
  private uboInfos: Map<string, UBOInfo> = new Map();
  private uboData: Map<string, UBOData> = new Map();
  private boundUBOs: Map<string, number> = new Map(); // UBO name -> binding point

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    // Check WebGL 2.0 support
    if (!this.renderer.capabilities.isWebGL2) {
      throw new Error('UBOManager requires WebGL 2.0 support');
    }
  }

  /**
   * Create a UBO from UBO info
   */
  createUBO(uboInfo: UBOInfo): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;

    // Calculate total size with std140 layout rules
    const totalSize = this.calculateUBOSize(uboInfo.members);

    // Create UBO buffer
    const uboBuffer = gl.createBuffer();
    if (!uboBuffer) {
      throw new Error(`Failed to create UBO buffer for ${uboInfo.name}`);
    }

    // Bind and allocate buffer
    gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, totalSize, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // Store UBO info
    this.ubos.set(uboInfo.name, uboBuffer);
    this.uboInfos.set(uboInfo.name, { ...uboInfo, size: totalSize });

    // Initialize with default data
    const defaultData: UBOData = {};
    for (const member of uboInfo.members) {
      defaultData[member.name] = this.getDefaultValueForType(member.type);
    }
    this.uboData.set(uboInfo.name, defaultData);

    console.log(`[UBOManager] Created UBO ${uboInfo.name} with ${totalSize} bytes, binding ${uboInfo.binding}`);
  }

  /**
   * Update UBO member data
   */
  updateUBOData(uboName: string, memberName: string, value: number | number[] | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | THREE.Matrix4): void {
    const uboData = this.uboData.get(uboName);
    if (!uboData) {
      console.warn(`[UBOManager] UBO ${uboName} not found`);
      return;
    }

    uboData[memberName] = value;
  }

  /**
   * Update multiple UBO members at once
   */
  updateUBODataBulk(uboName: string, data: UBOData): void {
    const uboData = this.uboData.get(uboName);
    if (!uboData) {
      console.warn(`[UBOManager] UBO ${uboName} not found`);
      return;
    }

    Object.assign(uboData, data);
  }

  /**
   * Bind UBO to shader program
   */
  bindUBOToProgram(program: WebGLProgram, uboName: string, blockName?: string): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const uboInfo = this.uboInfos.get(uboName);
    const uboBuffer = this.ubos.get(uboName);

    if (!uboInfo || !uboBuffer) {
      console.warn(`[UBOManager] UBO ${uboName} not found`);
      return;
    }

    // Get uniform block index
    const blockIndex = gl.getUniformBlockIndex(program, blockName || uboInfo.instanceName || uboInfo.name);
    if (blockIndex === gl.INVALID_INDEX) {
      console.warn(`[UBOManager] Uniform block ${blockName || uboInfo.instanceName || uboInfo.name} not found in program`);
      return;
    }

    // Bind UBO to binding point
    gl.uniformBlockBinding(program, blockIndex, uboInfo.binding);

    // Bind buffer to binding point
    gl.bindBufferBase(gl.UNIFORM_BUFFER, uboInfo.binding, uboBuffer);

    this.boundUBOs.set(uboName, uboInfo.binding);
  }

  /**
   * Upload UBO data to GPU
   */
  uploadUBOData(uboName: string): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const uboInfo = this.uboInfos.get(uboName);
    const uboBuffer = this.ubos.get(uboName);
    const uboData = this.uboData.get(uboName);

    if (!uboInfo || !uboBuffer || !uboData) {
      return;
    }

    // Prepare data buffer
    const dataBuffer = new ArrayBuffer(uboInfo.size);
    const dataView = new DataView(dataBuffer);

    // Pack data according to std140 layout
    for (const member of uboInfo.members) {
      const value = uboData[member.name];
      if (value !== undefined) {
        this.packMemberData(dataView, member, value);
      }
    }

    // Upload to GPU
    gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, dataBuffer);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }

  /**
   * Get UBO info
   */
  getUBOInfo(uboName: string): UBOInfo | undefined {
    return this.uboInfos.get(uboName);
  }

  /**
   * Get all UBO names
   */
  getAllUBONames(): string[] {
    return Array.from(this.ubos.keys());
  }

  /**
   * Dispose UBO resources
   */
  disposeUBO(uboName: string): void {
    const uboBuffer = this.ubos.get(uboName);
    if (uboBuffer) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      gl.deleteBuffer(uboBuffer);
      this.ubos.delete(uboName);
      this.uboInfos.delete(uboName);
      this.uboData.delete(uboName);
      this.boundUBOs.delete(uboName);
    }
  }

  /**
   * Dispose all UBOs
   */
  dispose(): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    for (const uboBuffer of this.ubos.values()) {
      gl.deleteBuffer(uboBuffer);
    }
    this.ubos.clear();
    this.uboInfos.clear();
    this.uboData.clear();
    this.boundUBOs.clear();
  }

  /**
   * Calculate UBO size with std140 layout rules
   */
  private calculateUBOSize(members: UBOMember[]): number {
    let offset = 0;
    const baseAlignment = 16; // vec4 alignment

    for (const member of members) {
      // Calculate alignment for this type
      const alignment = this.getTypeAlignment(member.type);

      // Align offset
      offset = Math.ceil(offset / alignment) * alignment;

      // Set member offset
      member.offset = offset;

      // Calculate size
      member.size = this.getTypeSize(member.type, member.arraySize);

      // Move to next offset
      offset += member.size;
    }

    // Final size must be multiple of vec4
    return Math.ceil(offset / baseAlignment) * baseAlignment;
  }

  /**
   * Get alignment for GLSL type (std140 rules)
   */
  private getTypeAlignment(type: string): number {
    switch (type) {
      case 'float':
      case 'int':
      case 'uint':
        return 4;
      case 'vec2':
      case 'ivec2':
      case 'uvec2':
        return 8;
      case 'vec3':
      case 'vec4':
      case 'ivec3':
      case 'ivec4':
      case 'uvec3':
      case 'uvec4':
      case 'mat2':
        return 16;
      case 'mat3':
        return 16; // Each column is vec3, but aligned to vec4
      case 'mat4':
        return 16;
      default:
        return 4; // Default to float alignment
    }
  }

  /**
   * Get size for GLSL type (std140 rules)
   */
  private getTypeSize(type: string, arraySize?: number): number {
    let baseSize: number;

    switch (type) {
      case 'float':
      case 'int':
      case 'uint':
        baseSize = 4;
        break;
      case 'vec2':
      case 'ivec2':
      case 'uvec2':
        baseSize = 8;
        break;
      case 'vec3':
      case 'vec4':
      case 'ivec3':
      case 'ivec4':
      case 'uvec3':
      case 'uvec4':
        baseSize = 16;
        break;
      case 'mat2':
        baseSize = 16; // 2 vec4 columns
        break;
      case 'mat3':
        baseSize = 48; // 3 vec4 columns (each vec3 padded to vec4)
        break;
      case 'mat4':
        baseSize = 64; // 4 vec4 columns
        break;
      default:
        baseSize = 4;
    }

    return arraySize ? baseSize * arraySize : baseSize;
  }

  /**
   * Get default value for GLSL type
   */
  private getDefaultValueForType(type: string): number | number[] | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | THREE.Matrix4 {
    switch (type) {
      case 'float':
      case 'int':
      case 'uint':
        return 0;
      case 'vec2':
      case 'ivec2':
      case 'uvec2':
        return new THREE.Vector2(0, 0);
      case 'vec3':
      case 'ivec3':
      case 'uvec3':
        return new THREE.Vector3(0, 0, 0);
      case 'vec4':
      case 'ivec4':
      case 'uvec4':
        return new THREE.Vector4(0, 0, 0, 0);
      case 'mat2':
        return [0, 0, 0, 0];
      case 'mat3':
        return [0, 0, 0, 0, 0, 0, 0, 0, 0];
      case 'mat4':
        return new THREE.Matrix4();
      default:
        return 0;
    }
  }

  /**
   * Pack member data into buffer according to std140 layout
   */
  private packMemberData(dataView: DataView, member: UBOMember, value: any): void {
    const offset = member.offset;

    switch (member.type) {
      case 'float':
        if (typeof value === 'number') {
          dataView.setFloat32(offset, value, true); // Little endian
        }
        break;
      case 'int':
        if (typeof value === 'number') {
          dataView.setInt32(offset, value, true);
        }
        break;
      case 'uint':
        if (typeof value === 'number') {
          dataView.setUint32(offset, value, true);
        }
        break;
      case 'vec2':
        if (value instanceof THREE.Vector2) {
          dataView.setFloat32(offset, value.x, true);
          dataView.setFloat32(offset + 4, value.y, true);
        } else if (Array.isArray(value)) {
          dataView.setFloat32(offset, value[0] || 0, true);
          dataView.setFloat32(offset + 4, value[1] || 0, true);
        }
        break;
      case 'vec3':
        if (value instanceof THREE.Vector3) {
          dataView.setFloat32(offset, value.x, true);
          dataView.setFloat32(offset + 4, value.y, true);
          dataView.setFloat32(offset + 8, value.z, true);
        } else if (Array.isArray(value)) {
          dataView.setFloat32(offset, value[0] || 0, true);
          dataView.setFloat32(offset + 4, value[1] || 0, true);
          dataView.setFloat32(offset + 8, value[2] || 0, true);
        }
        break;
      case 'vec4':
        if (value instanceof THREE.Vector4) {
          dataView.setFloat32(offset, value.x, true);
          dataView.setFloat32(offset + 4, value.y, true);
          dataView.setFloat32(offset + 8, value.z, true);
          dataView.setFloat32(offset + 12, value.w, true);
        } else if (Array.isArray(value)) {
          dataView.setFloat32(offset, value[0] || 0, true);
          dataView.setFloat32(offset + 4, value[1] || 0, true);
          dataView.setFloat32(offset + 8, value[2] || 0, true);
          dataView.setFloat32(offset + 12, value[3] || 0, true);
        }
        break;
      case 'mat4':
        if (value instanceof THREE.Matrix4) {
          const elements = value.elements;
          for (let i = 0; i < 16; i++) {
            dataView.setFloat32(offset + i * 4, elements[i], true);
          }
        } else if (Array.isArray(value)) {
          for (let i = 0; i < Math.min(16, value.length); i++) {
            dataView.setFloat32(offset + i * 4, value[i] || 0, true);
          }
        }
        break;
      // Add more types as needed (mat2, mat3, etc.)
    }
  }
}