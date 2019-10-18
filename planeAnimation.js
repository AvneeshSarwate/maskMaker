

let lerp = p5.Vector.lerp;


function setStyle(region){
    stroke(...region.color);
    strokeWeight(region.strokeWeight);
}

//TODO - could pass in easing funcs for these motions (or just mapping funcs eg frac => sinN(frac*3+cosN(frac*20)*0.1))


//ASSUMPTION - all quads drawn as top-left, bottom-left, bottom-right, top-right
function toLR(points){
    let [tl, bl, br, tr] = points;
    return [[tl, tr], [bl, br]];
}

function toRL(points){
    let [tl, bl, br, tr] = points;
    return [[tr, tl], [br, bl]];
}

function toTB(points){
    let [tl, bl, br, tr] = points;
    return [[tl, bl], [tr, br]];
}

function toTB(points){
    let [tl, bl, br, tr] = points;
    return [[bl, tl], [br, tr]];
}

//points is [[p1, p2], [p3, p4]] where 1-2 and 3-4 are lerped (and all are already vectors)
//set order of points to determine if it's left/right/up/down
function* lineLerpGen(points, duration, region){
    let startTIme = now();
    let elapsed = 0;
    while(elapsed < duration){
        yield () => {
            push();
            setStyle(region);

            let frac = elapsed/duration
            let l0 = lerp(points[0][0], points[0][1], frac);
            let l1 = lerp(points[1][0], points[1][1], frac);
            
            line(l0.x, l0.y, l1.x, l1.y);

            pop();
        }
        elapsed = now() - startTIme;
    }
} 


//same point order and directionality concerns as line-lerp, and filling var determines if its filling or emptying
function* planeLerpGen(points, duration, region, filling=false){
    let startTIme = now();
    let elapsed = 0;
    while(elapsed < duration){
        yield () => {
            push();
            setStyle(region);
            fill(...region.color);

            let frac = elapsed/duration
            let l0 = lerp(points[0][0], points[0][1], frac);
            let l1 = lerp(points[1][0], points[1][1], frac);

            beginShape()
            if(filling){
                [points[0][0], l0, l1, points[1][0]].forEach(p => vertex(p.x, p.y));
            } else{
                [l0, points[0][1], points[1][1], l1].forEach(p => vertex(p.x, p.y));
            }
            endShape(CLOSE);

            pop();
        }
        elapsed = now() - startTIme;
    }
} 


//out var determines if its zoom in or out. points are a flat list of vectors in hand-drawn order
function* zoomLerpGen(points, duration, region, out=true){
    let startTIme = now();
    let elapsed = 0;
    let sumPoint = points.reduce((p1, p2) => ({x: p1.x+p2.x, y: p1.y+p2.y}));
    let center = createVector(sumPoint.x/points.length, sumPoint.y/points.length);
    while(elapsed < duration){
        yield () => {
            push();
            setStyle(region);
            noFill();

            let frac = elapsed/duration
            let lerpPoints = points.map(p => lerp(p, center, out ? 1-frac : frac));

            beginShape()
            lerpPoints.forEach(p => vertex(p.x, p.y));
            endShape(CLOSE)

            pop();
        }
        elapsed = now() - startTIme;
    }
} 

//direction is 
function lineLerp(ind, dur, direction, alternate=false, loop=false){
    let region = regions[ind];
    if(alternate){
        let dirGen = dirFunc => () => lineLerpGen(dirFunc(region.points), dur, region);
        region.activeAnimation = chainInf([dirGen(toLR), dirGen(toRL)]);
    } else {
        if(loop){ 
            
        } else { 
            region.activeAnimation = lineLerpGen(toLR(region.points), dur, region);
        }
    }
}

function planeLerp(ind, dur, direction, alternate, filling=true){
    let region = regions[ind];
    region.activeAnimation = planeLerpGen(toRL(region.points), dur, region, filling);
}

function zoomLerp(ind, dur, out=true, alternate=false, loop=false){
    let region = regions[ind];
    if(alternate){
        let dirGen = dirVal => () => zoomLerpGen(region.points, dur, region, dirVal);
        region.activeAnimation = chainInf([dirGen(true), dirGen(false)]);
    } else {
        if(loop){

        } else { 
            region.activeAnimation = zoomLerpGen(region.points, dur, region, out);
        }
    }
}


//array of () => generatorCreatior(...)
function* chainInf(genDefs){
    let ind = 0;
    while(true){
        let gen = genDefs[ind%genDefs.length]();
        yield* gen
        ind++
    }
}





