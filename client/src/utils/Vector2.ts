import { approximatelyEqual } from './Math';

export class Vector2 {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  public static readonly Zero = new Vector2(0, 0);
  public static readonly Up = new Vector2(0, +1);
  public static readonly Right = new Vector2(+1, 0);
  public static readonly Down = new Vector2(0, -1);
  public static readonly Left = new Vector2(-1, 0);
  public static readonly Directions = [
    Vector2.Up, Vector2.Right, Vector2.Down, Vector2.Left,
  ];

  public static add(a: Vector2, b: Vector2) {
    return new Vector2(a.x + b.x, a.y + b.y);
  }
  public add(other: Vector2) {
    return Vector2.add(this, other);
  }

  public static substract(a: Vector2, b: Vector2) {
    return new Vector2(a.x - b.x, a.y - b.y);
  }
  public substract(other: Vector2) {
    return Vector2.substract(this, other);
  }

  public static approximatelyEqual(a: Vector2, b: Vector2, epsilon = 0.001) {
    return (approximatelyEqual(a.x, b.x, epsilon) && approximatelyEqual(a.y, b.y, epsilon));
  }
  public approximatelyEqual(other: Vector2, epsilon = 0.001) {
    return Vector2.approximatelyEqual(this, other, epsilon);
  }

  public static mutliply(a: Vector2, s: number) {
    return new Vector2(a.x * s, a.y * s);
  }
  public mutliply(s: number) {
    return Vector2.mutliply(this, s);
  }

  public rounded() {
    return new Vector2(
      Math.round(this.x),
      Math.round(this.y),
    );
  }

  public toString() {
    return `Vector2(${this.x}, ${this.y})`;
  }

  public toSvgString() {
    return `${this.x},${this.y}`;
  }

  public get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public static distance(a: Vector2, b: Vector2) {
    const xDiff = Math.abs(a.x - b.x);
    const yDiff = Math.abs(a.y - b.y);
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
  }
  public distance(other: Vector2) {
    return Vector2.distance(this, other);
  }

  public static fromDegrees(degrees: number) {
    const radians = Math.PI / 180 * degrees;
    return new Vector2(Math.cos(radians), Math.sin(radians));
  }
}
