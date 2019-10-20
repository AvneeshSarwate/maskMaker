let regions = {};
let regionCount = 0;
let state = "Nothing active";
let cursorSize = 10;

let drawBoundary = true;
let drawLetters = true;
let drawIndex = true;

let useMatrix = false;
let matrixVal = [1, 0, 0,
              0, 1, 0];

let matterObjs = {}; //{runner, world, engine}

let letterScale = 0.5; //scale down letter size to give them space to move

let meter;

let randSelect = arr => arr[Math.floor(Math.random()*arr.length)];

function killRegion(ind){
    let matterStuff = matterObjs[ind];
    Matter.Runner.stop(matterStuff.runner);
    Matter.World.clear(matterStuff.world);
    Matter.Engine.clear(matterStuff.engine);

    delete regions[ind];
}

function killMatterObj(ind){
    let matterStuff = matterObjs[ind];
    Matter.Runner.stop(matterStuff.runner);
    Matter.World.clear(matterStuff.world);
    Matter.Engine.clear(matterStuff.engine);
}

function isAnythingActive(){
    return Object.values(regions).some(r => r.active);
}

let font;

function setup() {
  createCanvas(window.screen.width/2, window.screen.height/2);
  // createCanvas(500, 500);
  textFont("Courier New");
  // textStyle(BOLD);
  meter = new FPSMeter(document.body);
}

let runHookIn = false;
function drawLoopHookIn(){

}

let time = 0;

function draw() {
    clear();
    background(0);
    stroke(255);


    if(useMatrix) {
        resetMatrix();
        applyMatrix(...matrixVal);
    }

    time = Date.now()/1000;

    strokeWeight(cursorSize);

    Object.values(regions).forEach(r => r.draw())
    
    stroke(0);
    fill(255);
    textSize(12);
    text(state, 10, 900);
    meter.tick();

    if(runHookIn) drawLoopHookIn();
}


//you have to explicitly EXIT some interaction state (grabbibg, drawing) before you can enter another
//this is enforced by code 
function keyPressed() {
    if(key === "d"){
        if(!isAnythingActive()) {
            let newRegion = new MaskRegion(regionCount);
            newRegion.active = true;
            regions[regionCount++] = newRegion;
            state = "Adding points";
        } else {
            Object.values(regions).forEach(r => {r.active = false});
            state = "Nothing active";
        }
    }
    if(key === " "){
        if(isAnythingActive()){
            let region = Object.values(regions).filter(r => r.active)[0];
            region.addPoint(new createVector(mouseX, mouseY));
        }
    }
    if(key === "g"){
        Object.values(regions).forEach(r => {r.active = false});
        state = "Moving existing point";
        let grabbedRegion, grabbedPointIndex;
        let closestPoint = createVector(10**5, 10**5);
        let mouseVec = createVector(mouseX, mouseY);
        Object.values(regions).forEach(region => {
            region.points.forEach((p, i) => {
                if(p5.Vector.dist(mouseVec, p) < p5.Vector.dist(mouseVec, closestPoint)) {
                    closestPoint = p;
                    grabbedRegion = region;
                    grabbedPointIndex = i;
                }
            })
        });
        Object.values(regions).forEach(r => {r.active = false});
        grabbedRegion.grabbedPoint = grabbedPointIndex;
        grabbedRegion.active = true;
    }

    if(key === "p"){
        let activeRegion = Object.values(regions).filter(r => r.active)[0];
        activeRegion.points[activeRegion.grabbedPoint] = createVector(mouseX, mouseY);
        activeRegion.updateInternalPoints();
        activeRegion.active = false;
        activeRegion.grabbedPoint = null;
        state = "Nothing active"
    }
    if(keyCode == 13){
        if(!window.screenTop && !window.screenY)
            {
                if (document.exitFullscreen) 
                    document.exitFullscreen();
                else if (document.mozCancelFullScreen) 
                   document.mozCancelFullScreen();
                else if (document.webkitExitFullscreen) 
                   document.webkitExitFullscreen();
            } else {
                if (document.body.requestFullScreen)
                    canvas.requestFullScreen();
                else if (document.body.mozRequestFullScreen)
                    canvas.mozRequestFullScreen();
                else if (document.body.webkitRequestFullScreen){
                    canvas.webkitRequestFullScreen();
                    console.log("trying fullscreen");
                }
            }
    }

}

