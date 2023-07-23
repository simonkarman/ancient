import { useKrmx } from '@krmx/client';
import React, { useMemo } from 'react';
import { useAppSelector } from '../store/store';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { Vector2 } from '../utils/Vector2';
import { Line } from './hexlines-store';

const Tile = (props: { size: number, location: AxialCoordinate, lines: Line[] }) => {
  const corners = useMemo(
    () => AxialCoordinate.Directions.map((_, index) => Vector2.fromDegrees(index * 60).mutliply(props.size)),
    [props.size],
  );
  const getAnchor = (anchorId: number): Vector2 => {
    const cornerIndexA = Math.floor(anchorId / 2);
    const cornerIndexB = cornerIndexA + 1;
    const cornerLocationA = corners[cornerIndexA];
    const cornerLocationB = corners[cornerIndexB % 6];
    const diff = cornerLocationB.substract(cornerLocationA).mutliply(0.33);
    return cornerLocationA.add(diff.mutliply(anchorId % 2 === 0 ? 1 : 2));
  };
  const owners = useAppSelector(state => state.hexlines.owners);
  return (
    <g transform={`translate(${props.location.toPixel(props.size).toSvgString()})`}>
      <polygon
        points={corners.map(corner => `${corner.x},${corner.y}`).join(' ')}
        className='fill-current text-gray-200'
        fillOpacity={0.4}
        stroke='black'
        strokeWidth={0.3}
      />
      {props.lines.map(({ fromAnchorId, toAnchorId, owner }, index) => <path
        key={index}
        d={`M ${getAnchor(fromAnchorId).x} ${getAnchor(fromAnchorId).y} Q 0 0 ${getAnchor(toAnchorId).x} ${getAnchor(toAnchorId).y}`}
        stroke={owner === undefined ? 'black' : owners[owner]?.color || 'black'}
        strokeWidth={props.size / 20}
        fill='transparent'
      />)}

    </g>
  );
};

export const Hexlines = () => {
  const { send } = useKrmx();
  const tiles = Object.entries(useAppSelector(state => state.hexlines.tiles));
  const svgSize = { x: 640, y: 480 };
  return <>
    <h1>Hello!</h1>
    <svg
      className='mt-1 max-h-[75vh] w-full border'
      preserveAspectRatio='xMidYMid meet'
      viewBox={`${-svgSize.x / 2} ${-svgSize.y / 2} ${svgSize.x} ${svgSize.y}`}
    >
      {tiles.map(([tileId, tile]) => <Tile key={tileId} size={50} location={AxialCoordinate.fromString(tile.location)} lines={tile.lines} />)}
    </svg>
  </>;
};
