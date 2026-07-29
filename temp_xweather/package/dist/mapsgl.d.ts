
type LengthArray<T, N extends number, R extends T[] = []> = number extends N
	? T[]
	: R['length'] extends N
	? R
	: LengthArray<T, N, [T, ...R]>;

export declare type vec2 = LengthArray<number, 2>;
export declare type vec3 = LengthArray<number, 3>;
export declare type vec4 = LengthArray<number, 4>;
export declare type mat2 = LengthArray<number, 4>;
export declare type mat3 = LengthArray<number, 9>;
export declare type mat4 = LengthArray<number, 16>;
export declare type quat = LengthArray<number, 4>;

declare module mapboxgl {
    export type Map = any;
}
declare module maplibregl {
    export type Map = any;
}
declare module google.maps {
	export type Map = any;
}
declare module L {
    export type Map = any;
}

export declare type RGB = {
    r: number;
    g: number;
    b: number;
    a?: number;
};

export declare type HSL = {
    h: number;
    s: number | string;
    l: number | string;
    a?: number;
};

export declare type HSV = {
    h: number;
    s: number | string;
    v: number | string;
    a?: number;
};

export declare class EventDispatcher {
	on(name: string, callback: (event: Event) => void);
	once(name: string, callback: (event: Event) => void);
	off(name: string, callback: (event: Event) => void);
}

export declare type EncodedTileData = any;
export declare type VectorData = any;

type ImageTileData = HTMLImageElement;

export declare type AnyColorType = string | number | Color;

declare const assert_2: (condition: boolean, message?: string) => void;

export declare interface Bindable {
    bind(target?: GLenum): void;
    unbind(target?: GLenum): void;
}

/**
 * Tests if specific bits are set in a given bitfield and returns true if so, false otherwise.
 */
export declare const bitInBitfield: (flags: GLbitfield, flag: GLbitfield | undefined) => boolean;

export declare enum Blending {
    None = 0,
    Normal = 1,
    Additive = 2,
    Subtractive = 3,
    Multiply = 4
}

export declare interface CameraOpts {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
    bounds?: ViewBounds;
    zoom?: number;
}

declare enum CameraType {
    orthographic = 0,
    perspective = 1
}

export declare const catmullRom: (t: number, p0: number, p1: number, p2: number, p3: number) => number;

export declare class Clock {
    #private;
    constructor(autoStart?: boolean);
    start(): void;
    stop(): void;
    reset(): void;
    getElapsedTime(): number;
    private getDelta;
}

/**
 * A utility class for creating and representing a color.
 */
export declare class Color {
    /**
     * Red channel as a normalized value between 0 and 1. Default is 0.
     */
    r: number;
    /**
     * Green channel value normalized between 0 and 1. Defautl value is 1.
     */
    g: number;
    b: number;
    a: number;
    /**
     * @param r - If arguments `g` and `b` are defined, then the red component of the color. Otherwise, it can be
     * a single hexadecimal triplet, a CSS-style color string, a valid X11 color name or a single number applied to all
     * color components.
     * @param g - The green component of the color.
     * @param b - The blue component of the color.
     * @param a - The alpha component of the color.
     */
    constructor(r?: any, g?: number, b?: number, a?: number);
    fromHex(hex: string | number): Color;
    fromHSL(h: number, s: number | string, l: number | string, a?: number): Color;
    fromHSV(h: number, s: number | string, v: number | string, a?: number): Color;
    setRGB(r: number, g: number, b: number): Color;
    setRGBA(r: number, g: number, b: number, a: number, normalized?: boolean): Color;
    setAlpha(a: number): Color;
    lighter(percent: number): Color;
    darker(percent: number): Color;
    equals(c: Color): boolean;
    toHex(): string;
    toHSL(): HSL;
    toHSV(): HSV;
    toObject(normalized?: boolean): RGB;
    toArray(): number[];
    toVector(): Vector4;
    toString(): string;
}

export declare const createCanvas: ({ width, height, dpi, id, insert }?: any) => HTMLCanvasElement;

export declare const cubicBezier: (t: number, p0: number, p1: number, p2: number, p3: number) => number;

/**
 * Given byte values in range [0..255] returns decoded float value.
 * @param r -
 * @param g -
 * @param b -
 * @param a -
 */
export declare const decodeFloatRGBA: (r: number, g: number, b: number, a: number) => number;

/**
 * Encodes float value into output array
 * @param val - - value to be encode
 * @param out -  - array where encoded value needs to be written.
 * @param writeOffset - - offset in the original array where values should be written.
 */
export declare const encodeFloatRGBA: (val: number, out: Uint8Array, writeOffset: number) => void;

/**
 * Euler angles describe a rotational transformation by rotating an object on its various axes in
 * specified amounts per axis, and a specified axis order. Euler angles consist of three
 * components: roll, pitch and yaw angles.
 * @see https://en.wikipedia.org/wiki/Euler%27s_rotation_theorem
 */
export declare class Euler {

get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get z(): number;
    set z(value: number);
    get order(): number;
    set order(value: number);
    get roll(): number;
    set roll(value: number);
    get pitch(): number;
    set pitch(value: number);
    get yaw(): number;
    set yaw(value: number);
    get value(): vec4;
    get elements(): number;
    constructor(x?: number, y?: number, z?: number, order?: number);
    fromArray(array: number[], offset?: number): Euler;
    toArray(array?: number[], offset?: number): number[];
    fromObject({ x, y, z, order }: {
        x: number;
        y: number;
        z: number;
        order: number;
    }): Euler;
    toObject(): {
        x: number;
        y: number;
        z: number;
        order: number;
    };
    fromRotationMatrix(m: Matrix4, order?: EulerOrder): Euler;
    fromQuaternion(q: Quaternion): Euler;
    toQuaternion(): Quaternion;
    fromVector3(v: Vector3, order?: EulerOrder): Euler;
    toVector3(): Vector3;
    set(x: number, y: number, z: number, order?: EulerOrder): Euler;
    clone(): Euler;
    copy(e: Euler): Euler;
    equals(e: Euler): boolean;

}

/**
 * The order of the Euler angles.
 */
declare enum EulerOrder {
    ZYX = 0,
    YXZ = 1,
    XZY = 2,
    ZXY = 3,
    YZX = 4,
    XYZ = 5,
    RollPitchYaw = 0
}

/**
 * A set of font specifications and character metrics used for laying out text for rendering. This information is
 * automatically generated using the `msdf-bmfont` tool from the `msdf-bmfont-xml` package from a TTF font file:
 * https://github.com/soimy/msdf-bmfont-xml
 */
export declare type FontLayoutSpec = {
    pages: Array<string>;
    chars: Array<TextMetrics_2>;
    info: {
        face: string;
        size: number;
        bold: number;
        italic: number;
        charset: Array<string>;
        unicode: number;
        stretchH: number;
        smooth: number;
        aa: number;
        padding: [number, number, number, number];
        spacing: [number, number];
        outline: number;
    };
    common: {
        lineHeight: number;
        base: number;
        scaleW: number;
        scaleH: number;
        pages: number;
        packed: number;
        alphaChnl: number;
        redChnl: number;
        greenChnl: number;
        blueChnl: number;
    };
    distanceField: {
        fieldType: string;
        distanceRange: number;
    };
    kernings: Array<{
        first: number;
        second: number;
        amount: number;
    }>;
};

export declare class FPSMeter {
    private _frame;
    private _fps;
    private _time;
    private _handle;
    private _timeout;
    private _running;
    get fps(): number;
    get running(): boolean;
    constructor();
    start(duration?: number, callback?: (fps: number) => void): void;
    stop(): void;
    tick(): void;
}

export declare interface FramebufferTarget {
    target?: GLuint;
    buffer?: WebGLFramebuffer;
    width?: number;
    height?: number;
    depth?: boolean;
}

export declare const getGLState: (gl: WebGLContext) => Record<string, any>;

export declare const getPageLoadPromise: () => Promise<any>;

export declare const getPixelRatio: (gl: any) => number;

export declare const getShaderName: (shader: string) => string;

export declare const getShaderTypeName: (gl: any, type: number) => string;

export declare const hash: (str: string) => string;

export declare const isBrowser: boolean;

export declare const isMobile: boolean;

export declare const isNode: boolean;

export declare let isPageLoaded: boolean;

export declare const isPowerOfTwo: (value: number) => boolean;

export declare const isWebGL2: (gl: WebGLContext) => boolean;

export declare interface LoaderCallbacks {
    onLoad?: (data: any) => void;
    onProgress?: (progress: number) => void;
    onError?: (error: any) => void;
}

/**
 * Base class for all matrices.
 */
export declare class Matrix<T> {
    /**
     * The raw value of the matrix.
     * @readonly
     */
    get value(): T;
    /**
     * Assigns the matrix values from an array.
     * @param array - The array to assign the values from.
     * @param offset - An optional offset to start assigning the values at.
     */
    fromArray(array: number[], offset?: number): Matrix<T>;
    /**
     * Returns the matrix as an array. If an array is provided, the values will be set to that array.
     * @param array - An optional array to set the values to.
     * @param offset - An optional offset to start setting the values at.
     * @returns The array representation of the matrix.
     */
    toArray(array?: number[], offset?: number): number[];
}

/**
 * Class representing a 2x2 matrix.
 */
export declare class Matrix2 extends Matrix<mat2> {
    private _value;
    get value(): mat2;
    get elements(): number;
    static get identity(): Matrix2;
    static get zero(): Matrix2;
    fromArray(array: number[], offset?: number): Matrix2;
    toArray(array?: number[], offset?: number): number[];
    clone(): Matrix2;
    copy(m: Matrix2): Matrix2;
    set(m00: number, m10: number, m01: number, m11: number): Matrix2;
    determinant(): number;
    equals(m: Matrix2): boolean;
    identity(): Matrix2;
    invert(): Matrix2;
    inverse(m: Matrix2): Matrix2;
    rotate(radians: number): Matrix2;
    scale(v: Vector2): Matrix2;
    scaleScalar(s: number): Matrix2;
    transpose(): Matrix2;
    multiply(m: Matrix2): Matrix2;
    multiplyScalar(s: number): Matrix2;
    toString(): string;
}

/**
 * Class representing a 3x3 matrix.
 */
export declare class Matrix3 extends Matrix<mat3> {
    private _value;
    get value(): mat3;
    get elements(): number;
    static get identity(): Matrix3;
    static get zero(): Matrix3;
    fromArray(array: number[], offset?: number): Matrix3;
    toArray(array?: number[], offset?: number): number[];
    clone(): Matrix3;
    copy(m: Matrix3): Matrix3;
    set(m00: number, m10: number, m20: number, m01: number, m11: number, m21: number, m02: number, m12: number, m22: number): Matrix3;
    determinant(): number;
    equals(m: Matrix3): boolean;
    getNormalMatrix(m: Matrix4): void;
    identity(): Matrix3;
    invert(): Matrix3;
    inverse(m: Matrix3): Matrix3;
    rotate(radians: number): Matrix3;
    scale(v: Vector2): Matrix3;
    scaleScalar(s: number): Matrix3;
    translate(v: Vector2): Matrix3;
    transpose(): Matrix3;
    multiply(m: Matrix3): Matrix3;
    multiplyScalar(s: number): Matrix3;
    toString(): string;
}

/**
 * Class representing a 4x4 matrix.
 */
export declare class Matrix4 extends Matrix<mat4> {
    private _value;
    get value(): mat4;
    get elements(): number;
    get x(): number;
    get y(): number;
    get z(): number;
    get w(): number;
    static get identity(): Matrix4;
    static get zero(): Matrix4;
    fromArray(array: number[], offset?: number): Matrix4;
    toArray(array?: number[], offset?: number): number[];
    fromRotationX(radians: number): Matrix4;
    fromRotationY(radians: number): Matrix4;
    fromRotationZ(radians: number): Matrix4;
    fromScale(v: Vector3): Matrix4;
    fromTranslation(v: Vector3): Matrix4;
    fromPerspective(fovy: number, aspect: number, near: number, far: number): Matrix4;
    fromOrthogonal(left: number, right: number, top: number, bottom: number, near: number, far: number): Matrix4;
    fromQuaternion(q: Quaternion): Matrix4;
    clone(): Matrix4;
    copy(m: Matrix4): Matrix4;
    determinant(): number;
    equals(m: Matrix4): boolean;
    getColumn(col: number): Vector4;
    setColumn(col: number, v: Vector4): Matrix4;
    getRotation(q?: Quaternion): Quaternion;
    getScale(v?: Vector3): Vector3;
    getTranslation(v?: Vector3): Vector3;
    identity(): Matrix4;
    invert(): Matrix4;
    inverse(m: Matrix4): Matrix4;
    transpose(): Matrix4;
    lookAt(eye: Vector3, center?: Vector3, up?: Vector3): Matrix4;
    multiply(m1: Matrix4, m2?: Matrix4): Matrix4;
    multiplyScalar(s: number): Matrix4;
    premultiply(m: Matrix4): Matrix4;
    rotateX(radians: number): Matrix4;
    rotateY(radians: number): Matrix4;
    rotateZ(radians: number): Matrix4;
    scale(v: Vector3): Matrix4;
    scaleScalar(s: number): Matrix4;
    translate(v: Vector3): Matrix4;
    compose(translation: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4;
    decompose(): {
        rotation: Quaternion;
        scale: Vector3;
        translation: Vector3;
    };
    toString(): string;
}

export declare interface ProgramConfiguration {
    vertexShader: string;
    fragmentShader: string;
    includes?: Record<string, string>;
    defines?: Array<string>;
    uniforms?: Record<string, any>;
    onBeforeCompile?: (shader: {
        vertex: string;
        fragment: string;
    }) => void;
}

export declare class ProjectionMatrix extends Matrix4 {
    frustum(left: number, right: number, top: number, bottom: number, near: number, far: number): ProjectionMatrix;
    orthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): ProjectionMatrix;
    perspective(fovy: number, aspect: number, near: number, far: number): ProjectionMatrix;
    lookAt(eye: Vector3, center?: Vector3, up?: Vector3): ProjectionMatrix;
}

export declare const quadraticBezier: (t: number, p0: number, p1: number, p2: number) => number;

/**
 * Implementation of a quaternion that is used to represent rotations.
 * @see https://en.wikipedia.org/wiki/Quaternion
 * @see https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
 */
export declare class Quaternion {

get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get z(): number;
    set z(value: number);
    get w(): number;
    set w(value: number);
    get value(): quat;
    get elements(): number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    fromArray(array: number[], offset?: number): Quaternion;
    toArray(array?: number[], offset?: number): number[];
    fromObject({ x, y, z, w }: {
        x: number;
        y: number;
        z: number;
        w: number;
    }): Quaternion;
    toObject(): {
        x: number;
        y: number;
    };
    fromAxisAngle(axis: Vector3, radians: number): Quaternion;
    fromEuler(e: Euler): Quaternion;
    fromRotationMatrix(): Quaternion;
    set(x: number, y: number, z: number, w: number): Quaternion;
    length(): number;
    clone(): Quaternion;
    copy(q: Quaternion): Quaternion;
    equals(q: Quaternion): boolean;
    identity(): Quaternion;
    invert(): Quaternion;
    conjugate(): Quaternion;
    normalize(): Quaternion;
    rotateX(radians: number): Quaternion;
    rotateY(radians: number): Quaternion;
    rotateZ(radians: number): Quaternion;
    dot(q: Quaternion): number;
    angleTo(q: Quaternion): number;

}

/**
 * The type of shader.
 */
declare const enum ShaderType {
    VERTEX = "vertex",
    FRAGMENT = "fragment"
}

export declare const sharedFPSMeter: FPSMeter;

export declare type Size = {
    width: number;
    height: number;
};

/**
 * Data that can be used to create a texture.
 */
export declare type TexImage2DData = GLintptr | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | ImageData | ArrayBufferView | ArrayBuffer | undefined;

export declare type TextAlignment = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

/**
 * TextLayout is a helper class for laying out text for rendering. It takes a string of text and font spec
 * information and returns a set of buffers and data for rendering the text.
 *
 * Font specs and MSDF distance field font textures can be generated using the `msdf-bmfont` tool from the
 * `msdf-bmfont-xml` package: https://github.com/soimy/msdf-bmfont-xml
 */
export declare class TextLayout {
    
    /**
     * The font layout spec used for laying out text.
     * @readonly
     */
    get font(): FontLayoutSpec;
    constructor(opts?: Partial<TextLayoutOptions>);
    /**
     * Layout the given text string using the current font configuration and specification.
     * @param text - The text string to layout.
     * @param width - The maximum width of the text box. If the text exceeds this width, it will be wrapped to the
     * next line.
     * @returns The result of performing text layout for the given text string.
     */
    generateLayout(text: string, width?: number): TextLayoutResult;
    
}

/**
 * Layout information for a single character calculated when performing text layout.
 */
export declare type TextLayoutInfo = {
    /**
     * The anchor point for the character in the text box.
     */
    anchor: [number, number];
    /**
     * The offset for the character in the text box.
     */
    offset: [number, number];
    /**
     * The UV coordinates for the character in the font texture atlas.
     */
    uv: [number, number, number, number];
};

/**
 * TextLayoutOptions is a set of options for laying out text for rendering.
 */
export declare type TextLayoutOptions = {
    /**
     * The font layout spec used for laying out text.
     */
    font: FontLayoutSpec;
    /**
     * The maximum width of the text box. If the text exceeds this width, it will be wrapped to the next line.
     */
    width: number;
    /**
     * The font size to use for the text.
     */
    size: number;
    /**
     * The alignment of the text within the text box.
     */
    align: TextAlignment;
    /**
     * The amount of space to add between characters (kerning).
     */
    letterSpacing: number;
    /**
     * The amount of space to add between words (leading).
     */
    lineHeight: number;
    /**
     * The amount of space to add between words.
     */
    wordSpacing: number;
    /**
     * Whether to break words that exceed the width of the text box.
     */
    wordBreak: boolean;
};

/**
 * The result of performing text layout for a string of text.
 */
export declare type TextLayoutResult = {
    /**
     * The original text string.
     */
    text: string;
    buffers: Record<'position' | 'uv' | 'id' | 'index', {
        size: number;
        data: Float32Array;
    }>;
    data: Record<'position' | 'uv' | 'id' | 'index' | 'layout', Array<any>>;
    layout: Array<TextLayoutInfo>;
    /**
     * The number of characters in the text string.
     */
    numChars: number;
    /**
     * The number of lines in the text string.
     */
    numLines: number;
    /**
     * The size of the text box containing the text.
     */
    size: {
        width: number;
        height: number;
    };
};

/**
 * TextMetrics is a set of metrics for a single character in a font layout spec.
 */
export declare type TextMetrics_2 = {
    id: number;
    index: number;
    char: string;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    chnl: number;
    x: number;
    y: number;
    page: number;
};

export declare const throwError: (message: string) => never;

export declare const toColor: (v: any) => Color;

export declare type TypedArray = Float64Array | Float32Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Uint8Array | Int8Array | Uint8ClampedArray;

export declare const uid: (id?: string) => string;

/**
 * Base class for all vectors.
 */
export declare class Vector<T> {
    /**
     * The raw value of the vector.
     * @readonly
     */
    get value(): T;
    /**
     * Assigns the vector values from an array.
     * @param array - The array to assign the values from.
     * @param offset - An optional offset to start assigning the values at.
     */
    fromArray(array: number[], offset?: number): Vector<T>;
    /**
     * Returns the vector as an array. If an array is provided, the values will be set to that array.
     * @param array - An optional array to set the values to.
     * @param offset - An optional offset to start setting the values at.
     * @returns The array representation of the vector.
     */
    toArray(array?: number[], offset?: number): number[];
}

/**
 * Class representing a 2D vector and consisting of an ordered pair of numbers (x, y).
 */
export declare class Vector2 extends Vector<vec2> {
    private _value;
    get value(): vec2;
    get elements(): number;
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    constructor(x?: number, y?: number);
    fromArray(array: number[], offset?: number): Vector2;
    toArray(array?: number[], offset?: number): number[];
    fromObject({ x, y }: {
        x: number;
        y: number;
    }): Vector2;
    toObject(): {
        x: number;
        y: number;
    };
    set(x: number, y: number): Vector2;
    setScalar(v: number): Vector2;
    length(): number;
    angle(): number;
    copy(v: Vector2): Vector2;
    clone(): Vector2;
    add(v: Vector2): Vector2;
    addScalar(s: number): Vector2;
    subtract(v: Vector2): Vector2;
    subtractScalar(s: number): Vector2;
    multiply(v: Vector2): Vector2;
    multiplyScalar(s: number): Vector2;
    divide(v: Vector2): Vector2;
    divideScalar(s: number): Vector2;
    distanceTo(v: Vector2): number;
    dot(v: Vector2): number;
    equals(v: Vector2): boolean;
    lerp(v: Vector2, factor: number): Vector2;
    normalize(): Vector2;
    scale(v: number): Vector2;
    applyMatrix3(m: Matrix3): Vector2;
    applyMatrix4(m: Matrix4): Vector2;
}

/**
 * Class representing a 3D vector and consisting of an ordered triplet of numbers (x, y, z).
 */
export declare class Vector3 extends Vector<vec3> {
    private _value;
    get value(): vec3;
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get z(): number;
    set z(value: number);
    get elements(): number;
    constructor(x?: number, y?: number, z?: number);
    fromArray(array: number[], offset?: number): Vector3;
    toArray(array?: number[], offset?: number): number[];
    fromObject({ x, y, z }: {
        x: number;
        y: number;
        z: number;
    }): Vector3;
    toObject(): {
        x: number;
        y: number;
        z: number;
    };
    set(x: number, y: number, z: number): Vector3;
    setScalar(v: number): Vector3;
    length(): number;
    distanceToSquared(v: Vector3): number;
    angle(): number;
    copy(v: Vector3): Vector3;
    clone(): Vector3;
    add(v: Vector3): Vector3;
    addScalar(s: number): Vector3;
    subtract(v: Vector3): Vector3;
    subtractScalar(s: number): Vector3;
    subVectors(a: Vector3, b: Vector3): Vector3;
    multiply(v: Vector3): Vector3;
    multiplyScalar(s: number): Vector3;
    divide(v: Vector3): Vector3;
    divideScalar(s: number): Vector3;
    distanceTo(v: Vector3): number;
    angleTo(v: Vector3): number;
    dot(v: Vector3): number;
    equals(v: Vector3): boolean;
    lerp(v: Vector3, factor: number): Vector3;
    normalize(): Vector3;
    scale(v: number): Vector3;
    rotateX(angle: number): Vector3;
    rotateY(angle: number): Vector3;
    rotateZ(angle: number): Vector3;
    applyEuler(e: Euler): Vector3;
    applyMatrix3(m: Matrix3): Vector3;
    applyMatrix4(m: Matrix4): Vector3;
    applyQuaternion(q: Quaternion): Vector3;
    negate(): Vector3;
}

/**
 * Class representing a 4D vector and consisting of an ordered quadruplet of numbers (x, y, z, w).
 */
export declare class Vector4 extends Vector<vec4> {
    private _value;
    get value(): vec4;
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get z(): number;
    set z(value: number);
    get w(): number;
    set w(value: number);
    get elements(): number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    fromArray(array: number[], offset?: number): Vector4;
    toArray(array?: number[], offset?: number): number[];
    fromObject({ x, y, z, w }: {
        x: number;
        y: number;
        z: number;
        w: number;
    }): Vector4;
    toObject(): {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    set(x: number, y: number, z: number, w: number): Vector4;
    setScalar(v: number): Vector4;
    length(): number;
    copy(v: Vector4): Vector4;
    clone(): Vector4;
    add(v: Vector4): Vector4;
    addScalar(s: number): Vector4;
    subtract(v: Vector4): Vector4;
    subtractScalar(s: number): Vector4;
    multiply(v: Vector4): Vector4;
    multiplyScalar(s: number): Vector4;
    divide(v: Vector4): Vector4;
    divideScalar(s: number): Vector4;
    distanceTo(v: Vector4): number;
    dot(v: Vector4): number;
    equals(v: Vector4): boolean;
    lerp(v: Vector4, factor: number): Vector4;
    normalize(): Vector4;
    scale(v: number): Vector4;
    applyMatrix4(m: Matrix4): Vector4;
}

export declare interface ViewBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export declare type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext;

/// <reference types="google-maps" />
/// <reference types="google.maps" />
/// <reference types="leaflet" />
/// <reference types="mapbox-gl" />
/// <reference types="maplibre-gl" />

/**
 * An `Account` object is responsible for managing the client id and secret as well as permissions for an Xweather
 * account. It provides methods for creating and configuring API and Map requests using the account credentials.
 */
export declare class Account {
    id: string;
    secret: string;
    servers: {
        api: string;
        maps: string;
        mapsgl?: string;
    };
    
    constructor(id: string, secret: string, serverOverrides?: Partial<AerisServers>);
    /**
     * Returns the client id and secret for the account.
     */
    credentials(): {
        id: string;
        secret: string;
    };
    
