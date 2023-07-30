import { useKrmx } from '@krmx/client';
import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { Vector2 } from '../utils/Vector2';
import { hexlinesSlice, Line } from './hexlines-store';

const getCornerPosition = (cornerId: number) => Vector2.fromDegrees((cornerId - 2) * 60);
const getAnchorCorners = (anchorId: number): [Vector2, Vector2] => {
  const cornerIndexA = Math.floor(anchorId / 2);
  const cornerIndexB = cornerIndexA + 1;
  return [getCornerPosition(cornerIndexA), getCornerPosition(cornerIndexB % 6)];
};

const getAnchorPosition = (anchorId: number): Vector2 => {
  const corners = getAnchorCorners(anchorId);
  const diff = corners[1].substract(corners[0]).multiply(0.33);
  return corners[0].add(diff.multiply(anchorId % 2 === 0 ? 1 : 2));
};
const getAnchorNormal = (anchorId: number): Vector2 => {
  const corners = getAnchorCorners(anchorId);
  const diff = corners[1].substract(corners[0]);
  return new Vector2(diff.y, -diff.x).normalized();
};

const TileLine = (props: {
  tileSize: number, fromAnchorId: number, toAnchorId: number, strokeWidth: number, color: string, opacity: number
}) => {
  const from = getAnchorPosition(props.fromAnchorId).substract(getAnchorNormal(props.fromAnchorId).multiply(0.0)).multiply(props.tileSize);
  const to = getAnchorPosition(props.toAnchorId).substract(getAnchorNormal(props.toAnchorId).multiply(0.0)).multiply(props.tileSize);
  const distance = 0.25 + getAnchorPosition(props.fromAnchorId).distance(getAnchorPosition(props.toAnchorId)) * 0.15;
  const centerFrom = from.substract(getAnchorNormal(props.fromAnchorId).multiply(props.tileSize * distance));
  const centerTo = to.substract(getAnchorNormal(props.toAnchorId).multiply(props.tileSize * distance));
  return <>
    <path
      d={`M ${from.x} ${from.y} C ${centerFrom.x} ${centerFrom.y} ${centerTo.x} ${centerTo.y} ${to.x} ${to.y}`}
      stroke={props.color}
      strokeWidth={props.tileSize * props.strokeWidth}
      strokeOpacity={props.opacity}
      fill='transparent'
    />
  </>;
};

const Tile = (props: {
  gridSize: number,
  tileSize: number,
  location: AxialCoordinate,
  lines: Line[],
  isEdge: boolean,
  rotation: number | undefined,
  debug: string,
}) => {
  const owners = useAppSelector(state => state.hexlines.owners);
  const pixel = props.location.toPixel(props.gridSize);
  const isStartTile = AxialCoordinate.approximatelyEqual(props.location, AxialCoordinate.Zero);
  return (<g
    className='transition-transform duration-1000'
    transform={`translate(${new Vector2(pixel.x, -pixel.y).toSvgString()}) rotate(${(props.rotation ?? 0) * 60})`}
  >
    <polygon
      points={
        [0, 1, 2, 3, 4, 5]
          .map(getCornerPosition)
          .map(corner => corner.multiply(props.tileSize))
          .map(corner => `${corner.x},${corner.y}`).join(' ')
      }
      fill={props.rotation !== undefined ? '#F7DC6F' : '#FCF3CF'}
      fillOpacity={props.isEdge ? 0.4 : (isStartTile ? 1 : 0.8)}
      stroke={'#FCF3CF'}
      strokeOpacity={1}
      strokeWidth={props.tileSize * 0.025}
    />
    {[...props.lines]
      // ensure without owner is drawn first
      .sort((a, b) => (a.ownerName ? 1 : 0) - (b.ownerName ? 1 : 0))
      .map(line => <g key={`${line.fromAnchorId}-${line.toAnchorId}`}>
        <TileLine
          tileSize={props.tileSize}
          fromAnchorId={line.fromAnchorId}
          toAnchorId={line.toAnchorId}
          color={'#F7DC6F'}
          opacity={props.isEdge ? 0.3 : 0.5}
          strokeWidth={0.21}
        />
        <TileLine
          tileSize={props.tileSize}
          fromAnchorId={line.fromAnchorId}
          toAnchorId={line.toAnchorId}
          color={line.ownerName === undefined
            ? 'white'
            : owners[line.ownerName]?.color || 'black'
          }
          opacity={1}
          strokeWidth={0.13}
        />
      </g>)}
    {isStartTile && <>
      <circle r={props.gridSize * 0.5} fillOpacity={0.7} fill={'#F7DC6F'} />
      <circle r={props.gridSize * 0.4} fill={'white'} fillOpacity={0.9} />
    </>}
  </g>);
};