class MaskRegion {
    
    constructor(id, text){
        this.id = id;
        this.active = false;
        this.grabbedPoint = null;
        this.points = [];
        this.spots = []; //internal spots where letters can be placed.
        this.activeAnimation = null;
        this.animationState = null;
        this.textIndex = 0;
        this.text = text ? text : randSelect(quotes);
        this.matterWorld = null;
        this.matterLerp = 1;
        this.animationDraw = this.fillDraw;
        this.fontSize = 14;
        this.sizeWarp = a => a;
        this.posWarp = a => a;
        this.color = randColor();
        this.strokeWeight = cursorSize;
    }

    drawWhileAddingPoint(){
        beginShape();
        this.points.forEach(p => vertex(p.x, p.y));
        vertex(mouseX, mouseY);
        endShape(CLOSE);
        ellipse(mouseX, mouseY, cursorSize);
    }

    drawWhileMovingPoint(){
        beginShape();
        this.points.forEach((p, i) => i === this.grabbedPoint ? vertex(mouseX, mouseY) : vertex(p.x, p.y));
        endShape(CLOSE);
        ellipse(mouseX, mouseY, cursorSize);
    }

    updateInternalPoints() {
        this.spots = generateLetterRoots(this);
        this.spotsFlat = this.spots.flat(1);
        this.spotsToWordSlots();
        this.bbox = getBBox(this);
    }

    stopRunner(){
        Matter.Runner.stop(this.matterRunner);
    }

    startRunner(){
        Matter.Runner.start(this.matterRunner, this.matterEngine);
    }

    restoreSpotBodies(){
        Object.values(this.spotToBodyMap).forEach(v => {
            let spot = v.spot;
            let body = v.body;
            Matter.Body.setPosition(body, spot);
        })
    }

    spotsToWordSlots(spots){
        if(!this.spots || !this.spots.length || !this.spots.length > 0) return;
        spots = spots ? spots : this.spots;
        let tracker = [];
        this.rowMap = tracker;
        for(let i = 0; i < spots.length; i++){
            let row = spots[i];
            for(let j = 0; j < row.length; j++){
                tracker.push({row: i, col: j});
            }
        }
        let runningWord = [];
        let words = this.text.split(" ").map(w => w+" ");

        let rowInd = 0;
        let colInd = 0;
        let rowLen = 0;
        this.wordPos = {};
        words.forEach((w, i) => {
            if(colInd+w.length > spots[rowInd].length && rowInd != spots.length-1){ //if no overflow and not the last row, put on next row
                rowInd++;
                colInd = 0;
            }
            this.wordPos[i] = {row: rowInd, col: colInd};
            colInd += w.length;
        });
    }