    /**
     * Returns a Boolean value indicating if the account has access to the specified endpoint or destination.
     * @param endpoint - The endpoint or destination to check access for.
     * @returns `true` if the account has access, otherwise `false`.
     */
    canAccess(endpoint: string): boolean;
    /**
     * Creates and returns a new ApiRequest configured for the account.
     * @returns A new ApiRequest object.
     */
    api(config?: ApiConfig): ApiRequest;
    /**
     * Creates and returns a new MapRequest configured for the account.
     * @returns A new MapRequest object.
     */
    map(config?: ApiConfig): MapRequest;
}

export declare type AerisServers = {
    api: string;
    maps: string;
};

/**
 * An object that manages the playback of a single animation.
 * @remarks
 * Animations can be played, paused, resumed, stopped, and restarted. A single animation can be added to a parent
 * {@link Timeline} object, which will control the playback of the animation. If an animation is not added to a
 * timeline, it will control its own playback via an internal render loop.
 */
export declare class Animation extends EventDispatcher {
    /**
     * The parent timeline that this animation belongs to, if any.
     */
    timeline: Timeline;
    private _config;
    private _state;
    private _active;
    private _enabled;
    private _elapsed;
    private _clampedRange;
    private _lastElapsed;
    private _startPosition;
    /**
     * The unique identifier for this animation.
     * @readonly
     */
    get id(): string;
    /**
     * The configuration options for this animation.
     * @readonly
     */
    get config(): State<AnimationOptions>;
    /**
     * The current state of this animation.
     * @readonly
     */
    get state(): AnimationState;
    /**
     * Whether this animation is enabled or not. If disabled, the animation will not play even if it is added to a
     * timeline.
     * @readonly
     */
    get enabled(): boolean;
    /**
     * The duration of this animation, in seconds.
     */
    get duration(): number;
    set duration(value: number);
    /**
     * The delay before this animation starts, in seconds.
     */
    get delay(): number;
    set delay(value: number);
    /**
     * The delay after this animation ends, in seconds.
     */
    get endDelay(): number;
    set endDelay(value: number);
    /**
     * Factor used to scale the time of the animation where a value of 1 is normal speed, 0.5 is half speed, and 2 is
     * double speed, etc. Only positive values are allowed.
     * @remarks
     * This value is used to scale the elapsed time of the animation, effectively slowing down or speeding up the
     * animation relative to its duration. For example, if an animation duration is `2` seconds and the time scale is
     * `0.5`, the animation will take `4` seconds to complete.
     */
    get timeScale(): number;
    set timeScale(value: number);
    /**
     * The total duration of this animation, including the delay and end delay.
     * @readonly
     */
    get totalDuration(): number;
    /**
     * The elapsed time of this animation, in seconds.
     * @readonly
     */
    get elapsedTime(): number;
    /**
     * The current position of the animation playhead, as a value between 0 and 1.
     * @readonly
     */
    get position(): number;
    /**
     * The current position of the animation playhead, as a value between 0 and 1, based on the total duration of the
     * animation, including the delay and end delay.
     * @readonly
     */
    get totalPosition(): number;
    /**
     * Whether the animation should always play from the beginning. When false, the animation will resume from its
     * current position when restarted. Defaults to `false`.
     * @readonly
     */
    get alwaysPlayFromBeginning(): boolean;
    /**
     * Returns whether the animation is currently playing.
     * @readonly
     */
    get isAnimating(): boolean;
    /**
     * Returns whether the animation is currently paused.
     * @readonly
     */
    get isPaused(): boolean;
    /**
     * REturns whether the animation is currently active, either playing or paused.
     * @readonly
     */
    get isActive(): boolean;
    constructor(opts?: Partial<AnimationOptions>);
    /**
     * Begins playing the animation. If the animation is currently paused, it will restart playback from the beginning.
     * @param position - The position to start the animation at, as a value between `0` and `1`, where `0` is the
     * beginning of the animation and `1` is the end. Defaults to `0`.
     */
    play(position?: number): void;
    /**
     * Pauses the animation.
     */
    pause(): void;
    /**
     * Resumes the animation from its current position.
     */
    resume(): void;
    /**
     * Stops the animation and resets it to its original starting position.
     */
    stop(advanceToStopPosition?: boolean): void;
    /**
     * Restarts the animation from the beginning if it is currently playing.
     */
    restart(): void;
    /**
     * Resets the animation to its original starting position.
     */
    reset(): void;
    /**
     * Toggles the animation between playing and paused states.
     */
    toggle(): void;
    /**
     * Enables the animation.
     */
    enable(): void;
    /**
     * Disables the animation.
     */
    disable(): void;
    /**
     * Advances the animation to the specified position (between 0 and 1).
     * @param position - The position to advance to, as a value between 0 and 1, where 0 is the beginning of the
     * animation and 1 is the end.
     * @param useTotalDuration - Whether to consider the total duration of the animation, including the delay and end
     * delay. Defaults to `false`.
     */
    goTo(position: number, useTotalDuration?: boolean): void;
    /**
     * Restricts the animation to a specific position range relative to the overall duration.
     * @param min - The minimum position value, between 0 and 1.
     * @param max - The maximum position value, between 0 and 1.
     */
    clampRange(min: number, max: number): void;
    proxyEvents(target: EventDispatcher, omitEvents?: Array<string>): void;
    /**
     * Advances the animation by the specified amount of time. This method is called by the global
     * {@link AnimationLoop} responsible for managing the playback of all animations.
     * @param elapsedTime - The amount of time that has elapsed, in milliseconds.
     */
    tick(elapsedTime: number): void;
    /**
     * Advances the animation to the specified position (between 0 and 1) and updates the elapsed time.
     * @param progress - The position to advance to, as a value between 0 and 1, where 0 is the beginning of the
     * animation and 1 is the end.
     * @param useTotalDuration - Whether to consider the total duration of the animation, including the delay and end
     * delay. Defaults to `true`.
     */
    advance(progress: number, useTotalDuration?: boolean): void;
    protected eventPayload(): Record<string, any>;
    protected advanceToStopPosition(): void;
}

/**
 * Configuration options for an animation.
 */
export declare interface AnimationOptions {
    /**
     * The unique identifier for the animation.
     */
    id: string;
    /**
     * Whether the animation is enabled.
     */
    enabled: boolean;
    /**
     * Whether the animation should autoplay when instantiated.
     */
    autoplay: boolean;
    /**
     * The duration of the animation in seconds.
     */
    duration: number;
    /**
     * The delay before the animation starts in seconds.
     */
    delay: number;
    /**
     * The delay after the animation ends in seconds.
     */
    endDelay: number;
    /**
     * The time scale factor for the animation.
     */
    timeScale: number;
    /**
     * Whether the animation should repeat.
     */
    repeat: boolean;
    /**
     * Whether the animation's progress is managed either manually or by an external source.
     */
    manualAdvance: boolean;
    /**
     * Whether the animation should always play from the beginning. When false, the animation will resume from its
     * current position when restarted. Defaults to `false`.
     */
    alwaysPlayFromBeginning: boolean;
}

/**
 * Defines the different states of an animation.
 */
export declare const AnimationState: {
    /**
     * The animation is in its initial state.
     */
    readonly initial: "initial";
    /**
     * The animation is currently loading data required for playback.
     */
    readonly loading: "loading";
    /**
     * The animation is ready to be played.
     */
    readonly ready: "ready";
    /**
     * The animation is currently playing.
     */
    readonly playing: "playing";
    /**
     * The animation is currently paused.
     */
    readonly paused: "paused";
    /**
     * The animation is currently stopped.
     */
    readonly stopped: "stopped";
    /**
     * The animation has completed. An animation that loops will never reach this state.
     */
    readonly completed: "completed";
};

export declare type AnimationState = ObjectValue<typeof AnimationState>;

/**
 * A type-erased {@link Authenticator} that can be used to represent any type of authenticator.
 */
export declare type AnyAuthenticator = Authenticator<any>;

export declare type AnyMapController = MapController<any>;

export declare type AnyTileCache = TileCache<any>;

/**
 * An enumerated value representing an API endpoint action.
 */
declare const ApiAction: {
    readonly affects: "affects";
    readonly all: ":all";
    readonly closest: "closest";
    readonly contains: "contains";
    readonly id: ":id";
    readonly route: "route";
    readonly search: "search";
    readonly within: "within";
};

export declare type ApiAction = ObjectValue<typeof ApiAction>;

/**
 * A data type that represents the configuration options for an API request.
 */
export declare type ApiConfig = {
    /**
     * The API base server path.
     */
    server?: string;
    /**
     * API client configuration to use with the request.
     */
    client?: {
        /**
         * Client access id.
         */
        id: string;
        /**
         * Client access secret.
         */
        secret: string;
    };
};

/**
 * An object that is responsible for configuring and performing a single request to the Aeris
 * Weather API.
 */
export declare class ApiRequest {
    /**
     * Base configuration for the request.
     */
    config: ApiConfig;
    /**
     * The parameters associated with the request.
     */
    private _params;
    private _request;
    private _endpoint;
    private _action;
    private _requests;
    private _paramKeys;
    private _range;
    private _route;
    get requests(): ApiRequest[];
    /**
     * Initializes a new request instance configured with the specified client access keys.
     * @param config - The configuration for the request.
     * @param opts - Additional options for the request.
     */
    constructor(config: ApiConfig, opts?: ApiRequestOptions);
    /**
     * Sets or returns the specified parameter.
     * @param key - The parameter key to set or get.
     * @param value - The value to set for the parameter.
     */
    param(key: string, value?: any): ApiRequest | any;
    /**
     * Returns the current request parameters.
     */
    getParams(): ApiRequestOptions;
    /**
     * Sets multiple request parameters.
     * @param params - The parameters to set.
     */
    setParams(params: ApiRequestOptions): ApiRequest;
    resetParams(): ApiRequest;
    /**
     * Sets the endpoint for the request (required).
     * @param endpoint - The endpoint to set.
     */
    endpoint(endpoint: string): ApiRequest;
    /**
     * Returns the endpoint for the request.
     */
    getEndpoint(): string;
    /**
     * Sets the action for the request.
     * @param action - The action to set.
     */
    action(action: ApiAction): ApiRequest;
    /**
     * Returns the action for the request.
     */
    getAction(): ApiAction;
    /**
     * Sets the place for the request.
     * @param value - The place to set.
     */
    place(value: string): ApiRequest;
    /**
     * Alias for `place`.
     * @param value - The place to set.
     */
    p(value: string): ApiRequest;
    /**
     * Sets the request's place to the coordinate bounds string.
     * @param bounds - The coordinate bounds to set.
     */
    bounds(bounds: CoordinateBounds): ApiRequest;
    /**
     * Sets the limit parameter.
     * @param value - The limit to set.
     */
    limit(value: number): ApiRequest;
    /**
     * Sets the lod (level-of-detail) parameter.
     * @param value - The lod to set.
     */
    lod(value: number): ApiRequest;
    /**
     * Sets the mindist parameter.
     * @param value - The mindist to set.
     */
    mindist(value: string | number): ApiRequest;
    /**
     * Sets the radius parameter.
     * @param value - The radius to set.
     */
    radius(value: string): ApiRequest;
    /**
     * Sets the filter parameter.
     * @param value - The filter to set.
     */
    filter(value: string): ApiRequest;
    /**
     * Sets the fields parameter.
     * @param value - The fields to set.
     */
    fields(value: string): ApiRequest;
    /**
     * Sets the query parameter.
     * @param value - The query to set.
     */
    query(value: string | Query): ApiRequest;
    /**
     * Sets the sort parameter.
     * @param value - The sort to set.
     */
    sort(value: string): ApiRequest;
    /**
     * Sets the skip parameter.
     * @param value - The skip to set.
     */
    skip(value: number): ApiRequest;
    /**
     * Sets the from parameter.
     * @param value - The from to set.
     */
    from(value: string | Date): ApiRequest;
    /**
     * Sets the to parameter.
     * @param value - The to to set.
     */
    to(value: string | Date): ApiRequest;
    /**
     * Sets the plimit paramter.
     * @param value - The plimit to set.
     */
    plimit(value: number): ApiRequest;
    /**
     * Sets the psort parameter.
     * @param value - The psort to set.
     */
    psort(value: string): ApiRequest;
    /**
     * Sets the pskip parameter.
     * @param value - The pskip to set.
     */
    pskip(value: number): ApiRequest;
    /**
     * Sets the format parameters.
     * @param value - The format to set.
     */
    format(value: string): ApiRequest;
    route(value: any): ApiRequest;
    private _requestKeys;
    /**
     * Adds a request to the batch request. Adding child requests to this request automatically converts the
     * containing request to a batch request.
     * @param request - The request to add to the batch request.
     */
    addRequest(request: ApiRequest): ApiRequest;
    /**
     * Removes a request from the batch request.
     * @param request - The request to remove from the batch request.
     */
    removeRequest(request: ApiRequest): ApiRequest;
    /**
     * Removes all requests from the batch request, converting the request instance to a non-batch request.
     */
    removeAllRequests(): void;
    /**
     * Perform the request.
     * @param callback - The callback to execute when the request is complete.
     */
    get(callback?: (result: ApiResult) => void): Promise<ApiResult>;
    /**
     * Cancels any active request.
     */
    cancel(): void;
    /**
     * Returns the url string for the request based on the configured parameters and options.
     * @param isBatch - Indicates if the request is a batch request.
     */
    url(isBatch?: boolean): string;
    /**
     * Returns a copy of the request.
     */
    clone(): ApiRequest;
}

/**
 * A data type that represents the configuration options for an API data request.
 */
export declare interface ApiRequestOptions {
    /**
     * Request endpoint (required).
     */
    endpoint: string;
    /**
     * Request action.
     */
    action?: string;
    /**
     * Coordinate bounds to search within.
     */
    bounds?: CoordinateBounds;
    /**
     * A comma-delimited list of response properties for the API to return. This parameter is often
     * used to limit the amount of data returned.
     */
    fields?: string;
    /**
     * Predefined filters for limiting the results. The filter value can be a single,
     * comma-delimited or a semicolon delimited string of filter names.
     */
    filter?: string;
    /**
     * Either a `Date` or [valid time string](http://php.net/manual/en/datetime.formats.php) from
     * which to return results for.
     */
    from?: string | Date;
    /**
     * Maximum number of results to return.
     */
    limit?: number;
    /**
     * Location to request data for. Refer to the list of
     * [supported place values](https://www.aerisweather.com/support/docs/api/reference/places/).
     */
    place?: string;
    /**
     * Applied only on the `periods` response property, the total number of periods to return as
     * an integer.
     */
    plimit?: number;
    /**
     * Applied only on the `periods` response property, used to skip over a specific number of
     * periods in the data set.
     */
    pskip?: number;
    /**
     * Applied only on the `periods` response property, used to sort results based on certain
     * fields contained within the periods.
     */
    psort?: string;
    /**
     * Filters results based on certain fields and values in the dataset. Refer to the
     * [advanced queries](https://www.aerisweather.com/support/docs/api/getting-started/queries/)
     * documentation.
     */
    query?: string;
    /**
     * When requesting the closest results within a circle, the radius determines how far from the
     * specified location to search. A valid unit value must be included in your radius value,
     * e.g., `5mi`, `10km`, `25miles`. If no unit is provided, your value is assumed to be in
     * meters by default.
     */
    radius?: string;
    /**
     * Skips over a specific number of results in the dataset.
     */
    skip?: number;
    /**
     * Sorts results based on certain fields in the dataset. Refer to the
     * [sorting](https://www.aerisweather.com/support/docs/api/getting-started/sorting/)
     * documentation.
     */
    sort?: string;
    /**
     * Either a `Date` or [valid time string](http://php.net/manual/en/datetime.formats.php) up to
     * which to return results for. When used in conjunction with `from()`, this value be relative
     * to the *from* value, not relative to the current time.
     */
    to?: string | Date;
}

/**
 * An `ApiResult` object contains response information about an API request.
 */
export declare class ApiResult {
    /**
     * Response object returned by the request.
     */
    response: any;
    /**
     * Response data provided by the API.
     */
    data: any;
    /**
     * Error that occurred during the request, if any.
     */
    error: any;
    /**
     * Warning that occurred during the request, if any.
     * @remarks
     * The Xweather Weather API will sometimes include warnings with the response if there was an issue
     * with the request or parameters that didn't prevent the request completely.
     */
    warning: any;
    /**
     * Request parameters that were used.
     */
    params: any;
    /**
     * Initializes a result instance with the necessary response information.
     * @param response - The response object returned by the request.
     * @param data - The data returned by the API.
     * @param error - The error that occurred during the request, if any.
     * @param params - The request parameters that were used.
     */
    constructor(response: any, data: any, error: any, params?: any);
    /**
     * Returns the headers returned by the response, if any.
     */
    headers(): Record<string, string> | undefined;
}

/**
 * An interface that describes an object that performs server authentication using a session token or
 * other means.
 * @template Token The type of the authentication token.
 */
export declare interface Authenticator<Token> {
    credentials: Token | undefined;
    headers: Record<string, string>;
    /**
     * Makes the necessary authentication request, such as requesting an access token, and returns
     * the authentication headers to include in data requests.
     */
    authenticate(): Promise<Record<string, string>>;
}

/**
 * Configuration options for a bar legend.
 */
export declare interface BarLegendOptions {
    /**
     * The height of the color scale bar.
     */
    height: number;
    /**
     * Whether the edges of the color scale bar should be rounded.
     */
    rounded: boolean;
    /**
     * Whether the color scale bar should have equal widths for each color stop. Default is `false`.
     *
     * When `false`, each cell will have a variable width that is proportional to its value and the next cell's value
     * relative to the value range of the bar.
     */
    equalWidth: boolean;
    /**
     * Defines the base measurement type and units for the legend which corresponds to the color scale's value range.
     */
    measurement: {
        /**
         * The measurement type.
         */
        type: Measurement;
        /**
         * The measurement units.
         */
        units: string;
        /**
         * A function that converts a value to another unit.
         */
        converter?: UnitConverter;
    };
    /**
     * The color scale configuration.
     */
    colorscale: Partial<ColorScaleOptions> & {
        /**
         * The easing curve to use for resampling the color scale if the color scale should not be rendered linearly.
         * The default is `'linear'`.
         */
        resample?: EasingCurve;
    };
    /**
     * The value label configuration.
     */
    labels: Partial<{
        /**
         * The values to use for the labels. If numbers are provided, then those values will be used as the labels at
         * the corresponding positions on the color scale. If `LabelItem` objects are provided, then those objects can
         * provide the value along the scale, a different label value to display, and an optional normalized position
         * along the scale where the label should be placed.
         */
        values: Array<number | LabelItem> | ((units: string) => Array<number | LabelItem>);
        /**
         * The value interval at which to display labels. This value must be in the same units as the color scale's
         * value range.
         */
        every: number | ((units: string) => number);
        /**
         * The number of steps at which to display labels based on the color scale's color interval, where each step
         * in the color scale corresponds to a label step.
         *
         * For example, if the color scale has 10 steps, and `everyStep` is 2, then labels will be displayed at steps 0,
         * 2, 4, 6, 8, and 10.
         */
        everyStep: number;
        /**
         * The formatter to use for the labels.
         */
        formatter: (value: number, index: number, state: LegendState) => string;
        /**
         * The placement of the labels relative to the color scale bar.
         */
        placement: 'top' | 'middle' | 'bottom';
        /**
         * Whether the labels should be centered on their corresponding color scale bar cell. Default is `false`,
         * which means the labels will be aligned to the left (beginning) of the corresponding color scale bar cell.
         */
        centered: boolean;
        /**
         * The marks to display at the label positions along the color scale bar.
         */
        marks: 'point' | 'line' | 'none';
        /**
         * Horizontal and vertical margins around the labels.
         */
        margin: number | [number, number];
        normalized: boolean;
        /**
         * Whether the labels should be allowed to overlap each other. Default is `false`.
         */
        allowOverlap: boolean;
    }>;
}

export declare type BBox = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

export declare class Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
    get size(): Size;
    get center(): Point;
    constructor(left: number, right: number, top: number, bottom: number);
}

/**
 * Circle style properties control how circles get rendered on a map. Use these properties in conjunction with `fill`
 * and `stroke` to define the style for a circle layer.
 */
export declare interface CircleStyleSpec {
    /**
     * Radius of the circle in points.
     */
    radius: StyleValue<number>;
}

export declare type ColorBand = typeof SupportedColorBands[number];

/**
 * Configuration for a color mask.
 */
export declare interface ColorMaskOptions {
    /**
     * The color band from the raster data that represents the mask.
     */
    channel: ColorBand;
    /**
     * The color value from the raster data that represents the mask for the specified `channel`.
     */
    value: number;
    /**
     * The color scale to apply to the masked data.
     */
    drawRange?: Partial<ValueRange>;
    /**
     * The color scale to apply to the masked data.
     */
    colorscale: Partial<ColorScaleOptions>;
}

/**
 * Configuration for a color scale.
 */
export declare interface ColorScaleOptions {
    /**
     * The data range the color scale represents.
     *
     * @remarks
     * The range is used to determine how to map the color stops to the data values and their position along the scale.
     * If not provided, then the range will be `0` to `1` by default.
     */
    range?: ValueRange;
    /**
     * Array of color stops to use for the color scale. Each stop in the array should be provided as a `value`, `color`
     * pair, where `value` corresponds to the data value within the data's `range` and the color can be a CSS color
     * string or `Color` instance.
     *
     * @example
     * ```js
     * {
     *     range: { min: 0, max: 50 }
     *     stops: [
     *         0, 'rgba(0, 0, 0, 0)',
     *         25, 'rgba(255, 0, 0, 1)',
     *         50, 'rgba(255, 255, 255, 1)'
     *     ]
     * }
     * ```
     */
    stops?: Array<number | string>;
    /**
     * An optional array of positions to use for the color scale's color stops if they should not be linearly
     * interpolated across the value range. Each position in the array should be a value between `0` and `1`, where
     * `0` is the start of the value range and `1` is the end of the value range.
     *
     * @example
     * ```js
     * {
     *     range: { min: 0, max: 50 }
     *     stops: [
     *         0, 'rgba(0, 0, 0, 0)',
     *         25, 'rgba(255, 0, 0, 1)',
     *         50, 'rgba(255, 255, 255, 1)'
     *     ],
     *     positions: [0, 0.25, 1],
     * }
     * ```
     */
    positions?: Array<number>;
    /**
     * Desired color stop interval to generate color breaks from. If you want to provide specific breaks or need to
     * perform additional logic to determine the breaks, use the `breaks` option instead.
     *
     * @remarks
     * This is useful for when you want to sample colors at regular intervals across the value range even for intervals
     * in between the defined `stops`. If not provided or `0` (default), then the color scale will be linearly
     * interpolated using the provided `stops` array to produce a smooth gradient.
     */
    interval?: number;
    /**
     * An array values to use as breaks in the color scale. Alternatively, a function can be provided that takes the
     * `min` and `max` values of the data range and returns an array of break values, which can be useful to perform
     * any custom logic to determine the break values such as unit conversions.
     *
     * If you want to provide a specific interval to automatically generate breaks from, use the `interval` option
     * instead.
     *
     * @remarks
     * This is useful for when you want to apply a stepped color scale where the color only changes at specific values
     * rather than interpolated between color stops. The values in the array should be provided in the same units as
     * the data's range.
     *
     * @example
     * ```js
     * {
     *    range: { min: 0, max: 50 }
     *    stops: [
     *       0, 'rgba(0, 0, 0, 0)',
     *       25, 'rgba(255, 0, 0, 1)',
     *       50, 'rgba(255, 255, 255, 1)'
     *    ],
     *    breaks: [0, 10, 20, 30, 40, 50]
     * }
     * ```
     *
     * @example
     * ```js
     * {
     *   range: { min: 0, max: 50 }
     *   stops: [
     *      0, 'rgba(0, 0, 0, 0)',
     *      25, 'rgba(255, 0, 0, 1)',
     *      50, 'rgba(255, 255, 255, 1)'
     *    ],
     *    breaks: (min, max) => {
     *       const breaks = [];
     *       for (let i = min; i <= max; i += 2) {
     *          breaks.push(i);
     *       }
     *       return breaks;
     *    }
     * }
     * ```
     */
    breaks?: Array<number> | ((min: number, max: number, interval: number) => Array<number>);
    /**
     * When `true`, the color scale's stops are defined in normalized values between `0` and `1` instead of the actual
     * data range. This is useful when you want to apply a simple color scale whose stops are defined in normalized
     * values and not tied to the data's actual range.
     */
    normalized?: boolean;
    /**
     * Whether color values between stops should be interpolated based on the specified `interval`. If `true`, then
     * colors will be linearly interpolated between stops and appear more gradient-like. Otherwise the color will be
     * stepped and only change at the specified stop values.
     */
    interpolate?: boolean;
    /**
     * An array of color scales and mask information to apply to masked data, where a specific data value or raster
     * color channel represents a mask that should be colorized using the provided color scale.
     */
    masks?: Array<ColorMaskOptions>;
}

export declare class ConstantStyleValue<T> extends StyleValue_2<T> {
    constructor(value: T | any[] | StyleEvaulatorFunction<T>);
}

/**
 * Contour style properties control how contoured data gets rendered on a map. Contour layers are rendered by sampling
 * encoded data and interpolating values in real-time.
 */
export declare interface ContourStyleSpec {
    /**
     * Determines the value interval for which to draw contour lines for. This value must be in the same units as
     * the data source.
     */
    interval: StyleValue<number>;
    /**
     * Determines the value interval for which to draw major, or thicker, contour lines for. If this value is `0`, then
     * major contour lines will not be rendered. This value must be in the same units as the data source.
     */
    majorInterval: StyleValue<number>;
    /**
     * The width of the contour lines in pixels.
     */
    width: StyleValue<number>;
    /**
     * The width of the major contour lines in pixels.
     */
    majorWidth: StyleValue<number>;
    scale: StyleValue<number>;
    offset: StyleValue<number>;
}

/**
 * Represents an object containing the map's controls.
 */
export declare interface ControlStore {
    legend: LegendControl;
    dataInspector: DataInspectorControl;
}

export declare type ConversionMeasurement = Measurement | 'temperature-change';

declare const convert: (type: ConversionMeasurement | string, value: number, from: string, to: string) => number;

export declare type Coordinate = {
    lat: number;
    lon: number;
};

/**
 * Represents a geographical coordinate bounds in degrees.
 */
export declare type CoordinateBounds = {
    north: number;
    west: number;
    south: number;
    east: number;
};

export declare type CrossTileID = string;

declare const CtoF: (c: number) => number;

declare const CtoFUnit: (c: number) => number;

export declare class DataDrivenStyleValue<T> extends StyleValue_2<T> {
}

export declare interface DataEvaluator {
    title: string | ((data: FeatureQueryResult) => string);
    alwaysShow?: boolean;
    fn: (data: FeatureQueryResult) => string;
}

export declare class DataInspector {
    readonly map: AnyMapController;
    constructor(map: AnyMapController);
    query(coord: Coordinate): Record<string, FeatureQueryResult> | undefined;
    queryPromise(coord: Coordinate): Promise<Record<string, FeatureQueryResult>>;
}

export declare class DataInspectorControl {
    readonly options: DataInspectorControlOptions;
    private _inspector;
    private _tooltip;
    private _evaluators;
    private _position;
    private _coord;
    private _enabled;
    get isEnabled(): boolean;
    constructor(inspector: DataInspector, options?: Partial<DataInspectorControlOptions>);
    addTo(target: HTMLElement | string): void;
    remove(): void;
    show(point: Point, coord?: Coordinate): void;
    hide(): void;
    enable(): void;
    disable(): void;
    setEvaluator(layerId: string, evaluator: DataEvaluator): void;
    update: () => void;
    handleMapClickEvent: (e: any) => void;
    handleMapMoveEvent: (e: any) => void;
    handleMouseMoveEvent: (e: any) => void;
    handleMouseOutEvent: (e: any) => void;
    _queryFeatures: (coord: Coordinate) => void;
    _queryFeaturesAsync: (coord: Coordinate) => Promise<void>;
    _setFeatures(coord: Coordinate, features: Record<string, FeatureQueryResult>): void;
}

export declare interface DataInspectorControlOptions {
    event: 'click' | 'move';
    stream: boolean;
    showCoordinates: boolean;
    tooltip: any;
}

/**
 * Determines the quality of the data when rendered.
 */
export declare const DataQuality: {
    /**
     * Data will be requested and rendered 1:1 with map tiles and zoom level. This setting results in the highest
     * data resolution but the lowest bandwidth and rendering optimization.
     */
    readonly exact: "exact";
    /**
     * Data is scaled by three-quarters the data resolution of `exact`per zoom level.
     */
    readonly high: "high";
    /**
     * Data is scaled by half resulting in half the data resolution of `exact`per zoom level. This setting provides a
     * good balance between data resolution and reduced request bandwidth and rendering performance.
     */
    readonly medium: "medium";
    /**
     * Data will be scaled to share the same data tiles across multiple map zoom levels. This setting provides a good
     * balance between data resolution and reduced request bandwidth and rendering performance.
     * @deprecated Use `medium` instead.
     */
    readonly normal: "normal";
    /**
     * Data is scaled by one-quarter the data resolution of `exact`per zoom level. This quality level results in
     * drastically reduced data resolution but the highest bandwidth and rendering optimization.
     */
    readonly low: "low";
    /**
     * Data will be scaled extensively to share the same data tiles across 3-5 map zoom levels. This results in
     * drastically reduced data resolution but the highest bandwidth and rendering optimization.
     * @deprecated Use `low` instead.
     */
    readonly minimal: "minimal";
};

export declare type DataQuality = ObjectValue<typeof DataQuality>;

/**
 * `DataSource` is an abstract class that provides the minimal implementation of a data source object. This class is
 * not intended to be used directly, but rather extended by a concrete implementation of a data source.
 * Data sources are responsible for storing static data or fetching data from a remote source and providing it to
 * consuming layers when added to a map. There are different types of data sources depending on the types of data
 * they manage, such as handling Slippy map tiles and the types of data they provide, such as raster images or vector
 * data.
 */
declare abstract class DataSource<Spec extends SourceSpecification = SourceSpecification> extends EventDispatcher {
    /**
     * The unique identifier for the data source.
     */
    id: string;
    /**
     * The data source configuration.
     */
    readonly spec: Spec;
    readonly metadata: SourceMetadata;
    
    /**
     * The map layers that are currently using this data source.
     */
    consumingLayers: Array<DataSourceConsumer>;
    private _consumingLayerIds;
    /**
     * The type of data source and data it manages.
     * @readonly
     */
    get type(): string;
    /**
     * Indicates whether the data source is ready to be used by consuming layers, which may be `false` if data has not
     * been loaded from a remote source yet or the data has not been fully prepared for rendering.
     * @readonly
     */
    get isReady(): boolean;
    constructor(id: string, spec: Partial<Spec>);
    /**
     * Returns the metadata for the source, which can be loaded from a remote source.
     * Some data sources require additional metadata to be loaded before its data can be requested, such as additional
     * information about the data, time information, min/max zoom levels, etc. If the source does not require metadata,
     * this method will return an empty object.
     * @returns The metadata for the source.
     */
    getMetadata(options?: Partial<UrlRequestOptions>): Promise<unknown>;
    /**
     * Adds a map layer as a consumer of the data source.
     * @param consumer -
     */
    addConsumer(consumer: DataSourceConsumer): void;
    /**
     * Removes a map layer as a consumer of the data source.
     * @param consumer -
     */
    removeConsumer(consumer: DataSourceConsumer): void;
    /**
     * Removes a map layer as a consumer of the data source by its layer identifier.
     * @param id -
     */
    removeConsumerForLayerId(id: string): void;
    reload(): void;
    dispose(): void;
}

export declare type DataSourceConsumer = Partial<LayerMetadata>;

export declare type DataSourceRequest = {
    url: string;
    options: Partial<TileRequestOptions>;
};

export declare const DataSourceType: {
    readonly raster: "raster";
    readonly vector: "vector";
    readonly geojson: "geojson";
    readonly encoded: "encoded";
    readonly debug: "debug";
};

export declare type DataSourceType = ObjectValue<typeof DataSourceType>;

declare const dbzToMMRate: (dbz: number, perSecond?: boolean) => number;

declare const defaultUnits: Record<Exclude<UnitSystem, 'custom'>, MapUnits>;

export declare class Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    constructor();
}

declare const degToDir: (d: number) => string;

export declare interface Disposable {
    dispose(): void;
}

/**
 * Manages download tasks with queuing, concurrency control, retry logic, and caching.
 * Supports per-host concurrency limits and priority-based task ordering.
 *
 * @template Task - The download task type that extends DownloadTask
 */
export declare class DownloadManager<Task extends DownloadTask<any>> extends EventDispatcher {
    id: string;

/**
     * Gets the progress tracker for download operations.
     * Progress is calculated from actual task states for accuracy.
     * @returns The Progress instance tracking download statistics.
     */
    get progress(): Progress;
    /**
     * Creates a new DownloadManager instance.
     * @param options - Configuration options for the download manager.
     * @param options.fetcher - Function that performs the fetch operation for tasks.
     * @param options.taskRunner - Optional custom task runner function. Defaults to runDownloadTask.
     * @param options.maxRetries - Maximum number of retry attempts for failed tasks.
     * @param options.defaultConcurrency - Default maximum concurrent downloads. Defaults to 16.
     * @param options.perHostConcurrency - Per-host concurrency limits, keyed by host name.
     */
    constructor(options?: Partial<DownloadManagerOptions<Task>>);
    /**
     * Checks if a task result exists in the cache.
     * @param key - The unique identifier for the task.
     * @returns True if the task result is cached, false otherwise.
     */
    has(key: string): boolean;
    /**
     * Retrieves a cached task result.
     * @param key - The unique identifier for the task.
     * @returns The cached task data, or undefined if not found.
     */
    get(key: string): TaskData<Task> | undefined;
    /**
     * Retrieves an active (pending or in-flight) task by key.
     * @param key - The unique identifier for the task.
     * @returns The active task if present, otherwise undefined.
     */
    getTask(key: string): Task | undefined;
    /**
     * Sets the task runner function used to execute download tasks.
     * @param runner - The task runner function that handles task execution with retry logic.
     */
    setTaskRunner(runner: TaskRunner<Task>): void;
    /**
     * Sets the task transformer function that modifies tasks before execution.
     * @param transformer - Function that receives a task and returns a (possibly modified) task.
     */
    setTaskTransformer(transformer: (task: Task) => Task): void;
    /**
     * Finds all tasks that match the provided predicate function.
     * @param predicate - A callback that receives a task and returns true if it should be included.
     */
    find(predicate: (task: Task) => boolean): Task[];
    /**
     * Finds the first task that matches the provided predicate function.
     * @param predicate - A callback that receives a task and returns true for a match.
     */
    findOne(predicate: (task: Task) => boolean): Task | undefined;
    /**
     * Returns true if any task matches the provided predicate function.
     * @param predicate - A callback that receives a task and returns true for a match.
     */
    hasTask(predicate: (task: Task) => boolean): boolean;
    private _totalTasks;
    /**
     * Adds a task to the download queue and optionally starts processing.
     * Tasks are organized by host for per-host concurrency control and sorted by priority.
     * @param task - The download task to enqueue.
     * @param start - If true, immediately starts processing the queue. Defaults to true.
     * @param isRetry - If true, this is a retry and should not increment total. Defaults to false.
     */
    enqueue(task: Task, start?: boolean, isRetryParam?: boolean): void;
    /**
     * Aborts a specific download task.
     * If the task is in-flight, the request is aborted. If pending, it's removed from the queue.
     * Updates progress tracking accordingly.
     * @param task - The task to abort.
     */
    abort(task: Task): void;
    /**
     * Aborts all tasks that match the provided predicate function.
     * @param predicate - A callback that receives a task and returns true if it should be aborted.
     */
    abortWhere(predicate: (task: Task) => boolean): void;
    /**
     * Aborts all tasks.
     */
    abortAll(): void;

}

