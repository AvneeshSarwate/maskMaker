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

let matterObjs = []; //{runner, world, engine}

let letterScale = 0.5; //scale down letter size to give them space to move

let meter;


function killRegion(ind){
    let matterStuff = matterObjs[ind];
    Matter.Runner.stop(matterStuff.runner);
    Matter.World.clear(matterStuff.world);
    Matter.Engine.clear(matterStuff.engine);

    delete regions[ind];
}

function isAnythingActive(){
    return Object.values(regions).some(r => r.active);
}

let font;

function setup() {
  createCanvas(1000, 1000);
  textFont("Courier New");
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
    if(key === "D"){
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
    if(key === "G"){
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

    if(key === "P"){
        let activeRegion = Object.values(regions).filter(r => r.active)[0];
        activeRegion.points[activeRegion.grabbedPoint] = createVector(mouseX, mouseY);
        activeRegion.updateInternalPoints();
        activeRegion.active = false;
        activeRegion.grabbedPoint = null;
        state = "Nothing active"
    }

}

function keyReleased() {

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
        this.text = text ? text : sampleText;
        this.matterWorld = null;
        this.matterLerp = 1;
        this.animationDraw = () => null;
        this.fontSize = 14;
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
            return Bodies.fromVertices(mid.x, mid.y, Matter.Vertices.fromPath(path), {isStatic: true, restitution: 0.9, collisionFilter});
        });
        World.add(this.matterWorld, walls);

        let words = this.text.split(" ").map(w => w+" ");
        let wordBodies = [];
        words.forEach((w, i) => {
            let pos = this.spots[this.wordPos[i].row][this.wordPos[i].col];
            let tw = textWidth(w, 14);
            let body = Matter.Bodies.rectangle(pos.x+tw/2, pos.y+letterSize.y/2, textWidth*letterScale, letterSize.y*letterScale);
            wordBodies.push(body)
        })
        World.add(this.matterWorld, wordBodies);
    }

    wordDraw() {
        let wordToPos = i => this.spots[this.wordPos[i].row][this.wordPos[i].col];
        if(this.activeAnimation){
            let animationVal = this.activeAnimation.next();
            if(!animationVal.done) wordToPos = i => animationVal.value[i];
        }

        let words = this.text.split(" ").map(w => w+" ");
        words.forEach((w, i) => {
            let pos = wordToPos(i);
            textSize(14);
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
        matterObjs.push({runner: this.matterRunner, world: this.matterWorld, engine: this.matterEngine});
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
            let randSelect = arr => arr[Math.floor(Math.random()*arr.length)];
            let cats = [0x1, 0x2, 0x4, 0x8];
            let cat = randSelect(cats);
            let colFilt = {mask: wallCat | cat, category: cat, group: 0-cat};
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
            spots.flat(1).forEach(spot => {
                let char = this.text[(spot.i+this.textIndex)%this.text.length];
                txt.push(char);
                textSize(this.fontSize);
                text(char, spot.s.x, spot.s.y);
            });
        }    
    }

    draw() {
        fill(0);
        stroke(255);
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
}

