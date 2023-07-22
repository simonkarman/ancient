export enum HexDirection {
  NONE = -1,
  Up = 0,
  RightUp = 1,
  RightDown = 2,
  Down = 3,
  LeftDown = 4,
  LeftUp = 5,
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace HexDirection {
  export function inverse(direction: HexDirection): HexDirection {
    if (direction == HexDirection.NONE)
      return HexDirection.NONE;
    return (3 + direction) % 6;
  }
}