/**
 * Configuration options for creating a DownloadManager instance.
 * @template Task - The download task type that extends DownloadTask
 */
export declare interface DownloadManagerOptions<Task extends DownloadTask<any>> {
    /** Function that performs the fetch operation for tasks. */
    fetcher: Fetcher<Task>;
    /** Optional custom task runner function. Defaults to runDownloadTask if not provided. */
    taskRunner?: TaskRunner<Task>;
    /** Maximum number of retry attempts for failed tasks. */
    maxRetries?: number;
    /** Default maximum concurrent downloads across all hosts. Defaults to 16 if not provided. */
    defaultConcurrency?: number;
    /** Per-host concurrency limits, keyed by host name. */
    perHostConcurrency?: Record<string, number>;
}

/**
 * Priority levels for download tasks. Lower numbers indicate higher priority.
 * Tasks with lower priority values are processed before tasks with higher values.
 */
declare const DownloadPriority: {
    /** Critical priority (0) - highest priority, processed first. */
    readonly critical: 0;
    /** High priority (1) - processed after critical tasks. */
    readonly high: 1;
    /** Warm priority (2) - lowest priority, processed last. */
    readonly warm: 2;
};

/**
 * Type representing a download priority value.
 */
export declare type DownloadPriority = ObjectValue<typeof DownloadPriority>;

/**
 * Status values for download tasks throughout their lifecycle.
 */
declare const DownloadStatus: {
    /** Task is queued and waiting to be processed. */
    readonly pending: "pending";
    /** Task is currently being executed (fetch in progress). */
    readonly inFlight: "in-flight";
    /** Task completed successfully. */
    readonly success: "success";
    /** Task failed after all retry attempts. */
    readonly failed: "failed";
    /** Task was cancelled before completion. */
    readonly cancelled: "cancelled";
};

/**
 * Type representing a download status value.
 */
export declare type DownloadStatus = ObjectValue<typeof DownloadStatus>;

/**
 * Represents a single download task with its configuration, state, and result handling.
 * @template ResultType - The type of data that will be returned when the task completes.
 */
export declare class DownloadTask<ResultType> {
    /** Unique identifier for this task. */
    readonly key: string;
    /** URL to fetch data from. */
    readonly url: string;
    /** Request options for the download task. */
    readonly options: Partial<DownloadTaskRequestOptions>;
    /** AbortController for cancelling the request. */
    readonly controller: AbortController;
    /** Expected result type for the response ('blob', 'json', 'arrayBuffer', or 'text'). */
    resultType: 'blob' | 'json' | 'arrayBuffer' | 'text';
    /** Priority level for this task. Lower numbers indicate higher priority. */
    priority: DownloadPriority;
    /** Current status of the download task. */
    status: DownloadStatus;
    /** Number of retry attempts made for this task. */
    retries: number;
    /** The Response object from the fetch operation, if available. */
    response: Response | undefined;
    /** Optional custom parser function to transform the Response into ResultType. */
    parse: ((response: Response) => Promise<ResultType>) | undefined;
    /** Deferred promise that resolves when the task completes. Set externally by the download scheduler. */
    readonly deferred: Deferred<ResultType>;
    /**
     * Gets the promise that resolves when the task completes.
     * @returns A Promise that resolves with the task result.
     */
    get promise(): Promise<ResultType>;
    /** Optional host name for per-host concurrency control. */
    host?: string;
    /**
     * Creates a new DownloadTask instance.
     * @param key - Unique identifier for the task.
     * @param url - URL to fetch data from.
     * @param options - Request options for the download task.
     * @param priority - Priority level for the task. Defaults to DownloadPriority.warm if not provided.
     */
    constructor(key: string, url: string, options: Partial<DownloadTaskRequestOptions>, priority?: DownloadPriority);
    getResponseResult(response: Response | Record<string, any>): Promise<any>;
}

/**
 * Options for configuring a download task request.
 */
export declare type DownloadTaskRequestOptions = {
    /**
     * The HTTP method to use for the request.
     */
    method: 'GET' | 'POST';
    /**
     * The authenticator to use for the request, if any.
     */
    authenticator?: AnyAuthenticator;
    /**
     * The request body to send, if any.
     */
    body?: any;
    /**
     * The request headers to send, if any.
     */
    headers?: Record<string, string>;
    /**
     * The request parameters to send, if any.
     */
    params: Record<string, any>;
    /**
     * The {@link AbortSignal} to use for the request.
     */
    signal: AbortSignal;
    /**
     * The download priority of the request.
     */
    priority: DownloadPriority;
};

/**
 * Set of common easing functions.
 */
export declare const Easing: {
    readonly linear: (t: number) => number;
    readonly quadratic: (t: number) => number;
    readonly cubic: (t: number) => number;
    readonly elastic: (t: number) => number;
    readonly inQuad: (t: number) => number;
    readonly outQuad: (t: number) => number;
    readonly inOutQuad: (t: number) => number;
    readonly inCubic: (t: number) => number;
    readonly outCubic: (t: number) => number;
    readonly inOutCubic: (t: number) => number;
    readonly inQuart: (t: number) => number;
    readonly outQuart: (t: number) => number;
    readonly inOutQuart: (t: number) => number;
    readonly inQuint: (t: number) => number;
    readonly outQuint: (t: number) => number;
    readonly inOutQuint: (t: number) => number;
    readonly inSine: (t: number) => number;
    readonly outSine: (t: number) => number;
    readonly inOutSine: (t: number) => number;
    readonly inExpo: (t: number) => number;
    readonly outExpo: (t: number) => number;
    readonly inOutExpo: (t: number) => number;
    readonly inCirc: (t: number) => number;
    readonly outCirc: (t: number) => number;
    readonly inOutCirc: (t: number) => number;
    readonly inSquare: (t: number) => number;
    readonly outSquare: (t: number) => number;
    readonly inOutSquare: (t: number) => number;
    readonly inSqrt: (t: number) => number;
    readonly outSqrt: (t: number) => number;
    readonly inOutSqrt: (t: number) => number;
};

export declare type Easing = ObjectValue<typeof Easing>;

/**
 * An easing curve function.
 */
export declare type EasingCurve = (x: number) => number;

/**
 * Represents the configuration for an encoded raster data source.
 */
export declare interface EncodedRasterDataset {
    /**
     * Unique identifier for the data source.
     */
    id: string;
    /**
     * Color band index where the dataset is located in the indexed image data.
     */
    band: number;
    /**
     * The minimum value for the dataset.
     */
    dataMin: number;
    /**
     * The maximum value for the dataset.
     */
    dataMax: number;
    /**
     * The no data value for the dataset.
     */
    noData: number;
    /**
     * An array of valid times for the dataset as either a `Date` or ISO 8601 string.
     */
    validTimes: Array<Date | string>;
    /**
     * The geographical coordinate bounds of the dataset.
     */
    bounds?: CoordinateBounds;
    /**
     * The column index of the dataset in the indexed image data.
     */
    column?: number;
    /**
     * The row index of the dataset in the indexed image data.
     */
    row?: number;
    /**
     * Describes how the time interval data is laid out in the indexed image data.
     */
    layout?: 'horizontal' | 'vertical';
}

/**
 * Represents the configuration for an encoded tile data source.
 */
export declare interface EncodedSourceSpecification<Dataset extends EncodedRasterDataset> extends TileSourceSpecification {
    /**
     * The datasets that are encoded in the tile data. These are used for requesting tiles from the server.
     * If the data is transformed (e.g., converting precip to snowfall), use `effectiveDatasets` to provide
     * the transformed datasets with updated dataMin/dataMax values for operations and rendering.
     */
    datasets: Array<Partial<Dataset>>;
    /**
     * The effective datasets used for operations and rendering. If not provided, defaults to `datasets`.
     * Use this when data transformations change the dataMin/dataMax values (e.g., converting precipitation
     * to snowfall). The original `datasets` are still used for tile requests.
     */
    effectiveDatasets?: Array<Partial<Dataset>>;
    /**
     * ID of a registered tile data transformer to run in the worker thread after tile data is loaded.
     * Preferred over `transformTileData` because it avoids serializing a function across threads.
     * @see TransformerId
     */
    transformerId?: string;
    /**
     * Optional function to transform tile data after it has been loaded. This allows for custom processing or
     * modification of the tile data before it is used for rendering, such as converting it to other values
     * derived from the original encoded data.
     * @param data - The loaded tile data as an RGBA image.
     * @param datasets - An array of dataset objects associated with this source, which contains information about the
     * original encoded data and its value ranges. This array can be modified in-place to update dataMin/dataMax
     * values for transformed data.
     * @deprecated Use `transformerId` instead to reference a registered transformer by ID.
     */
    transformTileData?: (data: RGBAImage, datasets: Array<Dataset>) => void;
}

/**
 * A {@link TileSource} for encoded tile data, such as PNG or JPEG images that contain indexed data or numerical
 * values encoded into one or more color bands of an image.
 * @template Data The type of data stored in a tile, such as {@link RGBAImage}.
 * @template Source The type of the source specification, such as {@link EncodedSourceSpecification}.
 * @template Dataset The type of the dataset, such as {@link EncodedRasterDataset}.
 */
export declare class EncodedTileSource<Source extends EncodedSourceSpecification<Dataset>, Dataset extends EncodedRasterDataset> extends TileSource<EncodedTileData, Source> {
    shouldUseTimesFromMetadata: boolean;
    maxTextureSize: number;
    private _worker;
    private _aggregateProgress;
    
    get type(): string;
    get operation(): TimeSeriesOperationType;
    constructor(id: string, spec: Partial<Source>);
    
    shouldRequestTile(tile: Tile<EncodedTileData>, reload?: boolean, intervals?: Array<Date>): boolean;
    abortTileByCoord(coord: TileCoord): void;
    
    /**
     * Returns the metadata for the specified band, if available.
     * @param band - The band to get metadata for.
     * @returns
     */
    getMetadataForBand(band: SampleChannel): any;
    /**
     * Returns the data range for the specified band.

     * @param band - The band to get the data range for.
     * @returns The data range for the specified band.
     */
    getDataRange(band: SampleChannel): ValueRange;

protected onLoadProgress(e: any): void;
}

/**
 * Returns whether the given units are equal to the other units.
 * @param units1 - The first units to compare.
 * @param units2 - The second units to compare.
 * @returns Whether the given units are equal to the other units.
 */
declare const equalUnits: (units1: MapUnits, units2: MapUnits) => boolean;

/**
 * Mapbox-style expression: operator name followed by arguments.
 * Arguments may be literals or nested expressions (recursive).
 */
export declare type Expression = [ExpressionOperator, ...ExpressionValue[]];

/**
 * Mapbox-style expression array, e.g. ['get', 'opacity'] or ['*', ['get', 'x'], 2].
 * Allowed in style config; converted to DataDrivenStyleValue in the PaintStyle constructor.
 */
export declare type ExpressionArray = any[];

/**
 * Defines a custom expression operation to calculate the result of a custom expression function. The custom expression
 * will have access to the data values sampled from the encoded data texture and should return the result of the custom
 * expression operation as a single value. This is useful for displaying derived data values that are not directly
 * encoded in the data texture.
 */
export declare interface ExpressionOperation {
    /**
     * Defines the value range of the calculated expression result.
     */
    dataRange: ValueRange;
    /**
     * Custom expression function to calculate the result of the expression operation within a map's data inspector
     * control.
     * @remarks
     * The function will have access to two data variables, `data.value0` and `data.value1`, which represent the two
     * data values sampled from the encoded data texture. The function should return the result of the expression
     * operation.
     * @example
     * ```typescript
     * value: (data: Record<string, number>) => {
     *     const temp = data.value0;
     *     const rh = data.value1;
     *     return calculateVaporPressureDeficit(temp, rh);
     * }
     * ```
     * @param data - The data values sampled from the encoded data texture.
     * @returns The result of the expression operation.
     */
    value: (data: Record<string, number>) => number;
    /**
     * Shader chunk to inject into the shader program to calculate the expression result.
     * @remarks
     * The chunk will have access to two data variables, `dataValue1` and `dataValue2`, which represent the two data
     * values sampled from the encoded data texture. The chunk should assign the custom expression's result to the
     * previously-declared `value` variable that represents the result of the expression operation.
     *
     * The `value` variable should be a normalized value between `0` and `1`.
     */
    chunk: string;
}

/**
 * Supported expression operator names (first element of an expression array).
 * @see evaluateExpression
 */
declare const ExpressionOperator: {
    readonly literal: "literal";
    readonly get: "get";
    readonly has: "has";
    readonly var: "var";
    readonly properties: "properties";
    readonly zoom: "zoom";
    readonly coalesce: "coalesce";
    readonly eq: "==";
    readonly neq: "!=";
    readonly lt: "<";
    readonly lte: "<=";
    readonly gt: ">";
    readonly gte: ">=";
    readonly not: "!";
    readonly all: "all";
    readonly any: "any";
    readonly toNumber: "to-number";
    readonly toString: "to-string";
    readonly toDate: "to-date";
    readonly toLocaleString: "to-locale-string";
    readonly toUnit: "to-unit";
    readonly toBoolean: "to-boolean";
    readonly typeOf: "typeof";
    readonly number: "number";
    readonly string: "string";
    readonly boolean: "boolean";
    readonly object: "object";
    readonly add: "+";
    readonly subtract: "-";
    readonly mod: "%";
    readonly pow: "^";
    readonly multiply: "*";
    readonly divide: "/";
    readonly abs: "abs";
    readonly ceil: "ceil";
    readonly floor: "floor";
    readonly round: "round";
    readonly min: "min";
    readonly max: "max";
    readonly sqrt: "sqrt";
    readonly ln: "ln";
    readonly ln2: "ln2";
    readonly log2: "log2";
    readonly log10: "log10";
    readonly sin: "sin";
    readonly cos: "cos";
    readonly tan: "tan";
    readonly asin: "asin";
    readonly acos: "acos";
    readonly atan: "atan";
    readonly e: "e";
    readonly pi: "pi";
    readonly at: "at";
    readonly in: "in";
    readonly regex: "regex";
    readonly indexOf: "index-of";
    readonly length: "length";
    readonly slice: "slice";
    readonly concat: "concat";
    readonly downcase: "downcase";
    readonly upcase: "upcase";
    readonly step: "step";
    readonly interpolate: "interpolate";
    readonly case: "case";
    readonly match: "match";
    readonly let: "let";
    /**
     * Active map timeline position as **Unix seconds** (from the map controller), not wall clock — use `now` for that.
     */
    readonly mapTime: "map-time";
    /**
     * @deprecated Prefer `map-time` — same semantics.
     */
    readonly time: "time";
    readonly now: "now";
};

export declare type ExpressionOperator = ObjectValue<typeof ExpressionOperator>;

/** Value that can appear as an expression or as an argument (literal or nested expression). */
export declare type ExpressionValue = string | number | boolean | null | object | Expression;

export declare type FeatureQueryResult = {
    value: number;
    angle?: number;
    unit?: string;
    features?: Array<FeatureData>;
    nodata: boolean;
};

/**
 * Function type that performs the actual fetch operation for a download task.
 * @template Task - The download task type that extends DownloadTask
 * @param task - The download task to fetch data for.
 * @returns A Promise that resolves with a Response object.
 */
export declare type Fetcher<Task extends DownloadTask<any>> = (task: Task) => Promise<Response>;

export declare type FillPattern = string | RemoteSymbolImage;

/**
 * Fill style properties control how one or more polygons (and associated outlines) get rendered on a map. These
 * properties also control the fill for circles and other vector shapes.
 */
export declare interface FillStyleSpec {
    /**
     * Color of the fill.
     */
    color: StyleValue<string | Color>;
    /**
     * The image to use for the fill pattern. Can be an image identifier string or a {@link RemoteSymbolImage}.
     * @remarks
     * If using a string, the string must be a valid image identifier for an image that has been added to the style's
     * image manager either by calling {@link Style#addImage} or {@link Style#addRemoteImage}. When referencing an image
     * from a sprite sheet, the image identifier must be prefixed with the sprite's identifier, e.g. `"sprite:icon-id"`
     * where `sprite` is the identifier of the sprite sheet and `icon-id` is the identifier of the icon within the
     * sprite sheet.
     */
    pattern: StyleValue<FillPattern>;
    /**
     * Opacity of the fill. Opacity can also be specified by including an alpha channel in the `color` value.
     */
    opacity: StyleValue<number>;
    /**
     * Feature property key to use for sorting features. By default, features with higher sort values will be rendered
     * first. You can also provide a sort direction to sort features in ascending or descending order.
     */
    sort: string | SortProperty;
}

/**
 * Mapbox-style filter expression array. Evaluates to boolean (feature included when truthy).
 * Use with StyleExpression for evaluation. Supports decision expressions (==, !=, <, <=, >, >=,
 * all, any, !, in, regex, case, match, etc.) and property lookups (get, has).
 * @see StyleExpression
 */
export declare type FilterExpression = ExpressionValue;

declare const FtoC: (f: number) => number;

declare const FtoCUnit: (f: number) => number;

declare const ftToM: (ft: number) => number;

/**
 * Union of GeoJSON objects.
 */
export declare type GeoJSON = GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection;

/**
 * Bounding box
 * https://tools.ietf.org/html/rfc7946#section-5
 */
export declare type GeoJSONBBox = [number, number, number, number] | [number, number, number, number, number, number];

/**
 * A feature object which contains a geometry and associated properties.
 * https://tools.ietf.org/html/rfc7946#section-3.2
 */
export declare interface GeoJSONFeature<G extends GeoJSONGeometry | null = GeoJSONGeometry, P = GeoJsonProperties> extends GeoJSONObject {
    type: 'Feature';
    /**
     * The feature's geometry
     */
    geometry: G;
    /**
     * A value that uniquely identifies this feature in a
     * https://tools.ietf.org/html/rfc7946#section-3.2.
     */
    id?: string | number | undefined;
    /**
     * Properties associated with this feature.
     */
    properties: P;
}

/**
 * A collection of feature objects.
 *  https://tools.ietf.org/html/rfc7946#section-3.3
 */
export declare interface GeoJSONFeatureCollection<G extends GeoJSONGeometry | null = GeoJSONGeometry, P = GeoJsonProperties> extends GeoJSONObject {
    type: 'FeatureCollection';
    features: Array<GeoJSONFeature<G, P>>;
}

/**
 * Geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3
 */
export declare type GeoJSONGeometry = GeoJSONPoint | GeoJSONMultiPoint | GeoJSONLineString | GeoJSONMultiLineString | GeoJSONPolygon | GeoJSONMultiPolygon | GeoJSONGeometryCollection;

/**
 * Geometry Collection
 * https://tools.ietf.org/html/rfc7946#section-3.1.8
 */
export declare interface GeoJSONGeometryCollection<G extends GeoJSONGeometry = GeoJSONGeometry> extends GeoJSONObject {
    type: 'GeometryCollection';
    geometries: G[];
}

/**
 * LineString geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3.1.4
 */
export declare interface GeoJSONLineString extends GeoJSONObject {
    type: 'LineString';
    coordinates: GeoJSONPosition[];
}

/**
 * MultiLineString geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3.1.5
 */
export declare interface GeoJSONMultiLineString extends GeoJSONObject {
    type: 'MultiLineString';
    coordinates: GeoJSONPosition[][];
}

/**
 * MultiPoint geometry object.
 *  https://tools.ietf.org/html/rfc7946#section-3.1.3
 */
export declare interface GeoJSONMultiPoint extends GeoJSONObject {
    type: 'MultiPoint';
    coordinates: GeoJSONPosition[];
}

/**
 * MultiPolygon geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3.1.7
 */
export declare interface GeoJSONMultiPolygon extends GeoJSONObject {
    type: 'MultiPolygon';
    coordinates: GeoJSONPosition[][][];
}

/**
 * The base GeoJSON object.
 * https://tools.ietf.org/html/rfc7946#section-3
 * The GeoJSON specification also allows foreign members
 * (https://tools.ietf.org/html/rfc7946#section-6.1)
 * Developers should use "&" type in TypeScript or extend the interface
 * to add these foreign members.
 */
export declare interface GeoJSONObject {
    /**
     * Specifies the type of GeoJSON object.
     */
    type: GeoJSONTypes;
    /**
     * Bounding box of the coordinate range of the object's Geometries, Features, or Feature Collections.
     * The value of the bbox member is an array of length 2*n where n is the number of dimensions
     * represented in the contained geometries, with all axes of the most southwesterly point
     * followed by all axes of the more northeasterly point.
     * The axes order of a bbox follows the axes order of geometries.
     * https://tools.ietf.org/html/rfc7946#section-5
     */
    bbox?: GeoJSONBBox | undefined;
}

/**
 * Point geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3.1.2
 */
export declare interface GeoJSONPoint extends GeoJSONObject {
    type: 'Point';
    coordinates: GeoJSONPosition;
}

/**
 * Polygon geometry object.
 * https://tools.ietf.org/html/rfc7946#section-3.1.6
 */
export declare interface GeoJSONPolygon extends GeoJSONObject {
    type: 'Polygon';
    coordinates: GeoJSONPosition[][];
}

/**
 * A GeoJSONPosition is an array of coordinates.
 * https://tools.ietf.org/html/rfc7946#section-3.1.1
 * Array should contain between two and three elements.
 * The previous GeoJSON specification allowed more elements (e.g., which could be used to represent M values),
 * but the current specification only allows X, Y, and (optionally) Z to be defined.
 */
export declare type GeoJSONPosition = number[];

export declare type GeoJsonProperties = {
    [name: string]: any;
} | null;

/**
 * A subclass of {@link VectorTileSource} that is used to represent GeoJSON data.
 *
 * This source tracks a single in-flight data update (`pendingDataUpdate`) to make update
 * lifecycle events deterministic when remote loads and `setData()` calls overlap. The revision-
 * based update state prevents duplicate or out-of-order `DATA_UPDATE_*` events, avoids stale
 * async completions mutating newer state, and reduces no-op update churn during rapid updates.
 */
export declare class GeoJSONSource extends VectorTileSource {
    private static readonly DATA_UPDATE_ERROR_MESSAGE;
    /**
     * Whether the GeoJSON data is dynamic, meaning it will be updated frequently. Default is `false`.
     */
    dynamic: boolean;
    
    private _transformGeoJSON?;
    get type(): string;
    /**
     * Returns the URL template string for the GeoJSON data.
     * @readonly
     */
    get url(): string;
    /**
     * The GeoJSON data associated with the source, either provided statically or from a remote source.
     */
    get data(): GeoJSONFeatureCollection;
    private needsUpdate;
    /**
     * The revision number of the data.
     */
    private dataRevision;
    /**
     * The pending data update being processed.
     */
    private pendingDataUpdate;
    constructor(id: string, spec: Partial<GeoJSONSourceSpecification>);
    /**
     * Sets the URL of the GeoJSON data.
     * @param url -
     */
    setUrl: (url: string) => void;
    /**
     * Returns the URL for the remote GeoJSON data.
     * @param params - Additional variables to use when generating the URL.
     * @returns The URL for the GeoJSON data.
     */
    getUrl(params?: Record<string, any>): string;
    /**
     * Sets the GeoJSON data and triggers a data change event.
     * @param value -
     */
    setData(value: GeoJSONFeatureCollection): void;
    expireAllTiles(): void;
    reload(): void;
    private updateWorkerData;
    private processWorkerUpdate;
    private beginDataUpdate;
    private flushQueuedDataUpdate;
    private completeDataUpdate;
    private failDataUpdate;
}

/**
 * Represents the configuration for a GeoJSON data source.
 */
export declare interface GeoJSONSourceSpecification extends SourceSpecification {
    /**
     * The static GeoJSON data to use.
     */
    data: string | Record<string, any>;
    /**
     * The GeoJSON URL template string to use when requesting GeoJSON data.
     */
    url: string;
    /**
     * Whether the GeoJSON data is dynamic, meaning it will be updated frequently. Default is `false`.
     */
    dynamic?: boolean;
    /**
     * A function that transforms the GeoJSON data before it is sent to the worker for processing.
     * @param source - The GeoJSON source.
     * @param data - The GeoJSON data to transform.
     * @returns The transformed GeoJSON data.
     */
    transformGeoJSON?: (source: GeoJSONSource, data: GeoJSONFeatureCollection) => GeoJSONFeatureCollection;
}

/**
 * The value values for the "type" property of GeoJSON Objects.
 * https://tools.ietf.org/html/rfc7946#section-1.4
 */
export declare type GeoJSONTypes = GeoJSON['type'];

/**
 * Returns the default unit for the given measurement and system.
 * @param type - The measurement to get the default unit for.
 * @param system - The system to get the default unit for.
 * @returns The default unit for the given measurement and system.
 */
declare const getDefaultUnit: (type: ConversionMeasurement, system: UnitSystem) => string;

/**
 * Returns the default units for the given system.
 * @param system - The system to get the default units for.
 * @returns The default units for the given system.
 */
declare const getDefaultUnitsForSystem: (system: UnitSystem) => MapUnits;

declare const getMeasurementType: (str: string) => Measurement | undefined;

/**
 * Returns the system for the given units. If the units are not equal to the default units for any system, then the
 * units are considered to be using a custom unit system.
 * @param units - The units to get the system for.
 * @returns The system for the given units.
 */
declare const getSystemForUnits: (units: MapUnits) => UnitSystem;

declare const getUnitPrecision: (unit: string) => number;

export declare type GoogleMap = google.maps.Map;

/**
 * Provides the configuration options for an {@link GoogleMapController} instance.
 */
export declare interface GoogleMapAdapterOptions extends MapAdapterOptions {
    interleaved?: boolean;
}

/**
 * The GoogleMapController class is a MapController implementation for Google Maps.
 */
export declare class GoogleMapController extends MapController<GoogleMap> {

get container(): HTMLElement;

get libraryInfo(): MapLibraryInfo;
    
    constructor(map: GoogleMap, opts: GoogleMapAdapterOptions);
    getSize(): Size;
    setSize(size: NumericalOrStringSize): void;
    getCenter(): Coordinate;
    setCenter(center: Coordinate): void;
    getBounds(): CoordinateBounds;
    getZoom(): number;
    setZoom(zoom: number): void;
    getBearing(): number;
    getPitch(): number;
    getFov(): number;
    setProjection(projection: ProjectionType): void;
    redraw(): void;

dispose(all?: boolean): void;
}

/**
 * Grid style properties control how gridded content gets rendered on a map. Grid layers will render a grid of symbols
 * or text in a grid layout and sample underlying data at each grid point to determine how each symbol is displayed.
 * @remarks
 * Symbol instances rendered at grid points are projected in screen space, not map space, which means they will remain
 * the same size on screen regardless of map zoom level.
 */
export declare interface GridStyleSpec {
    /**
     * Spacing between grid points at whole number map zoom levels (e.g. `3`, or `10`, not `3.487`). A lower spacing
     * value will result in a higher density of symbol instances per map tile.
     */
    spacing: StyleValue<number>;
}

/**
 * Heatmap style properties control how the density of points in an area gets rendered on a map.
 */
export declare interface HeatmapStyleSpec {
    /**
     * Defines the normalized (`0` to `1`) color scale used to color pixels based on its density value, where `0`
     * is none and `1` being the highest density.
     */
    color: StyleValue<Array<number | string>>;
    /**
     * Radius of influence of each data point in screen points.
     */
    radius: StyleValue<number>;
    /**
     * Controls how much to fade out the edges of each point based on its radius, reducing its overall influence on
     * neighboring points.
     */
    blur: StyleValue<number>;
    /**
     * Value that is multiplied with the weight value to calculate the final weight of a point. A value larger than
     * `1` biases the output color towards the higher end of the color scale, whereas a value less than `1` biases
     * the output color towards the lower end of the color scale.
     */
    intensity: StyleValue<number>;
    /**
     * Amount of weight to give each point.
     */
    weight: StyleValue<number>;
}

declare const hgToMb: (hg: number) => number;

/**
 * Icon style properties control how icons get rendered on a map from vector features. Use these properties on
 * conjunction with `symbol` to define the style for an icon layer.
 */
export declare interface IconStyleSpec {
    
    /**
     * The image to use for the icon. Can be an image identifier string or a {@link RemoteSymbolImage}.
     * @remarks
     * If using a string, the string must be a valid image identifier for an image that has been added to the style's
     * image manager either by calling {@link Style#addImage} or {@link Style#addRemoteImage}. When referencing an image
     * from a sprite sheet, the image identifier must be prefixed with the sprite's identifier, e.g. `"sprite:icon-id"`
     * where `sprite` is the identifier of the sprite sheet and `icon-id` is the identifier of the icon within the
     * sprite sheet.
     */
    image: StyleValue<SymbolIcon>;
    /**
     * Defines an atlas of icons, specifying their IDs and optionally an interval.
     */
    atlas: SymbolIconAtlas;
    /**
     * The size of the icon in screen points.
     */
    size: StyleValue<Size>;
    /**
     * Determines which corner or edge of the icon to place at the anchor point.
     */
    anchor: StyleValue<SymbolAnchor>;
    /**
     * The offset distance, either positive or negative, of the symbol relative to its anchor in screen points.
     */
    offset: StyleValue<Point>;
    /**
     * Margin size to apply around the icon bounding box to use for detecting collisions, in screen points.
     * @remarks
     * If a single value is provided, then the same margin size will be applied to all sides of the symbol bounding
     * box. If an array of two values is provided, then the first value will be applied to the left and right sides of
     * the symbol bounding box, and the second value will be applied to the top and bottom sides of the symbol bounding
     * box.
     */
    padding: StyleValue<number | [number, number]>;
    /**
     * The clockwise rotation angle of the icon in degrees, pivoting around the anchor point.
     */
    rotation: StyleValue<number>;
    
