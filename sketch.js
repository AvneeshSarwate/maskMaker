let regions = {};
let regionCount = 0;
let state = "Nothing active";
let cursorSize = 10;

function isAnythingActive(){
    return Object.values(regions).some(r => r.active);
}

function setup() {
  createCanvas(1000, 1000);
}

function draw() {
    clear();

    noFill();
    strokeWeight(cursorSize);

    Object.values(regions).forEach(r => r.draw())
    
    fill(0);
    textSize(14);
    text(state, 10, 900);
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
            region.points.push(new createVector(mouseX, mouseY));
        }
    }
    if(key === "G"){
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
        grabbedRegion.active = true;
        grabbedRegion.grabbedPoint = grabbedPointIndex;
    }

    if(key === "P"){
        let activeRegion = Object.values(regions).filter(r => r.active)[0];
        activeRegion.points[activeRegion.grabbedPoint] = createVector(mouseX, mouseY);
        activeRegion.active = false;
        activeRegion.grabbedPoint = null;
    }

}

function keyReleased() {

}

class MaskRegion {
    
    constructor(id){
        this.id = id;
        this.active = false;
        this.grabbedPoint = null;
        this.points = [];
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

    draw(){
        if(this.active){
            if(this.grabbedPoint) this.drawWhileMovingPoint();
            else this.drawWhileAddingPoint()
        } else {
            beginShape();
            this.points.forEach(p => vertex(p.x, p.y));
            endShape(CLOSE);
        }

        let center = createVector(0, 0);
        this.points.forEach(p =>{
            center.add(p);
        })
        let numPts = this.points.length;

        fill(0);
        textSize(24);
        text(this.id, center.x/numPts, center.y/numPts);
        noFill();
    }
}

