
let drawTime = 0;

osc = new OSC({
    discardLateMessages: true
});

osc.connect('localhost', 8085);

osc.on("/drawTime", (msg)=>{
    drawTime = msg.args[0];
});

let beatFunctions = [];
let logBeat = false;
osc.on("/drawBeat", (msg)=>{
    beatFunctions.forEach(f => f());
    beatFunctions = [];
    if(logBeat) console.log("log beat", msg.args[0]);
});

osc.on("/phaseHit", (msg)=>{
    console.log("phase hit");
    beatFunctions.push(retrigger)
})

let stringBanks = {};
osc.on("/bankHit", (msg)=>{
    let bankString = stringBanks[msg.args[0]];
    if(bankString){
        console.log('loading bank', )
        bankString.run();
    }
})

function saveBank(bankInd, bankStr){
    stringBanks[bankInd] = bankStr;
    let message = new OSC.Message('bankSave', bankInd);
    osc.send(message);
}


let nowSC = () => drawTime;

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

function toBT(points){
    let [tl, bl, br, tr] = points;
    return [[bl, tl], [br, tr]];
}

//points is [[p1, p2], [p3, p4]] where 1-2 and 3-4 are lerped (and all are already vectors)
//set order of points to determine if it's left/right/up/down
function* lineLerpGen(points, duration, region){
    let startTIme = nowSC();
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
        elapsed = nowSC() - startTIme;
    }
} 


//same point order and directionality concerns as line-lerp, and filling var determines if its filling or emptying
function* planeLerpGen(points, duration, region, filling=false){
    let startTIme = nowSC();
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
        elapsed = nowSC() - startTIme;
    }
} 


//out var determines if its zoom in or out. points are a flat list of vectors in hand-drawn order
function* zoomLerpGen(points, duration, region, out=true){
    let startTIme = nowSC();
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
        elapsed = nowSC() - startTIme;
    }
} 

let regionKeys = {}
'abcdefghijklmnopqrstuvwxyz'.split("").forEach((c, i) => {regionKeys[c]=i});

let symbolToGesture = {"line": lineGen, "zoom": zoomGen, "plane": planeGen};

String.prototype.run = function(){parseGestureString(this)};

let retrigger = () => Object.values(regions).forEach(r => r.lastGestureString.run());

function parseGestureString(str){
    let lines = str.split('\n').filter(s => /\S/.test(s));

    let gestureMap = lines.map(l => {
        let tokens = l.split(' ');
        let delay = parseFloat(tokens[0]);
        if(delay) tokens = tokens.slice(1);
        let regionKey = tokens[0];
        let regionInd = regionKeys[regionKey];

        if(!regions[regionInd]){
            console.log("No region with key", regionKey, "or ind", regionInd);
            return;
        }

        let gestureChain = tokens.slice(1).map((token, i) => {
            let subTokens = token.split("-");
            let gesture = symbolToGesture[subTokens[0]];
            if(!gesture){
                console.log("no symbol", subTokens, "at pos", i, "for region", regionKey);
                return;
            }
            let [duration, direction, repeats] = [parseFloat(subTokens[1]), subTokens[2], parseInt(subTokens[3])];
            if(!(duration && repeats)){
                console.log("duration and/or repeats  incorrect", "at pos", i, "for region", regionKey);
                return
            }
            return gesture(regionInd, duration, direction, repeats);
        });
        return gestureChain.every(e => !!e) ? {region: regions[regionInd], chain: chain(gestureChain), string: l} : false;
    });

    if(gestureMap.every(e => !!e)){
        console.log("congrats, it parses!");
        let launchFunc = () => {
            gestureMap.forEach(gc => {
                gc.region.activeAnimation = gc.chain;
                gc.region.lastGestureString = gc.string;
            });
        }
        beatFunctions.push(launchFunc);
    }
}