    /**
     * Whether the symbol is animated. For performance optimizations, only set this to `true` if you are using a
     * custom shader program or the {@link StyledImageRenderer} interface for images that require animation.
     */
    animated: boolean;
    /**
     * Custom shader program to use for rendering the symbol.
     */
    shader: StyleValue<string>;
    /**
     * Callback function that is called before the symbol shader program is compiled. This function can be used to
     * modify the shader source code before it is compiled to perform any custom effects to the symbol.
     * @param shader - The vertex and fragment shader source code.
     */
    shaderOnBeforeCompile: (shader: {
        vertex: string;
        fragment: string;
    }) => void;
    /**
     * Uniforms to pass to the custom shader program.
     */
    uniforms: Record<string, any>;
    /**
     * A value that can be assigned per instance based on the underlying data for that instance. This value is assigned
     * as a uniform for the WebGL program and can be used in custom shaders to customize rendering based on each
     * instance's factor value.
     */
    factor: StyleValue<number>;
}

export declare type Identifiable = {
    id: string;
};

/**
 * A type that represents an image.
 */
export declare type ImageRepresentable = {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
};

/**
 * A {@link TileSource} for raster tile images.
 */
export declare class ImageTileSource extends TileSource<ImageTileData> {
    get type(): string;
    protected parseTile(tile: Tile<ImageTileData>, data: Blob, headers?: Headers): Promise<ImageTileData>;
}

/**
 * Type of interpolation to perform on data.
 */
export declare const InterpolationMode: {
    /**
     * Disables interpolation and renders the data at its native resolution, which will often result in blocky and
     * pixelization for raster data that is scaled up.
     */
    readonly none: "none";
    /**
     * Renders data using bilinear interpolation which is the most performance but often results in artifacts and
     * blockiness depending on the data.
     */
    readonly bilinear: "bilinear";
    /**
     * Renders the data using bicubic interpolation which provides the smoothest output.
     */
    readonly bicubic: "bicubic";
    /**
     * Renders the data using biquadratic interpolation which can result in better output than bilinear. This
     * interpolation type is rarely used in favor of bicubic.
     */
    readonly biquadratic: "biquadratic";
};

export declare type InterpolationMode = ObjectValue<typeof InterpolationMode>;

declare const inToM: (ins: number) => number;

declare const inToMM: (ins: number) => number;

declare const inToMMRate: (ins: number) => number;

declare const kmToM: (km: number) => number;

declare const kmToMi: (km: number) => number;

declare const kphToMph: (kph: number) => number;

declare const kphToMs: (kph: number) => number;

/**
 * A label item for a bar legend.
 */
export declare type LabelItem = {
    value: number;
    label: string;
    position?: number;
    span?: number;
};

/**
 * A `Layer` object used to configure a single Aeris Maps layer.
 */
export declare class Layer {
    /**
     * The layer code associated with the layer
     */
    code: string;
    private _opts;
    /**
     * Initializes a layer instance with the specified AMP layer code.
     * @param code - The AMP layer code.
     */
    constructor(code: string);
    /**
     * Sets or returns an option value.
     * @param key - Key of the option to set or get.
     * @param value - Value to set for the option.
     * @returns The layer instance if setting an option, or the option value if getting an option.
     */
    opt(key: string, value?: any): Layer | any;
    /**
     * The layer configuration object.
     * @param value - The layer configuration object to set.
     * @returns The layer configuration object if setting, or the layer configuration object if getting.
     */
    options(value?: LayerOptions): Layer | LayerOptions;
    /**
     * The alpha (opacity) of the layer.
     * @param value - A value from `0` to `100`.
     */
    alpha(value?: number): Layer;
    /**
     * A Boolean indicating whether the layer should use the dark style.
     * @param value - A Boolean indicating whether the layer should use the dark style.
     */
    darkStyle(value?: boolean): Layer;
    /**
     * A Boolean indicating whether the layer is a text layer.
     * @param value - A Boolean indicating whether the layer is a text layer.
     */
    text(value?: boolean): Layer;
    /**
     * A Boolean indicating whether the layer should also include its associated text layer.
     * @param value - A Boolean indicating whether the layer should also include its associated text layer.
     */
    includeText(value?: boolean): Layer;
    /**
     * A Boolean indicating whether the text layer should use large text.
     * @param value - A Boolean indicating whether the text layer should use large text.
     */
    largeText(value?: boolean): Layer;
    /**
     * A Boolean indicating whether the layer should display text values in Metric units.
     * @param value - A Boolean indicating whether the layer should display text values in Metric units.
     */
    metric(value?: boolean): Layer;
    /**
     * The blend mode to apply to the layer.
     * @param value - The blend mode to apply to the layer.
     */
    blendMode(value?: string): Layer;
    /**
     * The amount to blur the layer, which is a value from `0` meaning no blur (default) to `10`.
     * The higher the value, the greater the blur effect.
     * @param value - The amount to blur the layer.
     */
    blur(value?: number): Layer;
    /**
     * The mask layer to apply to the layer.
     * @param value - The mask layer to apply to the layer.
     */
    mask(value?: string): Layer;
    /**
     * Adds a filter to the layer.
     * @param filter - The filter to apply to the layer.
     */
    addFilter(filter: string): Layer;
    /**
     * Removes a filter from the layer.
     * @param filter - The filter to remove from the layer.
     */
    removeFilter(filter: string): Layer;
    /**
     * Removes all filters from the layer.
     */
    removeAllFilters(): Layer;
    /**
     * Returns the layer string based on the layer configuration.
     */
    toString(): string;
}

/**
 * A data type that represents a series of layer groups.
 */
export declare type LayerGroups = {
    /**
     * Base map layers.
     */
    base: string[];
    /**
     * Weather data layers.
     */
    data: string[];
    /**
     * Map overlay layers.
     */
    overlays: string[];
    /**
     * Weather text data layers.
     */
    text: string[];
};

/**
 * Layer mask configuration.
 */
export declare type LayerMask = {
    layers: Array<WebGLLayer>;
    inverted?: boolean;
    mode?: 'all' | 'any';
};

export declare type LayerMaskConfiguration = Partial<LayerMaskSpecification> & {
    /**
     * The type of mask to apply to the layer. This is an alternative to using the `layers` property. If both
     * are provided, the `layers` property will take precedence.
     */
    type?: 'water' | 'land';
};

/**
 * Layer mask specification.
 */
export declare type LayerMaskSpecification = {
    /**
     * An array of layer identifiers and optional overrides to use for masking this layer's output. If the `id` is a
     * weather layer identifier, use the `overrides` property to provide additional options for the layer and the mask
     * layer will be created automatically. Use this in combination with the `mode` property to control how the masks
     * are applied to the layer's final output.
     */
    layers: Array<{
        id: string;
        overrides?: Partial<WeatherLayerOptions>;
    }>;
    /**
     * Whether to invert the mask, meaning the layer will be visible outside of the mask area.
     */
    invert?: boolean;
    /**
     * The mode to use applying the masks, either 'all' (default) or 'any'.
     * - 'all': The layer will be visible only if all the masks are visible (intersection of all masks).
     * - 'any': The layer will be visible if any of the masks are visible (union of all masks).
     */
    mode?: 'all' | 'any';
};

export declare type LayerMetadata = {
    layerId: string;
    sourceLayerId: string;
    sourceLayerType: string;
    type: string;
    filter: FilterExpression;
    paint: PaintStyle;
    options?: Record<string, unknown>;
};

export declare interface LayerOptions {
    alpha: number;
    darkStyle: boolean;
    text: boolean;
    largeText: boolean;
    metric: boolean;
    blendMode: string;
    blur: number;
    filters: string[];
    mask: string;
    includeText: boolean;
}

/**
 * Interface for a layer renderer.
 * A layer renderer is responsible for rendering layer data based on the layer's paint style and configuration.
 * Therefore, most WebGL-related code will be contained within a class that implements this interface.
 */
export declare interface LayerRenderer {
    
    /**
     * The layer that this renderer is associated with.
     */
    layer: WebGLLayer;
    /**
     * Paint style configuration used when rendering the layer's data.
     */
    paint: PaintStyle;
    
    /**
     * Called when the renderer's layer is added to a map.
     * @param layer - The layer that was added.
     */
    onAdd(layer: WebGLLayer): void;
    /**
     * Called when the renderer's layer is removed from a map.
     * @param layer - The layer that was removed.
     */
    onRemove(layer: WebGLLayer): void;
    /**
     * Called when the layer's map first starts moving (panning or zooming).
     * @param layer - The layer that is moving.
     */
    onMoveStart(layer: WebGLLayer): void;
    /**
     * Called when the layer's map stops moving (panning or zooming).
     * @param layer - The layer that stopped moving.
     */
    onMoveEnd(layer: WebGLLayer): void;
    /**
     * Called when the layer's map starts zooming.
     * @param layer - The layer that is zooming.
     */
    onZoomStart(layer: WebGLLayer): void;
    /**
     * Called when the layer's map stops zooming.
     * @param layer - The layer that stopped zooming.
     */
    onZoomEnd(layer: WebGLLayer): void;
    /**
     * Called when the layer's map is resized.
     * @param layer - The layer that was resized.
     */
    onResize(layer: WebGLLayer): void;
    /**
     * Called when the layer's mask state changes.
     */
    onMaskStateChange(): void;
    /**
     * Flags the renderer as dirty so that it is updated during the next render frame.
     */
    setNeedsUpdate(): void;
    /**
     * Called before the primary render method to perform any setup or rendering that needs to be done before
     * rendering, such as rendering to a framebuffer or updating compute passes.
     * @param elapsedTime - The render loop's elapsed time.
     * @param frameContext - Map and layer state for this frame; the renderer must use this instead of reading from the layer or map.
     */
    prerender(elapsedTime: number, frameContext: RenderFrameContext): void;
    /**
     * Render the layer's data.
     * @param elapsedTime - The render loop's elapsed time.
     * @param frameContext - Map and layer state for this frame; the renderer must use this instead of reading from the layer or map.
     */
    draw(elapsedTime: number, frameContext: RenderFrameContext): void;
    /**
     * Performs any necessary set up to prepare the renderer for offscreen rendering, such as setting up a framebuffer.
     */
    prepareForOffscreenRender(): void;
    /**
     * Disposes of all cached data and resources associated with the renderer.
     */
    dispose(): void;
}

/**
 * Represents a layer configuration.
 */
export declare interface LayerSpecification {
    /**
     * Type of layer.
     */
    type: LayerType;
    /**
     * The minimum zoom level for the layer.
     */
    minZoom?: number;
    /**
     * The maximum zoom level for the layer.
     */
    maxZoom?: number;
    /**
     * Data source associated with the layer.
     * @remarks
     * This can be a string representing the ID of a data source, a data source instance or a source specification.
     */
    source: string | SourceSpecification | DataSource;
    /**
     * The layer's data to use from the data source, if applicable. This is only used for vector tile data sources
     * whose tiles are in the Mapbox Vector Tile (MVT) format.
     */
    sourceLayer?: string;
    /**
     * The feature type to render from the data source, if applicable. This is only used for vector tile data sources
     * whose tiles are in the Mapbox Vector Tile (MVT) format.
     */
    sourceType?: VectorSourceType;
    /**
     * Layer identifier of the layer to use for querying/sampling data from, if applicable. This is only used for text
     * or point layers that need to sample data from another layer. Alternatively an object can be provided containing
     * the data layer's id and an optional flag to hide the data layer. The layer must have already been added to the
     * map.
     */
    queryLayer?: string | QueryLayerSpecification;
    /**
     * Layer type to render when this layer is a query layer. This is only used for query layers that need to render
     * data in a different way than the queried layer. If not provided, the query layer will render as text.
     */
    queryType?: ObjectValueFromKeys<typeof LayerType, 'text' | 'symbol' | 'circle'>;
    /**
     * Layer mask configuration to use when rendering the the layer, if any. The layer(s) used for masking must have
     * already been added to the map.
     */
    mask?: LayerMaskSpecification;
    /**
     * Filter expression for vector tile layers. Evaluated with StyleExpression.
     * @see FilterExpression
     */
    filter?: FilterExpression;
    /**
     * Time series configuration for the layer when time-based.
     */
    timeSeries?: Partial<LayerTiming>;
    /**
     * Optional measurement metadata associated with this layer's values.
     */
    measurement?: {
        type: ConversionMeasurement;
        units: string;
    };
    /**
     * Data resolution to use, which controls which data zoom level is requested for a specific map zoom level.
     * @remarks
     * Using a lower data quality value will reduce the amount of data needed for the visible map region but also
     * result is lower data resolution. Using a higher quality value will provide the most accurate result and
     * highest data resolution but also increase the amount of data required.
     * A lower quality value is useful in environments where resource limitations exist, such as mobile devices or
     * less capable hardware.
     * @see DataQuality
     */
    quality?: DataQuality;
    /**
     * Zoom level offset to use when requesting and rendering data. This is useful for rendering data at a different
     * zoom level than the current map zoom level.
     */
    zoomOffset?: number;
    /**
     * Whether to preload low-quality tiles when the layer is added or the time range changes,
     * ensuring fallback data is available immediately when panning or zooming beyond currently
     * loaded tile bounds. Default is `false`.
     */
    preloadLowQuality?: boolean;
    /**
     * Render style configuration.
     * @see PaintStyleSpec
     */
    paint: Partial<PaintStyleSpec>;
}

/**
 * Timing configuration options for a layer.
 */
export declare type LayerTiming = {
    mode: TimeSeriesMode;
    /**
     * Defines how to restrict the visibility of a time-specific layer, either `past`, `future` or `range` time
     * intervals.
     */
    clamp: TimeClampMode;
    /**
     * Defines the valid start and end date range for the layer. When provided, the layer will automatically be
     * hidden outside of this date range.
     */
    range: TimeRange;
    /**
     * Maximum number of time intervals to use for the data set.
     * @remarks
     * The actual intervals returned by the server may be less than this value depending on the available valid
     * times within the requested range of the map's timeline and the data source. NOTE: Increasing this value may
     * affect the performance of your map, so avoid setting this to large numbers.
     */
    intervals: number;
    /**
     * Whether data requests for animation frames should be interleaved. Default value is `true`.
     * @remarks
     * Data requests for time series animations are broken up in to multiple interval chunks of based on
     * the maximum number of intervals per request. When `true`, data requests for each frame of the animation will
     * be staggered and loaded at evenly-spaced intervals across the entire time range of the animation so that
     * the full time range can be animated as remaining intervals continue loading and filling in between
     * already-loaded intervals. When `false`, data requests will be loaded in sequential order, starting from the
     * beginning of the time range.
     */
    interleaved: boolean;
    /**
     * The operation to perform on the data within the time series. Defaults to `none`.
     */
    operation: TimeSeriesOperation;
};

export declare const LayerType: {
    /**
     * A raster tile layer.
     */
    readonly raster: "raster";
    /**
     * A vector tile layer that renders point features as circles.
     */
    readonly circle: "circle";
    /**
     * A vector tile layer that renders polygon and polyline features as filled geometry.
     */
    readonly fill: "fill";
    /**
     * A vector tile layer that renders polygon and polyline features as line geometry.
     */
    readonly line: "line";
    /**
     * A raster tile layer that applies a color scale to the data.
     */
    readonly sample: "sample";
    /**
     * A vector tile layer that renders point features as a grid of symbols based on the associated raster data.
     */
    readonly grid: "grid";
    /**
     * A vector tile layer that renders point features as a heatmap.
     */
    readonly heatmap: "heatmap";
    /**
     * A raster tile layer that renders contour lines by interpolating the raster data.
     */
    readonly contour: "contour";
    /**
     * A raster tile layer that renders particles based on the associated raster data.
     */
    readonly particle: "particle";
    /**
     * @deprecated Use `LayerType.particle` instead.
     */
    readonly particles: "particles";
    /**
     * A vector tile layer that renders point features as symbols, icons, or text glyphs.
     */
    readonly symbol: "symbol";
    /**
     * A vector tile layer that renders point features as text.
     * @deprecated Use `LayerType.symbol` instead.
     */
    readonly text: "text";
    /**
     * A vector tile layer that renders point features as text by querying data from another layer.
     */
    readonly query: "query";

};

export declare type LayerType = ObjectValue<typeof LayerType>;

/**
 * The LeafletMapController is a MapController implementation for Leaflet maps.
 */
export declare class LeafletMapController extends MapController<L.Map> implements MapProvider {

get container(): HTMLElement;
    constructor(map: L.Map, opts: MapAdapterOptions);
    getSize(): Size;
    setSize(size: NumericalOrStringSize): void;
    getCenter(): Coordinate;
    setCenter(center: Coordinate): void;
    getBounds(): CoordinateBounds;
    getZoom(): number;
    setZoom(zoom: number): void;
    getBearing(): number;
    getPitch(): number;
    getFov(): number;
    setProjection(projection: ProjectionType): void;
    redraw(): void;

dispose(all?: boolean): void;
}

/**
 * A legend for a map layer.
 */
declare abstract class Legend extends EventDispatcher {
    readonly id: string;
    readonly state: State<LegendState>;
    options: Partial<LegendOptions>;

private _rendered;
    get measurement(): string | undefined;
    get size(): Size;
    get canvas(): HTMLCanvasElement;
    get layout(): LegendLayout;
    constructor(id: string, options: Partial<LegendOptions>);
    setUnits(units: string): void;
    update: (options: Partial<LegendOptions>, state?: LegendRenderOptions) => void;
    render(state?: LegendRenderOptions): void;

protected _prepareCanvas(): void;
}

/**
 * A control for managing and displaying legends on a map.
 */
export declare class LegendControl extends EventDispatcher {
    options: Partial<LegendControlOptions>;
    legends: Map<string, LegendItemWrapper>;

get container(): HTMLElement;
    /**
     * Returns whether the legend is using metric system units.
     */
    get metric(): boolean;
    /**
     * Sets whether the legend should be using metric system units. If `false`, then the legend will use imperial
     * system units.
     */
    set metric(value: boolean);
    constructor(options?: Partial<LegendControlOptions>);
    /**
     * Sets the units of measurement for the legend.
     * @param units - The units of measurement to set.
     */
    setUnits(units: MapUnits): void;
    /**
     * Adds the legend control to a target element.
     * @param target - The DOM element or selector string for the target element to add the legend control to.
     */
    addTo(target: HTMLElement | string): void;
    /**
     * Removes the legend control from the DOM container element.
     */
    remove(): void;
    /**
     * Updates the legend control with new state.
     * @param state - The new state to update the legend control with.
     */
    update(state: Record<string, any>): void;
    /**
     * Returns whether the legend control has a legend with the given ID.
     * @param id - The ID of the legend to check for.
     * @returns `true` if the legend control has a legend with the given ID, otherwise `false`.
     */
    hasLegend(id: string): boolean;
    /**
     * Returns the legend with the given ID.
     * @param id - The ID of the legend to get.
     * @returns The legend with the given ID, or `undefined` if no legend with the given ID exists.
     */
    getLegend(id: string): Legend;
    /**
     * Adds a legend to the legend control.
     * @param id - The ID of the legend to add.
     * @param config - The configuration options for the legend.
     * @param state - The state to use when rendering the legend.
     * @returns The added legend.
     */
    addLegend(id: string, config: Partial<LegendOptions>, state?: LegendRenderOptions): Legend;
    /**
     * Removes a legend from the legend control. If multiple references to the legend exist, then the legend will not
     * be removed until all references have been removed.
     * @param id - The ID of the legend to remove.
     * @param force - Whether to force the removal of the legend.
     */
    removeLegend(id: string, force?: boolean): void;
    /**
     * Shows a legend item.
     * @param id - The ID of the legend item to show.
     */
    showLegend(id: string): void;
    /**
     * Hides a legend item.
     * @param id - The ID of the legend item to hide.
     */
    hideLegend(id: string): void;
    /**
     * Toggles the units of the legend between metric and imperial. If the legend is using a custom unit system, then
     * the units will not be toggled.
     */
    toggleUnits(): void;

}

/**
 * Configuration options for a legend control.
 */
export declare interface LegendControlOptions {
    width: number;
    insets: number | Array<number>;
    system: UnitSystem;
    units: MapUnits;
    toggleOnClick: boolean;
}

/**
 * Wrapper for a legend item that includes the legend canvas and
 * additional elements for handling overflow and scrolling.
 */
export declare class LegendItemWrapper extends EventDispatcher {
    legend: Legend;
    element: HTMLElement;
    parent: HTMLElement;
    ref: number;
    index: number;

constructor(legend: Legend, title?: string);
    show(): void;
    hide: () => void;
    remove: () => void;
    observe(): void;
    dispose(): void;

}

/**
 * Layout information for a legend.
 */
export declare type LegendLayout = {
    size: Size;
    bounds: Bounds;
    cols: number;
    rows: number;
    colWidth: number;
    rowHeight: number;
};

/**
 * Configuration options for a legend.
 */
export declare interface LegendOptions extends Identifiable {
    type: 'bar' | 'point';
    title?: string;
    width?: number;
    insets?: number | Array<number>;
    enabled?: boolean;
    points?: Partial<PointLegendOptions>;
    bar?: Partial<BarLegendOptions> | Array<Partial<BarLegendOptions>>;
    text?: Partial<{
        family: string;
        color: string;
        stroke: Partial<{
            color: string;
            width: number;
        }>;
        size: number;
        style: 'normal' | 'italic';
        weight: 'normal' | 'bold' | 'bolder' | 'lighter';
        offset: Partial<Point>;
        shadow: Partial<{
            color: string;
            blur: number;
            offset: Partial<Point>;
        }>;
    }>;
    /**
     * A function that is called before the legend is updated. This can be used to modify the options before the legend
     * is rendered.
     */
    onBeforeUpdate?: (options: Partial<LegendOptions>) => Partial<LegendOptions>;
}

/**
 * Render options for a legend.
 */
export declare type LegendRenderOptions = {
    time?: Date;
    bounds?: CoordinateBounds;
    
};

export declare type LegendState = {
    units: string;
};

/**
 * Line cap type.
 */
export declare const LineCap: {
    /**
     * Squares off the ends of a line at the exact endpoint of the line.
     */
    readonly Butt: "butt";
    /**
     * Rounds off the ends of a line by filling half a circle centered on the line's endpoints. The radius for these
     * rounded corners is equal to one-half the line width.
     */
    readonly Round: "round";
    /**
     * Squares off the ends of a line by extending the line a distance of one-half the line's width beyond the
     * endpoints.
     */
    readonly Square: "square";
};

export declare type LineCap = ObjectValue<typeof LineCap>;

/**
 * Line join type.
 */
export declare const LineJoin: {
    /**
     * Squares off the edges of a segment by extending the line a distance of one-half the line's width beyond the
     * segment endpoint.
     */
    readonly Bevel: "bevel";
    /**
     * Rounds off the corners of a segment by filling half a circle centered at the common endpoint of connected
     * segments. The radius for these rounded corners is equal to one-half the line width.
     */
    readonly Round: "round";
    /**
     * Connected segments are joined by extending their outside edges to connect at a single point, with the effect
     * of filling an additional lozenge-shaped area.
     */
    readonly Miter: "miter";
};

export declare type LineJoin = ObjectValue<typeof LineJoin>;

/**
 * Provides the configuration options for an {@link MapController} instance.
 */
export declare interface MapAdapterOptions {
    /**
     * An {@link Account} instance configured with your Xweather client id and secret keys for the application.
     */
    account: Account;
    units?: Partial<MapUnits>;
    /**
     * The {@link TimeAnimationOptions} containing configuration options for the map controller's timeline.
     */
    animation?: Partial<TimeAnimationOptions & {
        /**
         * Whether to pause the timeline animation while data required for animating is loading. Default is `false`.
         * If `true`, then the entire timeline will pause animation playback while any layers are loading data required
         * for animating.
         */
        pauseWhileLoading: boolean;
        /**
         * Whether to resume the timeline animation after a move end event if the animation was playing before the map
         * move started through a pan or zoom. Default is `true`.
         * @remarks
         * This option is useful for resuming the animation after a user has panned or zoomed the map. Active layers
         * that were animating at the time of the move event may need to load new data or update their data based on
         * the new map bounds and zoom level, which will also occur after the move end event. If this option is set to
         * `false`, the animation will not resume after the move end event, and the user will need to manually resume
         * the animation if desired using `timeline.resume()` or `timeline.start()`.
         */
        resumeOnMoveEnd: boolean;
        /**
         * Whether to always preload data for the animation. If `true`, then the animation will always preload data
         * for the animation when the map viewport changes or when animatable layers are added, even if the animation
         * is not currently playing. This is useful for ensuring that the animation has data to play when it is started.
         * Default is `false`.
         */
        preloadData: boolean;
    }>;
}

export declare type MapboxMap = mapboxgl.Map;

/**
 * The MapboxMapController is a MapController implementation for Mapbox maps.
 */
export declare class MapboxMapController extends MapController<MapboxMap> implements MapProvider {

get container(): HTMLElement;
    get libraryInfo(): MapLibraryInfo;
    constructor(map: MapboxMap, opts: MapAdapterOptions);
    getSize(): Size;
    setSize(size: NumericalOrStringSize): void;
    getCenter(): Coordinate;
    getNonPaddedCenter(): Coordinate;
    setCenter(center: Coordinate): void;
    getBounds(): CoordinateBounds;
    getZoom(): number;
    setZoom(zoom: number): void;
    getBearing(): number;
    getPitch(): number;
    getFov(): number;
    redraw(): void;
    moveLayer(id: string, beforeId?: string): void;

getProjection(): ProjectionType;
    setProjection(projection: ProjectionType): void;

dispose(all?: boolean): void;
}

export declare class MapCamera {
    private _transform;
    private _orientation;
    private readonly _quat;
    private readonly _vec3;
    get position(): Vector3;
    set position(value: Vector3);
    get orientation(): Quaternion;
    set orientation(value: Quaternion | null);
    get forward(): Vector3;
    get right(): Vector3;
    get up(): Vector3;
    setPitchBearing(pitch: number, bearing: number): void;
    /**
     * Transforms world space into camera space (view matrix).
     * @param worldSize - The world size
     * @param pixelsPerMeter - The number of pixels per meter
     * @returns The view matrix
     */
    worldToCameraMatrix(worldSize: number, pixelsPerMeter?: number): Matrix4;
    /**
     * Writes world->camera matrix into `out` to avoid per-frame allocations.
     */
    worldToCameraMatrixInto(out: Matrix4, worldSize: number, pixelsPerMeter?: number): Matrix4;
    calculateCameraOrientation(bearing: number, pitch: number): Quaternion;
}

/**
 * A MapController class acts as the interface between the map view of a mapping library and MapsGL-specific
 * functionality.
 */
declare abstract class MapController<MapType> extends EventDispatcher {
    /**
     * The {@link Account} instance configured with your Xweather client id and secret keys for the application.
     */
    readonly account: Account;
    /**
     * The underlying map instance whose type will vary depending on the mapping library being used.
     */
    readonly map: MapType;

/**
     * The {@link Timeline} instance used for managing animation and time-based data.
     */
    readonly timeline: Timeline;
    
    /**
     * The {@link WeatherLayerProvider} instance used for managing weather layer configurations and data.
     */
    readonly weatherProvider: WeatherLayerProvider;

get needsViewportUpdate(): boolean;
    
    private _isReady;
    /**
     * The DOM element that contains the map.
     */
    get container(): HTMLElement;

/**
     * Returns whether the map controller has been initialized and is ready for use. If `false`, then the map controller
     * is still in the process of loading and/or initializing and you will need to add an event listener for the `load`
     * event before performing actions with the map or controller.
     * @readonly
     */
    get isReady(): boolean;
    /**
     * The frames per second (FPS) of the context.
     */
    get fps(): number;
    /**
     * Returns an array of active data sources that have been added to the map.
     * @readonly
     */
    get sources(): Array<DataSource>;
    /**
     * Returns an array of active layers that have been added to the map.
     * @readonly
     */
    get layers(): Array<WebGLLayer>;
    /**
     * Returns the set of controls that have been added to the map.
     * @readonly
     */
    get controls(): ControlStore;
    /**
     * Returns an array of identifiers for the active data sources that have been added to the map.
     * @readonly
     */
    get sourceIds(): Array<string>;
    /**
     * Returns an array of identifiers for the active layers that have been added to the map.
     * @readonly
     */
    get layerIds(): Array<string>;
    /**
     * Returns an array of weather layer identifiers that have been added to the map.
     * @readonly
     */
    get weatherLayerIds(): Array<string>;
    /**
     * Returns metadata and version information about the mapping library being used.
     * @readonly
     */
    get libraryInfo(): MapLibraryInfo;
    constructor(map: MapType, opts: MapAdapterOptions);
    initialize(): Promise<void>;
    /**
     * Validates that the version of the mapping library being used is supported.
     */
    checkVersion(): void;
    /**
     * Returns the map's container size.
     */
    getSize(): Size;
    /**
     * Sets the size of the map's container.
     * Use this method instead of setting the size on the container DOM element directly as it will perform any
     * necessary map size invalidation and redraws needed depending on the mapping library being used.
     * @param size - The new size of the map's container.
     */
    setSize(size: NumericalOrStringSize): void;
    protected setContainerSize({ width, height }: NumericalOrStringSize): void;
    /**
     * Returns the map's geographical center coordinate.
     */
    getCenter(): Coordinate;
    
