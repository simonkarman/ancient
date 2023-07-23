import { CubeCoordinate } from './CubeCoordinate';
import { HexDirection } from './HexDirection';
import { approximatelyEqual } from './Math';
import { Vector2 } from './Vector2';

export class AxialCoordinate {
  constructor(
    public readonly q: number,
    public readonly r: number,
  ) {}

  public static readonly Zero = new AxialCoordinate(0, 0);
  public static readonly Up = new AxialCoordinate(0, +1);
  public static readonly RightUp = new AxialCoordinate(+1, 0);
  public static readonly RightDown = new AxialCoordinate(+1, -1);
  public static readonly Down = new AxialCoordinate(0, -1);
  public static readonly LeftDown = new AxialCoordinate(-1, 0);
  public static readonly LeftUp = new AxialCoordinate(-1, +1);
  public static readonly Directions = [
    AxialCoordinate.Up, AxialCoordinate.RightUp, AxialCoordinate.RightDown,
    AxialCoordinate.Down, AxialCoordinate.LeftDown, AxialCoordinate.LeftUp,
  ];

  public static add(a: AxialCoordinate, b: AxialCoordinate | HexDirection) {
    if (typeof b === 'number') {
      if (b == HexDirection.NONE) {
        return a;
      }
      b = AxialCoordinate.Directions[b];
    }
    return new AxialCoordinate(a.q + b.q, a.r + b.r);
  }
  public add(other: AxialCoordinate | HexDirection) {
    return AxialCoordinate.add(this, other);
  }

  public static substract(a: AxialCoordinate, b: AxialCoordinate | HexDirection) {
    if (typeof b === 'number') {
      if (b == HexDirection.NONE) {
        return a;
      }
      b = AxialCoordinate.Directions[b];
    }
    return new AxialCoordinate(a.q - b.q, a.r - b.r);
  }
  public substract(other: AxialCoordinate | HexDirection) {
    return AxialCoordinate.substract(this, other);
  }

  public static approximatelyEqual(a: AxialCoordinate, b: AxialCoordinate, epsilon = 0.001) {
    return (approximatelyEqual(a.q, b.q, epsilon) && approximatelyEqual(a.r, b.r, epsilon));
  }
  public approximatelyEqual(other: AxialCoordinate, epsilon = 0.001) {
    return AxialCoordinate.approximatelyEqual(this, other, epsilon);
  }

  public static multiply(a: AxialCoordinate, s: number) {
    return new AxialCoordinate(a.q * s, a.r * s);
  }
  public multiply(s: number) {
    return AxialCoordinate.multiply(this, s);
  }

  public rounded() {
    return this.toCube().rounded().toAxial();
  }

  public toCube() {
    return new CubeCoordinate(this.q, -this.q - this.r, this.r);
  }

  public toPixel(size: number): Vector2 {
    return new Vector2(
      size * 3 / 2 * this.q,
      size * Math.sqrt(3) * (this.r + this.q / 2),
    );
  }

  public static fromPixel(pixel: Vector2, size: number) {
    return new AxialCoordinate(
      pixel.x * 2 / 3 / size,
      (-pixel.x / 3 + Math.sqrt(3) / 3 * pixel.y) / size,
    );
  }

  public toString() {
    return `Axial(${this.q}, ${this.r})`;
  }

  public static fromString(value: string): AxialCoordinate {
    if (value.startsWith('Axial(') && value.endsWith(')')) {
      const [x, y] = value.substring('Axial('.length, value.length - 1).split(',');
      if (y !== undefined) {
        return new AxialCoordinate(Number.parseFloat(x), Number.parseFloat(y));
      }
    }
    throw new Error(`axial-coordinate: ${value} is not a valid axial coordinate string`);
  }

  public get length() {
    return this.toCube().length;
  }

  public static distance(a: AxialCoordinate, b: AxialCoordinate) {
    return a.toCube().distance(b.toCube());
  }
  public distance(other: AxialCoordinate) {
    return AxialCoordinate.distance(this, other);
  }

  public static circle(center: AxialCoordinate, radius: number, exteriorOnly = false): AxialCoordinate[] {
    const coords: AxialCoordinate[] = [];
    center = center.rounded();
    radius = Math.round(radius);
    for (let q = center.q - radius + 1; q < center.q + radius; q++) {
      for (let r = center.r - radius + 1; r < center.r + radius; r++) {
        const coord = new AxialCoordinate(q, r);
        if (coord.distance(center) >= radius) {
          continue;
        }
        if (exteriorOnly && coord.distance(center) < radius - 1) {
          continue;
        }
        coords.push(coord);
      }
    }
    return coords;
  }

  public static rectangle(
    center: AxialCoordinate,
    direction: HexDirection,
    halfLength: number,
    halfThickness: number,
    extra = false,
  ): AxialCoordinate[] {
    const primary = AxialCoordinate.Directions[direction];
    const secondary = AxialCoordinate.Directions[(direction + 1) % 6];
    const tertiary = AxialCoordinate.Directions[(direction + 2) % 6];

    const coords: AxialCoordinate[] = [];
    for (let secondaryI = -halfThickness + 1; secondaryI < halfThickness; secondaryI++) {
      for (let primaryI = -halfLength + 1; primaryI < halfLength; primaryI++) {
        const coord = center
          .add(primary.multiply(primaryI))
          .add(secondary.multiply(Math.floor((secondaryI + 1) / 2)))
          .add(tertiary.multiply(Math.floor(secondaryI / 2)));
        if (extra && (primaryI == -halfLength + 1) && (secondaryI % 2 != 0)) {
          coords.push(coord.substract(primary));
        }
        coords.push(coord);
      }
    }
    return coords;
  }
}