const Turn = (props: {gridSize: number, tileSize: number }) => {
  const { send } = useKrmx();
  const self = useAppSelector(state => state.hexlines.self);
  const turn = useAppSelector(state => state.hexlines.turn);
  if (turn === undefined) {
    return <></>;
  }
  const pixel = AxialCoordinate.fromString(turn.location).toPixel(props.gridSize);
  return <>
    <Tile
      key={'t-placing'}
      gridSize={props.gridSize}
      tileSize={props.tileSize}
      location={AxialCoordinate.fromString(turn.location)}
      lines={turn.lines}
      isEdge={false}
      debug={''}
      rotation={turn.rotation}
    />
    {turn.ownerName === self && <g transform={`translate(${new Vector2(pixel.x, -pixel.y).toSvgString()})`}>
      {[
        { text: '↻', action: 'hexlines/rotateClockwise', x: -15 },
        { text: 'v', action: 'hexlines/place', x: 0 },
        { text: '↺', action: 'hexlines/rotateCounterClockwise', x: 15 },
      ].map(rotate => {
        return <text
          key={rotate.text}
          dominantBaseline='middle'
          textAnchor='middle'
          className='text-xl'
          x={rotate.x}
          onClick={() => send({ type: rotate.action })}
        >
          {rotate.text}
        </text>;
      })}
    </g>}
  </>;
};

export const Hexlines = () => {
  const tiles = useAppSelector(state => state.hexlines.tiles);
  const owners = Object.entries(useAppSelector(state => state.hexlines.owners));
  const turn = useAppSelector(state => state.hexlines.turn);
  const numberOfHexesY = owners.length <= 2 ? 7 : 9;
  const gridSize = 40;
  const tileSize = 38.5;
  const svgSize = { x: gridSize * (numberOfHexesY - 2) * 2, y: gridSize * (numberOfHexesY - 2) * 2 };
  return <>
    <svg
      className='mb-1 max-h-[75vh] w-full'
      preserveAspectRatio='xMidYMid meet'
      viewBox={`${-svgSize.x / 2} ${-svgSize.y / 2} ${svgSize.x} ${svgSize.y}`}
    >
      {Object.entries(tiles).map(([tileId, tile]) => <Tile
        key={tileId}
        gridSize={gridSize}
        tileSize={tileSize}
        location={AxialCoordinate.fromString(tile.location)}
        lines={tile.lines}
        isEdge={tile.isEdge}
        debug={tile.debug}
        rotation={undefined}
      />)}
      <defs>
        <radialGradient id='edge-mask-gradient'>
          <stop offset='76%' stopColor="rgba(255,255,255,0)" />
          <stop offset="79%" stopColor="rgba(255,255,255,1)" />
        </radialGradient>
      </defs>
      <circle r={svgSize.y * (owners.length <= 2 ? 0.62 : 0.58)} fill={'url(#edge-mask-gradient)'} />
      <Turn gridSize={gridSize} tileSize={tileSize} />
      {owners.map(([player, owner]) => {
        if (owner.location === undefined) {
          return <></>;
        }
        const location = AxialCoordinate.fromString(tiles[owner.location.tileId].location);
        const pixelHex = location.toPixel(gridSize);
        const pixel = new Vector2(pixelHex.x, -pixelHex.y).add(getAnchorPosition(owner.location.anchorId).multiply(gridSize));
        return <circle
          key={player}
          cx={pixel.x}
          cy={pixel.y}
          r={gridSize * 0.13}
          fill={owner.color}
          stroke='black'
        />;
      })}
    </svg>
    <ul className='flex justify-around gap-4'>
      {owners.map(([player, owner]) => <li
        key={player}
        className='flex border-4 text-4xl font-bold'
        style={{
          borderColor: owner.name === turn?.ownerName ? 'white' : owner.color,
          backgroundColor: owner.name === turn?.ownerName ? owner.color : 'transparent',
          color: owner.name === turn?.ownerName ? 'white' : owner.color,
          letterSpacing: '3px',
        }}
      >
        <p
          className={`border-r-4 px-4 py-3 text-center ${owner.location === undefined ? 'line-through' : ''}`}
          style={{
            borderColor: owner.name === turn?.ownerName ? 'white' : owner.color,
            textDecorationThickness: '0.4rem',
          }}
        >
          {owner.name}
        </p>
        <p className='px-6 py-3'>
          {owner.score}
        </p>
      </li>)}
    </ul>
  </>;
};