    createWordBodies(){
        this.initMatter();

        //TODO - extend the ends of the lines out so they intersect and are closed
        let wallCat = 0x10;
        let walls = this.points.map((spt, i, spts) => {
            let collisionFilter = {category: wallCat, mask: 0x1F}; 
            let p1 = spt; 
            let p2 = spts[(i+1)%spts.length];
            let xp = 10; //expander
            let mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y+xp)/2};
            let path = [p1.x, p1.y, p1.x+xp, p1.y+xp, p2.x+xp, p2.y+xp, p2.x, p2.y].join(" ");
            return Matter.Bodies.fromVertices(mid.x, mid.y, Matter.Vertices.fromPath(path), {isStatic: true, restitution: 0.9, collisionFilter});
        });
        Matter.World.add(this.matterWorld, walls);

        let words = this.text.split(" ").map(w => w+" ");
        let wordBodies = [];
        this.spotToBodyMap = {};
        words.forEach((w, i) => {
            let pos = this.spots[this.wordPos[i].row][this.wordPos[i].col];
            let tw = textWidth(w, this.fontSize);
            let body = Matter.Bodies.rectangle(pos.x+tw/2, pos.y+letterSize.y/2, textWidth*letterScale, letterSize.y*letterScale);
            wordBodies.push(body);
            this.spotToBodyMap[i] = {spot: pos, body};
        });
        this.matterBodies = wordBodies;
        Matter.World.add(this.matterWorld, wordBodies);
    }

    wordDraw() {
        let wordToPos = i => this.spots[this.wordPos[i].row][this.wordPos[i].col];
        if(this.activeAnimation){
            let animationVal = this.activeAnimation.next();
            if(!animationVal.done) wordToPos = i => animationVal.value[i].s;
        }

        let words = this.text.split(" ").map(w => w+" ");
        words.forEach((w, i) => {
            let pos = wordToPos(i);
            textSize(this.fontSize);
            text(w, pos.x, pos.y);
        });
    }

    clearWorld(){
        Matter.World.clear(this.matterWorld);
    }

    initMatter(){
        // create engine
        let engine = Matter.Engine.create(),
            world = engine.world;
        this.matterEngine = engine;

        //  // create renderer
        // var render = Render.create({
        //     element: document.body,
        //     engine: engine,
        //     options: {
        //         width: width,
        //         height: height,
        //         showAngleIndicator: true,
        //     }
        // });

        // Render.run(render);

        // this.spots = this.spots.slice(1, -1).map(s => s.slice(1, -1));

        // create runner
        var runner = Matter.Runner.create();
        this.matterRunner = runner;
        Matter.Runner.run(runner, engine);

        this.matterWorld = world;
        // world.bounds = { min: { x: 0, y: 0 }, max: { x: width, y: height } };
        matterObjs[this.id] = {runner: this.matterRunner, world: this.matterWorld, engine: this.matterEngine};
    }


    updateMatterWorldFromSpots(){
        let Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            World = Matter.World,
            Bodies = Matter.Bodies;

        this.initMatter();

        //TODO - extend the ends of the lines out so they intersect and are closed
        let wallCat = 0x10;
        let walls = this.points.map((spt, i, spts) => {
            let collisionFilter = {category: wallCat, mask: 0x1F}; 
            let p1 = spt; 
            let p2 = spts[(i+1)%spts.length];
            let xp = 10; //expander
            let mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y+xp)/2};
            let path = [p1.x, p1.y, p1.x+xp, p1.y+xp, p2.x+xp, p2.y+xp, p2.x, p2.y].join(" ");
            return Bodies.fromVertices(mid.x, mid.y, Matter.Vertices.fromPath(path), {isStatic: true, restitution: 0.9, collisionFilter});
        });
        World.add(this.matterWorld, walls);

        this.spotToBodyMap = {};
        this.matterBodies = [];
        let ls = letterScale; 
        //TODO - collision filtering (both between shapes, and creating random subsets within shapes for performance)
        //TODO - place letters closer inside (or move region walls out) so that letters dont pass thru walls on init or rounding error
        let letterBodies = this.spots.flat(1).map((spot, i) => {
            let cats = [0x1, 0x2, 0x4, 0x8];
            let cat = randSelect(cats);
            let colFilt = {mask: wallCat | cat, category: cat, group: -1};
            let body = Bodies.rectangle(spot.x, spot.y, letterSize.x*ls, letterSize.y*ls, {isStatic: true, collisionFilter: colFilt});
            this.spotToBodyMap[i] = {spot, body};
            this.matterBodies.push(body);
            return body;
        });
        World.add(this.matterWorld, letterBodies);
        
    }

    addPoint(p){
        this.points.push(p);
        this.updateInternalPoints();
    }

    letterDraw(){
        let spots = this.spots.flat(1).map((s, i) => ({i, s}));
        this.text = this.text.length < spots.length ? this.text.repeat(Math.ceil(spots.length/this.text.length)) : this.text;
        if(this.activeAnimation){
            let animationVal = this.activeAnimation.next();
            if(!animationVal.done) spots = animationVal.value;
        }

        if(drawLetters) {
            let txt = [];
            spots.flat(1).forEach((spot, i) => {
                let char = this.text[(spot.i+this.textIndex)%this.text.length];
                txt.push(char);
                textSize(this.sizeWarp(this.fontSize, i));
                let pos = this.posWarp(spot.s, i);
                text(char, pos.x, pos.y);
            });
        }    
    }

    updateFontSize(size){
        this.fontSize = fontSize;
        this.updateInternalPoints();
    }

    draw() {
        noFill();
        stroke(255);
        strokeWeight(cursorSize);
        if(drawBoundary) {
            if(this.active){
                if(this.grabbedPoint != null) this.drawWhileMovingPoint(); //want index-0 to be true
                else this.drawWhileAddingPoint()
            } else {
                beginShape();
                this.points.forEach(p => vertex(p.x, p.y));
                endShape(CLOSE);
            }
        }

        let center = createVector(0, 0);
        this.points.forEach(p =>{
            center.add(p);
        })

        fill(255);
        stroke(0);
        strokeWeight(0);

        if(drawIndex) {
            let numPts = this.points.length;


            textSize(24);
            text(this.id, center.x/numPts, center.y/numPts);
        }
        this.animationDraw();
    }

    fillDraw(){
        if(this.activeAnimation){
            let animationVal = this.activeAnimation.next();
            if(!animationVal.done) {
                let planeDraw = animationVal.value;
                planeDraw();
            }
        }
    }

    colorDraw(){
        fill(...this.color);
        beginShape();
        this.points.forEach(p => vertex(p.x, p.y));
        endShape(CLOSE);
    }
}

