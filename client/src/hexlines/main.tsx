import { useKrmx } from '@krmx/client';
import React from 'react';
import { useAppSelector } from '../store/store';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { Vector2 } from '../utils/Vector2';
import { Line } from './hexlines-store';

const getCornerPosition = (cornerId: number) => Vector2.fromDegrees((cornerId - 2) * 60);
const getAnchorPosition = (anchorId: number): Vector2 => {
  const cornerIndexA = Math.floor(anchorId / 2);
  const cornerIndexB = cornerIndexA + 1;
  const cornerLocationA = getCornerPosition(cornerIndexA);
  const cornerLocationB = getCornerPosition(cornerIndexB % 6);
  const diff = cornerLocationB.substract(cornerLocationA).multiply(0.33);
  return cornerLocationA.add(diff.multiply(anchorId % 2 === 0 ? 1 : 2));
};

const Tile = (props: { size: number, location: AxialCoordinate, lines: Line[] }) => {
  const owners = useAppSelector(state => state.hexlines.owners);
  const pixel = props.location.toPixel(props.size);
  return (
    <g transform={`translate(${new Vector2(pixel.x, -pixel.y).toSvgString()})`}>
      <polygon
        points={
          [0, 1, 2, 3, 4, 5]
            .map(getCornerPosition)
            .map(corner => corner.multiply(props.size * 0.95))
            .map(corner => `${corner.x},${corner.y}`).join(' ')
        }
        fill='#FCF3CF'
        fillOpacity={0.4}
        strokeDasharray='4 4'
        stroke='#F7DC6F'
        strokeWidth={0.5}
      />
      {props.lines.map(({ fromAnchorId, toAnchorId, owner }, index) => {
        const from = getAnchorPosition(fromAnchorId).multiply(props.size);
        const to = getAnchorPosition(toAnchorId).multiply(props.size);
        return <path
          key={index}
          d={`M ${from.x} ${from.y} Q 0 0 ${to.x} ${to.y}`}
          stroke={owner === undefined ? '#F7DC6F' : owners[owner]?.color || 'black'}
          strokeWidth={owner === undefined ? props.size / 30 : props.size / 10}
          strokeOpacity={owner === undefined ? 0.5 : 1}
          fill="transparent"
        />;
      })}
    </g>
  );
};

export const Hexlines = () => {
  const tiles = useAppSelector(state => state.hexlines.tiles);
  const owners = Object.entries(useAppSelector(state => state.hexlines.owners));
  const svgSize = { x: 640, y: 480 };
  const hexSize = 27.3;
  return <>
    <svg
      className='mb-1 max-h-[75vh] w-full'
      preserveAspectRatio='xMidYMid meet'
      viewBox={`${-svgSize.x / 2} ${-svgSize.y / 2} ${svgSize.x} ${svgSize.y}`}
    >
      <circle r={hexSize * 0.3} fill={'#F7DC6F'} />
      {Object.entries(tiles).map(([tileId, tile]) => <Tile
        key={tileId}
        size={hexSize}
        location={AxialCoordinate.fromString(tile.location)}
        lines={tile.lines}
      />)}
      {owners.map(([player, owner]) => {
        if (owner.currentLocation === undefined) {
          return <></>;
        }
        const location = AxialCoordinate.fromString(tiles[owner.currentLocation.tileId].location);
        const pixelHex = location.toPixel(hexSize);
        const pixel = new Vector2(pixelHex.x, -pixelHex.y).add(getAnchorPosition(owner.currentLocation.anchorId).multiply(hexSize * 0.9));
        return <circle
          key={player}
          cx={pixel.x}
          cy={pixel.y}
          r={hexSize / 7}
          fill={owner.color}
          stroke='black'
        />;
      })}
    </svg>
    <ul className='flex justify-between gap-4'>
      {owners.map(([player, owner]) => <li
        key={player}
        className={`border p-4 text-2xl font-bold ${owner.currentLocation === undefined ? 'line-through' : ''}`}
        style={{ borderColor: owner.color, color: owner.color }}
      >
        {owner.player} {owner.score}
      </li>)}
    </ul>
  </>;
};