    /**
     * Sets the map's geographical center coordinate.
     * @param center -
     */
    setCenter(center: Coordinate): void;
    /**
     * Returns the map's visible geographical bounds.
     */
    getBounds(): CoordinateBounds;
    /**
     * Returns the map's current zoom level.
     */
    getZoom(): number;
    /**
     * Sets the map's zoom level.
     * @param zoom - The new zoom level to set.
     */
    setZoom(zoom: number): void;
    /**
     * Returns the map's current rotational bearing in degrees, if supported. A bearing of `0` orients the map so that
     * north is up.
     */
    getBearing(): number;
    /**
     * Returns the map's current pitch/tilt in degrees, if supported.
     */
    getPitch(): number;
    /**
     * Returns the map camera's current field-of-view in degrees.
     */
    getFov(): number;
    /**
     * Returns the current units of measurement for the map.
     */
    getUnits(): MapControllerState['units'];
    /**
     * Sets one or more units of measurement for the map. This will trigger a redraw of the map to update any
     * measurements or displayed data values that are affected by the new units.
     * @param units - An object containing one or more units to set.
     */
    setUnits(units: Partial<MapControllerState['units']>): void;
    /**
     * Sets the units of measurement for the map to the units for the specified system.
     * @param system - The system to set the units for, either `UnitSystem.metric` or `UnitSystem.imperial`.
     */
    setUnitsForSystem(system: UnitSystem): void;
    /**
     * Triggers a redraw of the map.
     */
    redraw(): void;
    /**
     * Resizes the map according to the current size of the map's `container` element.
     * @remarks
     * This method must be called after the map's `container` element is resized programmatically or when the map is
     * shown after being initially hidden via CSS.
     * @example
     * Resize the map after its container element size has changed:
     * ```ts
     * const map = document.querySelector('#map');
     * map.style.height = '600px';
     * controller.resize();
     * ```
     */
    resize(): void;
    /**
     * Toggles the fullscreen state of the map.
     * Use this method instead of any native method the third-party mapping library provides in order for MapsGL
     * controls, like the data inspector or legend, will accompany the map when in fullscreen.
     */
    toggleFullscreen(): void;
    /**
     * Sets the value of a paint style property for the specified layer.
     * @param layerId - Identifier of the layer to set the paint property on.
     * @param property - Paint style property to set as a key path string.
     * @param value - New value of the paint style property to set.
     */
    setPaintProperty(layerId: string, property: string, value: any): void;
    /**
     * Adds a legend control to the map in the specified DOM element.
     * @param target - The DOM element to add the legend control to.
     * @param options - The configuration options for the legend control.
     * @returns The newly added legend control instance.
     */
    addLegendControl(target: HTMLElement, options?: Partial<LegendControlOptions>): LegendControl;
    /**
     * Adds a data inspector control to the map.
     * @param options - The configuration options for the data inspector control.
     * @returns The newly added data inspector control instance.
     */
    addDataInspectorControl(options?: Partial<DataInspectorControlOptions>): DataInspectorControl;
    /**
     * Removes the legend control from the map.
     */
    removeLegendControl(): void;
    /**
     * Removes the data inspector control from the map.
     */
    removeDataInspectorControl(): void;
    addDayNightOverlay(): void;
    removeDayNightOverlay(): void;
    /**
     * Returns whether the map currently contains a weather layer with the specified identifier.
     * @param id - Weather layer identifier to check for.
     * @returns `true` if the weather layer exists, otherwise `false`
     */
    hasWeatherLayer(id: string): boolean;
    /**
     * Returns the map layer associated with the specified weather layer identifier if it exists on the map. If the
     * weather layer identifier is an alias that maps to multiple layers, then an array of the layers will be returned.
     * @param id - Weather layer identifier to get the layer(s) for.
     * @returns The map layer or an array of layers if the weather identifier has been added to the map, otherwise
     * `undefined`
     */
    getWeatherLayer(id: string): WebGLLayer | Array<WebGLLayer> | undefined;
    /**
     * Sets the visibility of a weather layer on the map. Any legends associated with the weather layer will be
     * automatically shown or hidden.
     * @param id - The identifier of the weather layer to set the visibility for.
     * @param visible - `true` to show the weather layer, `false` to hide it.
     */
    setWeatherLayerVisibility(id: string, visible: boolean): void;
    
    /**
     * Adds a new weather layer to the map.
     * @param idOrConfig - One of the supported weather layer identifiers or a weather layer configuration object.
     * @param overrides - An object containing data and render style overrides for the weather layer.
     * @param beforeId - The identifier of an existing map layer to insert the new layer before, which will result in
     * the new layer appearing below the target layer. If not provided, then the new layer will be added to the end of
     * the layer stack and above all other layers.
     * @returns The newly added map layer or an array of layers if the weather layer identifier maps to multiple layers.
     */
    addWeatherLayer(idOrConfig: WeatherLayerConfiguration | string, overrides?: Partial<WeatherLayerOptions>, beforeId?: string): WebGLLayer | Array<WebGLLayer>;
    /**
     * Removes a weather layer from the map.
     * @param id - One of the supported weather layer identifiers.
     */
    removeWeatherLayer(id: string): void;
    /**
     * Returns whether the map currently contains a data source with the specified identifier.
     * @param id - Identifier of the data source to check for.
     * @returns `true` if the data source exists, otherwise `false`
     */
    hasSource(id: string): boolean;
    /**
     * Returns whether the map currently contains a layer with the specified identifier.
     * @param id - Identifier of the layer to check for.
     * @returns `true` if the layer exists, otherwise `false`
     */
    hasLayer(id: string): boolean;
    /**
     * Returns the data source associated with the specified identifier.
     * @param id - Identifier of the data source to get.
     * @returns The data source if it exists, otherwise `undefined`
     */
    getSource(id: string): DataSource;
    /**
     * Returns the layer associated with the specified identifier.
     * @param id - Identifier of the layer to get.
     * @returns The layer if it exists, otherwise `undefined`
     */
    getLayer(id: string): WebGLLayer;
    /**
     * Returns the layer associated with the specified identifier pattern.
     * @param pattern - Identifier pattern to match against.
     * @returns The layer if it exists, otherwise `undefined`
     */
    findLayer(pattern: string): WebGLLayer;
    /**
     * Adds a new data source to the map.
     * @param id - A unique identifier for the source.
     * @param config - The configuration options for the source.
     * @returns The newly added data source.
     */
    addSource(id: string, config: Partial<SourceSpecification> | DataSource): DataSource;
    /**
     * Adds a new layer to the map.
     * @param id - A unique identifier for the layer.
     * @param config - The configuration options for the layer.
     * @param beforeId - The identifier of an existing map layer to insert the new layer before, which will result in
     * the new layer appearing below the target layer. If not provided, then the new layer will be added to the end of
     * the layer stack and above all other layers.
     * @returns The newly added layer.
     */
    addLayer(id: string, config: Partial<LayerSpecification> | WebGLLayer, beforeId?: string): WebGLLayer;
    /**
     * Moves a layer to a different position in the layer stack.
     * @param id - Identifier of the layer to move.
     * @param beforeId - The identifier of an existing map layer to insert the new layer before, which will result in
     * the new layer appearing below the target layer. If not provided, then the new layer will be added to the end of
     * the layer stack and above all other layers.
     */
    moveLayer(id: string, beforeId?: string): void;
    /**
     * Removes a data source from the map.
     * @param id - Identifier of the data source to remove.
     * @param dispose - Whether to dispose of the data source after removing it from the map. Defaults to `false`.
     */
    removeSource(id: string, dispose?: boolean): void;
    /**
     * Removes a layer from the map.
     * @param id - Identifier of the layer to remove.
     * @param dispose - Whether to dispose of the layer after removing it from the map. Defaults to `true`.
     */
    removeLayer(id: string, dispose?: boolean): void;
    /**
     * Queries the map for data and features at the specified coordinate based on the visible map layers.
     * The value returned by each layer will vary depending on the type of render style used for that layer. For
     * example, a sample fill layer style will return the sampled value at that coordinate from the data source,
     * whereas a vector or GeoJSON layer style will return the model properties associated with the feature at that
     * location.
     * @param coord - Coordinate to query for features at.
     * @returns An object keyed by layer identifier with the value being an array of features at the specified
     *     coordinate.
     */
    query(coord: Coordinate): Record<string, any>;
    /**
     * Queries the map for data and features at the specified coordinate based on the visible map layers.
     * The value returned by each layer will vary depending on the type of render style used for that layer. For
     * example, a sample fill layer style will return the sampled value at that coordinate from the data source,
     * whereas a vector or GeoJSON layer style will return the model properties associated with the feature at that
     * location.
     * @param coord - Coordinate to query for features at.
     * @returns A promise that resolves with an object keyed by layer identifier with the value being an array of
     * features at the specified coordinate.
     */
    queryPromise(coord: Coordinate): Promise<Record<string, any>>;
    private _refreshInterval;
    /**
     * Sets the refresh interval for reloading data on the map. This will also update the timeline's start and end
     * dates by the same amount of time this interval is set to so that the timeline will advance in sync with the data
     * reloads.
     * @param minutes - The number of minutes between data reloads. Set to `0` to disable automatic data reloading.
     * @param advanceToNow - Whether to advance the timeline to the current date when data is reloaded. If `false`,
     * then the timeline's current position will remain unchanged. Defaults to `true`.
     */
    setRefreshInterval(minutes: number, advanceToNow?: boolean): void;
    private _triggerPreloadAnimation;
    private _preloadAnimationRequestId;
    private _activePreloadAnimationPromise?;
    private _hasPendingPreloadAnimationRequest;
    /**
     * Schedules animation preload work and returns the active drain promise.
     * Calls are coalesced: if preload is already running, this only marks that another pass should run after the
     * current one completes.
     */
    preloadAnimationData(): Promise<void>;
    /**
     * Processes queued preload requests until no further requests are pending.
     * If a newer request arrives during a preload pass, marks animators dirty so the next pass recomputes against
     * the newest viewport and timeline state.
     */
    private _drainPreloadAnimationQueue;
    /**
     * Invalidates in-flight preload work.
     * This does not abort the current async operation directly; it marks the current pass stale and forces the next
     * queued pass to refresh from latest state.
     */
    private cancelPreloadAnimationData;
    private debouncedPreloadAnimationData;
    private setNeedsPreloadAnimationData;
    private preloadAnimationDataIfNeeded;
    triggerRedraw(): void;
    protected getTransform(map: MapType, projection?: ProjectionType): MapTransform;
    getProjection(): ProjectionType;
    setProjection(projection: ProjectionType): void;

protected getViewportState(): MapViewState;

protected fadeSymbolsIfNeeded(): void;
    
    private setupLegendEvents;

private _handleLayerLoadEvent;
    private _handleLayerShow;
    private _handleLayerHide;

dispose(all?: boolean): void;
}

/**
 * Current state of the map.
 */
export declare interface MapControllerState {
    /**
     * Whether the map is currently in fullscreen mode.
     */
    fullscreen: boolean;
    /**
     * The current tile bounds of the map.
     */
    tileBounds: TileBounds;
    /**
     * Current units used for various measurements and displayed data values on the map.
     */
    units: MapUnits;
}

/**
 * Provides metadata and version information about the mapping library being used.
 */
export declare interface MapLibraryInfo {
    /**
     * The name of the mapping library.
     */
    name: string;
    /**
     * Version information for the mapping library.
     */
    version: {
        /**
         * The current version of the mapping library.
         */
        current: number;
        /**
         * The minimum version of the mapping library supported by MapsGL.
         */
        min: number;
    };
}

export declare type MaplibreMap = maplibregl.Map;

/**
 * A MaplibreMapController is a MapController implementation for Maplibre maps.
 */
export declare class MaplibreMapController extends MapboxMapController {
    private projection;
    get libraryInfo(): MapLibraryInfo;
    constructor(map: MaplibreMap, opts: MapAdapterOptions);
    getFov(): number;

getProjection(): ProjectionType;
    setProjection(projection: ProjectionType): void;
}

/**
 * An object that contains valid times and dates represented by a map request.
 */
export declare class MapMetadata {
    /**
     * Date for which the data is valid for.
     */
    validDate: Date;
    /**
     * Beginning date for which the data should be used.
     */
    minValidDate: Date;
    /**
     * Ending date for which the data should be used.
     */
    maxValidDate: Date;
    /**
     * Date when the data was generated.
     */
    runDate: Date;
    /**
     * Creates and returns a MapMetadata instance initialized with the specified headers.
     * @param headers - The headers object to initialize the instance with.
     */
    constructor(headers: Headers | any);
}

export declare interface MapOverlay {
    update(date: Date): void;
    addToMap(controller: AnyMapController): void;
    removeFromMap(controller: AnyMapController): void;
}

/**
 * Provides a common interface when communicating between data layers and the associated map.
 */
export declare interface MapProvider extends Observable {
    getSize(): Size;
    getCenter(): Coordinate;
    getBounds(): CoordinateBounds;
    getZoom(): number;
    getBearing(): number;
    getPitch(): number;
    getFov(): number;
}

/**
 * An object that is responsible for configuring and performing a single request to the Aeris Weather API.
 */
export declare class MapRequest {
    /**
     * Base configuration for the request.
     */
    config: ApiConfig;
    /**
     * Parameters associated with the request.
     */
    private _params;
    private _serverRange;
    private _paramKeys;
    private _request;
    /**
     * Initializes a new request instance configured with the specified client access keys.
     * @param config - The configuration object for the request.
     * @param opts - The options to configure the request with.
     */
    constructor(config: ApiConfig, opts?: MapRequestOptions);
    /**
     * Sets or returns the specified parameter.
     * @param key - The key of the parameter to set or get.
     * @param value - The value to set for the parameter.
     */
    param(key: string, value?: any): MapRequest | any;
    /**
     * Sets multiple request parameters.
     * @param params - The parameters to set for the request.
     */
    setParams(params: any): MapRequest;
    /**
     * Sets the type of map image to request, either `image` (default) or `tile`.
     * @param type - The type of map image to request.
     */
    type(type: MapRequestType): MapRequest;
    /**
     * Sets the base layers, which will be rendered at the bottom of the layer stack.
     * @param value - The base layers to set.
     */
    base(value?: string | string[] | Layer[]): MapRequest;
    /**
     * Sets the weather data layers, which will be rendered above the base layers but below overlays and text.
     * @param value - The weather data layers to set.
     */
    data(value?: string | string[] | Layer[]): MapRequest;
    /**
     * Sets the overlay layers, which will be rendered above weather data layers but below text layers.
     * @param value - The overlay layers to set.
     */
    overlays(value?: string | string[] | Layer[]): MapRequest;
    /**
     * Sets the text layers, which will be rendered at the top of the layer stack.
     * @param value - The text layers to set.
     */
    text(value?: string | string[] | Layer[]): MapRequest;
    /**
     * Sets all layers, which will be rendered in the order in which they are provided by `value`.
     * @param value - The layers to set.
     */
    layers(value?: string | string[] | Layer[]): MapRequest;
    /**
     * Sets the location the map will be centered on.
     * @param value - The location to center the map on.
     */
    place(value?: string): MapRequest;
    /**
     * Sets the center for the map request. The center can be a place name or a geographical
     * coordinate value.
     * @param value - The center value to set.
     */
    center(value?: string | Coordinate): MapRequest;
    /**
     * Sets the zoom level.
     * @param value - The zoom level to set.
     */
    zoom(value?: number): MapRequest;
    /**
     * Sets the bounding box coordinates for the rendered map region.
     * @param value - The bounding box coordinates to set.
     */
    bounds(value?: CoordinateBounds): MapRequest;
    /**
     * Sets the map width and height.
     * @param w - The width of the map.
     * @param h - The height of the map.
     */
    size(w: number, h: number): MapRequest;
    /**
     * Sets the time offset value.
     * @param value - The time offset value to set.
     */
    offset(value?: string | number): MapRequest;
    suffix(value?: string): MapRequest;
    /**
     * Sets the time offset value using the specified date.
     * @param value - The date to set the time offset value with.
     */
    date(value: Date): MapRequest;
    /**
     * Sets whether text data should be rendered as Metric units.
     * @param value - A Boolean indicating whether text data should be rendered as Metric units.
     */
    metric(value?: boolean): MapRequest;
    /**
     * Sets the server subdomain range for the request, e.g. `[1, 2, 3, 4]`.
     * @param value - The server subdomain range to set.
     */
    range(value?: number[]): MapRequest | number[];
    /**
     * Perform the request.
     */
    get(callback?: (result: MapResult) => void): Promise<MapResult>;
    /**
     * Returns the url string for the request based on the configured parameters and options.
     * @param groups - The layer groups to include in the request.
     */
    url(groups?: string[]): string;
    /**
     * Returns a copy of the request.
     */
    clone(): MapRequest;
}

/**
 * A data type that represents the configuration options for an API map request.
 */
export declare interface MapRequestOptions {
    /**
     * Type of map request, which determines the request URL format.
     */
    type?: MapRequestType;
    /**
     * Layer groups.
     */
    layers?: string[] | LayerGroups;
    /**
     * Location the map will be centered on.
     */
    p?: string;
    /**
     * Zoom level.
     */
    zoom?: number;
    /**
     * Coordinate bounds defining the visible region.
     */
    bounds?: CoordinateBounds;
    /**
     * Output image size.
     */
    size?: {
        width: number;
        height: number;
    };
    /**
     * Time offset for the map data.
     */
    offset?: string;
    /**
     * Whether text values should be output in Metric units.
     */
    metric?: boolean;
    /**
     * Output format, e.g. `png` or `jpg`.
     */
    format?: string;
}

/**
 * An enumerated value representing the type of map request.
 */
declare const MapRequestType: {
    readonly image: "image";
    readonly tile: "tile";
};

export declare type MapRequestType = ObjectValue<typeof MapRequestType>;

/**
 * An `MapResult` object contains response information about an AMP request.
 */
export declare class MapResult {
    /**
     * The response object returned by the request.
     */
    response: any;
    /**
     * The image returned by the API.
     */
    image: HTMLImageElement;
    /**
     * The error that occurred during the request, if any.
     */
    error: any;
    /**
     * The request parameters that were used.
     */
    params: any;
    /**
     * Additional information about the returned map image, such as valid and run times.
     */
    metadata: MapMetadata;
    /**
     * Initializes a result instance with the necessary response information.
     * @param response - The response object returned by the request.
     * @param image - The image returned by the API.
     * @param error - The error that occurred during the request, if any.
     * @param params - The request parameters that were used.
     */
    constructor(response: any, image: HTMLImageElement, error: any, params?: any);
    /**
     * Returns the headers returned by the response, if any.
     */
    headers(): Headers;
}

/**
 * The units of measurement for the map.
 */
export declare type MapUnits = {
    /**
     * The current unit of measurement for temperature.
     */
    temperature: (typeof Units.temperature)[keyof typeof Units.temperature];
    /**
     * The current unit of measurement for wind speed.
     */
    speed: (typeof Units.speed)[keyof typeof Units.speed];
    /**
     * The current unit of measurement for pressure.
     */
    pressure: (typeof Units.pressure)[keyof typeof Units.pressure];
    /**
     * The current unit of measurement for distance.
     */
    distance: (typeof Units.distance)[keyof typeof Units.distance];
    /**
     * The current unit of measurement for height.
     */
    height: (typeof Units.distance)[keyof typeof Units.distance];
    /**
     * The current unit of measurement for precipitation.
     */
    precipitation: (typeof Units.precipitation)[keyof typeof Units.precipitation];
    /**
     * The current unit of measurement for snowfall.
     */
    snowfall: (typeof Units.precipitation)[keyof typeof Units.precipitation];
    /**
     * The current unit of measurement for direction.
     */
    direction: (typeof Units.direction)[keyof typeof Units.direction];
    /**
     * The current unit of measurement for time.
     */
    time: (typeof Units.time)[keyof typeof Units.time];
    /**
     * The current unit of measurement for rate.
     */
    rate: (typeof Units.rate)[keyof typeof Units.rate];
    /**
     * The current unit of measurement for precipitation intensity.
     */
    intensity: (typeof Units.rate)[keyof typeof Units.rate];
    /**
     * The current unit of measurement for concentration.
     */
    concentration: (typeof Units.concentration)[keyof typeof Units.concentration];
    /**
     * The current unit of measurement for ratio.
     */
    ratio: (typeof Units.ratio)[keyof typeof Units.ratio];
};

export declare interface MapViewState {
    id: string;
    size: Size;
    center: Coordinate;
    nonPaddedCenter?: Coordinate;
    zoom: number;
    bounds: CoordinateBounds;
    pitch: number;
    bearing: number;
    elevation: number;
    fov: number;
    farZ?: number;
    nearZ?: number;
    padding?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    /**
     * Scaler for the far plane, 1 unit equals to the distance from the camera to the edge of the screen. Default
     * `1.01`.
     */
    farZMultiplier?: number;
    /**
     * Scaler for the near plane, 1 unit equals to the height of the viewport. Default `0.1`.
     */
    nearZMultiplier?: number;
    /**
     * The globiness of the map, 0 is a flat map, 1 is a globe.
     */
    globiness?: number;
    cameraPosition?: Vector3;
    projectionMatrix?: Matrix4;
}

declare const mbToHg: (mb: number) => number;

declare const mbToPa: (mb: number) => number;

export declare type Measurement = keyof typeof Units | 'height' | 'snowfall' | 'intensity';

export declare type MessageHandler = (result: any) => any;

declare const miToM: (mi: number) => number;

declare const mmToIn: (mm: number) => number;

declare const mmToMMRate: (mm: number) => number;

declare const mphToKph: (mph: number) => number;

declare const mphToMs: (mph: number) => number;

declare const mphToMsUnit: (mph: number) => number;

declare const msToKph: (ms: number) => number;

declare const msToMph: (ms: number) => number;

declare const msToMphUnit: (ms: number) => number;

declare const mToFt: (m: number) => number;

declare const mToIn: (m: number) => number;

declare const mToKm: (m: number) => number;

declare const mToMi: (m: number) => number;

export declare type NumericalOrStringSize = {
    width: number | string;
    height: number | string;
};

export declare type ObjectValue<T> = T[keyof T];

export declare type ObjectValueFromKeys<T, K extends keyof T> = T[K];

export declare interface Observable {
    on(name: string, callback: (event: any) => void): void;
    off(name: string, callback: (event: any) => void): void;
}

export declare type Offset = {
    x: number | RelativeValue;
    y: number | RelativeValue;
};

/**
 * The supported query operators.
 */
declare const Operator: {
    /**
     * Joins queries using an `OR` operator
     */
    readonly or: ";";
    /**
     * Joins queries using an `AND` operator
     */
    readonly and: ",";
};

export declare type Operator = ObjectValue<typeof Operator>;

export declare interface Opts {
    capacity: number;
}

/**
 * The mode for handling symbol overlap.
 */
declare const OverlapMode: {
    readonly never: "never";
    readonly always: "always";
    readonly cooperative: "cooperative";
};

export declare type OverlapMode = ObjectValue<typeof OverlapMode>;

/**
 * A `PaintStyle` is a collection of style properties that can be used to render a layer.
 */
export declare class PaintStyle {
    /**
     * The configuration for this style.
     */
    readonly config: PaintStyleProvider;
    constructor(config?: PaintStyleProvider);
    opacity(data?: StylableData): number;
    animated(data?: StylableData): boolean;
    rasterMeld(data?: StylableData): boolean;
    rasterOpacity(data?: StylableData): number;
    fillColor(data?: StylableData): Color;
    fillPattern(data?: StylableData): FillPattern;
    fillOpacity(data?: StylableData): number;
    fillSort(data?: StylableData): SortProperty;
    strokeColor(data?: StylableData): Color;
    strokeOpacity(data?: StylableData): number;
    strokeThickness(data?: StylableData): number;
    strokeLineJoin(data?: StylableData): LineJoin;
    strokeLineCap(data?: StylableData): LineCap;
    radius(data?: StylableData): number;
    sampleExpression(data?: StylableData): SampleExpression;
    sampleExpressionOperation(data?: StylableData): ExpressionOperation;
    sampleChannel(data?: StylableData): SampleChannel | Array<ColorBand>;
    sampleColorScale(data?: StylableData): ColorScaleOptions;
    sampleInterpolation(data?: StylableData): InterpolationMode;
    sampleOpacity(data?: StylableData): number;
    sampleSmoothing(data?: StylableData): number;
    sampleOffset(data?: StylableData): number;
    sampleMeld(data?: StylableData): boolean;
    sampleDataRange(data?: StylableData): ValueRange;
    sampleDrawRange(data?: StylableData): Partial<ValueRange>;
    gridSpacing(data?: StylableData): number;
    particleType(data?: StylableData): string;
    particleCount(data?: StylableData): number;
    particleDensity(data?: StylableData): number;
    particleSpeed(data?: StylableData): number;
    particleSize(data?: StylableData): Size;
    particleTrails(data?: StylableData): boolean;
    particleTrailsFade(data?: StylableData): number;
    particleDropRate(data?: StylableData): number;
    particleDropRateBump(data?: StylableData): number;
    heatmapColor(data?: StylableData): number[];
    heatmapRadius(data?: StylableData): number;
    heatmapBlur(data?: StylableData): number;
    heatmapIntensity(data?: StylableData): number;
    heatmapWeight(data?: StylableData): number;
    heatmapOpacity(data?: StylableData): number;
    contourInterval(data?: StylableData): number;
    contourMajorInterval(data?: StylableData): number;
    contourWidth(data?: StylableData): number;
    contourMajorWidth(data?: StylableData): number;
    contourScale(data?: StylableData): number;
    contourOffset(data?: StylableData): number;
    symbolKey(data?: StylableData): string;
    symbolRank(data?: StylableData): string | SortProperty;
    symbolRotateWithMap(data?: StylableData): boolean;
    symbolPitchWithMap(data?: StylableData): boolean;
    symbolScaleWithMap(data?: StylableData): boolean;
    symbolSizeAttenuation(data?: StylableData): boolean;
    symbolAllowOverlap(data?: StylableData): boolean;
    symbolOverlapMode(data?: StylableData): string;
    symbolFadeOpacity(data?: StylableData): boolean;
    iconType(data?: StylableData): string;
    iconImage(data?: StylableData): SymbolIcon;
    iconShader(data?: StylableData): string;
    iconUniforms(data?: StylableData): Record<string, any>;
    iconSize(data?: StylableData): Size;
    iconAnchor(data?: StylableData): string;
    iconOffset(data?: StylableData): Point;
    iconPadding(data?: StylableData): [number, number];
    iconRotation(data?: StylableData): number;
    iconBlending(data?: StylableData): Blending;
    iconAnimated(data?: StylableData): boolean;
    iconFactor(data?: StylableData): number;
    iconAtlas(data?: StylableData): SymbolIconAtlas;
    textValue(data?: StylableData, line?: number): string;
    textTransform(data?: StylableData, line?: number): string;
    textFont(data?: StylableData, line?: number): string;
    textSize(data?: StylableData, line?: number): number;
    textColor(data?: StylableData, line?: number): Color;
    textOutlineColor(data?: StylableData, line?: number): Color;
    textOpacity(data?: StylableData, line?: number): number;
    textAlign(data?: StylableData, line?: number): string;
    textAnchor(data?: StylableData, line?: number): string;
    textOffset(data?: StylableData, line?: number): Offset;
    textPadding(data?: StylableData, line?: number): [number, number];
    textRotation(data?: StylableData, line?: number): number;
    textLetterSpacing(data?: StylableData, line?: number): number;
    textLineHeight(data?: StylableData, line?: number): number;
    textMaxWidth(data?: StylableData, line?: number): number;
    textLineCount(data?: StylableData): number;
    /**
     * Returns the value of the style property at the given path.
     * @param path - The path to the style property.
     * @returns The value of the style property at the given path.
     */
    getProperty(path: string): any;
    /**
     * Sets the value of the style property at the given path.
     * @param path - The path to the style property.
     * @param value - The new value to set.
     */
    setProperty(path: string, value: any): void;
    /**
     * Returns a serialized representation of this style.
     */
    serialized(): Record<string, any>;
    private _cachedSerialized;
    /**
     * Returns the style configuration for the given data.
     * @param data - The data to use when evaluating the style.
     * @returns The style configuration for the given data.
     */
    private provider;
    /**
     * Creates a new `PaintStyle` instance from the given serialized style.
     * @param serialized - The serialized style.
     * @returns The new `PaintStyle` instance.
     */
    static fromSerialized(serialized: Record<string, any>): PaintStyle;
}

/**
 * A `PaintStyleProvider` is a function that returns a `PaintStyleSpec` object.
 * A value of this type can return either a static `PaintStyleSpec` object or a function that returns a `PaintStyleSpec`
 * object. If a function is returned, it will be called with the data object passed to the `PaintStyle` instance.
 */
export declare type PaintStyleProvider = Partial<PaintStyleSpec>;

/**
 * Style specification for a layer's paint properties.
 */
export declare interface PaintStyleSpec {
    /**
     * The opacity of the layer.
     * @remarks
     * This value will be multiplied with the opacity of the layer's other style properties like `fill` or `stroke`.
     */
    opacity: StyleValue<number>;
    /**
     * Whether the layer is animated.
     */
    animated: StyleValue<boolean>;
    raster: Partial<RasterStyleSpec>;
    fill: Partial<FillStyleSpec>;
    stroke: Partial<StrokeStyleSpec>;
    circle: Partial<CircleStyleSpec>;
    grid: Partial<GridStyleSpec>;
    sample: Partial<SampleStyleSpec>;
    particle: Partial<ParticleStyleSpec>;
    heatmap: Partial<HeatmapStyleSpec>;
    contour: Partial<ContourStyleSpec>;
    symbol: Partial<SymbolStyleSpec>;
    icon: Partial<IconStyleSpec>;
    /**
     * Text style specification for the layer's text properties.
     * @remarks
     * This can be a single text style or an array of text styles to render multiple text labels for a single feature.
     * When configuring multiple text labels, use the `anchor` and `offset` properties to position each text label
     * relative to the feature's anchor point.
     */
    text: Partial<TextStyleSpec> | Array<Partial<TextStyleSpec>>;
}

/**
 * The density of particles on screen per particle tile.
 */
export declare const ParticleDensity: {
    /**
     * Falls back to the `count` style value.
     */
    readonly count: 0;
    /**
     * Least amount of particles will be rendered. This density setting may not provide enough speed and direction
     * information on the map since coverage is minimal. Sets the particle count per tile to 8^2.
     */
    readonly minimal: 16;
    /**
     * Slightly less particle density than `normal`, allowing the most visibiilty to content underneath while
     * providing good speed and direction information. Sets the particle count per tile to 16^2.
     */
    readonly low: 32;
    /**
     * Provides a good amount of particles and speed and direction information while still allowing a good portion
     * of content underneath to remain visible. Sets the particle count per tile to 48^2.
     */
    readonly normal: 64;
    /**
     * Slightly higher particle density than `normal` while still allowing some content underneath to remain visible.
     * Sets the particle count per tile to 76^2.
     */
    readonly high: 96;
    /**
     * Highest density that will essentially fill the layer with particle data, preventing content underneath from
     * being visible. Note that overall map performance may be affected with this setting for some hardware
     * configurations. Sets the particle count per tile to 128^2.
     */
    readonly extreme: 128;
};

export declare type ParticleDensity = ObjectValue<typeof ParticleDensity>;

/**
 * Particle style properties control how flow field particles get rendered on a map. Particles are used to represent
 * vector data and flow fields, such as wind speed and direction or ocean waves and currents.
 */
