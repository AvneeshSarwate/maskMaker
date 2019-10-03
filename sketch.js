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
    
    text(state, 10, 900);
}


//you have to explicitly EXIT some interaction state (grabbibg, drawing) before you can enter another
//this is enforced by code 
function keyPressed() {
    if(key === "D"){
        if(!isAnythingActive()) {
            let newRegion = new MaskRegion();
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
            region.points.push({x: mouseX, y: mouseY});
        }
    }
    if(key === "G"){
        let grabbedRegion, grabbedPointIndex;
        let closestPoint = {x: 10**5, y: 10**5};
        let mouseVec = {x: mouseX, y: mouseY};
        regions.forEach(id => {
            let region = regions[id];
            regions.points.forEach((p, i) => {
                if(distance(mouseVec, p) < distance(mouseVec, closestPoint)) {
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
        activeRegion.points[activeRegion.grabbedPoint] = vertex(mouseX, mouseY);
        activeRegion.active = false;
        activeRegion.grabbedPoint = null;
    }

}

function keyReleased() {

}

class MaskRegion {
    
    constructor(){
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
    }
}

