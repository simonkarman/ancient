import { HexDirection } from './HexDirection';
import { AxialCoordinate } from './AxialCoordinate';
import { approximatelyEqual } from './Math';

export class CubeCoordinate {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
  ) { }

  public static readonly Zero = new CubeCoordinate(0, 0, 0);
  public static readonly Up = new CubeCoordinate(0, -1, +1);
  public static readonly RightUp = new CubeCoordinate(+1, -1, 0);
  public static readonly RightDown = new CubeCoordinate(+1, 0, -1);
  public static readonly Down = new CubeCoordinate(0, +1, -1);
  public static readonly LeftDown = new CubeCoordinate(-1, +1, 0);
  public static readonly LeftUp = new CubeCoordinate(-1, 0, +1);
  public static readonly Directions = [
    CubeCoordinate.Up, CubeCoordinate.RightUp, CubeCoordinate.RightDown,
    CubeCoordinate.Down, CubeCoordinate.LeftDown, CubeCoordinate.LeftUp,
  ];

  public static add(a: CubeCoordinate, b: CubeCoordinate | HexDirection) {
    if (typeof b === 'number') {
      if (b == HexDirection.NONE) {
        return a;
      }
      b = CubeCoordinate.Directions[b];
    }
    return new CubeCoordinate(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  public add(other: CubeCoordinate | HexDirection) {
    return CubeCoordinate.add(this, other);
  }

  public static substract(a: CubeCoordinate, b: CubeCoordinate | HexDirection) {
    if (typeof b === 'number') {
      if (b == HexDirection.NONE) {
        return a;
      }
      b = CubeCoordinate.Directions[b];
    }
    return new CubeCoordinate(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  public substract(other: CubeCoordinate | HexDirection) {
    return CubeCoordinate.substract(this, other);
  }

  public static approximatelyEqual(a: CubeCoordinate, b: CubeCoordinate, epsilon = 0.001) {
    return (approximatelyEqual(a.x, b.x, epsilon)
      && approximatelyEqual(a.y, b.y, epsilon)
      && approximatelyEqual(a.z, b.z, epsilon));
  }
  public approximatelyEqual(other: CubeCoordinate, epsilon = 0.001) {
    return CubeCoordinate.approximatelyEqual(this, other, epsilon);
  }

  public static multiply(a: CubeCoordinate, s: number) {
    return new CubeCoordinate(a.x * s, a.y * s, a.z * s);
  }
  public multiply(s: number) {
    return CubeCoordinate.multiply(this, s);
  }

  public rounded() {
    let roundedX = Math.round(this.x);
    let roundedY = Math.round(this.y);
    let roundedZ = Math.round(this.z);

    const xDiff = Math.abs(roundedX - this.x);
    const yDiff = Math.abs(roundedY - this.y);
    const zDiff = Math.abs(roundedZ - this.z);

    if ((xDiff > yDiff) && (xDiff > zDiff)) {
      roundedX = -roundedY - roundedZ;
    }
    else if (yDiff > zDiff) {
      roundedY = -roundedX - roundedZ;
    }
    else {
      roundedZ = -roundedX - roundedY;
    }
    return new CubeCoordinate(roundedX, roundedY, roundedZ);
  }

  public toAxial() {
    return new AxialCoordinate(this.x, this.z);
  }

  public toString() {
    return `Cube(${this.x}, ${this.y}, ${this.z})`;
  }

  public get length() {
    return (Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z)) / 2;
  }

  public static distance(a: CubeCoordinate, b: CubeCoordinate) {
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
  }
  public distance(other: CubeCoordinate) {
    return CubeCoordinate.distance(this, other);
  }
}