export declare interface ParticleStyleSpec {
    /**
     * Type of particle to render.
     */
    type: StyleValue<'circle' | 'bar' | 'arrow'>;
    /**
     * Total number of particles to render for a single particle tile where a single particle tile is typically used
     * for the visible map region. Keeping this value as a power-of-two will result in the best performance (e.g.
     * 1024, 4096, 16384, 65536 or 262144).
     */
    count: StyleValue<number>;
    /**
     * An alternative to count that controls the total number of particles to render. Where `count` will always show
     * the same number of particles regardless of map viewport size, `density` will automatically calculate the number
     * of particles based on the viewport size in order to maintain a relatively consistent density across viewports
     * and screen sizes.
     */
    density: StyleValue<ParticleDensity>;
    /**
     * Size of the particle in screen points.
     */
    size: StyleValue<number | Size>;
    /**
     * Speed factor of the particle movement. A value of `1` will use the default speed.
     */
    speedFactor: StyleValue<number>;
    /**
     * @deprecated Use `speedFactor` instead.
     */
    speed: StyleValue<number>;
    /**
     * Whether or not particle trails should be rendered. If `false`, then only the particles and their current
     * positions will be rendered.
     */
    trails: StyleValue<boolean>;
    /**
     * Amount particle trails should fade between frames between `0` and `1`. A higher value will result in particle
     * trails fading out slowly and longer trails, whereas lower numbers will result in shorter trails.
     */
    trailsFadeFactor: StyleValue<number>;
    /**
     * @deprecated Use `trailsFadeFactor` instead.
     */
    trailsFade: StyleValue<number>;
    /**
     * Rate at which a particle will restart at a random position to avoid degeneration. A higher drop rate will result
     * in faster repositioning and less overall movement.
     */
    dropRate: StyleValue<number>;
    /**
     * Factor applied to the `dropRate` value and calculated velocity to further control the overall particle drop rate.
     */
    dropRateBump: StyleValue<number>;
}

declare const paToMb: (pa: number) => number;

export declare type PlotCoordinate = {
    x: number;
    y: number;
    z: number;
};

export declare type Point = {
    x: number;
    y: number;
    z?: number;
};

/**
 * A legend item for a point legend.
 */
export declare type PointLegendItem = {
    key?: string;
    color: string;
    label: string;
};

/**
 * Configuration options for a point legend.
 */
export declare interface PointLegendOptions extends LegendOptions {
    values: Array<PointLegendItem> | ((data?: Record<string, any>) => Promise<Array<PointLegendItem>>);
    radius: number;
    margin: number | [number, number];
    requiresMapBounds: boolean;
    layerId: string;
}

export declare type Polygon = Array<Array<Point>>;

export declare interface Projection {
    type: ProjectionType;
    zAxisUnit: 'meters' | 'pixels';
    range: [number, number] | null | undefined;
    subdivisionGranularity: SubdivisionGranularitySetting;
    /**
     * Convert a geographic coordinate to world (UnitMercator) coordinates ([0,0],[1,1]).
     * @param lat - The latitude
     * @param lon - The longitude
     * @param altitude - The altitude
     * @returns The world coordinates
     */
    project(latitude: number, longitude: number, altitude?: number): Point;
    /**
     * Convert world (UnitMercator) coordinates to a geographic coordinate.
     * @param x - The x coordinate
     * @param y - The y coordinate
     * @returns The geographic coordinate
     */
    unproject(x: number, y: number): Coordinate;
    projectTileCoordinates(x: number, y: number, coord: TileCoord, tr: MapTransform): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    };
    /**
     * Returns the number of pixels per meter at the given latitude and world size.
     * @param lat - The latitude
     * @param worldSize - The world size
     * @returns The number of pixels per meter
     */
    pixelsPerMeter(lat: number, worldSize: number): number;
    pixelSpaceConversion(lat: number, worldSize: number, interpolationT: number): number;
    /**
     * Returns the number of meters per pixel at the given latitude and zoom level.
     * @param lat - The latitude
     * @param zoom - The zoom level
     * @returns The number of meters per pixel
     */
    metersPerPixel(lat: number, zoom: number): number;
}

declare const ProjectionType: {
    readonly mercator: "mercator";
    readonly globe: "globe";
};

export declare type ProjectionType = ObjectValue<typeof ProjectionType>;

/**
 * A `Query` object is a convenience wrapper for setting up and configuring a query string used
 * for API queries.
 */
export declare class Query {
    private _conditions;
    /**
     * Initializes a query instance, optionally with an array of query conditions.
     * @param conditions - An array of query conditions to initialize the query with.
     */
    constructor(conditions?: QueryCondition[]);
    /**
     * Adds a query condition.
     * @param condition - The query condition to add.
     */
    addCondition(condition: QueryCondition): Query;
    /**
     * Removes a query condition.
     * @param condition - The query condition to remove.
     */
    removeCondition(condition: QueryCondition): Query;
    /**
     * Removes all query conditions.
     */
    removeAllConditions(): Query;
    /**
     * Returns the formatted string from all query conditions to be used for API requests.
     */
    toString(): string;
}

/**
 * A `QueryCondition` object stores information about a single property-value condition.
 */
export declare class QueryCondition {
    /**
     * The data property to query.
     */
    property: string;
    /**
     * The data value to query against.
     */
    value: string | number;
    /**
     * The operator to use when chaining this condition to successive conditions.
     */
    nextOperator: Operator;
    /**
     * Initializes a query condition instance for the specified property and value and optional
     * next operator.
     * @param property - The property to query.
     * @param value - The value to query against.
     * @param nextOperator - The operator to use when chaining this condition to successive
     */
    constructor(property: string, value: any, nextOperator?: Operator);
    /**
     * Returns the formatted query string to be used with API requests.
     */
    toString(): string;
}

export declare type QueryLayerConfiguration = {
    layerId: string;
    hidden?: boolean;
    overrides?: Record<string, any>;
};

/**
 * Query layer specification.
 */
export declare type QueryLayerSpecification = {
    /**
     * Layer identifier of the layer to use for querying/sampling data from.
     */
    id: string;
    /**
     * Whether to hide the query layer. Default value is `false` which means the query layer will be visible. If you
     * set this to `true`, then the query layer will be hidden while still being available for querying/sampling data.
     */
    hidden?: boolean;
};

export declare interface RasterStyleSpec {
    /**
     * Whether data should be interpolated between intervals during animation playback. If `true`, then data will
     * smoothly transition between data intervals, otherwise the result will appear stepped. Default is `false`.
     */
    meld: boolean;
    /**
     * @deprecated Use `opacity` at the root style level instead.
     */
    opacity: StyleValue<number>;
}

export declare type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export declare type Rect_2 = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

export declare type RelativeValue = {
    target: string;
    offset: number;
};

/**
 * Options for loading a remote styled image. These options are used when storing the {@link StyledImage} in the
 * {@link ImageManager}.
 */
export declare type RemoteStyledImageOptions = {
    /**
     * The pixel ratio of the image.
     */
    pixelRatio?: number;
    /**
     * Whether the image is a signed distance field.
     */
    sdf?: boolean;
    /**
     * Whether the image is a pattern.
     */
    pattern?: boolean;
};

/**
 * Interface representing a remote symbol image.
 */
export declare interface RemoteSymbolImage {
    /** The unique identifier for the image. */
    id: string;
    /** The URL of the image. */
    url: string;
    /** The pixel ratio of the image. Defaults to 1. */
    pixelRatio?: number;
    /** Indicates if the image is an SDF (Signed Distance Field) image. */
    sdf?: boolean;
    /** Indicates if the image is a pattern image. */
    pattern?: boolean;
}

/**
 * Context built by the layer each frame and passed to prerender() and draw().
 * Contains all map and layer state needed for the render path so the renderer
 * does not access the parent layer or the layer's map.
 */
export declare interface RenderFrameContext {
    /** Elapsed time since the start of the render loop. Used by the renderer to animate the layer. */
    elapsedTime: number;
    /** Latest calculated FPS of the context. */
    fps: number;
    /** Map state snapshot. */
    map: RenderFrameContextMap;
    /** Layer id. */
    layerId: string;
    /** Scene to render into. */
    scene: MapScene;
    /** Whether this layer is used as a mask (stencil). */
    isLayerMask: boolean;
    /** Layer mask config if any. */
    mask?: LayerMask;
    /** Whether the layer is visible. */
    visible: boolean;
    /** Request a redraw on the next frame. */
    setNeedsUpdate(): void;
    /** Tile-layer-specific state; set when the layer is a tile layer. */
    tileLayer?: RenderFrameContextTileLayer;
    /** Tile cache from the layer's source; set when the layer has a tile source. Used by renderers instead of accessing layer.source.tiles. */
    tileCache?: AnyTileCache;
    /** Tile dimensions from the layer's source; set when the layer has a tile source. Used for texture array setup. */
    tileSize?: {
        width: number;
        height: number;
    };
    /** Layer paint style (from layer.paint). Set by the layer when building context. */
    paint?: PaintStyle;
    /** Map style (map.style). Used by vector/grid passes for fonts, image atlas, etc. */
    mapStyle?: MapStyle;
}

/**
 * Snapshot of map transform state passed into the render path so the renderer
 * does not read from the map or layer during prerender/draw.
 */
export declare interface RenderFrameContextMap {
    center: Coordinate;
    zoom: number;
    bounds: CoordinateBounds;
    bearing: number;
    pitch: number;
    tileSize: number;
    projection: {
        type: ProjectionType;
        subdivisionGranularity: SubdivisionGranularitySetting;
    };
    transform: MapTransform;
    placement: SymbolPlacement;
    globiness: number;
    isGlobe: boolean;
    camera: {
        position: Vector3;
    };
    clippingPlane: Vector4;
    globeMatrix: Matrix4;
    mercatorMatrix: Matrix4;
    projGlobeMatrix: Matrix4;
    zoomTransition: number;
    cutoffParams: [number, number, number, number];
    farZ: number;
    pixelsPerMercatorPixelRatio: number;
}

/**
 * Optional tile-layer-specific state for resolution and LOD. Present when the
 * layer is a tile layer.
 */
export declare interface RenderFrameContextTileLayer {
    viewport: Viewport;
    pyramid: TilePyramid<any>;
    getDataZoom(): number;
    getVisibleTileCoords(zoom: number): TileCoord[];
    getCurrentInterval?(): TimeInterval | undefined;
    allowExpiredTilesForRender?: boolean;
}

declare const resolveMeasurementForUnits: (type: ConversionMeasurement) => Measurement;

/**
 * RGBAImage represents a 2D grid of image data. Them image data should NOT be premultipled since ImageData is not.
 * Therefore, UNPACK_PREMULTIPLY_ALPHA_WEBGL must be used when uploading the image data to the GPU via a texture.
 */
export declare class RGBAImage {
    /**
     * The raw image data.
     */
    rawData: Uint8Array | Uint8ClampedArray;
    stride: number;
    dimension: number;
    padding: number;
    get width(): number;
    get height(): number;
    
    constructor(data: Uint8Array, dimension: number, pad?: number);
    get(x: number, y: number): RGB;
    
    /**
     * Computes the index offset for the specified x and y coordinates and image width.
     * @param x -
     * @param y -
     * @returns
     */
    private _idx;
}

export declare type SampleChannel = typeof SupportedSampleChannels[number];

/**
 * Type of expression to use when sampling data.
 */
export declare const SampleExpression: {
    /**
     * Value is a float sampled from a single band.
     */
    readonly number: "number";
    /**
     * Value is a vector sampled and calculated from two bands.
     */
    readonly vector: "vector";
    /**
     * Value is a float sampled and calculated as the sum of two bands.
     */
    readonly sum: "sum";
    /**
     * Value is a float sampled and calculated as the difference of two bands.
     */
    readonly difference: "diff";
    /**
     * Value is a float sampled and calculated from the vector of two bands.
     */
    readonly angle: "angle";
    /**
     * Value is calculated using a custom shader chunk injected into the shader at runtime.
     */
    readonly custom: "custom";
};

export declare type SampleExpression = ObjectValue<typeof SampleExpression>;

/**
 * Sample style properties control how encoded data gets rendered on a map. Sample rendering is performed by sampling
 * values from the underlying data and mapping it to a desired result, such as color fill, contour line, etc.
 */
export declare interface SampleStyleSpec {
    /**
     * Determines how data should be sampled from the encoded data texture.
     */
    expression: SampleExpression;
    /**
     * TODO
     */
    expressionOperation: Partial<ExpressionOperation>;
    /**
     * Color band(s) to sample from the encoded data. If performing an expression operation, such as `vector`, `sum`
     * or `diff`, then two bands must be provided.
     */
    channel: SampleChannel | Array<ColorBand>;
    /**
     * Controls the data resolution that gets requested by the layer's data source and rendered to the map. Data will
     * be interpolated when rendering to the map to ensure low resolution/quality data is still smooth.
     */
    quality: DataQuality;
    /**
     * Type of interpolation to perform on the data.
     */
    interpolation: InterpolationMode;
    /**
     * Amount of smoothing to apply on the data from `0` (no smoothing) to `1` (full smoothing). Increasing this value
     * is useful for low resolution data sets or when higher detail is not desired or needed.
     */
    smoothing: number;
    /**
     * Defines how raster data gets colorized based on the encoded values.
     */
    colorscale: ColorScaleOptions;
    /**
     * Normalized amount to shift the interpolated sample values from `0` to `1`. This is typically used for expression
     * operations like `diff` where interpolated values can be negative and you need to start values half way (`0.5`)
     * between the `colorscale.range` values.
     */
    offset: number;
    /**
     * Whether data should be interpolated between intervals during animation playback. If `true`, then data will
     * smoothly transition between data intervals, otherwise the result will appear stepped.
     */
    meld: boolean;
    /**
     * Defines the value range of the sampled data if different than the data source. If not provided, then the sampled
     * data range will be used from the dataset associated with the data source. This is typically only used when
     * loaded encoded raster data is transformed into a different value range by the data source before being sampled.
     */
    dataRange: ValueRange;
    /**
     * Limits the data range that should be rendered from the sampled data. If not provided, then the full data range
     * will be rendered by default.
     */
    drawRange: Partial<ValueRange>;
}

export declare type SortProperty = {
    property: string;
    direction?: 'asc' | 'desc';
};

/**
 * An object that provides and manages information about a {@link DataSource} instance. This includes
 * metadata about the data source, such as its min/max zoom levels, valid times, and other
 * information that is used to determine how to request and display the data.
 * @remarks
 * When instantiated with a `url` parameter, the metadata should be requested and loaded manually by calling
 * the `load()` method (which is done automatically by {@link TileSource}). Metadata loaded from a remote source will
 * be combined with any static metadata provided in the constructor's `data` parameter.
 */
export declare class SourceMetadata extends EventDispatcher {
    readonly url: string;
    /**
     * For time-specific data sources, the maximum number of time intervals allowed for the data's time
     * series. A value of `0` means no limit and will allow the full set of valid times.
     */
    maxValidTimeIntervals: number;
    private _data;
    private _isLoading;
    private _requestTransformer;
    private _transformer;
    private _hasLoaded;
    private _lastRequestOptions;
    private _validTimesCache;
    
    /**
     * Creates an instance of SourceMetadata
     * @param url - URL to request metadata from if needed.
     * @param data - Static metadata to use for the source.
     */
    constructor(url: string, data: Partial<SourceMetadataSchema>);
    /**
     * The metadata for the source.
     * @readonly
     */
    get data(): Partial<SourceMetadataSchema>;
    /**
     * The minimum zoom level for the source as an integer.
     * @readonly
     */
    get minZoom(): number;
    /**
     * The maximum zoom level for the source as an integer.
     * @readonly
     */
    get maxZoom(): number;
    /**
     * The bounds for the source as a {@link CoordinateBounds} object.
     * @readonly
     */
    get bounds(): CoordinateBounds;
    get projection(): string;
    /**
     * The valid times for the source as an array of {@link Date} objects.
     * @readonly
     */
    get datasets(): Array<any>;
    /**
     * Whether the metadata is currently being requested.
     * @readonly
     */
    get isLoading(): boolean;
    /**
     * Whether the metadata has been loaded.
     * @readonly
     */
    get hasLoaded(): boolean;
    /**
     * Whether the data source is a time-series data source.
     * @readonly
     */
    get isTimeSeries(): boolean;
    get validTimeRange(): TimeRange;
    getAllValidTimes(): Array<Date>;
    /**
     * Returns an array of valid times for the source. If the source has multiple datasets, the valid times
     * for the first dataset will be returned.
     * @param max - The maximum number of valid times to return. A value of `0` means no limit and will return
     * all valid times.
     * @returns An array of valid times for the source.
     */
    getValidTimes(index?: number, max?: number): Array<Date>;
    /**
     * Returns the valid time for the source that is closest to the provided `time`.
     * @param time - The time to find the closest valid time for.
     * @returns The closest valid time for the source.
     */
    getValidTimeForTime(time: Date, index?: number): Date;
    setValidTimeRange(range: TimeRange): void;
    /**
     * Returns the dataset at the provided index.
     * @param index -
     * @returns
     */
    getDatasetAtIndex(index: number): any | undefined;
    /**
     * Returns the valid times for the dataset at the provided index.
     * @param index - The dataset index
     * @param max - The maximum number of valid times to return. A value of `0` means no limit and will return
     * all valid times.
     * @returns An array of valid times for the dataset.
     */
    getDatasetValidTimesAtIndex(index: number, max?: number): Array<Date>;
    /**
     * Sets a function to transform the metadata returned from the source.
     * @param fn -
     */
    setTransformer(fn: SourceMetadataTransformer): void;
    /**
     * Sets a function to transform the request options for the metadata request.
     * @param fn -
     */
    setRequestTransformer(fn: SourceMetadataRequestTransformer): void;
    /**
     * Loads the metadata for the source.
     * @param options - Request options
     * @returns A promise that resolves with the metadata for the source.
     */
    load(options?: Partial<UrlRequestOptions>): Promise<Partial<SourceMetadataSchema>>;
    cancel(): void;
    protected processMetadata(json: Record<string, any>): Partial<SourceMetadataSchema>;
}

export declare type SourceMetadataRequestTransformer = (options: UrlRequestOptions) => UrlRequestOptions;

/**
 * The metadata schema for a {@link DataSource} instance.
 */
export declare interface SourceMetadataSchema {
    /**
     * The minimum zoom level for the source as an integer.
     */
    minZoom: number;
    /**
     * The maximum zoom level for the source as an integer.
     */
    maxZoom: number;
    /**
     * The bounds for the source as a {@link CoordinateBounds} object.
     */
    bounds: CoordinateBounds;
    /**
     * The projection for the source.
     */
    projection: 'EPSG:3857' | 'EPSG:4326';
    /**
     * The data valid times for the source as an array of {@link Date} objects.
     */
    validTimes: Array<Date>;
    /**
     * The maximum number of valid times allowed for the data's time series. A value of `0` means no limit and will
     * allow the full set of valid times.
     */
    maxValidTimes: number;
    /**
     * Valid start time for a time-series data source, if any.
     */
    startDate: Date;
    /**
     * Valid end time for a time-series data source, if any.
     */
    endDate: Date;
    /**
     * Additional metadata for the source's datasets.
     */
    datasets: Array<{
        id: string;
        validTimes: Array<string | Date>;
    }>;
}

export declare type SourceMetadataTransformer = (data: Record<string, any>, options?: SourceMetadataTransformOptions) => Partial<SourceMetadataSchema>;

export declare interface SourceMetadataTransformOptions {
    range?: TimeRange;
}

/**
 * Represents the base configuration for a data source.
 */
export declare interface SourceSpecification {
    /**
     * The type of data source.
     */
    type: DataSourceType;
    /**
     * Unique identifier for the data source.
     */
    id: string;
    /**
     * The URL of the metadata for the source, if any.
     */
    metadataUrl: string;
    /**
     * Attribution to display when the data source is active.
     */
    attribution?: string;
    /**
     * An {@link Authenticator} to use when requesting data from the source if required.
     */
    authenticator?: AnyAuthenticator;
    /**
     * Time series configuration for a time-based data source.
     */
    timeSeries: Partial<{
        /**
         * An array of valid times for the source as an array of ISO 8601 strings or `Date` objects. If not provided,
         * the source is assumed to be static.
         */
        validTimes: Array<string | Date>;
        /**
         * The maximum number of valid times to load at once. Defaults to `10`.
         */
        maxValidTimes: number;
        /**
         * The operation to perform on the data within the time series. If not provided, no operation will be performed.
         */
        operation: TimeSeriesOperation;
    }>;
    /**
     * An optional hook for transforming the request for data before it is sent.
     * @param source - The data source making the request.
     * @param request - The request options.
     * @returns The transformed request options.
     */
    transformRequest?: (source: DataSource, request: DataSourceRequest) => DataSourceRequest;
    /**
     * An optional hook for transforming the metadata request before it is sent.
     * @param source - The data source making the request.
     * @param options - The request options.
     * @returns The transformed request options.
     */
    transformMetadataRequest?: (source: DataSource, options: UrlRequestOptions) => UrlRequestOptions;
    /**
     * An optional hook for transforming the metadata loaded from a remote source before it is stored.
     * @param source - The data source associated with the metadata.
     * @param data - The metadata loaded from a remote source.
     * @param options - Additional options for transforming the metadata.
     * @returns The transformed metadata.
     */
    transformMetadata?: (source: DataSource, data: Record<string, any>, options?: SourceMetadataTransformOptions) => Partial<SourceMetadataSchema>;
}

export declare class State<T> extends EventDispatcher {
    #private;
    get value(): T;
    constructor(initialState: T);
    get(path: string, fallback?: any): any;
    setState(newState: string | Partial<T>, value?: any): void;
    static Events: {
        UPDATE: string;
        UPDATE_KEY: string;
    };
}

/**
 * Legacy style value: a static value or a function (data) => value.
 * Supported for backwards compatibility.
 */
export declare type StaticOrFunctionStyleValue<T> = T | ((data: StylableData) => T);

/**
 * Stroke style properties control how one or more polylines get rendered on a map. These properties also control
 * strokes around circles and other vector shapes.
 */
export declare interface StrokeStyleSpec {
    /**
     * Color of the stroke.
     */
    color: StyleValue<string | Color>;
    /**
     * Opacity of the stroke. Opacity can also be specified by including an alpha channel in the `color` value.
     */
    opacity: StyleValue<number>;
    /**
     * Thickness of the stroke in points.
     */
    thickness: StyleValue<number>;
    /**
     * Line join style. Default is `round`.
     */
    lineJoin: StyleValue<LineJoin>;
    /**
     * Line cap style. Default is `round`.
     */
    lineCap: StyleValue<LineCap>;
}

/**
 * Defines a data object that can be provided to a style value function to customize the style based on the data
 * properties of the feature being rendered.
 */
export declare type StylableData = Record<string, any>;

/**
 * Interface representing a styled image. Styled images are stored by the {@link ImageManager} and rendered by the
 * {@link SymbolStore}.
 */
export declare type StyledImage = {
    /**
     * The raw image data as a Uint8ClampedArray.
     */
    data: Uint8ClampedArray;
    /**
     * The dimensions of the image.
     */
    size: Size;
    /**
     * The pixel ratio of the image.
     */
    pixelRatio?: number;
    /**
     * Whether the image is a signed distance field.
     */
    sdf?: boolean;
    /**
     * Whether the image is a pattern.
     */
    pattern?: boolean;
    /**
     * The position and size of the image in the sprite sheet.
     */
    position?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /**
     * The stretch factor of the image.
     */
    stretchX?: number;
    /**
     * The stretch factor of the image.
     */
    stretchY?: number;
    /**
     * The version of the image.
     */
    version?: number;
    /**
     * Whether the image has been used.
     */
    used?: boolean;
    /**
     * The custom renderer used to draw the image, such as from an HTML5 Canvas 2D context.
     */
    renderer?: StyledImageRenderer;
};

/**
 * Interface representing a custom renderer for styled images.
 */
export declare interface StyledImageRenderer {
    /**
     * Initializes the renderer with image data and size.
     * @param data - The raw image data as a Uint8ClampedArray.
     * @param size - The dimensions of the image.
     */
    initialize?: (data: Uint8ClampedArray, size: Size) => void;
    /**
     * Draws or modifies the image.
     * @param data - The raw image data as a Uint8ClampedArray.
     * @param size - The dimensions of the image.
     * @returns A new Uint8ClampedArray with the modified image data, or undefined if no changes were made.
     */
    draw?: (data: Uint8ClampedArray, size: Size) => Uint8ClampedArray | undefined;
    /**
     * Cleans up any resources used by the renderer.
     */
    dispose?: () => void;
}

export declare type StyleEvaulatorFunction<T> = (properties: Record<string, any>) => T;

export declare interface StyleExpression {
    property: string;
    type?: 'identity' | 'expression';
    evaluator?: (value: any) => any;
}

export declare const styles: {
    datasets: {};
    colorscales: {
        temperature: (string | number)[];
        freeze: (string | number)[];
        tempChange24Hour: (string | number)[];
        tempChange1Hour: (string | number)[];
        windspeed: (string | number)[];
        dewpoint: (string | number)[];
        humidity: (string | number)[];
        mslp: (string | number)[];
        visibility: (string | number)[];
        sky: (string | number)[];
        snowdepth: (string | number)[];
        uvi: (string | number)[];
        uvi_categories: {
            minimal: string;
            low: string;
            moderate: string;
            high: string;
            very_high: string;
        };
        prate: (string | number)[];
        precip_accum: (string | number)[];
        sleet_accum: (string | number)[];
        ice_accum: (string | number)[];
        radar: {
            rain: (string | number)[];
            mix: (string | number)[];
            snow: (string | number)[];
        };
        radarRate: {
            rain: (string | number)[];
            mix: (string | number)[];
            snow: (string | number)[];
        };
        heatmap: (string | number)[];
    };
    getColorScaleNames: () => string[];
    getColorScale: (name: "OrRd" | "PuBu" | "BuPu" | "Oranges" | "BuGn" | "YlOrBr" | "YlGn" | "Reds" | "RdPu" | "Greens" | "YlGnBu" | "Purples" | "GnBu" | "Greys" | "YlOrRd" | "PuRd" | "Blues" | "PuBuGn" | "Spectral" | "RdYlGn" | "RdBu" | "PiYG" | "PRGn" | "RdYlBu" | "BrBG" | "RdGy" | "PuOr" | "Set2" | "Accent" | "Set1" | "Set3" | "Dark2" | "Paired" | "Pastel2" | "Pastel1" | "Rainbow" | "Sinebow" | "White" | "Black" | "Viridis" | "Inferno" | "Plasma" | "Magma" | "Cividis" | "Mako" | "Rocket" | "Turbo", prefixColors?: string[], startTransparent?: boolean) => ColorScaleOptions;
};

/**
 * Style value accepted by paint specs. Can be:
 * - A constant (number, string, boolean, object, etc.)
 * - A function (data) => value
 * - An expression array (Mapbox-style, e.g. ['get', 'opacity'])
 * - A {@link ConstantStyleValue} or {@link DataDrivenStyleValue} instance (used as-is)
 *
 * Constants, functions, and expression arrays are converted to StyleValue instances in the PaintStyle constructor.
 */
export declare type StyleValue<T> = StaticOrFunctionStyleValue<T> | ExpressionArray | DataDrivenStyleValue<T> | ConstantStyleValue<T>;

declare abstract class StyleValue_2<T> {
    private constant;
    private expression;
    private fn;
    constructor(value: T | any[] | StyleEvaulatorFunction<T>);
    /**
     * Returns whether this value is an expression.
     */
    isExpression(): boolean;
    /**
     * Resolves the final value based on input properties.
     * If it's a constant, returns it directly.
     */
    resolve(properties?: Record<string, any>): T;
    /**
     * Returns the raw constant or expression for debugging or serialization.
     */
    getRaw(): T | any[] | StyleEvaulatorFunction<T> | null;
}

/**
 * Supported color bands.
 */
declare const SupportedColorBands: string[];

/**
 * Supported sample channel combinations.
 */
declare const SupportedSampleChannels: string[];

declare const SupportedSymbolAnchors: string[];

export declare type SymbolAnchor = typeof SupportedSymbolAnchors[number];

export declare type SymbolIcon = string | RemoteSymbolImage;

/**
 * A type representing an icon atlas, which is a collection of icon identifiers and an optional value interval.
 * @remarks
 * This type is used to define the icon atlas to use for a symbol layer. You can use the `interval` property to
 * specify the data value interval to use for the layer to determine which icon to use from the atlas based on the
 * underlying data source value at the symbol's position.
 *
 * @example
 * ```js
 * {
 *     ids: ['icon-1', 'icon-2', 'icon-3'],
 *     interval: 10
 * }
 * ```
 * In this example, the icon atlas will use the `icon-1` image for data values between 0 and 10, the `icon-2` image for
 * data values between 10 and 20, and the `icon-3` image for data values between 20 and 30.
 */
export declare type SymbolIconAtlas = {
    ids: Array<string>;
    interval?: number;
};

/**
 * Symbol style properties control how icons, glyphs or instanced geometries get rendered on a map. Custom WebGL
 * fragment shader programs can be provided for highly custom visualizations and effects for each instance on the map.
 */