function randColor(){
   return [random(), random(), random()].map(r => r*256); 
}

function rangeWarp(openRange, sizeDiff, cycleTime){
    return function(fontSize, letterInd){
        try{
            let numLetters = this.spotsFlat.length;
            let start = Math.floor(((now()/cycleTime) %1) * numLetters);
            return start <= letterInd && letterInd <= start+openRange ? fontSize+sizeDiff : fontSize
        } catch {
            return fontSize
        }
    }
}

function vertSine(pos, i){
    try {
        let vec = {x: pos.x, y: pos.y+sinN(now()+i/3*PI)*20};
        return isPointInternal(vec, this, this.bbox) ? vec : pos;
    } catch{
        return pos;
    }
}

function rot(pos, i){
    let dev = 20;
    try {
        let vec = {x: pos.x+cosN(now()+i/3*PI)*dev, y: pos.y+sinN(now()+i/3*PI)*dev};
        return isPointInternal(vec, this, this.bbox) ? vec : pos;
    } catch{
        return pos;
    }
}

function setColors(c1, c2, dim=1){
    if(colors[c1] && colors[c2]){
        Object.keys(regions).forEach(k =>{
            if(k % 2 == 0) regions[k].color = colors[c1].map(c => c*dim)
            else regions[k].color = colors[c2].map(c => c*dim)
        })
    } else {
        console.log("nonexistent color")
    }
}

function getRegionDefs(){
    return Object.values(regions).map(r => {
      return {id: r.id, points: r.points.map(v => ({x: v.x, y: v.y})), color: r.color}
    })
}

function regionDefsToRegions(regionDefs){
    let newRegions = {}
    regionDefs.forEach(rd => {
        let region = new MaskRegion(rd.id);
        region.color = [255, 255, 255];
        region.points = rd.points.map(v => createVector(v.x, v.y))
        newRegions[rd.id] = region;
    })
    return newRegions
}

let markerVis = show => {drawBoundary = show; drawIndex = show};


function getScene(){
    let sceneList = []
    Object.values(regions).forEach(r =>{
        sceneList.push(r.lastGestureString);
    });
    return sceneList.join("\n");
}

/*todos
bug around one-line-at-a-time animation with waits - why is it phasing?
    - seems to be related to hitting the phase-sync button

phase hit button needs to send an OSC message from supercollider

need to add dleay functionality to allow one-time wait for easy phasing

need a higher level syntax that compiles down to the "low level" syntax
    - In particular - doing "one region at a time" animation is super tedious.
      Could make an alternate syntax where you have a "block" where some frames are
      active, and all other frames are implicitly waiting (or held at their last draw func)
*/