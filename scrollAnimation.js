let now = () => Date.now()/1000;

function* typeLine(region, lineIndex, framesPerLetter){
    let frameCount = 0;
    let line = region.spots[lineIndex];
    for(let i = 0; i < line.length*framesPerLetter; i++){
        if(i%framesPerLetter == 0) yield line[i/framesPerLetter];
        else yield false;
    }
}

function* typeRegion(region, framesPerLetter){
    let lineTypers = region.spots.map((line, i) => typeLine(region, i, framesPerLetter));
    let multiLineTyper = chainPlay(lineTypers);
    let lettersToShow = [];
    let nextChar = multiLineTyper.next();
    while(!nextChar.done){
        if(nextChar) lettersToShow.push(nextChar.value);
        yield lettersToShow;  
        nextChar = multiLineTyper.next();
    } 
}

function* typeLastLine(region){
    let otherLetters = region.spots.slice(0, -1).flat(1).map((s, i) => ({s, i})); //mapping "spot index" to point position
    let lastLine = region.spots.slice(-1)[0].map((s, i) => ({s, i: i+otherLetters.length}));
    for(let spot of lastLine){
        otherLetters.push(spot);
        yield otherLetters;
    }
}

function* scrollBack(region, openSpots){
    let spots = region.spots.flat(1); 
    let startInd = openSpots-1;
    let textLen = spots.length - openSpots
    while(startInd >= 0){
        yield spots.slice(startInd, startInd+textLen).map((s, i) => ({s, i})); //mapping "spot index" to point position
        startInd--;
    }
}

function* dropLetters(region, numToDrop){
    let bbox = getBBox(region);
    let dropFinished = p => !isPointInternal(p, region, bbox);
    let letterDropGens = region.spots.flat(1).slice(0, numToDrop)
                         .map(l => letterGravity(l, Math.random(), dropFinished));

    let newLetters = region.spots.flat(1).map((s, i) => ({s, i})); //mapping "spot index" to point position
    let droppingLetters = letterDropGens.map(g => g.next());

    while(droppingLetters.length > 0){
        let preFilterLength = droppingLetters.length;
        droppingLetters = letterDropGens.map((g, i) => ({i, v: g.next()})) //mapping "spot index" to point position
                          .filter(r => !r.v.done).map(r => ({i: r.i, s: r.v.value}));
        newLetters.splice(0, preFilterLength, ...droppingLetters);
        yield newLetters;
    }
}

function* letterGravity(startPos, dropDelay, finishFunc){
    let startTime = now();
    let startVec = createVector(startPos.x, startPos.y);
    let dev = createVector(0, 0);

    while(!finishFunc(startVec.add(dev))){
        yield startVec.add(dev);

        let elapsedTime = now() - startTime;
        if(elapsedTime > dropDelay){
            let dropTime = elapsedTime-dropDelay;
            dev = createVector(0, dropTime**2);
        }
    }
}

function* dropAndScroll(region, textContentUpdate){
    while(true){
        let lastLineLen = Math.max(region.spots.slice(-1)[0].length, region.spots[0].length);
        
        yield* dropLetters(region, lastLineLen);
        textContentUpdate();
        yield* scrollBack(region, lastLineLen);
        yield* typeLastLine(region);
    }
}

function activateDropAndScroll(regionIndex){
    let region = regions[regionIndex];
    region.animationDraw = region.letterDraw;
    region.activeAnimation = dropAndScroll(region, () => {region.textIndex += region.spots.slice(-1)[0].length})
}

let sinN = v => (Math.sin(v)+1)/2;

let rad = () =>  5;
let ripples = () => PI / (letterSize.y * 4);

function* wave(region){
    let spots = region.spots.flat(1).map(sp => createVector(sp.x, sp.y));
    let sumPos = spots.reduce((acc, cur) => ({x: acc.x+cur.x, y:acc.y+cur.y}));
    let center = createVector(sumPos.x/spots.length, sumPos.y/spots.length);

    while(true){
        let time = now();
        yield spots.map((sp, i) => {
            let dev = p5.Vector.sub(center, sp).normalize().mult(rad()*sinN(time+rad()*ripples()));
            return {i, s: p5.Vector.add(dev, sp)};
        });
    }
}

function* useMatterPos(region, duration){
    let spots = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].spot).map(s => createVector(s.x, s.y));
    let bodies = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].body);
    let keys = Object.keys(region.spotToBodyMap);
    let elapsedTime = 0;
    let startTime = now();
    while(duration == null || elapsedTime < duration){
        elapsedTime = now() - startTime;
        let s = sinN(now());
        yield bodies.map((bod, i) => {
            let bodVec = createVector(bod.position.x, bod.position.y);
            return {i, s: p5.Vector.lerp(spots[i], bodVec, region.matterLerp)};
        });
    }
}