export declare interface SymbolStyleSpec {
    /**
     * Key to use for identifying the symbol across multiple tiles. This is useful for ensuring that the same symbol
     * is rendered consistently across tiles. If not provided, then the symbol will be rendered based on the feature's
     * text value or some other property of the feature.
     */
    key: StyleValue<string>;
    /**
     * Feature property value to determines the order in which the symbol should be rendered when performing collision
     * detection. Features with higher rank values will be rendered first with a lower chance of colliding with other
     * features.
     */
    rank: string | SortProperty;
    /**
     * Whether the symbol should fade in and out when placed on the map or based on collision detection.
     */
    fadeOpacity: boolean;
    /**
     * When true, the symbol will be pitched with the map. Otherwise, the symbol will always be oriented up when the
     * map is pitched.
     */
    pitchWithMap: boolean;
    /**
     * When true, the symbol will be rotated with the map so that it aligns with the map's east/west axis. Otherwise,
     * the symbol will always face the camera.
     */
    rotateWithMap: boolean;
    scaleWithMap: boolean;
    /**
     * When true, the symbol will be scaled based on its distance from the camera. This is useful for scaling symbols
     * based on their distance from the camera so that symbols are smaller when they are further away and larger when
     * they are closer when the map is pitched.
     */
    sizeAttenuation: boolean;
    /**
     * Whether to disable collision detection and allow symbol to overlap with other symbols on the map. Defaults to
     * `true`. Use this in conjunction with `overlapMode` to control the behavior of symbols when they overlap with
     * other symbols.
     */
    allowOverlap: boolean;
    /**
     * Determines how symbols should be rendered when they overlap with other symbols and `allowOverlap` is `false`.
     * Default value is `layer`.
     * @remarks
     * When set to `layer`, symbols from this layer will not be allowed to overlap with other symbols from the same
     * layer, but can overlap with symbols from other layers on the map. When set to `map`, symbols from this layer
     * will not be allowed to overlap with symbols from its nor all other layers on the map.
     */
    overlapMode: 'layer' | 'map';
    /**
     * Sorts features based on an array of properties and sort direction. Features with lower sort values are drawn
     * first with a lower chance of colliding with other features. Sorting is performed in the order in which they
     * appear in the array.
     */
    sortKey: StyleValue<Array<{
        property: string;
        direction?: 'asc' | 'desc';
    }>>;
    /**
     * @deprecated Use `paint.icon` instead.
     */
    icon: any;
    /**
     * @deprecated Use `paint.icon.type` instead.
     */
    type: 'arrow' | 'wind-barb';
    /**
     * @deprecated Use `paint.icon.size` instead.
     */
    size: StyleValue<Size>;
    /**
     * @deprecated Use `paint.icon.anchor` instead.
     */
    anchor: StyleValue<SymbolAnchor>;
    /**
     * @deprecated Use `paint.icon.offset` instead.
     */
    offset: StyleValue<Point>;
    /**
     * @deprecated Use `paint.icon.padding` instead.
     */
    padding: StyleValue<number | [number, number]>;
    /**
     * @deprecated Use `paint.icon.rotation` instead.
     */
    rotation: StyleValue<number>;
    /**
     * @deprecated Use `paint.icon.blending` instead.
     */
    blending: Blending;
    /**
     * @deprecated Use `paint.icon.animated` instead.
     */
    animated: boolean;
    /**
     * @deprecated Use `paint.icon.shader` instead.
     */
    shader: StyleValue<string>;
    /**
     * @deprecated Use `paint.icon.uniforms` instead.
     */
    uniforms: Record<string, any>;
    /**
     * @deprecated Use `paint.icon.factor` instead.
     */
    factor: StyleValue<number>;
}

/**
 * Extracts the result type from a DownloadTask type.
 * @template Task - The download task type that extends DownloadTask
 * @example
 * type MyTask = DownloadTask<string>;
 * type MyResult = TaskData<MyTask>; // MyResult is 'string'
 */
export declare type TaskData<Task extends DownloadTask<any>> = Task extends DownloadTask<infer T> ? T : never;

/**
 * Function type that executes a download task with retry logic and error handling.
 * @template Task - The download task type that extends DownloadTask
 * @param task - The download task to execute.
 * @param config - Configuration for the task runner.
 * @returns A Promise that resolves when the task completes (successfully or after all retries fail).
 */
export declare type TaskRunner<Task extends DownloadTask<any>> = (task: Task, config: TaskRunnerConfig<Task>) => Promise<Response>;

/**
 * Configuration object for task runner execution.
 * @template Task - The download task type that extends DownloadTask
 */
export declare interface TaskRunnerConfig<Task extends DownloadTask<any>> {
    /** Maximum number of retry attempts for failed tasks. */
    maxRetries: number;
    /** HTTP status code range [min, max] that triggers retry attempts. */
    retryStatusRange: [number, number];
    /** Optional function to transform tasks before execution. */
    taskTransformer?: (task: Task) => Task;
}

/**
 * Text style properties control how text gets rendered on a map from vector features. Use these properties on
 * conjunction with `symbol` to define the style for a text layer.
 */
export declare interface TextStyleSpec {
    /**
     * Text to render. This can be a static string or an expression that evaluates to a string.
     */
    value: StyleValue<string>;
    /**
     * The size of the text in pixels.
     */
    size: StyleValue<number>;
    /**
     * Font name to use for the text. If the font is not available, the default font will be used.
     */
    font: StyleValue<string>;
    /**
     * Font weight to use for the text.
     */
    weight: StyleValue<'normal' | 'bold'>;
    /**
     * Color the text will be drawn with.
     */
    color: StyleValue<string | Color | StyleExpression>;
    /**
     * Color the text will be outlined with.
     */
    outlineColor: StyleValue<string | Color | StyleExpression>;
    /**
     * The opacity the text will be drawn with.
     */
    opacity: StyleValue<number>;
    /**
     * Determines how text will be horizontally aligned within its bounding box.
     */
    align: StyleValue<'left' | 'center' | 'right'>;
    /**
     * Determines how to capitalize the text, similar to the CSS `text-transform` property.
     */
    transform: StyleValue<'none' | 'uppercase' | 'lowercase' | 'capitalize'>;
    /**
     * Determines which corner or edge of the text box to place at the anchor point.
     */
    anchor: StyleValue<SymbolAnchor>;
    /**
     * The offset distance, either positive or negative, of the symbol relative to its anchor in pixels.
     */
    offset: StyleValue<Offset>;
    /**
     * Margin size to apply around the text bounding box to use for detecting collisions, in pixels.
     *
     * @remarks
     * If a single value is provided, then the same margin size will be applied to all sides of the symbol bounding
     * box. If an array of two values is provided, then the first value will be applied to the left and right sides of
     * the symbol bounding box, and the second value will be applied to the top and bottom sides of the symbol bounding
     * box.
     */
    padding: StyleValue<number | [number, number]>;
    /**
     * The clockwise rotation angle of the text, in degrees. Rotation will take place around the text's anchor point.
     */
    rotation: StyleValue<number>;
    /**
     * Amount of text tracking in ems, which is the space between each letter.
     */
    letterSpacing: StyleValue<number>;
    /**
     * Amount of leading between lines of multiline text in ems.
     */
    lineHeight: StyleValue<number>;
    /**
     * Maximum width of the text box in pixels before wrapping.
     */
    maxWidth: StyleValue<number>;
}

/**
 * A `Tile` represents a single tile in a tile grid and its data.
 * @template Data The type of data associated with the tile.
 */
export declare class Tile<Data> implements Disposable {
    uid: number;
    private _coord;
    private _span;
    private _bounds;
    private _state;
    /**
     * Monotonically increasing identifier for the most recent request that started loading this tile.
     * Used by `TileSource` to guard against out-of-order async responses overwriting newer data.
     */
    requestId: number;
    private _data;
    /**
     * The tile coordinate of the tile as `x`, `y`, and `z`.
     * @readonly
     */
    get coord(): TileCoord;
    /**
     * The span of the tile in meters as `x` and `y`.
     * @readonly
     */
    get span(): TileCoordinate;
    /**
     * The bounds of the tile in meters as `nw` and `se`.
     * @readonly
     */
    get bounds(): TileCoordinateBounds;
    /**
     * The current state of the tile.
     */
    get state(): TileState;
    set state(value: TileState);
    /**
     * The data associated with the tile.
     */
    get data(): Data;
    set data(value: Data);
    /**
     * The size of the tile in pixels as `width` and `height` which can depened on the type of data stored in the tile.
     * @readonly
     */
    get size(): Size;
    constructor(coord: TileCoord);
    /**
     * Returns a clone of the tile with the option to wrap the tile in the x direction.
     * @param wrap - The number of times to wrap the tile in the x direction.
     * @returns A clone of the tile.
     */
    clone(wrap?: number): Tile<Data>;
    /**
     * Disposes of the tile and its data.
     */
    dispose(): void;
    toString(): string;
}

/**
 * A `TileBounds` represents a region defined by a set of tiles in a grid.
 */
export declare class TileBounds {
    /**
     * The top tile coordinate of the bounds.
     */
    top: number;
    /**
     * The bottom tile coordinate of the bounds.
     */
    bottom: number;
    /**
     * The left tile coordinate of the bounds.
     */
    left: number;
    /**
     * The right tile coordinate of the bounds.
     */
    right: number;
    /**
     * Number of tiles horizontally in the region.
     * @readonly
     */
    get width(): number;
    /**
     * Number of tiles vertically in the region.
     * @readonly
     */
    get height(): number;
    /**
     * Center tile in the bounds.
     * @readonly
     */
    get center(): Point;
    get info(): Rect_2;
    constructor(left: number, right: number, top: number, bottom: number);
    /**
     * Expands the bounds by the specified offsets.
     * @param xOffset - The offset to expand the bounds horizontally.
     * @param yOffset - The offset to expand the bounds vertically.
     * @returns The expanded bounds.
     */
    expand(xOffset: number, yOffset: number): TileBounds;
    /**
     * Returns whether the bounds equals the specified bounds.
     * @param bounds -
     * @returns
     */
    equals(bounds: TileBounds): boolean;
    /**
     * Returns whether the bounds overlaps the specified bounds.
     * @param bounds -
     * @returns
     */
    overlaps(bounds: TileBounds): boolean;
    /**
     * Returns the intersection the bounds with the specified bounds.
     * @param bounds -
     * @returns
     */
    intersection(bounds: TileBounds): TileBounds;
    /**
     * Returns whether the bounds contains the specified tile coordinate.
     * @param coord -
     * @returns
     */
    contains(coord: TileCoord): boolean;
    clone(): TileBounds;
    static fromCoords(coords: Array<Point>): TileBounds;
}

/**
 * A `TileCoord` represents tile coordinate information for a Slippy Map tile.
 */
export declare class TileCoord {
    /**
     * The `x` coordinate of the tile.
     */
    readonly x: number;
    /**
     * The `y` coordinate of the tile.
     */
    readonly y: number;
    /**
     * The `z` coordinate of the tile which normally represents the zoom level.
     */
    readonly z: number;
    /**
     * The hash of the tile coordinate.
     * @readonly
     */
    get hash(): string;
    /**
     * Total number of times the tile coordinate has wrapped around the world in the x direction. This number may be
     * positive or negative depending on the direction of the wrap.
     * @readonly
     */
    get wrap(): number;
    /**
     * Returns `true` if the tile coordinate is for zoom level 0.
     * @readonly
     */
    get isRoot(): boolean;
    constructor(z: number, x: number, y: number);
    /**
     * Returns `true` if the tile coordinate is equal to the provided tile coordinate.
     * @param coord - The tile coordinate to compare.
     * @returns `true` if the tile coordinate is equal to the provided tile coordinate.
     */
    equals(coord: TileCoord): boolean;
    /**
     * Returns a normalized tile coordinate, which removes any wrapping from the tile coordinate.
     * @returns
     */
    normalize(): TileCoord;
    /**
     * Returns the ancestor tile coordinate for the provided offset.
     * @param offset - The number of zoom levels to offset from the current tile coordinate.
     * @returns The ancestor tile coordinate for the provided offset.
     */
    getAncestor(offset?: number): TileCoord;
    /**
     * Returns the descendant tile coordinates for the provided offset.
     * @param offset - The number of zoom levels to offset from the current tile coordinate.
     * @returns The descendant tile coordinates for the provided offset.
     */
    getDescendants(offset?: number): Array<TileCoord>;
    /**
     * Returns the neighboring tile coordinate for the provided x and y offset.
     * @param xoffset - The x offset from the current tile coordinate.
     * @param yoffset - The y offset from the current tile coordinate.
     * @returns The neighboring tile coordinate for the provided x and y offset.
     */
    getNeighbor(xoffset: number, yoffset: number): TileCoord;
    /**
     * Returns the neighboring tile coordinates for the current tile coordinate as a 9x9 grid centered on the current
     * tile coordinate.
     */
    getNeighbors(): Record<TileQuadrant, TileCoord>;
    /**
     * Returns the x and y quadrant of the tile coordinate.
     */
    getQuadrant(): [number, number];
    /**
     * Returns `true` if the tile coordinate is an ancestor of the provided tile coordinate.
     * @param coord - The tile coordinate to compare.
     */
    isAncestorOf(coord: TileCoord): boolean;
    /**
     * Returns `true` if the tile coordinate is a descendant of the provided tile coordinate.
     * @param coord - The tile coordinate to compare.
     */
    isDescendantOf(coord: TileCoord): boolean;
    /**
     * Returns the normalized position (from `0` to `1`) for the top-left corner of the tile coordinate.
     * @returns
     */
    getPosition(): Point;
    /**
     * Returns the normalized position (from `0` to `1`) for the center of the tile coordinate.
     * @returns
     */
    getCenter(): Point;
    toString(): string;
    toInfo(): TileInfo;
    /**
     * Returns a tile coordinate from the provided hash.
     * @param hash - The hash of the tile coordinate.
     * @returns A new tile coordinate insstance from the provided hash.
     */
    static fromHash(hash: string): TileCoord;
}

export declare type TileCoordinate = {
    x: number;
    y: number;
};

export declare type TileCoordinateBounds = {
    nw: TileCoordinate;
    se: TileCoordinate;
};

export declare interface TileInfo {
    x: number;
    y: number;
    z: number;
}

/**
 * Represents a layer that renders data from a tile-based data source. This is the base class for all tile-based layers
 * and is not intended to be used directly.
 * @template Data Type of data stored in the layer's tiles.
 */
declare abstract class TileLayer<Data> extends WebGLLayer<TileSource> {
    /**
     * Tile pyramid used to calculating and requesting tiles for the layer from the data source.
     */
    readonly pyramid: TilePyramid<Data>;
    readonly zoomOffset: number;
    private tileBounds;
    private dataQuality;
    private upgradeDataQuality;
    private lastHiddenTime;
    private tileLoadProgress;
    private _preloadLowQuality;
    /**
     * Returns the layer's data render quality.
     * @see DataQuality
     */
    get quality(): DataQuality;
    /**
     * Sets the layer's data render quality.
     * @see DataQuality
     */
    set quality(value: DataQuality);
    /**
     * Creates an instance of TileLayer.
     * @param id - Unique identifier of the layer.
     * @param config - Config options for the layer.
     */
    constructor(id: string, { quality, preloadLowQuality, ...config }: Partial<TileLayerConfig>);
    /**
     * Returns whether expired tiles can still be used for rendering/LOD fallback.
     * Default is disabled so stale tiles are not rendered after data refreshes.
     */
    shouldRenderExpiredTiles(): boolean;
    refresh(clear?: boolean): void;
    /**
     * Returns the layer's tile cache so renderers can use it via RenderFrameContext instead of accessing layer.source.tiles.
     */
    getTileCache(): AnyTileCache;
    /**
     * Returns the layer's tile dimensions for texture array setup.
     */
    getTileSize(): {
        width: number;
        height: number;
    };
    /**
     * Returns the data zoom level used for the specified map zoom level based on the configured `quality` level.
     * @param zoom - Map zoom level to get the data zoom level for.
     * @param scale - Scale to apply to the data quality.
     * @remarks
     * The scale parameter is used to reduce the data quality by a factor of the specified scale. For example, if the
     * scale is 0.5, the data quality will be reduced by half. If the scale is 0.25, the data quality will be reduced
     * by one-quarter.
     * @returns Data zoom level, optionally adjusted by the data quality scale and clamped to the source's min/max zoom
     * levels.
     */
    getDataZoom(zoom?: number, scale?: number): number;
    /**
     * Preloads low-quality tiles for the layer at the specified zoom level. This is used to ensure we can render data
     * anywhere quickly when zooming in our out beyond partial bounds for tiles not yet loaded.
     * @param zoom : Zoom level to preload low-quality tiles for.
     */
    preloadLowQualityTiles(zoom?: number): void;
    /**
     * Returns the tile at the specified geographic coordinate.
     * @param coord - Geographic coordinate to get the tile for.
     * @param allowPartials - Whether to allow returning a tile that only partially contains the queried coordinate.
     * @returns Tile and position within the tile for the specified coordinate.
     */
    protected getTile(coord: Coordinate, zoom?: number, allowPartials?: boolean): {
        tile: Tile<Data>;
        position: Point;
    } | undefined;
    /**
     * Returns the visible tile coordinates based on the map's current viewport.
     * @returns Array of visible tile coordinates.
     */
    getVisibleTileCoords(): Array<TileCoord>;
    private _alreadyPreloadedLowQualityTiles;
    /**
     * Requests visible tiles from the tile pyramid.
     * @param reload - Whether to reload tiles that have already been requested.
     * @returns Promise that resolves when the tiles have been requested.
     */
    private requestVisibleTiles;
    protected requestTiles(coords: Array<TileCoord>, reload?: boolean): Promise<void>;
    protected shouldReloadTile(coord: TileCoord): boolean;
    onAdd(context: Context): void;
    onMove(): void;
    onVisible(): void;
    onHidden(): void;
    private onDataStale;
    private onDataChange;
    private onTileLoad;
    private onTileError;
    private onLoadProgress;
    private onLoadStart;
    private onLoadComplete;
    private _shouldRequestTiles;
    onTimelineRangeChange(e: any): void;
    protected onTimeSeriesDataChange(): void;
    protected onMaskLayerChange(): void;
    protected onMaskStateChange(): void;
}

/**
 * Configuration options for a tile-based layer.
 */
export declare interface TileLayerConfig extends WebGLLayerConfig {
    /**
     * Quality to use when rendering data.
     */
    quality: DataQuality;
    /**
     * Range of values to use when rendering data.
     */
    dataRange: ValueRange;
    /**
     * Offset to apply to the map's zoom level when requesting data from the data source. This is useful to render data
     * at a different zoom level than the map's zoom level.
     */
    zoomOffset: number;
    /**
     * Whether to preload low-quality tiles when the layer is added or the time range changes,
     * ensuring fallback data is available immediately when panning or zooming beyond currently
     * loaded tile bounds. Default is `false`.
     */
    preloadLowQuality: boolean;
}

export declare type TilePositionData = {
    translation: Vector3;
    scale: Vector3;
    matrix: Matrix4;
};

export declare type TileQuadrant = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

/**
 * Options for a tile request.
 */
export declare type TileRequestOptions = {
    /**
     * The HTTP method to use for the request.
     */
    method: 'GET' | 'POST';
    /**
     * The authenticator to use for the request, if any.
     */
    authenticator?: AnyAuthenticator;
    /**
     * The request body to send, if any.
     */
    body: any;
    /**
     * The request headers to send, if any.
     */
    headers: any;
    /**
     * The request parameters to send, if any.
     */
    params: Record<string, any>;
    /**
     * The {@link AbortSignal} to use for the request.
     */
    signal: AbortSignal;
    /**
     * The download priority of the request.
     */
    priority: DownloadPriority;
    /**
     * Whether to reload the tile if it has already been loaded.
     */
    reload: boolean;
    /**
     * The time intervals to load for the tile.
     */
    intervals: Array<Date>;
};

/**
 * `TileSource` is an abstract class that provides the primary implementation of a tile-based data source object that
 * loads tiles from a remote source. This class is not intended to be used directly, but rather extended by a concrete
 * implementation of a tile-based data source.
 *
 * @remarks
 * **Tile loading: two complementary mechanisms**
 *
 * Network fetches are orchestrated by {@link TileSource.downloadManager} (`DownloadManager`). `requestTile` may run
 * decode/parse work after bytes arrive. Understanding these two behaviors avoids duplicate work and stale tiles:
 *
 * 1. **Download deduplication** — For a given `TileDownloadTask` key (tile coordinate plus optional interval key from
 *    {@link makeTileKey} / {@link makeTileArrayKey}), the manager ensures at most one in-flight or pending fetch. If
 *    `requestTile` is called again while that task is still pending or in-flight, callers await the **same** promise
 *    instead of starting a second HTTP request. This reduces redundant bandwidth and coordinates multiple callers
 *    (e.g. layers or rapid map updates) that share the exact same request identity.
 *
 * 2. **Load generation guard (`tile.requestId` / `task.loadRequestId`)** — Deduping only merges identical
 *    **keys**. It does **not** decide which result is "current" when the logical request for a tile slot changes:
 *    different URL parameters (time, style, reload), a new fetch after a previous task finished, or a slow
 *    {@link parseTile} finishing after a newer `requestTile` has already started. For non-interval loads, each **new**
 *    enqueued download task gets a monotonically increasing id; callers that shared that task share the same id.
 *    After `parseTile` resolves, the result is applied only if that id still matches `tile.requestId` (see
 *    `requestTile` and `loadTile`). Stale completions are dropped so an older response cannot overwrite newer data for
 *    the same tile instance.
 *
 * **Interval-based loads** (time-series tiles with multiple intervals on one tile) intentionally skip this per-tile
 * id guard so a single tile can accumulate multiple interval results; ordering for those paths is handled elsewhere
 * in the data model.
 *
 * @template Data The type of data stored in a tile.
 * @template Source The type of the source specification.
 */
declare abstract class TileSource<Data = any, Source extends TileSourceSpecification = TileSourceSpecification> extends DataSource<Source> {
    /**
     * Monotonic counter used when assigning {@link TileDownloadTask.loadRequestId} for non-interval loads. Each new
     * enqueued download task gets the next id; waiters sharing the same task reuse that id. See class-level docs on
     * deduplication vs. load-generation guard.
     */
    private _tileLoadRequestId;
    private _metadataLoadPromise?;
    private _pendingTaskCountByCoord;
    private _pendingIntervalsByCoord;
    /**
     * The minimum zoom level for the source.  Defaults to `0`.
     */
    minZoom: number;
    /**
     * The maximum zoom level for the source.  Defaults to `21`.
     */
    maxZoom: number;
    /**
     * The authenticator used to authenticate requests for the source if required.
     * By default, this is a `PassthroughAuthenticator` which does not add any authentication headers to requests.
     */
    readonly authenticator: AnyAuthenticator;

/**
     * Returns the URL template for the source.  This is a string that can contain variables that will be replaced with
     * values from the tile coordinate when a tile is requested. The following variables are supported:
     * - `{x}`: The x coordinate of the tile.
     * - `{y}`: The y coordinate of the tile.
     * - `{z}`: The zoom level of the tile.
     * - `{s}`: The subdomain of the tile.
     * - `{size}`: The size of the tile when width and height are the same.
     * - `{width}`: The width of the tile.
     * - `{height}`: The height of the tile.
     * @readonly
     */
    get tileUrl(): string;
    /**
     * Returns the tile size.
     * @readonly
     */
    get tileSize(): {
        width: number;
        height: number;
    };
    
    /**
     * Returns the coordinate bounds for the source if provided by the source configuration.
     * When defined, data and/or tiles will not be requested outside of these bounds. This is useful for limiting the
     * amount of data requested from a source when the data is only needed for a specific region.
     * @readonly
     */
    get bounds(): CoordinateBounds;

constructor(id: string, spec: Partial<Source>);
    /**
     * Generates a tile instance for the source.
     * @param coord - The tile coordinate.
     */
    generateTile(coord: TileCoord): Tile<Data>;
    /**
     * Sets the URL template for the source.
     * @param url - The URL template to use when requesting tiles.
     */
    setTileUrl(url: string): void;
    /**
     * Returns the URL for a tile based on the configured URL template, tile coordinate, and other tile-related
     * information.
     * @param coord - The tile coordinate.
     * @param params - Additional variables to use when generating the URL.
     * @returns The URL for the tile.
     */
    getTileUrl(coord: TileCoord, params?: Record<string, any>): string;
    /**
     * Checks if tile data exists for the given coordinate.
     * For time-series sources, pass `intervals` to require data for those intervals; otherwise
     * only the coord is checked and a single cached tile counts as "has data".
     * @param coord - The tile coordinate.
     * @param layerId - Optional layer ID for per-layer data (unused but retained for API compatibility). If provided,
     *   the tile data must have data for the given layer ID. This is only used for vector tile sources.
     * @param allowExpired - If true, allows expired tiles to be considered as having data.
     * @param intervals - Optional time intervals (e.g. from request options). When provided, the tile must have
     *   data for all of these intervals (used for time-series / multi-interval requests). The base implementation
     *   only checks for data for the given intervals if the tile data is a time series data object.
     * @returns Whether tile data exists (optionally including expired/stale and/or for the given intervals).
     */
    hasTileData(coord: TileCoord, layerId?: string, allowExpired?: boolean, intervals?: Array<Date>): boolean;
    /**
     * Returns whether there is already a pending or in-flight request for the given coordinate
     * (and optionally for the given intervals). Used to avoid duplicate requests when the
     * same tile+intervals are requested multiple times.
     * @param coord - The tile coordinate.
     * @param intervals - Optional time intervals. When provided, only a task for the same coord and
     *   these intervals is considered; when omitted, any task for this coord is considered.
     * @returns True if a matching request is pending or in-flight.
     */
    isPending(coord: TileCoord, intervals?: Array<Date>): boolean;
    getTileDataSize(data?: Data): Size;
    /**
     * Returns whether the source should request a tile.
     * @param tile - The tile to check.
     * @param options - Optional request options (reload, intervals for time-series, etc.). Subclasses may use
     *   this to request a tile when cached data does not satisfy the request (e.g. missing interval).
     * @returns Whether the source should request a tile.
     */
    shouldRequestTile(tile: Tile<Data>, reload?: boolean, intervals?: Array<Date>): boolean;
    /**
     * Reloads all cached tiles.
     */
    reload(): void;
    /**
     * Requests a tile from the source.
     * @param coord - The tile coordinate.
     * @param options - Additional options to use when requesting the tile.
     * @returns A promise that resolves with the tile data.
     */
    requestTile(coord: TileCoord, options?: Partial<TileRequestOptions>): Promise<Data | null>;
    protected loadTile(tile: Tile<Data>, options?: Partial<TileRequestOptions>, loadRequestCtx?: {
        loadRequestId: number;
    }): Promise<{
        data: Blob | null;
        headers: Headers | null;
    }>;
    getMetadata(options?: Partial<UrlRequestOptions>): Promise<unknown>;

removeConsumer(consumer: DataSourceConsumer): void;
    /**
     * Aborts a tile request.
     * @param tile - The tile to abort.
     */
    protected abortTile(tile: Tile<Data>): void;
    /**
     * Aborts in-worker requests for a tile by coordinate (e.g. when tile is no longer visible).
     * Override in subclasses that run work in a worker (e.g. encoded operation layers).
     * @param coord - The tile coordinate to abort.
     */
    abortTileByCoord(_coord: TileCoord): void;
    
    /**
     * Cancels all active tile requests.
     */
    cancelAllRequests(): void;
    
    protected onLoadStart(): void;
    protected onLoadProgress(e: any): void;
    protected onLoadComplete(): void;
    protected onTileLoaded(tile: Tile<Data>, data: Data): void;
    protected onTileError(tile: Tile<Data>, err: any): void;
    dispose(): void;
}

/**
 * Represents the configuration for a tile data source.
 */
export declare interface TileSourceSpecification extends SourceSpecification {
    /**
     * The minimum zoom level at which the source is available from `0` to `21`. Defaults to `0`.
     */
    minZoom: number;
    /**
     * The maximum zoom level at which the source is available from `0` to `21`. Defaults to `21`.
     */
    maxZoom: number;
    /**
     * The geographical coordinate bounds of the source.
     */
    bounds: CoordinateBounds;
    /**
     * The tile URL template string to use when requesting tiles.
     */
    url: string;
    /**
     * The tile size in pixels. If a number is provided, the tile is assumed to be square. Defaults to `256`.
     */
    tileSize: number | {
        width: number;
        height: number;
    };
    /**
     * Map projection of the source. Defaults to `EPSG:3857`.
     */
    projection: 'EPSG:3857' | 'EPSG:4326';
    /**
     * A function that requests a tile from the source.
     * @param tile - The tile to load.
     * @param url - The URL template string to use when requesting the tile.
     * @param options - Additional options to use when requesting the tile.
     * @returns A promise that resolves to the response from the tile request.
     */
    loadTile: (tile: TileCoord, url: string, options?: Partial<TileRequestOptions>) => Promise<Response>;
}

export declare const TileState: {
    readonly initial: "initial";
    readonly loading: "loading";
    readonly reloading: "reloading";
    readonly processing: "processing";
    readonly ready: "ready";
    readonly expired: "expired";
    readonly failed: "failed";
    readonly upsampled: "upsampled";
};

export declare type TileState = ObjectValue<typeof TileState>;

/**
 * An animation that is based on time and is bound by a start and end date.
 */
