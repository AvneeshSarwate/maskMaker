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
        let lastLineLen = region.spots.slice(-1)[0].length;
        
        yield* dropLetters(region, lastLineLen);
        textContentUpdate();
        yield* scrollBack(region, lastLineLen);
        yield* typeLastLine(region);
    }
}

function activateDropAndScroll(regionIndex){
    let region = regions[regionIndex];
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
    let timeElapsed = 0;
    let startTime = now();
    while(duration == null || elapsedTime < startTime){
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
    region.updateMatterWorldFromSpots();
    region.activeAnimation = useMatterPos(region);
    Object.values(region.spotToBodyMap).map(v => Matter.Body.setStatic(v.body, false));

}

function* explodeAndRestore(region, dropTime, restoreTime){
    let startTime = now();
    let spots = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].spot).map(s => createVector(s.x, s.y));
    let bodies = Object.keys(region.spotToBodyMap).map(i => region.spotToBodyMap[i].body);
    let matterGen = useMatterPos(region);
    let state = "drop"; //drop vs lift
    let elapsedTime = (now()-startTime) % (dropTime+restoreTime);
    while(true){
        elapsedTime = (now()-startTime) % (dropTime+restoreTime);

        region.startRunner();

        while(elapsedTime <= dropTime){
            elapsedTime = (now()-startTime) % (dropTime+restoreTime);
            yield matterGen.next().value;
        }

        region.stopRunner();

        while(elapsedTime > dropTime){ //i.e., the mod value hasn't wrapped over and the restoreTime isn't finished
            elapsedTime = (now()-startTime) % (dropTime+restoreTime);
            let lerpVal = (elapsedTime - dropTime)/restoreTime
            yield bodies.map((bod, i) => {
                let bodVec = createVector(bod.position.x, bod.position.y);
                return {i, s: p5.Vector.lerp(bodVec, spots[i], lerpVal)};
            });
        }

        region.restoreBodies();
    }
}

function activateDropAndRaise(regionIndex, dropTime, restoreTime){
    let region = regions[regionIndex];
    region.updateMatterWorldFromSpots();
    Object.values(region.spotToBodyMap).map(v => Matter.Body.setStatic(v.body, false));
    region.activeAnimation = explodeAndRestore(region, dropTime, restoreTime);
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