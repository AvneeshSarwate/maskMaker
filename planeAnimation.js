function connectOSC() {
    osc.connect(address, port);
}

let drawTime = 0;

osc.on("/drawTime" (msg)=>{
    drawTime = msg[0];
});

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
    while(ind < reps){
        let gen = genDefs[ind%genDefs.length]();
        yield* gen
        ind++
    }
}


/*
line types - lr, rl, tb, bt, vert, hor
zoom types - in, out, alt
plane types - same as line but with an extra param fil, emp, alt for the fill type

[delay] region animatation-duration-direction-otherstuff...

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


