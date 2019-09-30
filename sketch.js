let regions = {};
let regionCount = 0;

function isAnythingActive(){
    return Object.values(regions).some(r => r.active);
}

function setup() {
  createCanvas(1000, 1000);
}

function draw() {
    ellipse(100, 100, 100)
}


//you have to explicitly EXIT some interaction state (grabbibg, drawing) before you can enter another
//this is enforced by code 
function keyPressed() {
    if(KEY === KEY_D){
        if(!isAnythingActive()) {
            let newRegion = new MaskRegion();
            newRegion.active = true;
            regions[regionCount++] = newRegion;
        }
    }
    if(KEY === KEY_F){
        Object.values(regions).forEach(r => {r.active = false});
    }
    if(KEY === KEY_G){
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

    if(KEY === KEY_P){
        let activeRegion = Object.values(regions).filter(r => r.active)[0];
        activeRegion.points[activeRegion.grabbedPoint] = {x: mouseX, y: mouseY};
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
        points.forEach(p => vertex(p.x, p.y));
        vertex(mouseX, mouseY);
        endShape();
        ellipse(mouseX, mouseY, 50);
    }

    drawWhileMovingPoint(){
        beginShape();
        points.forEach((p, i) => i === this.grabbedPoint ? vertex(mouseX, mouseY) : vertex(p.x, p.y));
        endShape();
        ellipse(mouseX, mouseY, 50);
    }

    draw(){
        if(this.active){
            if(this.grabbedPoint) drawWhileMovingPoint();
            else drawWhileAddingPoint()
        } else {
            beginShape();
            points.forEach(p => vertex(p.x, p.y));
            endShape();
        }
    }
}

