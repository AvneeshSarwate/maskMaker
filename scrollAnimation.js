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
        console.log(spot);
        otherLetters.push(spot);
        yield otherLetters;
    }
}

function* scrollBack(region, openSpots){
    let spots = region.spots.flat(1);
    let startInd = openSpots;
    let textLen = spots.length - openSpots
    while(startInd <= 0){
        yield spots.slice(startInd, startInd+textLen);
        startInd--;
    }
}

function* dropLetters(region, numToDrop){
    
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