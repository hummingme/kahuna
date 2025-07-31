import type { Position } from './types/common.ts';

const calculateDistance = (node: HTMLElement, from: Position) => {
    const { x, y } = from;
    const off = node.getBoundingClientRect();
    const ny1 = off.top; // top
    const ny2 = ny1 + node.offsetHeight; // bottom
    const nx1 = off.left; // left
    const nx2 = nx1 + node.offsetWidth; // right
    const maxX1 = Math.max(x, nx1);
    const minX2 = Math.min(x, nx2);
    const maxY1 = Math.max(y, ny1);
    const minY2 = Math.min(y, ny2);
    const intersectX = minX2 >= maxX1;
    const intersectY = minY2 >= maxY1;
    const to = {
        x: intersectX ? x : nx2 < x ? nx2 : nx1,
        y: intersectY ? y : ny2 < y ? ny2 : ny1,
    };
    const distX = to.x - from.x;
    const distY = to.y - from.y;
    const distance = Math.floor((distX ** 2 + distY ** 2) ** (1 / 2));
    return distance;
};

export default calculateDistance;