export declare class TimeAnimation extends Animation {
    /**
     * Whether the animation should always stop at the start date.
     */
    alwaysStopAtStart: boolean;
    /**
     * The start date of the animation.
     */
    get startDate(): Date;
    set startDate(value: Date);
    /**
     * The offset between the start date and the animation's reference date in milliseconds. The reference date is the
     * current date at the time the animation was instantiated or the last time the start/end date was set.
     * @readonly
     */
    get startOffset(): number;
    /**
     * The end date of the animation.
     */
    get endDate(): Date;
    set endDate(value: Date);
    /**
     * The offset between the end date and the animation's reference date in milliseconds. The reference date is the
     * current date at the time the animation was instantiated or the last time the start/end date was set.
     * @readonly
     */
    get endOffset(): number;
    /**
     * The current date of the animation based on the animation's current position.
     * @readonly
     */
    get currentDate(): Date;
    /**
     * The reference date of the animation. The reference date is the current date at the time the animation was
     * instantiated or the last time the start/end date was set.
     * @readonly
     */
    get referenceDate(): Date;
    /**
     * Whether the animation includes time in the past.
     * @readonly
     */
    get containsPast(): boolean;
    /**
     * Whether the animation includes time in the future.
     * @readonly
     */
    get containsFuture(): boolean;
    /**
     * Returns whether the animation only includes time in the past.
     * @readonly
     */
    get isPast(): boolean;
    /**
     * Returns whether the animation only includes time in the future.
     * @readonly
     */
    get isFuture(): boolean;
    /**
     * The time difference between the start and end date in milliseconds.
     * @readonly
     */
    get deltaTime(): number;
    /**
     * Returns metadata information about the current state of the animation.
     * @readonly
     */
    get info(): TimeAnimationInfo;
    private _startDate;
    private _startOffset;
    private _endDate;
    private _endOffset;
    private _now;
    private _rangeChangeAnchorDate?;
    constructor({ start, end, alwaysStopAtStart, ...animationOpts }: Partial<TimeAnimationOptions>);
    /**
     * Sets the start date of the animation using an offset from a reference date.
     * @param offset - The offset in milliseconds.
     * @param relativeTo - The date to use as a reference for the offset. Default is the current date and time.
     */
    setStartDateUsingOffset(offset: number, relativeTo?: Date): void;
    /**
     * Sets the start date of the animation using a relative time string, such as "1 day", "2 hours", etc.
     * @param relativeDate - The relative time string.
     * @param relativeTo - The date to use as a reference for the relative time. Default is the current date and time.
     */
    setStartDateUsingRelativeTime(relativeDate: string, relativeTo?: Date): void;
    /**
     * Sets the end date of the animation using an offset from a reference date.
     * @param offset - The offset in milliseconds.
     * @param relativeTo - The date to use as a reference for the offset. Default is the current date and time.
     */
    setEndDateUsingOffset(offset: number, relativeTo?: Date): void;
    /**
     * Sets the end date of the animation using a relative time string, such as "1 day", "2 hours", etc.
     * @param relativeDate - The relative time string.
     * @param relativeTo - The date to use as a reference for the relative time. Default is the current date and time.
     */
    setEndDateUsingRelativeTime(relativeDate: string, relativeTo?: Date): void;
    /**
     * Begins playing the animation from the specified date where `date` is within the time range between the
     * timeline's `startDate` and `endDate` values.
     * @param date - The date to start the animation from.
     */
    playFromDate(date: Date): void;
    /**
     * Advances the animation to a specific position based on a date.
     * @param date - The date to advance to. If the date is outside the range of the animation, it will be clamped to
     * the start or end date.
     */
    goToDate(date: Date): void;
    /**
     * Advances the animation to a specific position based on an time offset from the start date.
     * @param offset - The time offset in milliseconds.
     */
    goToOffset(offset: number): void;
    getPositionFromDate(date: Date): number;
    /**
     * Restricts the animation to a specific date range relative to the overall start and end date.
     * @param min - The minimum date for the range, which must be between the start and end date.
     * @param max - The maximum date for the range, which must be between the start and end date.
     */
    clampDateRange(min: Date, max: Date): void;
    protected eventPayload(): Record<string, any>;
    protected advanceToStopPosition(): void;
    private _debouncedRangeChangeEvent;
    /**
     * Captures the current date as an anchor date for the range change event.
     */
    private _captureRangeChangeAnchorDate;
    /**
     * Restores the anchor date for the range change event.
     */
    private _restoreRangeChangeAnchorDate;
}

export declare type TimeAnimationInfo = {
    isActive: boolean;
    currentDate: Date;
    startDate: Date;
    endDate: Date;
    deltaTime: number;
};

/**
 * Configuration options for a time-based animation.
 */
export declare interface TimeAnimationOptions extends AnimationOptions {
    /**
     * The start date of the animation.
     */
    start: Date | string;
    /**
     * The end date of the animation.
     */
    end: Date | string;
    mode: TimeClampMode;
    /**
     * Whether the animation should always stop at the start date.
     */
    alwaysStopAtStart: boolean;
}

/**
 * Defines how to restrict the visibility of a time-specific layer.
 */
export declare const TimeClampMode: {
    /**
     * The time series data can be displayed at any time.
     */
    readonly none: "none";
    /**
     * The time series data can only be displayed for past time intervals.
     */
    readonly past: "past";
    /**
     * The time series data can only be displayed for future time intervals.
     */
    readonly future: "future";
    /**
     * The time series data can only be displayed within a specific time range.
     */
    readonly range: "range";
};

export declare type TimeClampMode = ObjectValue<typeof TimeClampMode>;

export declare type TimeInterval = number;

export declare type TimeIntervalKey = string;

/**
 * A {@link TimeAnimation} that manages and controls one or more individual animations. Using a timeline, you can
 * control the playback of multiple animations at once and keep them in sync.
 * @remarks
 * When an animation is added to a `Timeline`, it will not be added to the global {@link AnimationLoop}. Instead, the
 * `Timeline` will manage the animation's playback and progress. This means that individual animations will not be
 * updated unless the `Timeline` is playing.
 */
export declare class Timeline extends TimeAnimation {
    private _animations;
    /**
     * The animations managed by the timeline.
     * @readonly
     */
    get animations(): Array<Animation>;
    get info(): TimelineInfo;
    constructor(opts: Partial<TimeAnimationOptions>);
    /**
     * Adds an animation to the timeline.
     * @param animation - The animation to add.
     */
    add(animation: Animation): void;
    /**
     * Removes an animation from the timeline.
     * @param animation - The animation to remove.
     */
    remove(animation: Animation): void;
    /**
     * Removes an animation from the timeline by its identifier if it exists.
     * @param id - The identifier of the animation to remove.
     */
    removeById(id: string): void;
    /**
     * Stops and removes all animations from the timeline.
     */
    clear(): void;
    play(position?: number): void;
    pause(): void;
    resume(): void;
    stop(): void;
    restart(): void;
    advance(progress: number, useTotalDuration?: boolean): void;
    goToDate(date: Date): void;
    goTo(position: number, useTotalDuration?: boolean): void;
    /**
     * Calls a function for each animation in the timeline.
     * @param fn - The function to call for each animation.
     * @param enabledOnly - Whether to only call the function for enabled animations. Default is `true`.
     */
    private _each;
    protected advanceToStopPosition(): void;
}

export declare type TimelineInfo = {
    isActive: boolean;
    currentDate: Date;
    startDate: Date;
    endDate: Date;
    deltaTime: number;
};

/**
 * A type that represents a time range.
 */
export declare type TimeRange = {
    /**
     * The start of the time range.
     */
    start: Date;
    /**
     * The end of the time range.
     */
    end: Date;
};

/**
 * Defines the mode used when evaluating a layer's data based on time. Layers that aren't time-specific
 * should use a value of `none`.
 */
export declare const TimeSeriesMode: {
    /**
     * The time series data is not time-specific and should be displayed at any time.
     */
    readonly none: "none";
    /**
     * The time series data is time-specific but can be displayed at any time.
     */
    readonly any: "any";
    /**
     * The time series data is time-specific and should be displayed at valid time intervals.
     */
    readonly interval: "interval";
    /**
     * The time series data is time-specific and should reloaded when the time range changes.
     */
    readonly range: "range";
};

export declare type TimeSeriesMode = ObjectValue<typeof TimeSeriesMode>;

/**
 * Represents an operation to perform on the data within a time series.
 */
export declare type TimeSeriesOperation = {
    /**
     * Type of operation to perform on the data.
     */
    type: TimeSeriesOperationType;
    /**
     * Period of time to perform the operation on the data.
     */
    period?: TimeSeriesOperationPeriod;
    /**
     * Whether to aggregate the data, meaning to combine the data from multiple intervals of the desired period into a
     * single value.
     */
    aggregate?: boolean;
    /**
     * Bands to restrict the operation to. If not specified, the operation will be applied to all bands.
     */
    bands?: Array<ColorBand>;
    /**
     * The data range to remap the data to. If not specified, the data range will not be remapped and use provided data
     * range or the range based on the datasets being used by the operation.
     */
    remappedDataRange?: ValueRange;
};

/**
 * Period of time to perform an operation on the data within a time series.
 *
 * - `none`: Does not perform the operation on a periodic basis.
 * - `hour`: Performs the operation on an hourly basis.
 * - `day`: Performs the operation on a daily basis.
 * - `week`: Performs the operation on a weekly basis.
 * - `month`: Performs the operation on a monthly basis.
 * - `year`: Performs the operation on a yearly basis.
 */
export declare type TimeSeriesOperationPeriod = 'none' | 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * Type of operation to perform on the data within a time series.
 *
 * - `none`: Does not perform any operation on the data.
 * - `sum`: Performs a sum operation on the data by adding the data from one interval to the aggregated sum of the
 * previous intervals.
 * - `difference`: Performs a difference operation on the data by subtracting the data from one interval from the
 * aggregated difference of the previous intervals.
 * - `max`: Performs a max operation on the data by comparing the data from one interval to the aggregated max of the
 * previous intervals.
 * - `min`: Performs a min operation on the data by comparing the data from one interval to the aggregated min of the
 * previous intervals.
 */
export declare type TimeSeriesOperationType = 'none' | 'sum' | 'diff' | 'max' | 'min';

export declare type TimestampledPixel = {
    interval: TimeInterval;
    pixel: RGB;
};

/**
 * A unit converter function.
 */
export declare type UnitConverter = (value: number, from: string, to: string) => number;

/**
 * The supported units of measurement.
 */
declare const Units: {
    readonly temperature: {
        readonly C: "C";
        readonly F: "F";
    };
    readonly speed: {
        readonly kmh: "km/h";
        readonly mph: "mph";
        readonly ms: "m/s";
        readonly kts: "kts";
    };
    readonly pressure: {
        readonly mb: "mb";
        readonly pa: "Pa";
        readonly hPa: "hPa";
        readonly hg: "inHg";
    };
    readonly distance: {
        readonly m: "m";
        readonly km: "km";
        readonly ft: "ft";
        readonly mi: "mi";
    };
    readonly precipitation: {
        readonly mm: "mm";
        readonly cm: "cm";
        readonly in: "in";
        readonly m: "m";
        readonly ft: "ft";
    };
    readonly direction: {
        readonly deg: "°";
    };
    readonly time: {
        readonly hr: "hr";
        readonly min: "min";
        readonly sec: "sec";
        readonly ms: "ms";
    };
    readonly rate: {
        readonly mmhr: "mm/hr";
        readonly inhr: "in/hr";
        readonly mms: "mm/sec";
        readonly dbz: "dBZ";
    };
    readonly concentration: {
        readonly ppm: "ppm";
        readonly ugm3: "ug/m^3";
    };
    readonly ratio: {
        readonly percent: "%";
    };
};

export declare const units: {
    UnitSystem: {
        readonly metric: "metric";
        readonly imperial: "imperial";
        readonly custom: "custom";
    };
    Units: {
        readonly temperature: {
            readonly C: "C";
            readonly F: "F";
        };
        readonly speed: {
            readonly kmh: "km/h";
            readonly mph: "mph";
            readonly ms: "m/s";
            readonly kts: "kts";
        };
        readonly pressure: {
            readonly mb: "mb";
            readonly pa: "Pa";
            readonly hPa: "hPa";
            readonly hg: "inHg";
        };
        readonly distance: {
            readonly m: "m";
            readonly km: "km";
            readonly ft: "ft";
            readonly mi: "mi";
        };
        readonly precipitation: {
            readonly mm: "mm";
            readonly cm: "cm";
            readonly in: "in";
            readonly m: "m";
            readonly ft: "ft";
        };
        readonly direction: {
            readonly deg: "°";
        };
        readonly time: {
            readonly hr: "hr";
            readonly min: "min";
            readonly sec: "sec";
            readonly ms: "ms";
        };
        readonly rate: {
            readonly mmhr: "mm/hr";
            readonly inhr: "in/hr";
            readonly mms: "mm/sec";
            readonly dbz: "dBZ";
        };
        readonly concentration: {
            readonly ppm: "ppm";
            readonly ugm3: "ug/m^3";
        };
        readonly ratio: {
            readonly percent: "%";
        };
    };
    resolveMeasurementForUnits: (type: _units.ConversionMeasurement) => _units.Measurement;
    defaultUnits: Record<"metric" | "imperial", MapUnits>;
    getDefaultUnit: (type: _units.ConversionMeasurement, system: "metric" | "imperial" | "custom") => string;
    getDefaultUnitsForSystem: (system: "metric" | "imperial" | "custom") => MapUnits;
    equalUnits: (units1: MapUnits, units2: MapUnits) => boolean;
    getSystemForUnits: (units: MapUnits) => "metric" | "imperial" | "custom";
    FtoC: (f: number) => number;
    CtoF: (c: number) => number;
    mphToKph: (mph: number) => number;
    mphToMs: (mph: number) => number;
    kphToMph: (kph: number) => number;
    kphToMs: (kph: number) => number;
    msToKph: (ms: number) => number;
    msToMph: (ms: number) => number;
    mbToPa: (mb: number) => number;
    mbToHg: (mb: number) => number;
    paToMb: (pa: number) => number;
    hgToMb: (hg: number) => number;
    mToKm: (m: number) => number;
    mToFt: (m: number) => number;
    mToIn: (m: number) => number;
    mToMi: (m: number) => number;
    kmToM: (km: number) => number;
    ftToM: (ft: number) => number;
    kmToMi: (km: number) => number;
    miToM: (mi: number) => number;
    mmToIn: (mm: number) => number;
    inToMM: (ins: number) => number;
    inToM: (ins: number) => number;
    inToMMRate: (ins: number) => number;
    mmToMMRate: (mm: number) => number;
    CtoFUnit: (c: number) => number;
    FtoCUnit: (f: number) => number;
    mphToMsUnit: (mph: number) => number;
    msToMphUnit: (ms: number) => number;
    dbzToMMRate: (dbz: number, perSecond?: boolean) => number;
    degToDir: (d: number) => string;
    getUnitPrecision: (unit: string) => number;
    convert: (type: string, value: number, from: string, to: string) => number;
    getMeasurementType: (str: string) => _units.Measurement;
};

declare namespace _units {
    export {
        UnitSystem,
        Units,
        Measurement,
        ConversionMeasurement,
        resolveMeasurementForUnits,
        defaultUnits,
        getDefaultUnit,
        getDefaultUnitsForSystem,
        equalUnits,
        getSystemForUnits,
        FtoC,
        CtoF,
        mphToKph,
        mphToMs,
        kphToMph,
        kphToMs,
        msToKph,
        msToMph,
        mbToPa,
        mbToHg,
        paToMb,
        hgToMb,
        mToKm,
        mToFt,
        mToIn,
        mToMi,
        kmToM,
        ftToM,
        kmToMi,
        miToM,
        mmToIn,
        inToMM,
        inToM,
        inToMMRate,
        mmToMMRate,
        CtoFUnit,
        FtoCUnit,
        mphToMsUnit,
        msToMphUnit,
        dbzToMMRate,
        degToDir,
        getUnitPrecision,
        convert,
        getMeasurementType
    }
}

/**
 * The supported unit systems.
 */
declare const UnitSystem: {
    readonly metric: "metric";
    readonly imperial: "imperial";
    readonly custom: "custom";
};

export declare type UnitSystem = keyof typeof UnitSystem;

export declare type UrlRequestOptions = {
    url: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    reload?: boolean;
};

export declare const utils: {
    browser: {
        firefox: boolean;
        chrome: boolean;
        safari: boolean;
        version: number;
        info: {
            name: string;
            version: string;
            mobile: boolean;
        };
    };
};

export declare type ValueRange = {
    min: number;
    max: number;
};

/**
 * Represents the configuration for a vector tile data source.
 */
export declare type VectorSourceSpecification = TileSourceSpecification;

export declare const VectorSourceType: {
    readonly point: "point";
    readonly line: "line";
    readonly polygon: "polygon";
    readonly symbol: "symbol";
};

export declare type VectorSourceType = ObjectValue<typeof VectorSourceType>;

/** Static vector tile data or time-series container for animated vector tiles. */
export declare type VectorTileData = VectorData | VectorTimeSeriesData;

/**
 * A {@link TileSource} for vector tile data.
 * Vector tiles are a compact representation of geographic data. They are typically used to render map data in a vector
 * format, such as lines, polygons, and points.
 * Vector tiles are typically served as a compressed binary format, such as
 * Mapbox's [MVT](https://docs.mapbox.com/vector-tiles/reference/mapbox-vector-tile-spec/).
 */
export declare class VectorTileSource extends TileSource<VectorTileData, VectorSourceSpecification> {
    
    /**
     * Tracks deferred tile refresh requests while a tile is still loading.
     * Map key: tile coord hash.
     * Map value: layer ids to refresh once parsing completes (`*` means refresh all consumers).
     */
    private readonly _pendingRefreshByTile;
    get type(): string;
    
    constructor(id: string, spec: Partial<VectorSourceSpecification>);
    hasTileData(coord: TileCoord, layerId?: string, allowExpired?: boolean, _intervals?: Array<Date>): boolean;
    expireAllTiles(): void;
    expireTile(tile: Tile<VectorTileData>): void;
    addConsumer(consumer: DataSourceConsumer): void;
    /**
     * Refreshes the data for all tiles in the source.
     * @param layerId - The layer ID to refresh. If not provided, all layers will be refreshed.
     */
    refreshAllTileData(layerId?: string): void;
    /**
     * Refreshes the data for a single tile in the source by re-parsing the existing data. This is useful when a new
     * consumer is added or the filter expression has changed for a consuming layer.
     * @param tile - The tile to refresh.
     */
    refreshTileData(tile: Tile<VectorTileData>, layerId?: string): Promise<void>;
    
}

export declare const version: string;

export declare const weather: {
    /**
     * @deprecated
     */
    getWeatherSourceSpec: (id: string, account: Account, overrides?: Partial<any>) => Partial<SourceSpecification> | (DataSource<SourceSpecification> & Identifiable);
    /**
     * @deprecated
     */
    getWeatherLayerConfig: (id: string, account: Account, opts?: Partial<WeatherLayerOptions>) => string[] | WeatherLayerConfiguration;
    /**
     * @deprecated
     */
    getWeatherLayerAlias: (id: string) => string;
};

export declare type WeatherCode = string;

/**
 * Configuration for a weather layer, including the data source, legend and data evaluator.
 */
export declare interface WeatherLayerConfiguration extends Identifiable {
    /**
     * Reference to another layer configuration to use as a base for this layer. This layer will inherit all properties
     * from the referenced layer, but can override any of them.
     */
    ref?: string;
    /**
     * The data source specification for the layer.
     */
    source?: Partial<SourceSpecification> | DataSource & Identifiable;
    /**
     * The layer specification for the layer.
     */
    layer: Partial<LayerSpecification>;
    /**
     * The legend configuration options.
     */
    legend?: Partial<LegendOptions> & Identifiable;
    /**
     * The data evaluator to use for the layer, if any.
     */
    evaluator?: DataEvaluator;
    /**
     * The layer to use for querying and sampling data from, if any.
     */
    query?: QueryLayerConfiguration;
    /**
     * The layer mask configuration to use when rendering the the layer, if any.
     */
    mask?: LayerMaskConfiguration;
    /**
     * The operation to perform on the data within the time series. Defaults to `none`.
     */
    operation?: TimeSeriesOperation;
}

/**
 * Metadata for a weather layer. This information is stored in the documentation CMS and returned by the available
 * endpoint in JSON format.
 */
export declare interface WeatherLayerMetadata {
    /**
     * Identifier for the weather layer, which is used when adding the layer to the map via `addWeatherLayer`.
     */
    id: WeatherCode;
    /**
     * Layer type, which determines how the layer gets rendered.
     */
    style: WeatherLayerStyle;
    /**
     * Title of the weather layer.
     */
    title: string;
    /**
     * Description of the weather layer.
     */
    description: string;
    /**
     * Whether or not the layer is animatable across a time series.
     */
    animatable: boolean;
    /**
     * Categories that the layer belongs to.
     */
    categories: Array<string>;
    /**
     * Time range the layer can provide data for.
     */
    dataRange: string;
    /**
     * Regions covered by the layer's data.
     */
    dataCoverage: Array<string>;
    /**
     * Update frequency of the layer's data.
     */
    updateInterval: string;
}

/**
 * Defines the set of optional overrides for a weather layer.
 */
export declare type WeatherLayerOptions = {
    /**
     * The unique identifier for the layer. If not provided, then the default identifier will be used.
     */
    id: string;
    /**
     * The render style to use for rendering the layer's data.
     */
    type: LayerType;
    /**
     * The minimum zoom level for the layer.
     */
    minZoom?: number;
    /**
     * The maximum zoom level for the layer.
     */
    maxZoom?: number;
    /**
     * Whether the layer should be hidden by default. Default is `false`.
     */
    hidden: boolean;
    /**
     * Options for configuring the layer's data.
     */
    data: Partial<{
        /**
         * The MapsGL server to use for requesting data.
         */
        server: string;
        /**
         * Quality to render the data at.
         */
        quality: DataQuality;
        /**
         * The geographical coordinate bounds to restrict the data to.
         * @remarks
         * Data outside of these bounds will not be requested nor rendered. In the case of tile-based data, this will
         * restrict the tiles requested to only those that intersect the bounds and whose coverage depends on the zoom
         * level.
         */
        bounds: CoordinateBounds;
        /**
         * Minimum zoom level to request data for. This value must be equal to or greater than the data source's
         * default minimum zoom level and less than or equal to the maximum zoom level.
         */
        minZoom: number;
        /**
         * Maximum zoom level to request data for. This value must be equal to or less than the data source's default
         * maximum zoom level and greater than or equal to the minimum zoom level.
         */
        maxZoom: number;
        /**
         * Additional parameters to pass to the data request.
         */
        params: Record<string, any>;
        /**
         * The data evaluator to use for the layer in a map's data inspector control.
         */
        evaluator: DataEvaluator;
        /**
         * Whether to show city name labels on the layer, which is used for text-based data query layers only. Default
         * value is `true`.
         */
        cities: boolean;
        /**
         * Whether to preload low-quality tiles when the layer is added or the time range changes,
         * ensuring fallback data is available immediately when panning or zooming beyond currently
         * loaded tile bounds. Default is `false`.
         */
        preloadLowQuality: boolean;
    }>;
    /**
     * Options for configuring the layer's timing behavior, for time-based data only.
     */
    timing: Partial<Omit<LayerTiming, 'mode'>>;
    /**
     * Filter expression for vector tile layers. Evaluated with StyleExpression.
     */
    filter: FilterExpression;
    /**
     * Paint style overrides for the layer.
     */
    paint: Partial<PaintStyleSpec>;
    /**
     * Legend overrides for the layer. If you set this to `false`, then the legend will be disabled for the layer.
     */
    legend: Partial<LegendOptions> | false;
    /**
     * The map's live timeline animation instance, used by source generators for both time range
     * parameters and per-feature animation controllers.
     */
    timeline: TimeAnimation;
    /**
     * Options for configuring a mask to apply to the layer.
     */
    mask: LayerMaskConfiguration;
    childLayers?: {
        [id: string]: Partial<WeatherLayerOptions>;
    };
};

/**
 * Provides MapsGL weather layer configurations for a given account.
 */
export declare class WeatherLayerProvider {

constructor(account: Account);
    initialize(account: Account, style: MapStyle): Promise<void>;
    isWeatherLayer(code: string): boolean;
    /**
     * Returns whether or not the specified weather code is deprecated.
     */
    isDeprecated(code: WeatherCode): boolean;
    /**
     * Returns the alias to use for the specified weather code, if any.
     */
    getLayerAlias(code: WeatherCode): string | undefined;
    /**
     * Returns the metadata for all available weather layers.
     */
    getLayerMetadata(): Promise<Array<WeatherLayerMetadata>>;
    /**
     * Returns a weather layer configuration for the specified Xweather Raster Maps layer code.
     * @param code - The raster layer code to get the configuration for.
     * @returns The weather layer configuration.
     */
    getRasterLayerConfig(code: string): WeatherLayerConfiguration;
    /**
     * Returns the weather layer configuration for the specified weather code. If the code represents a combined layer,
     * then an array of weather codes will be returned instead.
     * @param code - The weather code to get the configuration for.
     * @param overrides - Any additional options to apply to the layer configuration.
     * @returns The weather layer configuration or an array of weather codes if the code is a combined layer.
     */
    getWeatherLayerConfig(code: WeatherCode, overrides?: Partial<WeatherLayerOptions>): WeatherLayerConfiguration | Array<WeatherCode> | undefined;

}

export declare type WeatherLayerStyle = `${WeatherLayerType}` | 'composite';

export declare type WeatherLayerType = Exclude<LayerType, 'particles' | 'query' | 'voronoi' | 'data' | 'debug'>;

/**
 * The base class for all layers rendered with WebGL. This class should not be instantiated directly but rather extended
 * by a subclass that is responsible for rendering a specific type of data from a data source.
 * @template Source The type of data source that this layer will render.
 */
declare abstract class WebGLLayer<Source extends DataSource = DataSource> extends EventDispatcher {
    /**
     * The unique identifier for this layer.
     */
    readonly id: string;
    /**
     * The data source that this layer will render.
     */
    readonly source: Source;
    /**
     * The type of layer.
     */
    type: LayerType;
    /**
     * The minimum zoom level for the layer.
     */
    minZoom: number;
    /**
     * The maximum zoom level for the layer.
     */
    maxZoom: number;
    /**
     * The map controller that this layer is associated with.
     */
    map: AnyMapController;
    
    /**
     * The layer's timing configuration.
     */
    timing: LayerTiming;
    
    /**
     * Whether to invert the mask layer's output.
     */
    invertMaskLayer: boolean;
    
    private _renderFrameContext;

/**
     * Returns the render paint style configuration for this layer.
     * @readonly
     */
    get paint(): PaintStyle;
    /**
     * Returns the renderer responsible for rendering this layer and its data.
     * @readonly
     */
    get renderer(): LayerRenderer;

get mask(): LayerMask;
    set mask(value: LayerMask);
    get isLayerMask(): boolean;
    set isLayerMask(value: boolean);
    /**
     * Returns whether this layer is visible or not.
     * @readonly
     */
    get visible(): boolean;
    /**
     * Registers another layer as depending on this layer (for example it reads this layer via `queryFeatures`
     * while this layer may be hidden). When the registry is non-empty, time-series data providers may load tiles even
     * if this layer is not visible.
     */
    registerDependentLayer(layer: WebGLLayer): void;
    /**
     * Removes a layer from this layer's dependent registry.
     */
    unregisterDependentLayer(layer: WebGLLayer): void;
    /**
     * Whether any layer has registered as a dependent via
     * {@link WebGLLayer.registerDependentLayer}.
     */
    hasDependentLayers(): boolean;
    /**
     * Returns whether this layer is enabled or not.
     */
    get enabled(): boolean;
    /**
     * Sets whether this layer is enabled or not.
     */
    set enabled(value: boolean);
    /**
     * Returns metadata information about this layer, such as its type, source, and style, etc.
     * @readonly
     */
    get metadata(): LayerMetadata;
    /**
     * Returns whether this layer needs to be updated or not.
     * @readonly
     */
    get isDirty(): boolean;
    /**
     * Optional measurement metadata associated with this layer's values.
     */
    measurement: {
        type: ConversionMeasurement;
        units: string;
    } | undefined;
    constructor(id: string, { source, renderer, measurement }: Partial<WebGLLayerConfig>);
    /**
     * Shows the layer if it is hidden.
     */
    show(): void;
    /**
     * Hides the layer if it is visible.
     */
    hide(): void;
    /**
     * Flags the layer as dirty so that it is updated during the next render frame.
     * @param force - Whether to force the layer to be updated even if it is not visible.
     */
    setNeedsUpdate(force?: boolean): void;

/**
     * Sets the value of a paint style property for the layer.
     * @param property - Paint style property to set as a key path string.
     * @param value - New value of the paint style property to set.
     */
    setPaintProperty(property: string, value: any): void;
    /**
     * Returns all features found for the layer at the specified coordinate and zoom level (optional). If a value for
     * `zoom` is not provided, then the map's current zoom level will be used.
     * The value returned will vary depending on the type of render style used for the layer. For example, a sample
     * fill layer style will return the sampled value at that coordinate from the data source, whereas a vector or
     * GeoJSON layer style will return the model properties associated with the feature at that location.
     * @param coord - Geographic coordinate to query for features.
     * @param zoom - Zoom level to query for features. If not provided, the map's current zoom level will be used.
     * @param allowPartials - Whether to use partial data (ancestor or descendant) if the exact tile is not loaded.
     * @param requestIfMissing - Whether to request the tile if it is missing.
     * @returns The features found at the specified coordinate and zoom level.
     */
    queryFeatures(coord: Coordinate, zoom: number, allowPartials: boolean, requestIfMissing?: boolean): FeatureQueryResult;
    /**
     * Returns a Promise that will query the layer for all features at the specified coordinate and zoom level
     * (optional). If a value for `zoom` is not provided, then the map's current zoom level will be used.
     * The value returned by the Promise will vary depending on the type of render style used for the layer. For
     * example, a sample fill layer style will return the sampled value at that coordinate from the data source,
     * whereas a vector or GeoJSON layer style will return the model properties associated with the feature at that
     * location.
     * @param coord - Geographic coordinate to query for features.
     * @param zoom - Zoom level to query for features. If not provided, the map's current zoom level will be used.
     * @returns A Promise that will resolve with the features found at the specified
     */
    queryFeaturesPromise(coord: Coordinate, zoom: number, allowPartials: boolean): Promise<FeatureQueryResult | null>;
    /**
     * Refreshes the layer by re-rendering it.
     * If a complete refresh is needed including triggering the associated data source to reload, then pass an argument
     * of `true` when calling the method. Otherwise, existing cached data will be used when the layer is re-rendered.
     * @param clear - Whether to clear the layer's data source and re-fetch data.
     */
    refresh(clear?: boolean): void;

protected addSourceEventHandler(event: string, handler: (e: any) => void, once?: boolean): void;
    
    protected onReady(): void;

protected onMaskStateChange(): void;
    protected eventPayload(): Record<string, any>;
    /**
     * Disposes of all cached data and resources associated with the layer. This method is automatically called when
     * the layer is removed from a MapController instance.
     */
    dispose(): void;
}

/**
 * Configuration options for a WebGL layer.
 */
export declare interface WebGLLayerConfig {
    /**
     * The data source that this layer will render.
     */
    source: DataSource;
    /**
     * The layer's data to use from the data source, if applicable. This is only used for vector tile data sources
     * whose tiles are in the Mapbox Vector Tile (MVT) format.
     */
    sourceLayer: string;
    /**
     * The feature type to render from the data source, if applicable. This is only used for vector tile data sources
     * whose tiles are in the Mapbox Vector Tile (MVT) format.
     */
    sourceType: VectorSourceType;
    /**
     * Renderer responsible for rendering this layer and its data.
     */
    renderer: LayerRenderer;
    
    /**
     * Animation instance that controls the animation of this layer if time-based.
     */
    animation: Animation;
    /**
     * Optional measurement metadata associated with this layer's values.
     */
    measurement: {
        type: ConversionMeasurement;
        units: string;
    };
}

