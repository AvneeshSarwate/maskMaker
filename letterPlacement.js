let letterSize = {x: 10, y:20};
function getBBox(region){
    let maxX, maxY, mnX, minY;
    region.points.forEach(p => {
        if(p.x > maxX) maxX = p.x;
        if(p.x < minX) minX = p.x;
        if(p.y > maxY) maxY = p.y;
        if(p.y < minY) minY = p.y;
    });
    return {minX, maxX, minY, maxY};
}

function generateLetterRoots(region){
    let bbox = getBBox(region);
    let spots = [];
    let ls = letterSize;
    //switch x and y loop order 
    for(let x = bbox.minX; x <= bbox.maxX; x += ls.x) {
        let row = [];
        spots.push([]);
        for(let y = bbox.minY; y <= bbox.maxY; y += ls.y) {
            let pt = {x, y};
            if(isPointInternal(pt)) row.push(pt);
        }
    }
    return spots;
}

function isPointInternal(point, region, bBox){
    //raycast test - intersect from point to top of bbox
    let ray = [point, {x:point.x, y: bBox.minY-10}];
    let numIntersections = 0;
    let numPoints = region.points.length;
    region.points.forEach((p, i, a) => {
        let seg = [p, a[(i+1)%numPoints]];
        if(doSegmentIntersect(ray, seg)) numIntersections++;
    });
    return numIntersections%2 === 1;
}

function doSegmentsIntersect(seg1, seg2){

}