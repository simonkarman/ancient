import { useKrmx } from '@krmx/client';
import React, { useMemo } from 'react';
import { AppState, useAppSelector } from '../store/store';
import { AxialCoordinate } from '../utils/AxialCoordinate';
import { Vector2 } from '../utils/Vector2';

const Hexagon = (props: { size: number }) => {
  const corners = useMemo(
    () => AxialCoordinate.Directions.map((_, index) => Vector2.fromDegrees(index * 60).mutliply(props.size)),
    [props.size],
  );
  return (
    <polygon
      points={corners.map(corner => `${corner.x},${corner.y}`).join(' ')}
      className='fill-current text-green-400'
      fillOpacity={0.4}
      stroke='black'
      strokeWidth={0.3}
    />
  );
};

export const Ancient = () => {
  const { send } = useKrmx();
  const svgSize = { x: 640, y: 480 };
  const tileSize = 40;
  const tiles = useAppSelector((state: AppState) => state.ancient.tiles);
  return <>
    <button
      className='border p-2 transition-colors hover:bg-green-400'
      onClick={() => send({ type: 'ancient/restart' })}
    >
      Restart animation
    </button>
    <svg
      xmlns='http://www.w3.org/2000/svg'
      className='mt-1 max-h-[75vh] w-full border'
      preserveAspectRatio='xMidYMid meet'
      // onClick={onClick}
      // onMouseMove={onMove}
      viewBox={`${-svgSize.x / 2} ${-svgSize.y / 2} ${svgSize.x} ${svgSize.y}`}
    >
      {Object.entries(tiles).map(([tileId, tile]) => {
        const coord = AxialCoordinate.fromString(tile.coord);
        return <g
          key={tileId}
          className='transition-all duration-700'
          transform={`translate(${coord.toPixel(tileSize).toSvgString()})`}
        >
          <Hexagon size={tileSize} />
        </g>;
      })}
    </svg>
  </>;
};
