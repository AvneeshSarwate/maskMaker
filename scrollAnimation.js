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
    let lastLine = region.spots.slice(-1)[0];
    let otherLetters = region.spots.slice(0, -1).flat(1);
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
        yield spots.slice(startInd, startInd+textLen);
        startInd--;
    }
}

function* dropLetters(region, numToDrop){
    let bbox = getBBox(region);
    let dropFinished = p => !isPointInternal(p, region, bbox);
    let letterDropGens = region.spots.flat(1).slice(0, numToDrop)
                         .map(l => letterGravity(l, Math.random(), dropFinished));


    let newLetters = region.spots.flat(1).map(l => l);
    let droppingLetters = letterDropGens.map(g => g.next());

    while(droppingLetters.length > 0){
        droppingLetters = letterDropGens.map(g => g.next()).filter(r => !r.done).map(r => r.value);
        newLetters.splice(0, droppingLetters.length, ...droppingLetters);
        yield newLetters;
    }
}

function* letterGravity(startPos, dropDelay, finishFunc){
    let startTime = Date.now()/1000;
    let startVec = createVector(startPos.x, startPos.y);
    let dev = createVector(0, 0);
    while(!finishFunc(startVec.add(dev))){
        yield startVec.add(dev);

        let elapsedTime = Date.now() /1000 - startTime;
        if(elapsedTime > dropDelay){
            let dropTime = elapsedTime-dropDelay;
            dev = createVector(0, dropTime**2);
        }
        
    }
}

function* dropAndScroll(region, textContentUpdate){
    while(true){
        let lastLineLen = region.spots.slice(-1)[0].length;

//         let dropGen = dropLetters(region, lastLineLen);
//         let scrollGen = scrollBack(region, lastLineLen);
//         let lastLineGen = typeLastLine(region);

//         for(let v = dropGen.next(); !v.done; v = dropGen.next()) yield v.value;
//         textContentUpdate();
//         for(let v = scrollGen.next(); !v.done; v = scrollGen.next()) yield v.value;
//         for(let v = lastLineGen.next(); !v.done; v = lastLineGen.next()) yield v.value;

        yield* dropLetters(region, lastLineLen);
        textContentUpdate();
        yield* scrollBack(region, lastLineLen);
        yield* typeLastLine(region);
    }
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