function lineGen(ind, duration, direction, repeats){
    let region = regions[ind]
    switch(direction){
        case "lr":
            return () => chain([() => lineLerpGen(toLR(region.points), duration, region)], repeats);
        case "rl":
            return () => chain([() => lineLerpGen(toRL(region.points), duration, region)], repeats);
        case "tb":
            return () => chain([() => lineLerpGen(toTB(region.points), duration, region)], repeats);
        case "bt":
            return () => chain([() => lineLerpGen(toBT(region.points), duration, region)], repeats);
        case "vert":
            return () => chain([() => lineLerpGen(toTB(region.points), duration, region), () => lineLerpGen(toBT(region.points), duration, region)], repeats);
        case "hor":
            return () => chain([() => lineLerpGen(toLR(region.points), duration, region), () => lineLerpGen(toRL(region.points), duration, region)], repeats);
        default:
            console.log("bad LINE direction:", direction, "for region", ind);
            return
    }
}

function zoomGen(ind, duration, direction, repeats){
    let region = regions[ind];
     switch(direction){
        case "in":
            return () => chain([() => zoomLerpGen(region.points, duration, region, false)], repeats);
        case "out":
            return () => chain([() => zoomLerpGen(region.points, duration, region, true)], repeats);
        case "alt":
            return () => chain([() => zoomLerpGen(region.points, duration, region, false), () => zoomLerpGen(region.points, duration, region, true)], repeats);
        default:
            console.log("bad ZOOM direction:", direction);
            return
    }
}

function planeGen(ind, duration, direction, repeats){
    let region = regions[ind];
    if(!["lf", "rf", "tf", "bf", "le", "re", "te", "be"].includes(direction)){
        console.log("bad PLANE direction:", direction, "for region", ind);
        return
    }
    let filling = direction[1] === "f";
    switch(direction[0]){
        case "l":
            return () => chain([() => planeLerpGen(toLR(region.points), duration, region, filling)], repeats);
        case "r":
            return () => chain([() => planeLerpGen(toRL(region.points), duration, region, filling)], repeats);
        case "t":
            return () => chain([() => planeLerpGen(toTB(region.points), duration, region, filling)], repeats);
        case "b":
            return () => chain([() => planeLerpGen(toBT(region.points), duration, region, filling)], repeats);
        default:
            console.log("bad PLANE direction:", direction, "for region", ind);
            return
    }
}

//direction is 
function lineLerp(ind, dur, direction, alternate=false, loop=false){
    let region = regions[ind];
    if(alternate){
        let dirGen = dirFunc => () => lineLerpGen(dirFunc(region.points), dur, region);
        region.activeAnimation = chain([dirGen(toLR), dirGen(toRL)]);
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
        region.activeAnimation = chain([dirGen(true), dirGen(false)]);
    } else {
        if(loop){

        } else { 
            region.activeAnimation = zoomLerpGen(region.points, dur, region, out);
        }
    }
}


//array of () => generatorCreatior(...)
function* chain(genDefs, reps=Infinity){
    let ind = 0;
    while(ind < reps*genDefs.length){
        let gen = genDefs[ind%genDefs.length]();
        yield* gen
        ind++
    }
}


/*
line types - lr, rl, tb, bt, vert, hor
zoom types - in, out, alt
plane types - 2 characters, lrtb as first char and fe as second - 8 types in total
    - the lrtb is short for lr rl tb bt like line types, fe is fill or empty

[delay] region animatation-duration-direction-repeats-otherstuff...

for alternating types the duration applies for each component, so total will be 2x as long

add prototype func to String object called "run()" to make it quicker to execute

add an extra "beat" OSC message that launches all of the queued up animations


POTENTIAL ISSUE - drift due to gesture durations not being exact in JS
- since "transport-time" is coming from SC and is correct, you could save the start time
  of a gesture group, and when it loops back around, look at the predicted end time vs actual end time
  and add a correction term (which could swing positive or negative) to a locally defined version of now(). 
  Drift should be small enough that doing a correction  at the end of each gesture group isn't noticable
- alternately, have gestures calculate their "scheduled" end time in relation to the transport time, not
  just their local elapsed time (the genDef functions in chain can take a time arg to allow calculating).
  This could be clean-ish because ideally chain() is only created on a whole beat, and a gesture group has
  a knowable duration beforehand

================================================================
================================================================

NICE TO HAVES

- be able to save string from javascript to launchpad, and have it light up the button.
- pressing the button while some "alt" key is held down will print the string to the console

create a special func for making a random-direction fil-empty alternator for planes
- eg, alternates between vert/hor fill/empty, but which side of the vert or hor is random

*/