function activateMatterAnimation(regionIndex){
    let region = regions[regionIndex];
    region.animationDraw = region.letterDraw;
    region.updateMatterWorldFromSpots();
    region.activeAnimation = useMatterPos(region);
    Object.values(region.spotToBodyMap).map(v => Matter.Body.setStatic(v.body, false));
}

function bumpVelocities(bodies, velFunc){
    bodies.forEach(b => Matter.Body.setVelocity(b, velFunc()));
}

let rnd = n => (Math.random()-0.5)*2*(n?n:1);
let randVel = n => ({x: rnd(n), y: rnd(n)});

function activateMatterWander(regionIndex){
    let region = regions[regionIndex];
    region.animationDraw = region.letterDraw;
    region.updateMatterWorldFromSpots();
    region.activeAnimation = useMatterPos(region);
    region.matterBodies.forEach(b => {
        b.airFriction = 0;
        b.friction = 0;
        b.collisionFilter.group = -1;
        Matter.Body.setVelocity(b, randVel(5));
    });
    region.matterWorld.gravity.scale = 0;
    Object.values(region.spotToBodyMap).map(v => Matter.Body.setStatic(v.body, false));
}

function activateWordWander(regionIndex){
    let region = regions[regionIndex];
    region.animationDraw = region.wordDraw;
    region.createWordBodies();
    region.activeAnimation = useMatterPos(region);
    region.matterBodies.forEach(b => {
        b.airFriction = 0;
        b.friction = 0;
        b.collisionFilter.group = -1;
        Matter.Body.setVelocity(b, randVel(5));
    });
    region.matterWorld.gravity.scale = 0;
    region.matterBodies.map(b => Matter.Body.setStatic(b, false));
}

//TODO rewrite this by adding duration parameter to updateMatterPos, and creating a lerp generator
function* explodeAndRestore(region, dropTime, restoreTime, hangTime){
    let startTime = now();
    let spots = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].spot).map(s => createVector(s.x, s.y));
    let bodies = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].body);
    // let matterGen = useMatterPos(region);
    let state = "drop"; //drop vs lift
    let elapsedTime = (now()-startTime) % (dropTime+restoreTime);
    while(true){
        yield* useMatterPos(region, dropTime);

        region.stopRunner();

        yield* lerpTask(bodies, spots, restoreTime);

        region.restoreSpotBodies();

        if(hangTime) yield* idleYield(hangTime, spots.map((s, i)=>({s, i})));

        region.startRunner();
    }
}

function* idleYield(waitTime, yieldVal){
    let startTime = now();
    while(now() - startTime < waitTime) {
        yield yieldVal;
    }
}

function* lerpTask(bodies, spots, runtime){
    let startTime = now();
    let elapsedTime = 0;
    while(elapsedTime < runtime){
        let lerpVal = elapsedTime/runtime;
        yield bodies.map((bod, i) => {
            let bodVec = createVector(bod.position.x, bod.position.y);
            return {i, s: p5.Vector.lerp(bodVec, spots[i], lerpVal)};
        });
        elapsedTime = now() - startTime;
    }
}

function activateDropAndRaise(regionIndex, dropTime, restoreTime, hangTime){
    let region = regions[regionIndex];
    region.animationDraw = region.letterDraw;
    region.updateMatterWorldFromSpots();
    region.activeAnimation = explodeAndRestore(region, dropTime, restoreTime, hangTime);
    Object.values(region.spotToBodyMap).map(v => Matter.Body.setStatic(v.body, false));
}







function* createGesture(timeStart, duration, timeFunc, motionFunc){
    let timeDiff = timeFunc() - timeStart;
    while(timeDiff < duration){
        yield motionFunc(timeDiff/duration);
    }
}

let sin = t => Math.sin(t*PI);
let exp = t => Math.pow(0.5, t);
let lin = t => t;

function* chainPlay(gestures){
    let i = 0;
    while(i < gestures.length){
        let val = gestures[i].next();
        if(!val.done){
            yield val.value
        } else {
            i++
        }
    }
}

let cg = createGesture;
let dn = () => Date.now/1000;

// chainPlay([
//     cg(dn(), 5, dn, lin),
//     cg(dn(), 2, dn, t => 1.- sin(t)),
//     cg(dn(), 2, dn, t => 1.- sin(t*2.))
// ]);