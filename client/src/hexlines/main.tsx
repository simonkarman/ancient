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

const Tile = (props: { size: number, location: AxialCoordinate, lines: Line[], isEdge: boolean, debug: string }) => {
  const owners = useAppSelector(state => state.hexlines.owners);
  const pixel = props.location.toPixel(props.size);
  const isStartTile = AxialCoordinate.approximatelyEqual(props.location, AxialCoordinate.Zero);
  return (
    <g transform={`translate(${new Vector2(pixel.x, -pixel.y).toSvgString()})`}>
      <polygon
        points={
          [0, 1, 2, 3, 4, 5]
            .map(getCornerPosition)
            .map(corner => corner.multiply(props.size * (props.isEdge ? 0.95 : 0.95)))
            .map(corner => `${corner.x},${corner.y}`).join(' ')
        }
        fill={'#FCF3CF'}
        fillOpacity={props.isEdge ? 0.05 : (isStartTile ? 0.6 : 0.2)}
        stroke={'#F7DC6F'}
        strokeOpacity={0.8}
        strokeWidth={props.size / 30}
      />
      {props.lines.map(({ fromAnchorId, toAnchorId, owner }) => {
        const hasOwner = owner !== undefined;
        const from = getAnchorPosition(fromAnchorId).multiply(props.size * (hasOwner ? 0.98 : 0.95));
        const to = getAnchorPosition(toAnchorId).multiply(props.size * (hasOwner ? 0.98 : 0.95));
        const toCenterVector = from.add(to).multiply(props.isEdge ? 0.15 : 0.07);
        return <path
          className='transition-all duration-700'
          key={`${fromAnchorId}-${toAnchorId}`}
          d={`M ${from.x} ${from.y} Q ${toCenterVector.x} ${toCenterVector.y} ${to.x} ${to.y}`}
          stroke={hasOwner ? owners[owner]?.color || 'black' : '#F7DC6F'}
          strokeWidth={hasOwner ? props.size / 9 : props.size / 18}
          strokeOpacity={hasOwner ? 1 : 0.4}
          strokeLinecap={'round'}
          fill="transparent"
        />;
      })}
      <text>{props.debug}</text>
    </g>
  );
};

export const Hexlines = () => {
  const tiles = useAppSelector(state => state.hexlines.tiles);
  const owners = Object.entries(useAppSelector(state => state.hexlines.owners));
  const turn = useAppSelector(state => state.hexlines.turn);
  const numberOfHexesY = owners.length <= 2 ? 7 : 9;
  const hexSize = 40;
  const svgSize = { x: hexSize * (numberOfHexesY - 2) * 2, y: hexSize * (numberOfHexesY - 2) * 2 };
  return <>
    <svg
      className='mb-1 max-h-[75vh] w-full'
      preserveAspectRatio='xMidYMid meet'
      viewBox={`${-svgSize.x / 2} ${-svgSize.y / 2} ${svgSize.x} ${svgSize.y}`}
    >
      {Object.entries(tiles).map(([tileId, tile]) => <Tile
        key={tileId}
        size={hexSize}
        location={AxialCoordinate.fromString(tile.location)}
        lines={tile.lines}
        isEdge={tile.isEdge}
        debug={tile.debug}
      />)}
      <circle r={hexSize * 0.3} fill={'#F7DC6F'} />
      <defs>
        <radialGradient id='edge-mask-gradient'>
          <stop offset='76%' stopColor="rgba(255,255,255,0)" />
          <stop offset="79%" stopColor="rgba(255,255,255,1)" />
        </radialGradient>
      </defs>
      <circle r={svgSize.y * (owners.length <= 2 ? 0.62 : 0.58)} fill={'url(#edge-mask-gradient)'} />
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
        style={owner.player === turn ? { backgroundColor: owner.color, color: 'white' } : { borderColor: owner.color, color: owner.color }}
      >
        {owner.player} {owner.score}
      </li>)}
    </ul>
  </>;
};
