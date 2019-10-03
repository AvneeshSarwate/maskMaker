
let sampleText = "Here is some sample text. It is a couple sentences and should be long enough that all of it doesn't all fit into a single region at once if you're using a reasonably big font size."

let letterX = 10;
let courierRatio = .42;
let letterSize = {x: letterX, y: letterX/courierRatio};

function getBBox(region){
    let maxX = -Infinity, maxY = -Infinity, minX = Infinity, minY = Infinity;
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
    for(let y = bbox.minY; y <= bbox.maxY; y += ls.y) { 
        let row = [];
            for(let x = bbox.minX; x <= bbox.maxX; x += ls.x) {
            let pt = {x, y};
            if(isPointInternal(pt, region, bbox)) row.push(pt);
        }
        spots.push(row);
    }
    return spots;
}

function isPointInternal(point, region, bbox){
    //raycast test - intersect from point to top of bbox
    let ray = [point, {x:point.x, y: bbox.minY-10}];
    let numIntersections = 0;
    let numPoints = region.points.length;
    region.points.forEach((p, i, a) => {
        let seg = [p, a[(i+1)%numPoints]];
        if(segment_intersection(ray, seg)) numIntersections++;
    });
    return numIntersections%2 === 1;
}


function segment_intersection(ray1, ray2) {
    let x1 = ray1[0].x,
        y1 = ray1[0].y,
        x2 = ray1[1].x,
        y2 = ray1[1].y, 
        x3 = ray2[0].x,
        y3 = ray2[0].y,
        x4 = ray2[1].x,
        y4 = ray2[1].y;
    var eps = 0.0000001;
    function between(a, b, c) {
        return a-eps <= b && b <= c+eps;
    }
    var x=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    var y=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    if (isNaN(x)||isNaN(y)) {
        return false;
    } else {
        if (x1>=x2) {
            if (!between(x2, x, x1)) {return false;}
        } else {
            if (!between(x1, x, x2)) {return false;}
        }
        if (y1>=y2) {
            if (!between(y2, y, y1)) {return false;}
        } else {
            if (!between(y1, y, y2)) {return false;}
        }
        if (x3>=x4) {
            if (!between(x4, x, x3)) {return false;}
        } else {
            if (!between(x3, x, x4)) {return false;}
        }
        if (y3>=y4) {
            if (!between(y4, y, y3)) {return false;}
        } else {
            if (!between(y3, y, y4)) {return false;}
        }
    }
    return {x: x, y: y};
}