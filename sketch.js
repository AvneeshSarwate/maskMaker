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


let letterScale = 0.5; //scale down letter size to give them space to move

let meter;

function isAnythingActive(){
    return Object.values(regions).some(r => r.active);
}

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

    if(useMatrix) {
        resetMatrix();
        applyMatrix(...matrixVal);
    }

    time = Date.now()/1000;

    noFill();
    strokeWeight(cursorSize);

    Object.values(regions).forEach(r => r.draw())
    
    fill(0);
    textSize(14);
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

    restoreBodies(){
        Object.values(this.spotToBodyMap).forEach(v => {
            let spot = v.spot;
            let body = v.body;
            Matter.Body.setPosition(body, spot);
        })
    }

    refreshBodies(){
        this.stopRunner();
        this.restoreBodies();
        this.startRunner();
    }

    updateMatterWorldFromSpots(){
        let Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Composites = Matter.Composites,
            Common = Matter.Common,
            MouseConstraint = Matter.MouseConstraint,
            Mouse = Matter.Mouse,
            World = Matter.World,
            Bodies = Matter.Bodies;

        // create engine
        let engine = Engine.create(),
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

        // create runner
        var runner = Runner.create();
        this.matterRunner = runner;
        Runner.run(runner, engine);

        this.matterWorld = world;

        //TODO - extend the ends of the lines out so they intersect and are closed
        let walls = this.points.map((spt, i, spts) => {
            let p1 = spt; 
            let p2 = spts[(i+1)%spts.length];
            let mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y+1)/2};
            let path = [p1.x, p1.y, p1.x+5, p1.y+5, p2.x+5, p2.y+5, p2.x, p2.y].join(" ");
            return Bodies.fromVertices(mid.x, mid.y, Matter.Vertices.fromPath(path), {isStatic: true, restitution: 0.9});
        });
        World.add(world, walls);

        this.spotToBodyMap = {};
        this.matterBodies = [];
        let ls = letterScale; 
        //TODO - collision filtering (both between shapes, and creating random subsets within shapes for performance)
        //TODO - place letters closer inside (or move region walls out) so that letters dont pass thru walls on init or rounding error
        let letterBodies = this.spots.flat(1).map((spot, i) => {
            let colFilt = {group: Math.random() < 0.5 ? 1 : 2}
            let body = Bodies.rectangle(spot.x, spot.y, letterSize.x*ls, letterSize.y*ls, {isStatic: true, collisionFilter: colFilt});
            this.spotToBodyMap[i] = {spot, body};
            this.matterBodies.push(body);
            return body;
        });
        World.add(world, letterBodies);
        
    }

    addPoint(p){
        this.points.push(p);
        this.updateInternalPoints();
    }

    draw() {
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

        if(drawIndex) {
            let numPts = this.points.length;

            fill(0);
            textSize(24);
            text(this.id, center.x/numPts, center.y/numPts);
            noFill();
        }

        let spots = this.spots.flat(1).map((s, i) => ({i, s}));
        if(this.activeAnimation){
            let animationVal = this.activeAnimation.next();
            if(!animationVal.done) spots = animationVal.value;
        }

        if(drawLetters) {
            let txt = [];
            spots.flat(1).forEach(spot => {
                let char = sampleText[(spot.i+this.textIndex)%this.text.length];
                txt.push(char);
                fill(0);
                textSize(14);
                text(char, spot.s.x, spot.s.y);
                noFill();
            });
        }    
    }
}

